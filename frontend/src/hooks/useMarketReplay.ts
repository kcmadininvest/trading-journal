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
  disciplined?: boolean;
  restoredTimestamp?: number;
  restoredPaneTfs?: (string | null)[];
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
  timeframes: string[],
  existing: Record<string, ReplayCandle[]>,
  start: string,
  end: string,
): Promise<Record<string, ReplayCandle[]>> {
  const missing = timeframes.filter((tf) => !(tf in existing));
  if (missing.length === 0) return existing;
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
  disciplined = false,
  restoredTimestamp,
  restoredPaneTfs,
  onSuggestSessionDate,
}: UseMarketReplayParams) {
  const [availableTimeframes, setAvailableTimeframes] = useState<AvailableTimeframe[]>([]);
  const [currentSessionTfs, setCurrentSessionTfs] = useState<string[] | null>(null);
  const [requestedPaneTfs, setRequestedPaneTfs] = useState<(string | null)[]>([null, null, null, null]);
  const [paneTfs, setPaneTfs] = useState<(string | null)[]>([null, null, null, null]);
  const [switchedTimeframes, setSwitchedTimeframes] = useState<Record<string, { requested: string; fallback: string } | null>>({});
  const [seriesByTf, setSeriesByTf] = useState<Record<string, ReplayCandle[]>>({});
  const [loadingTfs, setLoadingTfs] = useState(false);
  const [loadingBars, setLoadingBars] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replayTimestamp, setReplayTimestamp] = useState(0);
  const [furthestTimestamp, setFurthestTimestamp] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [range, setRange] = useState<{ start: number; end: number } | null>(null);
  const [latestSessionDate, setLatestSessionDate] = useState<string | null>(null);
  const [sessionHasBars, setSessionHasBars] = useState<boolean | null>(null);
  const [availableSessions, setAvailableSessions] = useState<string[]>([]);
  const [sessionRange, setSessionRange] = useState<{ start: string; end: string } | null>(null);

  const engineRef = useRef<ReplayEngine | null>(null);
  const seriesByTfRef = useRef(seriesByTf);
  seriesByTfRef.current = seriesByTf;
  const loadedWindowRef = useRef<string | null>(null);
  const restoreCursorConsumedRef = useRef(false);
  const sessionDateRef = useRef(sessionDate);
  sessionDateRef.current = sessionDate;
  const onSuggestSessionDateRef = useRef(onSuggestSessionDate);
  onSuggestSessionDateRef.current = onSuggestSessionDate;
  const currentSessionTfsRef = useRef(currentSessionTfs);
  currentSessionTfsRef.current = currentSessionTfs;
  const sessionTfRequestIdRef = useRef(0);
  const barsRequestIdRef = useRef(0);

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
      engine.subscribe((ts) => {
        setReplayTimestamp(ts);
        setFurthestTimestamp((current) => Math.max(current, ts));
      });
      if (keepTs != null) engine.setTimestamp(keepTs);
      engineRef.current = engine;
      setReplayTimestamp(engine.replayTimestamp);
    },
    [],
  );

  // Instrument change: stop, clear, load timeframes + available sessions
  useEffect(() => {
    let cancelled = false;
    engineRef.current?.dispose();
    engineRef.current = null;
    setPlaying(false);
    setSeriesByTf({});
    loadedWindowRef.current = null;
    setRange(null);
    setReplayTimestamp(0);
    setFurthestTimestamp(0);
    setLatestSessionDate(null);
    setSessionHasBars(null);
    setAvailableSessions([]);
    setCurrentSessionTfs(null);
    setSessionRange(null);
    setSwitchedTimeframes({});
    restoreCursorConsumedRef.current = false;

    if (!instrument) {
      setAvailableTimeframes([]);
      setRequestedPaneTfs([null, null, null, null]);
      setPaneTfs([null, null, null, null]);
      return;
    }

    setLoadingTfs(true);
    setError(null);
    marketReplayService
      .getInstrumentReplayMeta(instrument)
      .then(async (meta) => {
        if (cancelled) return;
        setAvailableTimeframes(meta.timeframes);
        setLatestSessionDate(meta.latestSessionDate);
        const valid = new Set(meta.timeframes.map((tf) => tf.value));
        const restored = restoredPaneTfs?.slice(0, 4).map((tf) => (tf && valid.has(tf) ? tf : null));
        const initialPaneTfs = restored?.some(Boolean)
          ? restored
          : defaultTimeframePicks(meta.timeframes);
        setRequestedPaneTfs(initialPaneTfs);
        setPaneTfs(initialPaneTfs);

        let sessions: string[] = [];
        let latestFromSessions: string | null = meta.latestSessionDate;
        try {
          const payload = await marketReplayService.getAvailableSessions(instrument, {
            timeframe: '',
            contract: 'front',
          });
          if (cancelled) return;
          sessions = payload.sessions || [];
          setAvailableSessions(sessions);
          if (payload.latest) {
            latestFromSessions = payload.latest;
            setLatestSessionDate(payload.latest);
          }
        } catch {
          if (!cancelled) setAvailableSessions([]);
        }

        const currentSessionDate = sessionDateRef.current;
        const suggestDate =
          sessions.length > 0
            ? latestFromSessions
            : meta.latestSessionDate;
        if (
          suggestDate &&
          currentSessionDate &&
          (sessions.length > 0
            ? !sessions.includes(currentSessionDate)
            : currentSessionDate > suggestDate)
        ) {
          onSuggestSessionDateRef.current?.(suggestDate);
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
  }, [instrument, restoredPaneTfs]);

  const chartConfigKey = paneTfs.join('|');

  // Fetch available timeframes + UTC bounds for the current session
  useEffect(() => {
    if (!instrument || !sessionDate) {
      setCurrentSessionTfs(null);
      setSessionRange(null);
      return;
    }
    const requestId = ++sessionTfRequestIdRef.current;
    setCurrentSessionTfs(null);
    setSessionRange(null);
    setFurthestTimestamp(0);
    marketReplayService
      .getSessionTimeframes(instrument, sessionDate, { contract: 'front' })
      .then((payload) => {
        if (requestId !== sessionTfRequestIdRef.current) return;
        setCurrentSessionTfs(payload.timeframes);
        if (payload.start_utc && payload.end_utc) {
          setSessionRange({ start: payload.start_utc, end: payload.end_utc });
        } else {
          const fallback = sessionDateToUtcRange(sessionDate);
          setSessionRange(fallback);
        }
        if (payload.timeframes.length === 0) {
          setSessionHasBars(false);
        }
      })
      .catch((err: Error) => {
        if (requestId !== sessionTfRequestIdRef.current) return;
        setError(err.message || 'Erreur timeframes de séance');
        setCurrentSessionTfs(null);
        setSessionRange(null);
      });
  }, [instrument, sessionDate]);

  // Validate requested pane timeframes against what is actually stored for the session
  useEffect(() => {
    if (!currentSessionTfs) {
      setSwitchedTimeframes({});
      return;
    }
    const validSet = new Set(currentSessionTfs);
    const fallback = currentSessionTfs[0];
    if (!fallback) {
      setPaneTfs([null, null, null, null]);
      setSwitchedTimeframes({});
      return;
    }
    const switched: Record<string, { requested: string; fallback: string } | null> = {};
    const next = requestedPaneTfs.map((tf, i) => {
      if (tf && validSet.has(tf)) return tf;
      const chartId = CHART_IDS[i];
      if (tf && chartId) {
        switched[chartId] = { requested: tf, fallback };
      }
      return fallback;
    });
    setPaneTfs(next);
    setSwitchedTimeframes(switched);
  }, [currentSessionTfs, requestedPaneTfs]);

  // Load / refresh bars when date or selected TFs change (bornes backend).
  useEffect(() => {
    if (!instrument || !sessionDate || chartConfigs.length === 0 || !baseTimeframe || !sessionRange) {
      return;
    }
    const requestId = ++barsRequestIdRef.current;

    const needed = [
      ...new Set([...chartConfigs.map((c) => c.timeframe.value), baseTimeframe.value]),
    ];
    const { start, end } = sessionRange;
    const startTs = candleTimeToUnix(start);
    const endTs = candleTimeToUnix(end);
    const chartsSnapshot = chartConfigs;
    const windowKey = `${instrument}|${sessionDate}`;
    const cache =
      loadedWindowRef.current === windowKey ? seriesByTfRef.current : {};

    setLoadingBars(true);
    setError(null);

    ensureSeries(instrument, needed, cache, start, end)
      .then((merged) => {
        if (requestId !== barsRequestIdRef.current) return;
        const sameWindow = loadedWindowRef.current === windowKey;
        loadedWindowRef.current = windowKey;
        setSeriesByTf(merged);
        const hasBars = needed.some((tf) => (merged[tf]?.length ?? 0) > 0);
        if (currentSessionTfsRef.current) {
          setSessionHasBars(hasBars);
        }
        setRange({ start: startTs, end: endTs });
        // Restaurer le curseur une seule fois au bootstrap, jamais après un
        // changement d'instrument/séance (évite de révéler une autre journée).
        let restored: number | undefined;
        if (
          !sameWindow &&
          !restoreCursorConsumedRef.current &&
          restoredTimestamp != null &&
          restoredTimestamp >= startTs &&
          restoredTimestamp <= endTs
        ) {
          restored = restoredTimestamp;
        }
        if (!sameWindow) {
          restoreCursorConsumedRef.current = true;
        }
        const baseSeries = merged[baseTimeframe.value];
        const firstBaseBarTs = baseSeries && baseSeries.length > 0 ? candleTimeToUnix(baseSeries[0].t) : startTs;
        const startCursorTs = firstBaseBarTs;
        const keep = sameWindow ? engineRef.current?.replayTimestamp : (restored ?? startCursorTs);
        rebuildEngine(instrument, startTs, endTs, chartsSnapshot, keep);
        setPlaying(false);
      })
      .catch((err: Error) => {
        if (requestId !== barsRequestIdRef.current) return;
        setError(err.message || 'Erreur chargement bars');
      })
      .finally(() => {
        if (requestId === barsRequestIdRef.current) {
          setLoadingBars(false);
        }
      });
    // chartConfigKey stabilise les 4 TF sélectionnés.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instrument, sessionDate, sessionRange, chartConfigKey, baseTimeframe?.value, rebuildEngine]);

  const changePaneTimeframe = useCallback((chartId: string, timeframeValue: string) => {
    const idx = CHART_IDS.indexOf(chartId as (typeof CHART_IDS)[number]);
    if (idx < 0) return;
    setRequestedPaneTfs((prev) => {
      const next = [...prev];
      next[idx] = timeframeValue;
      return next;
    });
    setPaneTfs((prev) => {
      const next = [...prev];
      next[idx] = timeframeValue;
      return next;
    });
    setSwitchedTimeframes((prev) => {
      if (!prev[chartId]) return prev;
      const next = { ...prev };
      delete next[chartId];
      return next;
    });
  }, []);

  const sessionAvailableTimeframes = useMemo(() => {
    if (!currentSessionTfs) return availableTimeframes;
    const valid = new Set(currentSessionTfs);
    return availableTimeframes.filter((tf) => valid.has(tf.value));
  }, [availableTimeframes, currentSessionTfs]);

  // Met à jour sessionHasBars une fois les TF connus, sans flash « vide »
  // pendant le chargement des barres.
  useEffect(() => {
    if (!currentSessionTfs) return;
    if (currentSessionTfs.length === 0) {
      setSessionHasBars(false);
      return;
    }
    const needed = chartConfigs.map((c) => c.timeframe.value);
    if (needed.length === 0) return;
    const hasBars = needed.some((tf) => (seriesByTf[tf]?.length ?? 0) > 0);
    if (hasBars) {
      setSessionHasBars(true);
      return;
    }
    // Pas encore de séries pour ces TF, ou load en cours → ne pas afficher « vide ».
    if (loadingBars) return;
    const seriesReady = needed.every((tf) => tf in seriesByTf);
    if (!seriesReady) return;
    setSessionHasBars(false);
  }, [currentSessionTfs, chartConfigs, seriesByTf, loadingBars]);

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
  const stepBackward = useCallback(() => {
    if (!disciplined) engineRef.current?.stepBackward();
  }, [disciplined]);
  const goStart = useCallback(() => {
    if (!disciplined) engineRef.current?.goToStart();
  }, [disciplined]);
  const goEnd = useCallback(() => {
    if (!disciplined) engineRef.current?.goToEnd();
  }, [disciplined]);
  const reset = useCallback(() => {
    if (disciplined) return;
    engineRef.current?.reset();
    setPlaying(false);
  }, [disciplined]);
  const seek = useCallback((ts: number) => {
    if (disciplined && ts < replayTimestamp) return;
    if (disciplined && furthestTimestamp > 0 && ts > furthestTimestamp) return;
    engineRef.current?.setTimestamp(ts);
  }, [disciplined, replayTimestamp, furthestTimestamp]);
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
    sessionAvailableTimeframes,
    switchedTimeframes,
    paneTfs,
    requestedPaneTfs,
    chartIds: CHART_IDS,
    visibleByChart,
    loading: loadingTfs || loadingBars,
    error,
    replayTimestamp,
    furthestTimestamp,
    playing,
    speed,
    range,
    baseTimeframe,
    lastPrice,
    latestSessionDate,
    sessionHasBars,
    availableSessions,
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
