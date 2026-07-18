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
  pruneToPrimaryPlusReentryPerBlock,
  toggleSlotEvent,
} from '../utils/marketPhaseEventCapture';
import { normalizeTimeHHMM } from '../utils/marketPhaseSlots';

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
      // Priorité au lien parent_block quand les ids sont connus
      if (block.id != null && ev.parent_block != null) {
        if (ev.parent_block !== block.id) return false;
        assigned.add(key);
        return true;
      }
      if (!eventBelongsToBlock(ev.occurred_at, block)) return false;
      assigned.add(key);
      return true;
    });
    return { ...block, events: blockEvents };
  });
  const orphans = events.filter((ev) => !assigned.has(marketPhaseEventKey(ev)));
  return { blocks: nextBlocks, orphans };
}

function blockRangeKey(block: MarketPhaseBlock): string {
  const start = normalizeTimeHHMM(block.range_start) || block.range_start;
  const end =
    block.range_end == null ? '' : normalizeTimeHHMM(block.range_end) || block.range_end;
  return `${block.instrument_key}|${start}|${end}`;
}

/** Un seul bloc par plage (garde le plus récent) — évite les doublons d’anciennes sauvegardes. */
function dedupeBlocksByRange(blocks: MarketPhaseBlock[]): MarketPhaseBlock[] {
  const groups = new Map<string, MarketPhaseBlock[]>();
  for (const block of blocks) {
    const key = blockRangeKey(block);
    const list = groups.get(key) || [];
    list.push(block);
    groups.set(key, list);
  }
  return [...groups.values()].map((group) => {
    const sorted = [...group].sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
    const keep = sorted[0];
    const linked = group
      .flatMap((b) => b.events || [])
      .filter((ev) => keep.id == null || ev.parent_block == null || ev.parent_block === keep.id);
    const keepNested = keep.events || [];
    const events = keepNested.length > 0 ? keepNested : linked;
    return { ...keep, events };
  });
}

function flattenCaptureEvents(data: {
  blocks: MarketPhaseBlock[];
  orphan_events: MarketPhaseEvent[];
}): MarketPhaseEvent[] {
  return [...data.blocks.flatMap((b) => b.events || []), ...data.orphan_events];
}

