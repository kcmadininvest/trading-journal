import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  marketReplayService,
  type AvailableTimeframe,
  type ReplayCandle,
} from '../services/marketReplay';
import {
  getVisibleCandles,
  pickReplayBaseTimeframe,
  ReplayEngine,
  type ReplayChartConfiguration,
  type VisibleCandle,
} from '../utils/replayEngine';
import { candleTimeToUnix, sessionDateToUtcRange } from '../utils/marketReplaySession';

const CHART_IDS = ['a', 'b', 'c', 'd'] as const;

export interface UseMarketReplayParams {
  instrument: string | null;
  sessionDate: string | null;
  /** Aligne la date de séance sur la dernière disponible (ex. pas de bougies « aujourd’hui »). */
  onSuggestSessionDate?: (sessionDate: string) => void;
}

function defaultTimeframePicks(available: AvailableTimeframe[]): string[] {
  const sorted = [...available].sort((a, b) => a.durationSeconds - b.durationSeconds);
  if (sorted.length === 0) return ['', '', '', ''];
  const picks = sorted.slice(0, 4).map((t) => t.value);
  while (picks.length < 4) picks.push(sorted[sorted.length - 1].value);
  return picks;
}

async function ensureSeries(
  instrument: string,
  sessionDate: string,
  timeframes: string[],
  existing: Record<string, ReplayCandle[]>,
): Promise<Record<string, ReplayCandle[]>> {
  const missing = timeframes.filter((tf) => !(tf in existing));
  if (missing.length === 0) return existing;
  const { start, end } = sessionDateToUtcRange(sessionDate);
  const res = await marketReplayService.getBars({
    instrument,
    timeframes: missing,
    start,
    end,
    contract: 'front',
  });
  return { ...existing, ...res.series };
}

