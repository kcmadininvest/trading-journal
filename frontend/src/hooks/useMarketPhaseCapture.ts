import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePreferences } from './usePreferences';
import {
  marketPhasesService,
  MarketPhaseBlock,
  MarketPhaseDefinition,
  MarketPhaseEvent,
  MarketInstrument,
  MarketPhaseSlotConfig,
} from '../services/marketPhases';
import { toIsoCalendarDateInTimezone } from '../utils/dateFormat';
import {
  marketPhaseEventKey,
  removeMarketPhaseEvent,
} from '../utils/marketPhaseEventDisplay';

export interface UseMarketPhaseCaptureOptions {
  tradingAccountId?: number;
  sessionDate?: string;
  instrumentKey?: string;
  source?: 'live' | 'replay';
  tradingSessionId?: number;
}

export function nowTimeInTz(timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const h = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const m = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${h}:${m}`;
}

export function useMarketPhaseCapture({
  tradingAccountId,
  sessionDate,
  instrumentKey: instrumentKeyProp,
  source = 'live',
  tradingSessionId,
}: UseMarketPhaseCaptureOptions) {
  const { preferences } = usePreferences();
  const [phases, setPhases] = useState<MarketPhaseDefinition[]>([]);
  const [instruments, setInstruments] = useState<MarketInstrument[]>([]);
  const [slotConfig, setSlotConfig] = useState<MarketPhaseSlotConfig | null>(null);
  const [instrumentKey, setInstrumentKey] = useState(instrumentKeyProp || 'nasdaq');
  const [blocks, setBlocks] = useState<MarketPhaseBlock[]>([]);
  const [orphanEvents, setOrphanEvents] = useState<MarketPhaseEvent[]>([]);
  const [selectedPhase, setSelectedPhase] = useState('consolidation');
  const [precedingContext, setPrecedingContext] = useState('none');
  const [openBlockStart, setOpenBlockStart] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastRecordedEvent, setLastRecordedEvent] = useState<MarketPhaseEvent | null>(null);
  const [selectedEventKey, setSelectedEventKey] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveDate = sessionDate || toIsoCalendarDateInTimezone(new Date(), preferences.timezone);

  const loadMeta = useCallback(async () => {
    const [p, inst, cfg] = await Promise.all([
      marketPhasesService.getPhaseDefinitions(),
      marketPhasesService.getInstruments(tradingAccountId),
      marketPhasesService.getSlotConfig().catch(() => null),
    ]);
    setPhases(p);
    const list = inst.instruments;
    setInstruments(list);
    setSlotConfig(cfg);
    setInstrumentKey((current) => {
      const keys = list.map((i) => i.key);
      if (instrumentKeyProp && keys.includes(instrumentKeyProp)) return instrumentKeyProp;
      if (keys.includes(current)) return current;
      const preferred = cfg?.default_instrument_key;
      if (preferred && keys.includes(preferred)) return preferred;
      return keys[0] || current;
    });
  }, [instrumentKeyProp, tradingAccountId]);

  const loadCapture = useCallback(async () => {
    if (!tradingAccountId) return;
    const data = await marketPhasesService.getCapture({
      session_date: effectiveDate,
      trading_account: tradingAccountId,
      instrument_key: instrumentKey,
    });
    setBlocks(data.blocks);
    setOrphanEvents(data.orphan_events);
    setSelectedEventKey(null);
    const open = data.blocks.find((b) => !b.range_end);
    setOpenBlockStart(open?.range_start ?? null);
  }, [tradingAccountId, effectiveDate, instrumentKey]);

  useEffect(() => {
    loadMeta().catch(() => undefined);
  }, [loadMeta]);

  useEffect(() => {
    loadCapture().catch(() => undefined);
  }, [loadCapture]);

  const allEvents = useMemo(() => {
    const nested = blocks.flatMap((b) => b.events || []);
    return [...nested, ...orphanEvents].sort((a, b) =>
      (a.occurred_at || '').localeCompare(b.occurred_at || ''),
    );
  }, [blocks, orphanEvents]);

  const persist = useCallback(
    (nextBlocks: MarketPhaseBlock[], nextEvents: MarketPhaseEvent[]) => {
      if (!tradingAccountId) return;
      setBlocks(nextBlocks);
      setSaveState('saving');
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await marketPhasesService.bulkCapture({
            session_date: effectiveDate,
            trading_account: tradingAccountId,
            instrument_key: instrumentKey,
            source,
            trading_session: tradingSessionId ?? null,
            blocks: nextBlocks,
            events: nextEvents,
          });
          setSaveState('saved');
          await loadCapture();
        } catch {
          setSaveState('idle');
        }
      }, 500);
    },
    [tradingAccountId, effectiveDate, instrumentKey, source, tradingSessionId, loadCapture],
  );

  const handleStartBlock = useCallback(() => {
    const start = nowTimeInTz(preferences.timezone);
    setOpenBlockStart(start);
    const newBlock: MarketPhaseBlock = {
      instrument_key: instrumentKey,
      range_start: start,
      range_end: null,
      phase_code: selectedPhase,
      preceding_context: precedingContext,
      source,
    };
    const next = [...blocks.filter((b) => b.range_end), newBlock];
    persist(next, allEvents);
  }, [preferences.timezone, instrumentKey, selectedPhase, precedingContext, source, blocks, allEvents, persist]);

  const handleCloseBlock = useCallback(() => {
    if (!openBlockStart) return;
    const end = nowTimeInTz(preferences.timezone);
    const next = blocks.map((b) =>
      !b.range_end && b.range_start === openBlockStart ? { ...b, range_end: end } : b,
    );
    setOpenBlockStart(null);
    persist(next, allEvents);
  }, [openBlockStart, preferences.timezone, blocks, allEvents, persist]);

  const handleQuickEvent = useCallback(
    (eventCode: string, direction: string, candlePart: string, outcome: string, at?: string) => {
      const occurredAt = at ?? nowTimeInTz(preferences.timezone);
      const ev: MarketPhaseEvent = {
        occurred_at: occurredAt,
        event_type_code: eventCode,
        direction,
        candle_part: candlePart,
        outcome,
        source,
      };
      setLastRecordedEvent(ev);
      setSelectedEventKey(marketPhaseEventKey(ev));
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      feedbackTimer.current = setTimeout(() => setLastRecordedEvent(null), 4000);
      persist(blocks, [...allEvents, ev]);
    },
    [preferences.timezone, source, blocks, allEvents, persist],
  );

  const handleSelectEvent = useCallback((ev: MarketPhaseEvent) => {
    const key = marketPhaseEventKey(ev);
    setSelectedEventKey((current) => (current === key ? null : key));
  }, []);

  const handleRemoveEvent = useCallback(
    (ev: MarketPhaseEvent) => {
      const next = removeMarketPhaseEvent(allEvents, ev);
      setSelectedEventKey(null);
      setLastRecordedEvent(null);
      persist(blocks, next);
    },
    [allEvents, blocks, persist],
  );

  const setBlocksAndPersist = useCallback(
    (nextBlocks: MarketPhaseBlock[], nextEvents?: MarketPhaseEvent[]) => {
      persist(nextBlocks, nextEvents ?? allEvents);
    },
    [allEvents, persist],
  );

  return {
    phases,
    instruments,
    slotConfig,
    instrumentKey,
    setInstrumentKey,
    blocks,
    setBlocks,
    orphanEvents,
    selectedPhase,
    setSelectedPhase,
    precedingContext,
    setPrecedingContext,
    openBlockStart,
    saveState,
    effectiveDate,
    allEvents,
    loadCapture,
    persist,
    setBlocksAndPersist,
    handleStartBlock,
    handleCloseBlock,
    handleQuickEvent,
    handleSelectEvent,
    handleRemoveEvent,
    selectedEventKey,
    lastRecordedEvent,
  };
}
