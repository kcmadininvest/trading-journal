import type { MarketPhaseBlock, MarketPhaseEvent } from '../services/marketPhases';
import { eventInPeriod } from './marketPhaseSlots';
import { removeMarketPhaseEvent, marketPhaseEventKey } from './marketPhaseEventDisplay';

export function eventBelongsToBlock(occurredAt: string, block: MarketPhaseBlock): boolean {
  if (!block.range_end) {
    const t = occurredAt.trim();
    const start = block.range_start.trim();
    if (!/^\d{1,2}:\d{2}$/.test(t) || !/^\d{1,2}:\d{2}$/.test(start)) return false;
    const [th, tm] = t.split(':').map((x) => parseInt(x, 10));
    const [sh, sm] = start.split(':').map((x) => parseInt(x, 10));
    return th * 60 + tm >= sh * 60 + sm;
  }
  return eventInPeriod(occurredAt, block.range_start, block.range_end);
}

function parseClockMinutes(value: string): number | null {
  const m = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function formatClockMinutes(total: number): string {
  const normalized = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Garantit une heure distincte des événements déjà présents (incrément 1 min). */
export function nextDistinctEventTime(
  preferred: string,
  existingTimes: string[],
  periodEnd?: string | null,
): string {
  const used = new Set(existingTimes.map((t) => t.trim()));
  let candidate = preferred.trim();
  const endMins = periodEnd ? parseClockMinutes(periodEnd) : null;
  for (let i = 0; i < 24 * 60; i += 1) {
    if (!used.has(candidate)) return candidate;
    const mins = parseClockMinutes(candidate);
    if (mins == null) return preferred.trim();
    const next = mins + 1;
    if (endMins != null && next >= endMins) {
      return candidate;
    }
    candidate = formatClockMinutes(next);
  }
  return preferred.trim();
}

function isWickBreakout(ev: MarketPhaseEvent): boolean {
  return (
    (ev.event_type_code === 'range_breakout_up' || ev.event_type_code === 'range_breakout_down') &&
    ev.candle_part === 'wick'
  );
}

/** Réintégration du range (bouton dédié) — pas un outcome reporté sur une cassure. */
export function isRangeReentryEvent(
  ev: Pick<MarketPhaseEvent, 'event_type_code'>,
): boolean {
  return ev.event_type_code === 'range_reentry';
}

/**
 * Ajoute un événement (append). Si c’est une réintégration, marque le dernier
 * breakout mèche du même bloc en outcome=reentry (compat analytics fakeout).
 */
export function appendMarketPhaseEvent(
  allEvents: MarketPhaseEvent[],
  newEvent: MarketPhaseEvent,
  blocks: MarketPhaseBlock[],
): MarketPhaseEvent[] {
  const next = [...allEvents];
  const isReentry =
    newEvent.event_type_code === 'range_reentry' || newEvent.outcome === 'reentry';

  if (isReentry) {
    const targetBlock = blocks.find((block) => eventBelongsToBlock(newEvent.occurred_at, block));
    if (targetBlock) {
      let lastWickIdx = -1;
      for (let i = 0; i < next.length; i += 1) {
        const ev = next[i];
        if (!eventBelongsToBlock(ev.occurred_at, targetBlock)) continue;
        if (!isWickBreakout(ev)) continue;
        if (ev.outcome === 'reentry') continue;
        lastWickIdx = i;
      }
      if (lastWickIdx >= 0) {
        next[lastWickIdx] = { ...next[lastWickIdx], outcome: 'reentry' };
      }
    }
  }

  return [...next, newEvent];
}

function eventMatchesToggleTarget(
  ev: MarketPhaseEvent,
  target: Pick<MarketPhaseEvent, 'event_type_code' | 'direction' | 'candle_part'>,
): boolean {
  return (
    ev.event_type_code === target.event_type_code &&
    (ev.candle_part || 'unknown') === (target.candle_part || 'unknown') &&
    (ev.direction || 'neutral') === (target.direction || 'neutral')
  );
}

function sortByOccurredAt(events: MarketPhaseEvent[]): MarketPhaseEvent[] {
  return [...events].sort((a, b) =>
    (a.occurred_at || '').localeCompare(b.occurred_at || ''),
  );
}

/**
 * Sélection par tranche : au plus 1 événement primaire + 1 réintégration.
 * - reclic sur le même → retire cet événement seulement
 * - clic sur un autre primaire → remplace le primaire, conserve la réintégration
 * - clic réintégration → ajoute/retire sans toucher au primaire
 */
export function toggleSlotEvent(
  allEvents: MarketPhaseEvent[],
  slotEvents: MarketPhaseEvent[],
  candidate: MarketPhaseEvent,
  blocks: MarketPhaseBlock[],
): MarketPhaseEvent[] {
  const matching = slotEvents.find((ev) => eventMatchesToggleTarget(ev, candidate));
  if (matching) {
    // Retirer tous les événements de la tranche qui correspondent à l’action
    // (évite les échecs de match id/clé après sync API).
    const slotKeys = new Set(slotEvents.map((ev) => marketPhaseEventKey(ev)));
    return allEvents.filter((ev) => {
      const inSlot =
        slotKeys.has(marketPhaseEventKey(ev)) ||
        slotEvents.some(
          (se) =>
            se.id != null &&
            ev.id != null &&
            se.id === ev.id,
        ) ||
        slotEvents.some(
          (se) =>
            se.occurred_at === ev.occurred_at &&
            eventMatchesToggleTarget(se, ev),
        );
      if (!inSlot) return true;
      return !eventMatchesToggleTarget(ev, candidate);
    });
  }

  const candidateIsReentry = isRangeReentryEvent(candidate);
  let next = allEvents;

  if (candidateIsReentry) {
    for (const ev of slotEvents) {
      if (isRangeReentryEvent(ev)) {
        next = removeMarketPhaseEvent(next, ev);
      }
    }
  } else {
    for (const ev of slotEvents) {
      if (!isRangeReentryEvent(ev)) {
        next = removeMarketPhaseEvent(next, ev);
      }
    }
  }

  return appendMarketPhaseEvent(next, candidate, blocks);
}

/** @deprecated Utiliser toggleSlotEvent — conservé pour compat tests anciens. */
export function toggleExclusiveSlotEvent(
  allEvents: MarketPhaseEvent[],
  slotEvents: MarketPhaseEvent[],
  candidate: MarketPhaseEvent,
  blocks: MarketPhaseBlock[],
): MarketPhaseEvent[] {
  return toggleSlotEvent(allEvents, slotEvents, candidate, blocks);
}

/** Événements actifs d’une tranche (primaire + réintégration éventuelle). */
export function activeSlotEvents(slotEvents: MarketPhaseEvent[]): MarketPhaseEvent[] {
  if (slotEvents.length === 0) return [];
  const sorted = sortByOccurredAt(slotEvents);
  const reentries = sorted.filter((ev) => isRangeReentryEvent(ev));
  const primaries = sorted.filter((ev) => !isRangeReentryEvent(ev));
  const result: MarketPhaseEvent[] = [];
  if (primaries.length > 0) result.push(primaries[primaries.length - 1]);
  if (reentries.length > 0) result.push(reentries[reentries.length - 1]);
  return result;
}

/** @deprecated Un seul événement — préférer activeSlotEvents. */
export function activeExclusiveSlotEvent(
  slotEvents: MarketPhaseEvent[],
): MarketPhaseEvent | undefined {
  const active = activeSlotEvents(slotEvents);
  return active[active.length - 1];
}

/**
 * Garde au plus 1 primaire + 1 réintégration par bloc.
 * Les orphelins hors bloc sont conservés.
 */
export function pruneToPrimaryPlusReentryPerBlock(
  blocks: MarketPhaseBlock[],
  allEvents: MarketPhaseEvent[],
): { events: MarketPhaseEvent[]; pruned: boolean } {
  if (allEvents.length <= 1 || blocks.length === 0) {
    return { events: allEvents, pruned: false };
  }

  const keepKeys = new Set<string>();
  const inBlockKeys = new Set<string>();

  for (const block of blocks) {
    const members = allEvents.filter((ev) => eventBelongsToBlock(ev.occurred_at, block));
    for (const ev of members) {
      inBlockKeys.add(marketPhaseEventKey(ev));
    }
    if (members.length === 0) continue;
    for (const ev of activeSlotEvents(members)) {
      keepKeys.add(marketPhaseEventKey(ev));
    }
  }

  const events = allEvents.filter((ev) => {
    const key = marketPhaseEventKey(ev);
    if (!inBlockKeys.has(key)) return true;
    return keepKeys.has(key);
  });

  return { events, pruned: events.length !== allEvents.length };
}

/** @deprecated Utiliser pruneToPrimaryPlusReentryPerBlock. */
export function pruneToExclusiveEventPerBlock(
  blocks: MarketPhaseBlock[],
  allEvents: MarketPhaseEvent[],
): { events: MarketPhaseEvent[]; pruned: boolean } {
  return pruneToPrimaryPlusReentryPerBlock(blocks, allEvents);
}
