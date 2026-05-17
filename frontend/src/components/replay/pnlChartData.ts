import { SessionEventItem } from '../../services/sessionReplay';

export interface PnlChartPoint {
  eventIndex: number;
  pnl: number;
  occurredAt: string;
}

/** Points PnL cumulé issus des événements `pnl_tick` jusqu'à l'index curseur inclus. */
export function buildPnlChartPoints(
  events: SessionEventItem[],
  currentIndex: number,
): PnlChartPoint[] {
  const points: PnlChartPoint[] = [];
  const limit = Math.min(currentIndex, events.length - 1);

  for (let i = 0; i <= limit; i++) {
    const evt = events[i];
    if (evt.event_type !== 'pnl_tick') continue;
    const raw = evt.payload?.cumulative_pnl;
    const pnl = raw != null ? Number(raw) : 0;
    points.push({
      eventIndex: i,
      pnl: Number.isFinite(pnl) ? pnl : 0,
      occurredAt: evt.occurred_at,
    });
  }

  if (points.length > 0) {
    const first = points[0];
    return [
      { eventIndex: first.eventIndex, pnl: 0, occurredAt: first.occurredAt },
      ...points,
    ];
  }

  if (limit >= 0 && events[0]?.occurred_at) {
    return [{ eventIndex: 0, pnl: 0, occurredAt: events[0].occurred_at }];
  }

  return points;
}
