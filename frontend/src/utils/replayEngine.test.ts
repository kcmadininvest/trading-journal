import { describe, expect, it } from 'vitest';
import {
  aggregateFormingCandle,
  bucketOpenUnix,
  getVisibleCandles,
  pickReplayBaseTimeframe,
  ReplayEngine,
  followAppendedBarsRange,
  type ReplayChartConfiguration,
} from './replayEngine';
import type { AvailableTimeframe, ReplayCandle } from '../services/marketReplay';

const tf = (value: string, durationSeconds: number): AvailableTimeframe => ({
  value,
  label: value,
  durationSeconds,
});

function candle(iso: string, o: number, h: number, l: number, c: number, v = 1): ReplayCandle {
  return { t: iso, o, h, l, c, v };
}

describe('followAppendedBarsRange', () => {
  it('does not move the viewport when no candle was appended', () => {
    expect(followAppendedBarsRange({ from: 10, to: 60 }, 50, 50)).toBeNull();
  });

  it('shifts the range by the appended count and keeps its width (zoom)', () => {
    expect(followAppendedBarsRange({ from: 10.5, to: 53.5 }, 50, 51)).toEqual({
      from: 11.5,
      to: 54.5,
    });
  });

  it('does not follow when the last candle was scrolled out of view', () => {
    expect(followAppendedBarsRange({ from: 0, to: 20 }, 50, 51)).toBeNull();
  });
});

describe('pickReplayBaseTimeframe', () => {
  it('picks the finest duration among charts', () => {
    const charts: ReplayChartConfiguration[] = [
      { chartId: 'a', timeframe: tf('15m', 900) },
      { chartId: 'b', timeframe: tf('5m', 300) },
      { chartId: 'c', timeframe: tf('1m', 60) },
    ];
    expect(pickReplayBaseTimeframe(charts)?.value).toBe('1m');
  });
});

describe('ReplayEngine session alignment', () => {
  const startTimestamp = Math.floor(Date.parse('2026-09-07T22:00:00Z') / 1000);
  const endTimestamp = Math.floor(Date.parse('2026-09-08T21:00:00Z') / 1000);

  it('steps a four-hour base timeframe from the session open and reaches the partial final bucket', () => {
    const engine = new ReplayEngine({
      symbol: 'MES',
      startTimestamp,
      endTimestamp,
      charts: [{ chartId: 'a', timeframe: tf('4h', 14400) }],
    });

    engine.stepForward();
    expect(new Date(engine.replayTimestamp * 1000).toISOString()).toBe('2026-09-08T02:00:00.000Z');
    engine.setTimestamp(Math.floor(Date.parse('2026-09-08T18:00:00Z') / 1000));
    engine.stepForward();
    expect(engine.replayTimestamp).toBe(endTimestamp);
  });

  it('reaches the session close with a daily base timeframe', () => {
    const engine = new ReplayEngine({
      symbol: 'MES',
      startTimestamp,
      endTimestamp,
      charts: [{ chartId: 'a', timeframe: tf('1d', 86400) }],
    });

    engine.stepForward();
    expect(engine.replayTimestamp).toBe(endTimestamp);
  });
});

describe('bucketOpenUnix', () => {
  it('aligns to duration grid', () => {
    // 2025-03-10 14:07:00 UTC
    const ts = Math.floor(Date.parse('2025-03-10T14:07:00Z') / 1000);
    const open5 = bucketOpenUnix(ts, 300);
    expect(new Date(open5 * 1000).toISOString()).toBe('2025-03-10T14:05:00.000Z');
  });
});

