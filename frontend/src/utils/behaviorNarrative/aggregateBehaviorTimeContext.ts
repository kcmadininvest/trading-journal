import { getISOWeek, getISOWeekYear } from 'date-fns';
import type { PnlDisplayMode } from '../pnlDisplay';
import { getTradeDisplayPnlValue } from '../pnlDisplay';
import { toIsoCalendarDateInTimezone } from '../dateFormat';
import { WEEKDAY_WIN_RATE_MIN_TRADES } from '../../hooks/useWeekdayPerformance';
import type {
  HourlyPerformanceRow,
  WeekdayPerformanceRow,
  WeeklyPerformanceRow,
} from './types';

export interface TradeForTimeAggregate {
  entered_at?: string;
  trade_day?: string | null;
  pnl?: string | null;
  net_pnl?: string | null;
}

function getHourInTimezone(isoDate: string, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(isoDate));
  const hourPart = parts.find((p) => p.type === 'hour');
  return hourPart ? parseInt(hourPart.value, 10) : 0;
}

export function aggregateHourlyPerformance(
  trades: TradeForTimeAggregate[],
  timeZone: string,
  pnlDisplayMode: PnlDisplayMode,
): HourlyPerformanceRow[] {
  const buckets: Record<number, { totalPnl: number; tradeCount: number }> = {};

  trades.forEach((trade) => {
    const pnl = getTradeDisplayPnlValue(trade, pnlDisplayMode);
    if (!trade.entered_at || pnl === null) return;

    const hour = getHourInTimezone(trade.entered_at, timeZone);
    if (!buckets[hour]) {
      buckets[hour] = { totalPnl: 0, tradeCount: 0 };
    }
    buckets[hour].totalPnl += pnl;
    buckets[hour].tradeCount += 1;
  });

  return Object.entries(buckets)
    .map(([hour, stats]) => ({
      hour: Number(hour),
      totalPnl: stats.totalPnl,
      tradeCount: stats.tradeCount,
    }))
    .sort((a, b) => a.hour - b.hour);
}

export function aggregateWeekdayPerformance(
  trades: TradeForTimeAggregate[],
  dayNames: string[],
  timeZone: string,
  pnlDisplayMode: PnlDisplayMode,
): WeekdayPerformanceRow[] {
  const sunday = dayNames[0];
  const saturday = dayNames[6];
  const dayStats: Record<string, { totalPnl: number; tradeCount: number; winningTrades: number }> = {};

  dayNames.forEach((name) => {
    dayStats[name] = { totalPnl: 0, tradeCount: 0, winningTrades: 0 };
  });

  trades.forEach((trade) => {
    const pnl = getTradeDisplayPnlValue(trade, pnlDisplayMode);
    if (pnl === null) return;

    const calendarKey =
      trade.trade_day ||
      (trade.entered_at ? toIsoCalendarDateInTimezone(trade.entered_at, timeZone) : '');
    if (!calendarKey) return;

    const [y, m, d] = calendarKey.split('-').map(Number);
    if (!y || !m || !d) return;

    const dayName = dayNames[new Date(y, m - 1, d, 12, 0, 0).getDay()];
    if (!dayStats[dayName]) return;

    dayStats[dayName].totalPnl += pnl;
    dayStats[dayName].tradeCount += 1;
    if (pnl > 0) {
      dayStats[dayName].winningTrades += 1;
    }
  });

  return Object.entries(dayStats)
    .map(([day, stats]) => ({
      day,
      totalPnl: stats.totalPnl,
      tradeCount: stats.tradeCount,
      winRate: stats.tradeCount > 0 ? (stats.winningTrades / stats.tradeCount) * 100 : 0,
    }))
    .filter((d) => d.day !== saturday && d.day !== sunday);
}

export { WEEKDAY_WIN_RATE_MIN_TRADES };

export function aggregateWeeklyPerformance(
  trades: TradeForTimeAggregate[],
  timeZone: string,
  pnlDisplayMode: PnlDisplayMode,
): WeeklyPerformanceRow[] {
  const buckets: Record<
    string,
    { totalPnl: number; tradeCount: number; winningTrades: number; isoYear: number; isoWeek: number }
  > = {};

  trades.forEach((trade) => {
    const pnl = getTradeDisplayPnlValue(trade, pnlDisplayMode);
    if (pnl === null) return;

    const calendarKey =
      trade.trade_day ||
      (trade.entered_at ? toIsoCalendarDateInTimezone(trade.entered_at, timeZone) : '');
    if (!calendarKey) return;

    const [y, m, d] = calendarKey.split('-').map(Number);
    if (!y || !m || !d) return;

    const localDate = new Date(y, m - 1, d, 12, 0, 0);
    const isoYear = getISOWeekYear(localDate);
    const isoWeek = getISOWeek(localDate);
    const bucketKey = `${isoYear}-W${isoWeek}`;

    if (!buckets[bucketKey]) {
      buckets[bucketKey] = { totalPnl: 0, tradeCount: 0, winningTrades: 0, isoYear, isoWeek };
    }
    buckets[bucketKey].totalPnl += pnl;
    buckets[bucketKey].tradeCount += 1;
    if (pnl > 0) {
      buckets[bucketKey].winningTrades += 1;
    }
  });

  return Object.values(buckets)
    .map((stats) => ({
      isoYear: stats.isoYear,
      isoWeek: stats.isoWeek,
      totalPnl: stats.totalPnl,
      tradeCount: stats.tradeCount,
      winRate: stats.tradeCount > 0 ? (stats.winningTrades / stats.tradeCount) * 100 : 0,
    }))
    .sort((a, b) => {
      if (a.isoYear !== b.isoYear) return a.isoYear - b.isoYear;
      return a.isoWeek - b.isoWeek;
    });
}
