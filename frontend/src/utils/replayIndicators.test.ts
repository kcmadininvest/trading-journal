import { describe, expect, it } from 'vitest';
import type { VisibleCandle } from './replayEngine';
import {
  addMovingAverage,
  buildReplayOverlays,
  computeAnchoredVwap,
  computeEma,
  computeSessionVwap,
  computeSma,
  emptyPaneIndicators,
  toggleAvwap,
} from './replayIndicators';

function c(
  time: number,
  close: number,
  extras: Partial<Pick<VisibleCandle, 'open' | 'high' | 'low' | 'volume'>> = {},
): VisibleCandle {
  const high = extras.high ?? close;
  const low = extras.low ?? close;
  return {
    time,
    open: extras.open ?? close,
    high,
    low,
    close,
    volume: extras.volume ?? 1,
  };
}

describe('computeSma', () => {
  const candles = [c(1, 1), c(2, 2), c(3, 3), c(4, 4), c(5, 5)];

  it('emits nothing until the window is full', () => {
    expect(computeSma(candles, 3)).toEqual([
      { time: 3, value: 2 },
      { time: 4, value: 3 },
      { time: 5, value: 4 },
    ]);
  });

  it('returns empty when period exceeds length', () => {
    expect(computeSma(candles, 8)).toEqual([]);
  });

  it('returns empty for an invalid period', () => {
    expect(computeSma(candles, 1)).toEqual([]);
    expect(computeSma(candles, 1.5)).toEqual([]);
  });
});

describe('computeEma', () => {
  it('seeds with SMA then applies the smoothing factor', () => {
    const candles = [c(1, 1), c(2, 2), c(3, 3), c(4, 4)];
    const points = computeEma(candles, 3);
    expect(points).toHaveLength(2);
    expect(points[0]).toEqual({ time: 3, value: 2 });
    // k = 2/4 = 0.5 → 4*0.5 + 2*0.5 = 3
    expect(points[1]).toEqual({ time: 4, value: 3 });
  });

  it('returns empty when there are not enough bars', () => {
    expect(computeEma([c(1, 1), c(2, 2)], 3)).toEqual([]);
  });
});

describe('computeSessionVwap', () => {
  it('uses typical price and cumulative volume', () => {
    const candles = [
      c(10, 11, { high: 12, low: 10, volume: 10 }),
      c(20, 12, { high: 14, low: 10, volume: 20 }),
    ];
    const points = computeSessionVwap(candles);
    expect(points).toHaveLength(2);
    expect(points[0].value).toBe(11);
    expect(points[1].value).toBeCloseTo(350 / 30, 10);
  });

  it('keeps VWAP when a bar has zero volume', () => {
    const candles = [
      c(10, 11, { high: 12, low: 10, volume: 10 }),
      c(20, 99, { high: 100, low: 98, volume: 0 }),
      c(30, 13, { high: 14, low: 12, volume: 10 }),
    ];
    const points = computeSessionVwap(candles);
    expect(points).toHaveLength(3);
    expect(points[1].value).toBe(11);
    expect(points[2].value).toBeCloseTo((11 * 10 + 13 * 10) / 20, 10);
  });

  it('emits nothing while cumulative volume is zero', () => {
    expect(
      computeSessionVwap([
        c(1, 10, { volume: 0 }),
        c(2, 11, { volume: 0 }),
      ]),
    ).toEqual([]);
  });
});

describe('computeAnchoredVwap', () => {
  it('starts at the first bar on or after the anchor', () => {
    const candles = [
      c(10, 10, { high: 10, low: 10, volume: 10 }),
      c(20, 20, { high: 20, low: 20, volume: 10 }),
      c(30, 30, { high: 30, low: 30, volume: 10 }),
    ];
    const points = computeAnchoredVwap(candles, 20);
    expect(points.map((p) => p.time)).toEqual([20, 30]);
    expect(points[0].value).toBe(20);
    expect(points[1].value).toBe(25);
  });

  it('returns empty when the anchor is after all candles', () => {
    expect(computeAnchoredVwap([c(10, 10, { volume: 5 })], 99)).toEqual([]);
  });
});

describe('buildReplayOverlays', () => {
  it('composes enabled overlays only', () => {
    let state = emptyPaneIndicators();
    state = addMovingAverage(state, 'sma', 2);
    state = { ...state, vwap: true };
    state = toggleAvwap(state, true);
    state = { ...state, avwapAnchor: 2 };
    const overlays = buildReplayOverlays(
      [c(1, 1, { volume: 1 }), c(2, 3, { volume: 1 })],
      state,
    );
    expect(overlays.map((o) => o.id)).toEqual([
      expect.stringMatching(/^sma-2-/),
      'vwap',
      'avwap',
    ]);
    expect(overlays[0].data).toHaveLength(1);
  });

  it('omits AVWAP until an anchor is set', () => {
    const state = toggleAvwap(emptyPaneIndicators(), true);
    const overlays = buildReplayOverlays([c(1, 1)], state);
    expect(overlays).toEqual([]);
  });

  it('does not add a duplicate MA of the same kind and period', () => {
    const once = addMovingAverage(emptyPaneIndicators(), 'ema', 9);
    const twice = addMovingAverage(once, 'ema', 9);
    expect(twice.mas).toHaveLength(1);
  });
});