export function useMarketReplay({
  instrument,
  sessionDate,
  onSuggestSessionDate,
}: UseMarketReplayParams) {
  const [availableTimeframes, setAvailableTimeframes] = useState<AvailableTimeframe[]>([]);
  const [paneTfs, setPaneTfs] = useState<(string | null)[]>([null, null, null, null]);
  const [seriesByTf, setSeriesByTf] = useState<Record<string, ReplayCandle[]>>({});
  const [loadingTfs, setLoadingTfs] = useState(false);
  const [loadingBars, setLoadingBars] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replayTimestamp, setReplayTimestamp] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [range, setRange] = useState<{ start: number; end: number } | null>(null);
  const [latestSessionDate, setLatestSessionDate] = useState<string | null>(null);
  const [sessionHasBars, setSessionHasBars] = useState<boolean | null>(null);

  const engineRef = useRef<ReplayEngine | null>(null);
  const seriesByTfRef = useRef(seriesByTf);
  seriesByTfRef.current = seriesByTf;
  const loadedWindowRef = useRef<string | null>(null);
  const sessionDateRef = useRef(sessionDate);
  sessionDateRef.current = sessionDate;
  const onSuggestSessionDateRef = useRef(onSuggestSessionDate);
  onSuggestSessionDateRef.current = onSuggestSessionDate;

  const tfByValue = useMemo(() => {
    const map = new Map<string, AvailableTimeframe>();
    for (const tf of availableTimeframes) map.set(tf.value, tf);
    return map;
  }, [availableTimeframes]);

  const chartConfigs: ReplayChartConfiguration[] = useMemo(() => {
    const configs: ReplayChartConfiguration[] = [];
    CHART_IDS.forEach((id, i) => {
      const value = paneTfs[i];
      const timeframe = value ? tfByValue.get(value) : undefined;
      if (timeframe) configs.push({ chartId: id, timeframe });
    });
    return configs;
  }, [paneTfs, tfByValue]);

  const baseTimeframe = useMemo(
    () => pickReplayBaseTimeframe(chartConfigs),
    [chartConfigs],
  );

  const rebuildEngine = useCallback(
    (symbol: string, startTs: number, endTs: number, charts: ReplayChartConfiguration[], keepTs?: number) => {
      engineRef.current?.dispose();
      if (!charts.length) {
        engineRef.current = null;
        return;
      }
      const engine = new ReplayEngine({
        symbol,
        startTimestamp: startTs,
        endTimestamp: endTs,
        charts,
      });
      engine.subscribe((ts) => setReplayTimestamp(ts));
      if (keepTs != null) engine.setTimestamp(keepTs);
      engineRef.current = engine;
      setReplayTimestamp(engine.replayTimestamp);
    },
    [],
  );

  // Instrument change: stop, clear, load timeframes
  useEffect(() => {
    let cancelled = false;
    engineRef.current?.dispose();
    engineRef.current = null;
    setPlaying(false);
    setSeriesByTf({});
    loadedWindowRef.current = null;
    setRange(null);
    setReplayTimestamp(0);
    setLatestSessionDate(null);
    setSessionHasBars(null);

    if (!instrument) {
      setAvailableTimeframes([]);
      setPaneTfs([null, null, null, null]);
      return;
    }

    setLoadingTfs(true);
    setError(null);
    marketReplayService
      .getInstrumentReplayMeta(instrument)
      .then((meta) => {
        if (cancelled) return;
        setAvailableTimeframes(meta.timeframes);
        setLatestSessionDate(meta.latestSessionDate);
        setPaneTfs(defaultTimeframePicks(meta.timeframes));
        const currentSessionDate = sessionDateRef.current;
        if (
          meta.latestSessionDate &&
          currentSessionDate &&
          currentSessionDate > meta.latestSessionDate
        ) {
          onSuggestSessionDateRef.current?.(meta.latestSessionDate);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || 'Erreur timeframes');
      })
      .finally(() => {
        if (!cancelled) setLoadingTfs(false);
      });

    return () => {
      cancelled = true;
    };
  }, [instrument]);

  const chartConfigKey = paneTfs.join('|');

  // Load / refresh bars when date or selected TFs change
  useEffect(() => {
    let cancelled = false;
    if (!instrument || !sessionDate || chartConfigs.length === 0 || !baseTimeframe) {
      return;
    }

    const needed = [
      ...new Set([...chartConfigs.map((c) => c.timeframe.value), baseTimeframe.value]),
    ];
    const { start, end } = sessionDateToUtcRange(sessionDate);
    const startTs = candleTimeToUnix(start);
    const endTs = candleTimeToUnix(end);
    const chartsSnapshot = chartConfigs;
    const windowKey = `${instrument}|${sessionDate}`;
    const cache =
      loadedWindowRef.current === windowKey ? seriesByTfRef.current : {};

    setLoadingBars(true);
    setError(null);

    ensureSeries(instrument, sessionDate, needed, cache)
      .then((merged) => {
        if (cancelled) return;
        const sameWindow = loadedWindowRef.current === windowKey;
        loadedWindowRef.current = windowKey;
        setSeriesByTf(merged);
        const hasBars = needed.some((tf) => (merged[tf]?.length ?? 0) > 0);
        setSessionHasBars(hasBars);
        setRange({ start: startTs, end: endTs });
        // Ne conserver le curseur que si on reste sur la même séance (ex. changement de TF).
        // Sinon repartir du début — sinon un ancien timestamp clampé à endTs révèle toute la journée.
        const keep = sameWindow ? engineRef.current?.replayTimestamp : undefined;
        rebuildEngine(instrument, startTs, endTs, chartsSnapshot, keep);
        setPlaying(false);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || 'Erreur chargement bars');
      })
      .finally(() => {
        if (!cancelled) setLoadingBars(false);
      });

    return () => {
      cancelled = true;
    };
    // chartConfigKey stabilise les 4 TF sélectionnés
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instrument, sessionDate, chartConfigKey, baseTimeframe?.value, rebuildEngine]);

  const changePaneTimeframe = useCallback((chartId: string, timeframeValue: string) => {
    const idx = CHART_IDS.indexOf(chartId as (typeof CHART_IDS)[number]);
    if (idx < 0) return;
    setPaneTfs((prev) => {
      const next = [...prev];
      next[idx] = timeframeValue;
      return next;
    });
  }, []);

  const visibleByChart = useMemo(() => {
    const out: Record<string, VisibleCandle[]> = {};
    for (const id of CHART_IDS) out[id] = [];
    if (!replayTimestamp) return out;
    for (const cfg of chartConfigs) {
      const series = seriesByTf[cfg.timeframe.value] || [];
      const baseSeries = baseTimeframe ? seriesByTf[baseTimeframe.value] : undefined;
      out[cfg.chartId] = getVisibleCandles(
        series,
        cfg.timeframe,
        replayTimestamp,
        baseSeries,
        baseTimeframe,
      );
    }
    return out;
  }, [chartConfigs, seriesByTf, replayTimestamp, baseTimeframe]);

  const lastPrice = useMemo(() => {
    if (!baseTimeframe || !replayTimestamp) return null;
    const candles = getVisibleCandles(
      seriesByTf[baseTimeframe.value] || [],
      baseTimeframe,
      replayTimestamp,
      seriesByTf[baseTimeframe.value],
      baseTimeframe,
    );
    if (!candles.length) return null;
    return candles[candles.length - 1].close;
  }, [baseTimeframe, seriesByTf, replayTimestamp]);

  const playPause = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    if (eng.playing) {
      eng.pause();
      setPlaying(false);
    } else {
      eng.setSpeed(speed);
      eng.play();
      setPlaying(true);
    }
  }, [speed]);

  const stepForward = useCallback(() => engineRef.current?.stepForward(), []);
  const stepBackward = useCallback(() => engineRef.current?.stepBackward(), []);
  const goStart = useCallback(() => engineRef.current?.goToStart(), []);
  const goEnd = useCallback(() => engineRef.current?.goToEnd(), []);
  const reset = useCallback(() => {
    engineRef.current?.reset();
    setPlaying(false);
  }, []);
  const seek = useCallback((ts: number) => engineRef.current?.setTimestamp(ts), []);
  const changeSpeed = useCallback((s: number) => {
    setSpeed(s);
    engineRef.current?.setSpeed(s);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const eng = engineRef.current;
      if (eng && playing && !eng.playing) setPlaying(false);
    }, 250);
    return () => clearInterval(id);
  }, [playing]);

  useEffect(() => () => engineRef.current?.dispose(), []);

  return {
    availableTimeframes,
    paneTfs,
    chartIds: CHART_IDS,
    visibleByChart,
    loading: loadingTfs || loadingBars,
    error,
    replayTimestamp,
    playing,
    speed,
    range,
    baseTimeframe,
    lastPrice,
    latestSessionDate,
    sessionHasBars,
    changePaneTimeframe,
    playPause,
    stepForward,
    stepBackward,
    goStart,
    goEnd,
    reset,
    seek,
    changeSpeed,
  };
}
