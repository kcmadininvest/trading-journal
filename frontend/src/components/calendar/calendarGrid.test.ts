import { describe, it, expect } from 'vitest';
import { buildCalendarWeeks, AdjacentCell } from './calendarGrid';
import type { DailyCalendarData, AdjacentDayCalendarData } from '../../services/calendar';

const day = (date: string, pnl: number, tradeCount = 1): DailyCalendarData => ({
  date,
  pnl,
  trade_count: tradeCount,
});

const adj = (date: string, pnl: number, tradeCount = 1): AdjacentDayCalendarData => ({
  date,
  pnl,
  trade_count: tradeCount,
});

const adjacentCells = (cells: { kind: string }[]) =>
  cells.filter((c): c is AdjacentCell => c.kind === 'adjacent');

describe('buildCalendarWeeks', () => {
  it('fills leading days from the previous month (October 2026 starts on Thursday)', () => {
    const weeks = buildCalendarWeeks({ year: 2026, month: 10, dailyData: [] });
    // 4 jours de tête + 31 jours = 35 → 5 lignes, octobre finit un samedi
    expect(weeks).toHaveLength(5);
    expect(adjacentCells(weeks[0].cells).map((c) => c.date)).toEqual([
      '2026-09-27',
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
    ]);
    expect(adjacentCells(weeks[4].cells)).toHaveLength(0);
  });

  it('fills trailing days from the next month (September 2026 ends on Wednesday)', () => {
    const weeks = buildCalendarWeeks({ year: 2026, month: 9, dailyData: [] });
    const last = weeks[weeks.length - 1];
    expect(adjacentCells(last.cells).map((c) => c.date)).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ]);
  });

  it('includes previous-month days in the weekly PnL', () => {
    const weeks = buildCalendarWeeks({
      year: 2026,
      month: 10,
      dailyData: [day('1', 100), day('2', 50)],
      adjacentDays: [adj('2026-09-30', 75)],
    });
    expect(weeks[0].weeklyPnl).toBe(225);
    const sep30 = adjacentCells(weeks[0].cells).find((c) => c.date === '2026-09-30');
    expect(sep30).toMatchObject({ day: 30, month: 9, year: 2026, pnl: 75, tradeCount: 1 });
  });

  it('includes next-month days in the weekly PnL', () => {
    const weeks = buildCalendarWeeks({
      year: 2026,
      month: 9,
      dailyData: [day('30', 40)],
      adjacentDays: [adj('2026-10-01', 20)],
    });
    expect(weeks[weeks.length - 1].weeklyPnl).toBe(60);
  });

  it('ignores adjacent data outside the displayed grid', () => {
    const weeks = buildCalendarWeeks({
      year: 2026,
      month: 10,
      dailyData: [],
      adjacentDays: [adj('2026-09-26', 999), adj('2026-11-01', 999)],
    });
    expect(weeks.every((w) => w.weeklyPnl === 0)).toBe(true);
  });

  it('has no adjacent days when the month is aligned on Sunday-Saturday (February 2026)', () => {
    const weeks = buildCalendarWeeks({ year: 2026, month: 2, dailyData: [] });
    expect(weeks).toHaveLength(4);
    expect(weeks.every((w) => adjacentCells(w.cells).length === 0)).toBe(true);
  });

  it('wraps to December of the previous year (January 2026)', () => {
    const weeks = buildCalendarWeeks({
      year: 2026,
      month: 1,
      dailyData: [],
      adjacentDays: [adj('2025-12-31', 10)],
    });
    const lead = adjacentCells(weeks[0].cells);
    expect(lead).toHaveLength(4);
    expect(lead[3]).toMatchObject({ date: '2025-12-31', day: 31, month: 12, year: 2025, pnl: 10 });
  });

  it('wraps to January of the next year (December 2026)', () => {
    const weeks = buildCalendarWeeks({
      year: 2026,
      month: 12,
      dailyData: [],
      adjacentDays: [adj('2027-01-01', 15)],
    });
    const trail = adjacentCells(weeks[weeks.length - 1].cells);
    expect(trail[0]).toMatchObject({ date: '2027-01-01', day: 1, month: 1, year: 2027, pnl: 15 });
  });

  it('handles leap-year February (2028 starts on Tuesday, 29 days)', () => {
    const weeks = buildCalendarWeeks({ year: 2028, month: 2, dailyData: [day('29', 5)] });
    const last = weeks[weeks.length - 1];
    expect(last.cells.some((c) => c.kind === 'current' && c.day === 29)).toBe(true);
    expect(adjacentCells(last.cells)[0].date).toBe('2028-03-01');
  });
});
