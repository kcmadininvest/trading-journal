import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePreferences } from './usePreferences';
import {
  marketPhasesService,
  MarketPhaseBlock,
  MarketPhaseDefinition,
  MarketPhaseEvent,
  MarketInstrument,
} from '../services/marketPhases';
import { toIsoCalendarDateInTimezone } from '../utils/dateFormat';
import {
  marketPhaseEventKey,
  removeMarketPhaseEvent,
} from '../utils/marketPhaseEventDisplay';
import {
  appendMarketPhaseEvent,
  eventBelongsToBlock,
  nextDistinctEventTime,
  pruneToExclusiveEventPerBlock,
  toggleExclusiveSlotEvent,
} from '../utils/marketPhaseEventCapture';

export interface UseMarketPhaseCaptureOptions {
  tradingAccountId?: number;
  sessionDate?: string;
  instrumentKey?: string;
  source?: 'live' | 'replay';
  tradingSessionId?: number;
}

/** Projette les événements sur les blocs pour un affichage immédiat (avant retour API). */
function projectEventsOntoBlocks(
  blocks: MarketPhaseBlock[],
  events: MarketPhaseEvent[],
): { blocks: MarketPhaseBlock[]; orphans: MarketPhaseEvent[] } {
  const assigned = new Set<string>();
  const nextBlocks = blocks.map((block) => {
    const blockEvents = events.filter((ev) => {
      const key = marketPhaseEventKey(ev);
      if (assigned.has(key)) return false;
      if (!eventBelongsToBlock(ev.occurred_at, block)) return false;
      assigned.add(key);
      return true;
    });
    return { ...block, events: blockEvents };
  });
  const orphans = events.filter((ev) => !assigned.has(marketPhaseEventKey(ev)));
  return { blocks: nextBlocks, orphans };
}

function flattenCaptureEvents(data: {
  blocks: MarketPhaseBlock[];
  orphan_events: MarketPhaseEvent[];
}): MarketPhaseEvent[] {
  return [...data.blocks.flatMap((b) => b.events || []), ...data.orphan_events];
}

