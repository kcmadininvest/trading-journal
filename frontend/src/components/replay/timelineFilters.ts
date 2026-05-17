export type TimelineFilterKey = 'orders' | 'fills' | 'positions';

export const TIMELINE_FILTER_KEYS: TimelineFilterKey[] = ['orders', 'fills', 'positions'];

const FILTER_EVENT_TYPES: Record<TimelineFilterKey, readonly string[]> = {
  orders: ['order_created', 'order_updated'],
  fills: ['fill'],
  positions: ['position_open', 'position_close', 'pnl_tick'],
};

export function eventMatchesTimelineFilters(
  eventType: string,
  activeFilters: ReadonlySet<TimelineFilterKey>,
): boolean {
  if (activeFilters.size === 0) return false;
  return TIMELINE_FILTER_KEYS.some(
    (key) => activeFilters.has(key) && FILTER_EVENT_TYPES[key].includes(eventType),
  );
}

export function getVisibleEventIndices(
  events: readonly { event_type: string }[],
  activeFilters: ReadonlySet<TimelineFilterKey>,
): number[] {
  return events
    .map((evt, index) => ({ evt, index }))
    .filter(({ evt }) => eventMatchesTimelineFilters(evt.event_type, activeFilters))
    .map(({ index }) => index);
}