describe('getVisibleCandles', () => {
  const m1: ReplayCandle[] = [
    candle('2025-03-10T14:00:00Z', 100, 101, 99, 100.5, 10),
    candle('2025-03-10T14:01:00Z', 100.5, 102, 100, 101, 11),
    candle('2025-03-10T14:02:00Z', 101, 103, 100.5, 102, 12),
    candle('2025-03-10T14:03:00Z', 102, 104, 101, 103, 13),
    candle('2025-03-10T14:04:00Z', 103, 105, 102, 104, 14),
    candle('2025-03-10T14:05:00Z', 104, 106, 103, 105, 15),
  ];
  const m5: ReplayCandle[] = [
    candle('2025-03-10T14:00:00Z', 100, 105, 99, 104, 60),
    candle('2025-03-10T14:05:00Z', 104, 110, 103, 108, 70),
  ];

  it('hides future candles', () => {
    const replay = Math.floor(Date.parse('2025-03-10T14:02:30Z') / 1000);
    const visible = getVisibleCandles(m1, tf('1m', 60), replay, m1, tf('1m', 60));
    expect(visible.every((c) => c.time <= replay)).toBe(true);
    expect(visible.map((c) => c.time)).not.toContain(
      Math.floor(Date.parse('2025-03-10T14:05:00Z') / 1000),
    );
  });

  it('forms higher TF candle from base series', () => {
    const replay = Math.floor(Date.parse('2025-03-10T14:02:00Z') / 1000);
    const visible = getVisibleCandles(m5, tf('5m', 300), replay, m1, tf('1m', 60));
    expect(visible).toHaveLength(1);
    expect(visible[0].open).toBe(100);
    expect(visible[0].high).toBe(103);
    expect(visible[0].low).toBe(99);
    expect(visible[0].close).toBe(102);
  });

  it('forms session-aligned four-hour bars from their native open', () => {
    const open = Math.floor(Date.parse('2026-09-07T22:00:00Z') / 1000);
    const higher = [
      candle('2026-09-07T22:00:00Z', 100, 110, 99, 105),
      candle('2026-09-08T02:00:00Z', 105, 112, 104, 108),
    ];
    const lower = [
      candle('2026-09-07T22:00:00Z', 100, 102, 99, 101),
      candle('2026-09-07T22:02:00Z', 101, 103, 100, 102),
    ];
    const visible = getVisibleCandles(higher, tf('4h', 14400), open + 120, lower, tf('2m', 120));

    expect(visible).toHaveLength(1);
    expect(visible[0].time).toBe(open);
    expect(visible[0].close).toBe(102);
  });

  it('shows a session-aligned native bar when it is the base timeframe', () => {
    const open = Math.floor(Date.parse('2026-09-07T22:00:00Z') / 1000);
    const native = [candle('2026-09-07T22:00:00Z', 100, 110, 99, 105)];
    const visible = getVisibleCandles(native, tf('4h', 14400), open, native, tf('4h', 14400));

    expect(visible).toHaveLength(1);
    expect(visible[0].time).toBe(open);
  });

  it('keeps the daily forming bar anchored to the session open', () => {
    const open = Math.floor(Date.parse('2026-09-07T22:00:00Z') / 1000);
    const replay = Math.floor(Date.parse('2026-09-08T20:59:00Z') / 1000);
    const daily = [candle('2026-09-07T22:00:00Z', 100, 120, 95, 110)];
    const lower = [
      candle('2026-09-07T22:00:00Z', 100, 102, 99, 101),
      candle('2026-09-08T20:59:00Z', 101, 103, 100, 102),
    ];
    const visible = getVisibleCandles(daily, tf('1d', 86400), replay, lower, tf('1m', 60));

    expect(visible).toHaveLength(1);
    expect(visible[0].time).toBe(open);
    expect(visible[0].close).toBe(102);
  });

  it('does not invent intrabar without finer base', () => {
    const replay = Math.floor(Date.parse('2025-03-10T14:02:00Z') / 1000);
    const visible = getVisibleCandles(m5, tf('5m', 300), replay);
    // Bougie 14:00 pas encore clôturée à 14:02 → rien, ou seulement closes
    expect(visible.every((c) => c.time + 300 - 1 <= replay || c.time <= replay)).toBe(true);
    // Sans base : pas de formation partielle → 0 bougies clôturées
    expect(visible.length).toBe(0);
  });
});

describe('aggregateFormingCandle', () => {
  it('aggregates OHLC correctly', () => {
    const base: ReplayCandle[] = [
      candle('2025-03-10T14:00:00Z', 10, 12, 9, 11),
      candle('2025-03-10T14:01:00Z', 11, 13, 10, 12),
    ];
    const start = Math.floor(Date.parse('2025-03-10T14:00:00Z') / 1000);
    const replay = Math.floor(Date.parse('2025-03-10T14:01:00Z') / 1000);
    const formed = aggregateFormingCandle(base, start, replay);
    expect(formed).toEqual({
      time: start,
      open: 10,
      high: 13,
      low: 9,
      close: 12,
      volume: 2,
    });
  });
});