/** Applique la règle « 1 événement max par bloc » aux données API. */
function normalizeExclusiveCapture(data: {
  blocks: MarketPhaseBlock[];
  orphan_events: MarketPhaseEvent[];
}): {
  blocks: MarketPhaseBlock[];
  orphanEvents: MarketPhaseEvent[];
  events: MarketPhaseEvent[];
  pruned: boolean;
} {
  const flat = flattenCaptureEvents(data);
  const { events, pruned } = pruneToExclusiveEventPerBlock(data.blocks, flat);
  const projected = projectEventsOntoBlocks(
    data.blocks.map((block) => ({ ...block, events: [] })),
    events,
  );
  return {
    blocks: projected.blocks,
    orphanEvents: projected.orphans,
    events,
    pruned,
  };
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
  const [instrumentKey, setInstrumentKey] = useState(instrumentKeyProp || 'nasdaq');
  const [blocks, setBlocks] = useState<MarketPhaseBlock[]>([]);
  const [orphanEvents, setOrphanEvents] = useState<MarketPhaseEvent[]>([]);
  const [selectedPhase, setSelectedPhase] = useState('consolidation');
  const [precedingContext, setPrecedingContext] = useState('none');
  const [openBlockStart, setOpenBlockStart] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [selectedEventKey, setSelectedEventKey] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Invalide les GET / captures en vol pour ne pas écraser une saisie locale (ex. 1ère phase). */
  const captureRequestId = useRef(0);

  const effectiveDate = sessionDate || toIsoCalendarDateInTimezone(new Date(), preferences.timezone);

  const loadMeta = useCallback(async () => {
    const [p, inst] = await Promise.all([
      marketPhasesService.getPhaseDefinitions(),
      marketPhasesService.getInstruments(tradingAccountId),
    ]);
    setPhases(p);
    const list = inst.instruments;
    setInstruments(list);
    setInstrumentKey((current) => {
      const keys = list.map((i) => i.key);
      if (instrumentKeyProp && keys.includes(instrumentKeyProp)) return instrumentKeyProp;
      if (keys.includes(current)) return current;
      return keys[0] || current;
    });
  }, [instrumentKeyProp, tradingAccountId]);

  const loadCapture = useCallback(async () => {
    if (!tradingAccountId) return;
    const requestId = ++captureRequestId.current;
    const data = await marketPhasesService.getCapture({
      session_date: effectiveDate,
      trading_account: tradingAccountId,
      instrument_key: instrumentKey,
    });
    if (requestId !== captureRequestId.current) return;
    const normalized = normalizeExclusiveCapture(data);
    setBlocks(normalized.blocks);
    setOrphanEvents(normalized.orphanEvents);
    setSelectedEventKey(null);
    const open = normalized.blocks.find((b) => !b.range_end);
    setOpenBlockStart(open?.range_start ?? null);
    if (normalized.pruned) {
      const saveId = ++captureRequestId.current;
      try {
        await marketPhasesService.bulkCapture({
          session_date: effectiveDate,
          trading_account: tradingAccountId,
          instrument_key: instrumentKey,
          source,
          trading_session: tradingSessionId ?? null,
          blocks: normalized.blocks,
          events: normalized.events,
        });
        if (saveId !== captureRequestId.current) return;
      } catch {
        // garde l’état local déjà normalisé
      }
    }
  }, [tradingAccountId, effectiveDate, instrumentKey, source, tradingSessionId]);

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
      // Annule tout GET en cours : sinon le chargement initial peut réinitialiser la 1ʳᵉ saisie.
      const requestId = ++captureRequestId.current;
      const projected = projectEventsOntoBlocks(nextBlocks, nextEvents);
      setBlocks(projected.blocks);
      setOrphanEvents(projected.orphans);
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
          if (requestId !== captureRequestId.current) return;
          setSaveState('saved');
          const data = await marketPhasesService.getCapture({
            session_date: effectiveDate,
            trading_account: tradingAccountId,
            instrument_key: instrumentKey,
          });
          if (requestId !== captureRequestId.current) return;
          const normalized = normalizeExclusiveCapture(data);
          setBlocks(normalized.blocks);
          setOrphanEvents(normalized.orphanEvents);
          const open = normalized.blocks.find((b) => !b.range_end);
          setOpenBlockStart(open?.range_start ?? null);
        } catch {
          if (requestId === captureRequestId.current) {
            setSaveState('idle');
          }
        }
      }, 500);
    },
    [tradingAccountId, effectiveDate, instrumentKey, source, tradingSessionId],
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
      const preferred = at ?? nowTimeInTz(preferences.timezone);
      const targetBlock = blocks.find((block) => eventBelongsToBlock(preferred, block));
      const siblingTimes = targetBlock
        ? allEvents
            .filter((existing) => eventBelongsToBlock(existing.occurred_at, targetBlock))
            .map((existing) => existing.occurred_at)
        : allEvents.map((existing) => existing.occurred_at);
      const occurredAt = nextDistinctEventTime(
        preferred,
        siblingTimes,
        targetBlock?.range_end ?? null,
      );
      const ev: MarketPhaseEvent = {
        occurred_at: occurredAt,
        event_type_code: eventCode,
        direction,
        candle_part: candlePart,
        outcome,
        source,
      };
      const nextEvents = appendMarketPhaseEvent(allEvents, ev, blocks);
      setSelectedEventKey(marketPhaseEventKey(ev));
      persist(blocks, nextEvents);
    },
    [preferences.timezone, source, blocks, allEvents, persist],
  );

  /**
   * Sélection exclusive sur une tranche : un clic sélectionne ; reclic annule ;
   * clic sur un autre remplace l’événement précédent.
   */
  const handleToggleExclusiveEvent = useCallback(
    (
      eventCode: string,
      direction: string,
      candlePart: string,
      outcome: string,
      slotEvents: MarketPhaseEvent[],
      at?: string,
    ) => {
      const preferred = at ?? nowTimeInTz(preferences.timezone);
      const candidateStub: MarketPhaseEvent = {
        occurred_at: preferred,
        event_type_code: eventCode,
        direction,
        candle_part: candlePart,
        outcome,
        source,
      };
      const matching = slotEvents.find(
        (ev) =>
          ev.event_type_code === eventCode &&
          (ev.candle_part || 'unknown') === candlePart &&
          (ev.direction || 'neutral') === direction,
      );

      if (matching) {
        const next = toggleExclusiveSlotEvent(allEvents, slotEvents, candidateStub, blocks);
        setSelectedEventKey(null);
        persist(blocks, next);
        return;
      }

      let withoutSlot = allEvents;
      for (const ev of slotEvents) {
        withoutSlot = removeMarketPhaseEvent(withoutSlot, ev);
      }
      const targetBlock = blocks.find((block) => eventBelongsToBlock(preferred, block));
      const siblingTimes = targetBlock
        ? withoutSlot
            .filter((existing) => eventBelongsToBlock(existing.occurred_at, targetBlock))
            .map((existing) => existing.occurred_at)
        : withoutSlot.map((existing) => existing.occurred_at);
      const candidate: MarketPhaseEvent = {
        ...candidateStub,
        occurred_at: nextDistinctEventTime(
          preferred,
          siblingTimes,
          targetBlock?.range_end ?? null,
        ),
      };
      const next = toggleExclusiveSlotEvent(allEvents, slotEvents, candidate, blocks);
      setSelectedEventKey(marketPhaseEventKey(candidate));
      persist(blocks, next);
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
    handleToggleExclusiveEvent,
    handleSelectEvent,
    handleRemoveEvent,
    selectedEventKey,
  };
}
