import { describe, expect, it } from 'vitest';
import {
  averageRange,
  clamp,
  computeAtr,
  computeBoxEndTime,
  computeInitialLevels,
  DEFAULT_POSITION_SIZING,
  resolveVolatilityDistance,
  visiblePriceRangeFromBars,
  type OhlcBar,
} from './positionToolSizing';

function makeBars(count: number, base = 100, range = 2): OhlcBar[] {
  const bars: OhlcBar[] = [];
  for (let i = 0; i < count; i += 1) {
    const close = base + i * 0.1;
    bars.push({
      high: close + range / 2,
      low: close - range / 2,
      close,
    });
  }
  return bars;
}

describe('positionToolSizing', () => {
  it('clamp bounds value', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });

  it('computeAtr returns null with insufficient history', () => {
    expect(computeAtr(makeBars(5), 14)).toBeNull();
  });

  it('computeAtr returns positive ATR with enough bars', () => {
    const atr = computeAtr(makeBars(30, 100, 4), 14);
    expect(atr).not.toBeNull();
    expect(atr!).toBeGreaterThan(0);
  });

  it('averageRange falls back when ATR unavailable', () => {
    const avg = averageRange(makeBars(5, 50, 3), 14);
    expect(avg).toBeCloseTo(3, 5);
  });

  it('keeps ATR stop when inside visible fraction band', () => {
    const atr = 10;
    const visibleRange = 100; // min 5, max 40
    const result = computeInitialLevels(1000, 'long', atr, visibleRange);
    expect(result.stopDistance).toBe(10);
    expect(result.tpDistance).toBe(15);
    expect(result.slPrice).toBe(990);
    expect(result.tpPrice).toBe(1015);
  });

  it('raises stop to minFraction when ATR too small for zoom', () => {
    const atr = 1;
    const visibleRange = 100; // minPx = 5
    const result = computeInitialLevels(1000, 'long', atr, visibleRange);
    expect(result.stopDistance).toBe(5);
    expect(result.tpDistance).toBe(7.5);
  });

  it('caps stop at maxFraction when ATR too large for zoom', () => {
    const atr = 80;
    const visibleRange = 100; // maxPx = 40
    const result = computeInitialLevels(1000, 'short', atr, visibleRange);
    expect(result.stopDistance).toBe(40);
    expect(result.tpDistance).toBe(60);
    expect(result.slPrice).toBe(1040);
    expect(result.tpPrice).toBe(940);
  });

  it('falls back to price fraction when no ATR and no bars', () => {
    const result = computeInitialLevels(2000, 'long', null, 0);
    expect(result.stopDistance).toBeCloseTo(2000 * 0.005, 6);
  });

  it('resolveVolatilityDistance uses average range then price fallback', () => {
    const fromAvg = resolveVolatilityDistance(makeBars(5, 100, 4), 100);
    expect(fromAvg).toBeCloseTo(4 * DEFAULT_POSITION_SIZING.kStop, 5);

    const fromPrice = resolveVolatilityDistance([], 500);
    expect(fromPrice).toBeCloseTo(500 * 0.005, 6);
  });

  it('computeBoxEndTime spans ~18% of candles', () => {
    const times = Array.from({ length: 100 }, (_, i) => 1_000_000 + i * 60);
    const end = computeBoxEndTime(times, times[10]);
    const endIdx = times.indexOf(end);
    expect(endIdx).toBe(10 + 18);
  });

  it('visiblePriceRangeFromBars', () => {
    expect(visiblePriceRangeFromBars([])).toBe(0);
    expect(
      visiblePriceRangeFromBars([
        { high: 110, low: 100, close: 105 },
        { high: 120, low: 95, close: 110 },
      ]),
    ).toBe(25);
  });
});