/** Applique la règle « 1 primaire + 1 réintégration max par bloc » aux données API. */
function normalizeSlotCapture(data: {
  blocks: MarketPhaseBlock[];
  orphan_events: MarketPhaseEvent[];
}): {
  blocks: MarketPhaseBlock[];
  orphanEvents: MarketPhaseEvent[];
  events: MarketPhaseEvent[];
  pruned: boolean;
} {
  const dedupedBlocks = dedupeBlocksByRange(data.blocks);
  const flat = flattenCaptureEvents({
    blocks: dedupedBlocks,
    orphan_events: data.orphan_events,
  });
  const { events, pruned } = pruneToPrimaryPlusReentryPerBlock(dedupedBlocks, flat);
  const projected = projectEventsOntoBlocks(
    dedupedBlocks.map((block) => ({ ...block, events: [] })),
    events,
  );
  return {
    blocks: projected.blocks,
    orphanEvents: projected.orphans,
    events,
    pruned: pruned || dedupedBlocks.length !== data.blocks.length,
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

function instrumentCacheKey(accountId: number): string {
  return `mp-instrument-${accountId}`;
}

function captureCacheKey(accountId: number, date: string, instrument: string): string {
  return `mp-capture-${accountId}-${date}-${instrument}`;
}

function readCachedCapture(
  accountId: number,
  date: string,
  instrument: string,
): { blocks: MarketPhaseBlock[]; orphanEvents: MarketPhaseEvent[]; events: MarketPhaseEvent[] } | null {
  try {
    const raw = sessionStorage.getItem(captureCacheKey(accountId, date, instrument));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      blocks: MarketPhaseBlock[];
      orphan_events: MarketPhaseEvent[];
    };
    const normalized = normalizeSlotCapture({
      blocks: parsed.blocks || [],
      orphan_events: parsed.orphan_events || [],
    });
    return {
      blocks: normalized.blocks,
      orphanEvents: normalized.orphanEvents,
      events: normalized.events,
    };
  } catch {
    return null;
  }
}

function writeCachedCapture(
  accountId: number,
  date: string,
  instrument: string,
  blocks: MarketPhaseBlock[],
  orphanEvents: MarketPhaseEvent[],
): void {
  try {
    sessionStorage.setItem(
      captureCacheKey(accountId, date, instrument),
      JSON.stringify({ blocks, orphan_events: orphanEvents }),
    );
    sessionStorage.setItem(instrumentCacheKey(accountId), instrument);
  } catch {
    // quota / private mode
  }
}

function resolveInstrumentKey(
  keys: string[],
  preferred: string | undefined,
  fallback: string,
): string {
  if (preferred && keys.includes(preferred)) return preferred;
  if (keys.includes(fallback)) return fallback;
  return keys[0] || fallback;
}

export function useMarketPhaseCapture({
  tradingAccountId,
  sessionDate,
  instrumentKey: instrumentKeyProp,
  source = 'live',
  tradingSessionId,
}: UseMarketPhaseCaptureOptions) {
  const { preferences } = usePreferences();
  const effectiveDate = sessionDate || toIsoCalendarDateInTimezone(new Date(), preferences.timezone);

  const initialInstrument = useMemo(() => {
    if (instrumentKeyProp) return instrumentKeyProp;
    if (tradingAccountId) {
      try {
        const cached = sessionStorage.getItem(instrumentCacheKey(tradingAccountId));
        if (cached) return cached;
      } catch {
        // ignore
      }
    }
    return 'nasdaq';
  }, [instrumentKeyProp, tradingAccountId]);

  const [phases, setPhases] = useState<MarketPhaseDefinition[]>([]);
  const [instruments, setInstruments] = useState<MarketInstrument[]>([]);
  const [instrumentKey, setInstrumentKeyState] = useState(initialInstrument);
  const [blocks, setBlocks] = useState<MarketPhaseBlock[]>(() => {
    if (!tradingAccountId) return [];
    return readCachedCapture(tradingAccountId, effectiveDate, initialInstrument)?.blocks ?? [];
  });
  const [orphanEvents, setOrphanEvents] = useState<MarketPhaseEvent[]>(() => {
    if (!tradingAccountId) return [];
    return readCachedCapture(tradingAccountId, effectiveDate, initialInstrument)?.orphanEvents ?? [];
  });
  const [selectedPhase, setSelectedPhase] = useState('consolidation');
  const [precedingContext, setPrecedingContext] = useState('none');
  const [openBlockStart, setOpenBlockStart] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [selectedEventKey, setSelectedEventKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => {
    if (!tradingAccountId) return false;
    return !readCachedCapture(tradingAccountId, effectiveDate, initialInstrument);
  });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Invalide les GET / captures en vol pour ne pas écraser une saisie locale (ex. 1ère phase). */
  const captureRequestId = useRef(0);
  /**
   * Dernier payload à persister + file sérialisée.
   * Évite qu’un PUT plus ancien (ex. sélection) réécrase une désélection plus récente.
   */
  const latestPersistRef = useRef<{
    blocks: MarketPhaseBlock[];
    events: MarketPhaseEvent[];
    requestId: number;
  } | null>(null);
  const saveInFlightRef = useRef(false);
  const saveAgainRef = useRef(false);
  /** État courant pour toggles successifs sans attendre le re-render. */
  const blocksRef = useRef<MarketPhaseBlock[]>([]);
  const allEventsRef = useRef<MarketPhaseEvent[]>([]);
  const bootstrappedRef = useRef(false);
  const skipInstrumentEffectRef = useRef(false);
  const instrumentKeyRef = useRef(instrumentKey);
  instrumentKeyRef.current = instrumentKey;

  const applyCaptureState = useCallback(
    (
      data: { blocks: MarketPhaseBlock[]; orphan_events: MarketPhaseEvent[] },
      resolvedInstrument: string,
    ) => {
      const normalized = normalizeSlotCapture(data);
      setBlocks(normalized.blocks);
      setOrphanEvents(normalized.orphanEvents);
      blocksRef.current = normalized.blocks;
      allEventsRef.current = normalized.events;
      setSelectedEventKey(null);
      const open = normalized.blocks.find((b) => !b.range_end);
      setOpenBlockStart(open?.range_start ?? null);
      if (normalized.pruned) {
        latestPersistRef.current = {
          blocks: normalized.blocks,
          events: normalized.events,
          requestId: captureRequestId.current,
        };
      }
      if (tradingAccountId) {
        writeCachedCapture(
          tradingAccountId,
          effectiveDate,
          resolvedInstrument,
          normalized.blocks,
          normalized.orphanEvents,
        );
      }
    },
    [tradingAccountId, effectiveDate],
  );

  /** Bootstrap parallèle : meta + capture en même temps (plus de file d’attente). */
  useEffect(() => {
    if (!tradingAccountId) {
      setLoading(false);
      return;
    }
    bootstrappedRef.current = false;
    let cancelled = false;
    const requestId = ++captureRequestId.current;
    const provisionalKey = instrumentKeyProp || instrumentKeyRef.current || 'nasdaq';

    // Hydrate immédiat depuis le cache si dispo (évite le flash « Non renseigné »).
    const cached = readCachedCapture(tradingAccountId, effectiveDate, provisionalKey);
    if (cached) {
      setBlocks(cached.blocks);
      setOrphanEvents(cached.orphanEvents);
      blocksRef.current = cached.blocks;
      allEventsRef.current = cached.events;
      setLoading(false);
    } else {
      setLoading(true);
    }

    (async () => {
      try {
        // Capture en priorité : ne pas bloquer l’UI sur instruments/phases.
        const capturePromise = marketPhasesService.getCapture({
          session_date: effectiveDate,
          trading_account: tradingAccountId,
          instrument_key: provisionalKey,
        });
        const phasesPromise = marketPhasesService.getPhaseDefinitions();
        const instrumentsPromise = marketPhasesService.getInstruments(tradingAccountId);

        const captureData = await capturePromise;
        if (cancelled || requestId !== captureRequestId.current) return;
        applyCaptureState(captureData, provisionalKey);
        setLoading(false);

        const [p, inst] = await Promise.all([phasesPromise, instrumentsPromise]);
        if (cancelled || requestId !== captureRequestId.current) return;

        setPhases(p);
        const list = inst.instruments;
        setInstruments(list);
        const resolved = resolveInstrumentKey(
          list.map((i) => i.key),
          instrumentKeyProp,
          provisionalKey,
        );
        if (resolved !== instrumentKeyRef.current) {
          skipInstrumentEffectRef.current = true;
          setInstrumentKeyState(resolved);
        }

        if (resolved !== provisionalKey) {
          const data = await marketPhasesService.getCapture({
            session_date: effectiveDate,
            trading_account: tradingAccountId,
            instrument_key: resolved,
          });
          if (cancelled || requestId !== captureRequestId.current) return;
          applyCaptureState(data, resolved);
        }

        bootstrappedRef.current = true;
      } catch {
        // garde le cache local s’il existe
      } finally {
        if (!cancelled && requestId === captureRequestId.current) {
          setLoading(false);
          bootstrappedRef.current = true;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tradingAccountId, effectiveDate, instrumentKeyProp, applyCaptureState]);

  /** Changement d’instrument par l’utilisateur (après bootstrap). */
  const setInstrumentKey = useCallback((next: string) => {
    setInstrumentKeyState(next);
  }, []);

  useEffect(() => {
    if (!tradingAccountId || !bootstrappedRef.current) return;
    if (skipInstrumentEffectRef.current) {
      skipInstrumentEffectRef.current = false;
      return;
    }
    const requestId = ++captureRequestId.current;
    const cached = readCachedCapture(tradingAccountId, effectiveDate, instrumentKey);
    if (cached) {
      setBlocks(cached.blocks);
      setOrphanEvents(cached.orphanEvents);
      blocksRef.current = cached.blocks;
      allEventsRef.current = cached.events;
      setLoading(false);
    } else {
      setLoading(true);
    }
    marketPhasesService
      .getCapture({
        session_date: effectiveDate,
        trading_account: tradingAccountId,
        instrument_key: instrumentKey,
      })
      .then((data) => {
        if (requestId !== captureRequestId.current) return;
        applyCaptureState(data, instrumentKey);
      })
      .catch(() => undefined)
      .finally(() => {
        if (requestId === captureRequestId.current) setLoading(false);
      });
  }, [instrumentKey, tradingAccountId, effectiveDate, applyCaptureState]);

  const allEvents = useMemo(() => {
    const nested = blocks.flatMap((b) => b.events || []);
    return [...nested, ...orphanEvents].sort((a, b) =>
      (a.occurred_at || '').localeCompare(b.occurred_at || ''),
    );
  }, [blocks, orphanEvents]);

  blocksRef.current = blocks;
  allEventsRef.current = allEvents;

  const flushPersist = useCallback(async () => {
    if (!tradingAccountId) return;
    if (saveInFlightRef.current) {
      saveAgainRef.current = true;
      return;
    }
    saveInFlightRef.current = true;
    setSaveState('saving');
    try {
      do {
        saveAgainRef.current = false;
        const payload = latestPersistRef.current;
        if (!payload) break;
        const { blocks: saveBlocks, events: saveEvents, requestId } = payload;
        await marketPhasesService.bulkCapture({
          session_date: effectiveDate,
          trading_account: tradingAccountId,
          instrument_key: instrumentKey,
          source,
          trading_session: tradingSessionId ?? null,
          blocks: saveBlocks,
          events: saveEvents,
        });
        // Un persist plus récent est arrivé pendant le PUT : on réécrit avec le dernier état.
        if (latestPersistRef.current?.requestId !== requestId) {
          saveAgainRef.current = true;
          continue;
        }
        if (requestId !== captureRequestId.current) {
          continue;
        }
        // On NE réécrit PAS l'affichage depuis la réponse PUT : l'état optimiste est déjà
        // complet et correct. La réponse peut orpheliner un événement (parent_block null non
        // renvoyé) et faire clignoter « aucun » avant de réafficher la sélection.
        setSaveState('saved');
        if (tradingAccountId) {
          const projected = projectEventsOntoBlocks(saveBlocks, saveEvents);
          writeCachedCapture(
            tradingAccountId,
            effectiveDate,
            instrumentKey,
            projected.blocks,
            projected.orphans,
          );
        }
      } while (saveAgainRef.current);
    } catch {
      if (latestPersistRef.current?.requestId === captureRequestId.current) {
        setSaveState('idle');
      }
    } finally {
      saveInFlightRef.current = false;
      if (saveAgainRef.current) {
        saveAgainRef.current = false;
        void flushPersist();
      }
    }
  }, [tradingAccountId, effectiveDate, instrumentKey, source, tradingSessionId]);

  const persist = useCallback(
    (nextBlocks: MarketPhaseBlock[], nextEvents: MarketPhaseEvent[]) => {
      if (!tradingAccountId) return;
      // Annule tout GET en cours : sinon le chargement initial peut réinitialiser la 1ʳᵉ saisie.
      const requestId = ++captureRequestId.current;
      latestPersistRef.current = {
        blocks: nextBlocks,
        events: nextEvents,
        requestId,
      };
      const projected = projectEventsOntoBlocks(nextBlocks, nextEvents);
      setBlocks(projected.blocks);
      setOrphanEvents(projected.orphans);
      blocksRef.current = projected.blocks;
      allEventsRef.current = [...projected.blocks.flatMap((b) => b.events || []), ...projected.orphans];
      setSaveState('saving');
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void flushPersist();
      }, 500);
    },
    [tradingAccountId, flushPersist],
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
   * Sélection par tranche : au plus 1 primaire + 1 réintégration.
   * Reclic annule l’événement ; un autre primaire remplace le primaire sans
   * toucher à la réintégration (et inversement).
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

      // État le plus récent (y compris juste après un persist optimiste).
      const baseEvents = allEventsRef.current;
      const baseBlocks = blocksRef.current;
      const targetBlock =
        baseBlocks.find((block) => eventBelongsToBlock(preferred, block)) ??
        (slotEvents[0]
          ? baseBlocks.find((block) => eventBelongsToBlock(slotEvents[0].occurred_at, block))
          : undefined);
      // Recalculer les events de la tranche depuis les refs (pas le rendu potentiellement périmé).
      const currentSlotEvents = targetBlock
        ? baseEvents.filter((ev) => eventBelongsToBlock(ev.occurred_at, targetBlock))
        : slotEvents;

      const matching = currentSlotEvents.find(
        (ev) =>
          ev.event_type_code === eventCode &&
          (ev.candle_part || 'unknown') === candlePart &&
          (ev.direction || 'neutral') === direction,
      );

      if (matching) {
        const next = toggleSlotEvent(baseEvents, currentSlotEvents, candidateStub, baseBlocks);
        setSelectedEventKey(null);
        persist(baseBlocks, next);
        return;
      }

      // Ne retirer que les événements du même « rôle » pour calculer l’heure
      // (sinon la réintégration existante bloquerait le créneau horaire du primaire).
      const candidateIsReentry = eventCode === 'range_reentry';
      let withoutReplaced = baseEvents;
      for (const ev of currentSlotEvents) {
        const evIsReentry = ev.event_type_code === 'range_reentry';
        if (candidateIsReentry === evIsReentry) {
          withoutReplaced = removeMarketPhaseEvent(withoutReplaced, ev);
        }
      }
      const siblingTimes = targetBlock
        ? withoutReplaced
            .filter((existing) => eventBelongsToBlock(existing.occurred_at, targetBlock))
            .map((existing) => existing.occurred_at)
        : withoutReplaced.map((existing) => existing.occurred_at);
      const candidate: MarketPhaseEvent = {
        ...candidateStub,
        occurred_at: nextDistinctEventTime(
          preferred,
          siblingTimes,
          targetBlock?.range_end ?? null,
        ),
      };
      const next = toggleSlotEvent(baseEvents, currentSlotEvents, candidate, baseBlocks);
      setSelectedEventKey(marketPhaseEventKey(candidate));
      persist(baseBlocks, next);
    },
    [preferences.timezone, source, persist],
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
    loading,
    effectiveDate,
    allEvents,
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
