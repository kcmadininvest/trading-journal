import type { TFunction } from 'i18next';
import type { MarketPhaseEvent } from '../services/marketPhases';

export const MARKET_PHASE_EVENT_ACTIONS = [
  {
    code: 'range_breakout_up',
    direction: 'up',
    candlePart: 'body',
    outcome: 'hold',
    labelKey: 'events.breakoutUpBody',
    previewKey: 'events.savePreview.breakoutUpBody',
  },
  {
    code: 'range_breakout_up',
    direction: 'up',
    candlePart: 'wick',
    outcome: 'unknown',
    labelKey: 'events.breakoutUpWick',
    previewKey: 'events.savePreview.breakoutUpWick',
  },
  {
    code: 'range_breakout_down',
    direction: 'down',
    candlePart: 'body',
    outcome: 'hold',
    labelKey: 'events.breakoutDownBody',
    previewKey: 'events.savePreview.breakoutDownBody',
  },
  {
    code: 'range_breakout_down',
    direction: 'down',
    candlePart: 'wick',
    outcome: 'unknown',
    labelKey: 'events.breakoutDownWick',
    previewKey: 'events.savePreview.breakoutDownWick',
  },
  {
    code: 'range_reentry',
    direction: 'neutral',
    candlePart: 'unknown',
    outcome: 'reentry',
    labelKey: 'events.reentry',
    previewKey: 'events.savePreview.reentry',
  },
] as const;

export type MarketPhaseEventAction = (typeof MARKET_PHASE_EVENT_ACTIONS)[number];

export function marketPhaseEventKey(ev: Pick<MarketPhaseEvent, 'id' | 'occurred_at' | 'event_type_code' | 'candle_part' | 'outcome' | 'direction'>): string {
  if (ev.id != null) return `id:${ev.id}`;
  return `${ev.occurred_at}|${ev.event_type_code}|${ev.candle_part}|${ev.outcome}|${ev.direction}`;
}

export function marketPhaseEventsMatch(a: MarketPhaseEvent, b: MarketPhaseEvent): boolean {
  if (a.id != null && b.id != null) return a.id === b.id;
  return marketPhaseEventKey(a) === marketPhaseEventKey(b);
}

export function removeMarketPhaseEvent(
  events: MarketPhaseEvent[],
  target: MarketPhaseEvent,
): MarketPhaseEvent[] {
  const idx = events.findIndex((ev) => marketPhaseEventsMatch(ev, target));
  if (idx < 0) return events;
  return [...events.slice(0, idx), ...events.slice(idx + 1)];
}

function metaLabel(t: TFunction, group: string, value?: string | null): string | null {
  if (!value || value === 'unknown') return null;
  const key = `eventMeta.${group}.${value}`;
  const label = t(key, { defaultValue: '' });
  return label || null;
}

export function formatMarketPhaseEventSummary(
  t: TFunction,
  ev: Pick<
    MarketPhaseEvent,
    'event_type_label' | 'event_type_code' | 'direction' | 'candle_part' | 'outcome'
  >,
): string {
  const base =
    ev.event_type_label ||
    t(`events.types.${ev.event_type_code}`, { defaultValue: ev.event_type_code || '' });
  const parts = [
    metaLabel(t, 'candlePart', ev.candle_part),
    metaLabel(t, 'outcome', ev.outcome),
  ].filter(Boolean);
  if (parts.length === 0) return base;
  return `${base} (${parts.join(', ')})`;
}

export function formatMarketPhaseEventActionPreview(t: TFunction, action: MarketPhaseEventAction): string {
  return t(action.previewKey);
}
