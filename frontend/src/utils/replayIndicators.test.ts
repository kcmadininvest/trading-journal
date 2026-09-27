import { describe, expect, it } from 'vitest';
import type { VisibleCandle } from './replayEngine';
import {
  addAvwap,
  addMovingAverage,
  AVWAP_COLORS,
  buildReplayOverlays,
  computeAnchoredVwap,
  computeEma,
  computeSessionVwap,
  computeSma,
  emptyPaneIndicators,
  MAX_AVWAPS,
  normalizePaneIndicators,
  pendingAvwap,
  pickAvwapAt,
  removeAvwap,
  setAvwapAnchor,
  setAvwapStyle,
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

describe('multi AVWAP helpers', () => {
  it('adds a pending AVWAP and blocks a second pending', () => {
    const state = addAvwap(emptyPaneIndicators());
    expect(state.avwaps).toHaveLength(1);
    expect(pendingAvwap(state)?.anchorTime).toBeNull();
    expect(addAvwap(state).avwaps).toHaveLength(1);
  });

  it('anchors and styles only the targeted id', () => {
    let state = addAvwap(emptyPaneIndicators());
    const firstId = state.avwaps[0].id;
    state = setAvwapAnchor(state, firstId, 10);
    state = addAvwap(state);
    const secondId = state.avwaps[1].id;
    state = setAvwapAnchor(state, secondId, 20);
    state = setAvwapStyle(state, firstId, { color: '#EF5350', lineWidth: 4 });
    expect(state.avwaps.find((a) => a.id === firstId)?.style).toEqual({
      color: '#EF5350',
      lineWidth: 4,
    });
    expect(state.avwaps.find((a) => a.id === secondId)?.style.color).not.toBe('#EF5350');
    state = removeAvwap(state, firstId);
    expect(state.avwaps.map((a) => a.id)).toEqual([secondId]);
  });

  it('reuses a free palette color after removal', () => {
    let state = emptyPaneIndicators();
    const ids: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      state = addAvwap(state);
      const id = state.avwaps[state.avwaps.length - 1].id;
      ids.push(id);
      state = setAvwapAnchor(state, id, i + 1);
    }
    const removedColor = state.avwaps[0].style.color;
    state = removeAvwap(state, ids[0]);
    state = addAvwap(state);
    const next = state.avwaps[state.avwaps.length - 1];
    expect(next.style.color).toBe(removedColor);
  });

  it('caps at MAX_AVWAPS', () => {
    let state = emptyPaneIndicators();
    for (let i = 0; i < MAX_AVWAPS; i += 1) {
      state = addAvwap(state);
      const id = state.avwaps[state.avwaps.length - 1].id;
      state = setAvwapAnchor(state, id, i + 1);
    }
    expect(state.avwaps).toHaveLength(MAX_AVWAPS);
    expect(addAvwap(state).avwaps).toHaveLength(MAX_AVWAPS);
    expect(AVWAP_COLORS[0]).toBe('#a855f7');
  });
});

describe('buildReplayOverlays', () => {
  it('composes enabled overlays including multiple AVWAPs', () => {
    let state = emptyPaneIndicators();
    state = addMovingAverage(state, 'sma', 2);
    state = { ...state, vwap: true };
    state = addAvwap(state);
    const firstId = state.avwaps[0].id;
    state = setAvwapAnchor(state, firstId, 2);
    state = addAvwap(state);
    const secondId = state.avwaps[1].id;
    state = setAvwapAnchor(state, secondId, 1);
    const overlays = buildReplayOverlays(
      [c(1, 1, { volume: 1 }), c(2, 3, { volume: 1 })],
      state,
    );
    expect(overlays.map((o) => o.id)).toEqual([
      expect.stringMatching(/^sma-2-/),
      'vwap',
      firstId,
      secondId,
    ]);
    expect(overlays[0].data).toHaveLength(1);
  });

  it('omits AVWAP until an anchor is set', () => {
    const state = addAvwap(emptyPaneIndicators());
    const overlays = buildReplayOverlays([c(1, 1)], state);
    expect(overlays).toEqual([]);
  });

  it('applies avwap style color and lineWidth to the overlay', () => {
    let state = addAvwap(emptyPaneIndicators());
    const id = state.avwaps[0].id;
    state = setAvwapAnchor(state, id, 1);
    state = setAvwapStyle(state, id, { color: '#EF5350', lineWidth: 4 });
    const overlays = buildReplayOverlays([c(1, 1, { volume: 1 })], state);
    expect(overlays).toHaveLength(1);
    expect(overlays[0]).toMatchObject({
      id,
      color: '#EF5350',
      lineWidth: 4,
    });
  });

  it('does not add a duplicate MA of the same kind and period', () => {
    const once = addMovingAverage(emptyPaneIndicators(), 'ema', 9);
    const twice = addMovingAverage(once, 'ema', 9);
    expect(twice.mas).toHaveLength(1);
  });
});

describe('normalizePaneIndicators', () => {
  it('migrates legacy single AVWAP', () => {
    const next = normalizePaneIndicators({
      vwap: true,
      avwap: true,
      avwapAnchor: 42,
      avwapStyle: { color: '#abc', lineWidth: 3 },
      mas: [{ id: 'sma-20-1', kind: 'sma', period: 20 }],
    });
    expect(next.vwap).toBe(true);
    expect(next.mas).toHaveLength(1);
    expect(next.avwaps).toEqual([
      {
        id: 'avwap-legacy',
        anchorTime: 42,
        style: { color: '#abc', lineWidth: 3 },
      },
    ]);
  });

  it('migrates legacy pending AVWAP', () => {
    const next = normalizePaneIndicators({
      vwap: false,
      avwap: true,
      avwapAnchor: null,
      avwapStyle: { color: '#a855f7', lineWidth: 2 },
    });
    expect(next.avwaps).toEqual([
      {
        id: 'avwap-legacy',
        anchorTime: null,
        style: { color: '#a855f7', lineWidth: 2 },
      },
    ]);
  });

  it('returns empty when legacy AVWAP is off and mas is missing', () => {
    const next = normalizePaneIndicators({ vwap: false, avwap: false });
    expect(next).toEqual(emptyPaneIndicators());
  });

  it('keeps modern avwaps array and drops extra pendings', () => {
    const next = normalizePaneIndicators({
      vwap: false,
      avwaps: [
        {
          id: 'avwap-1',
          anchorTime: null,
          style: { color: '#a855f7', lineWidth: 2 },
        },
        {
          id: 'avwap-2',
          anchorTime: null,
          style: { color: '#ec4899', lineWidth: 2 },
        },
        {
          id: 'avwap-3',
          anchorTime: 10,
          style: { color: '#8b5cf6', lineWidth: 2 },
        },
      ],
      mas: [],
    });
    expect(next.avwaps).toHaveLength(2);
    expect(next.avwaps.filter((a) => a.anchorTime == null)).toHaveLength(1);
    expect(next.avwaps.some((a) => a.id === 'avwap-3')).toBe(true);
  });
});

describe('pickAvwapAt', () => {
  const overlays = [
    {
      id: 'vwap',
      title: 'VWAP',
      color: '#f59e0b',
      data: [{ time: 1, value: 100 }],
    },
    {
      id: 'avwap-a',
      title: 'AVWAP',
      color: '#a855f7',
      data: [
        { time: 1, value: 10 },
        { time: 2, value: 20 },
      ],
    },
    {
      id: 'avwap-b',
      title: 'AVWAP',
      color: '#ec4899',
      data: [
        { time: 1, value: 50 },
        { time: 2, value: 60 },
      ],
    },
  ];

  it('picks the closest AVWAP within tolerance', () => {
    const priceToY = (price: number) => price; // 1:1
    expect(pickAvwapAt(overlays, 2, 22, priceToY, 6)).toBe('avwap-a');
    expect(pickAvwapAt(overlays, 2, 58, priceToY, 6)).toBe('avwap-b');
  });

  it('returns null when outside tolerance', () => {
    const priceToY = (price: number) => price;
    expect(pickAvwapAt(overlays, 2, 40, priceToY, 6)).toBeNull();
  });

  it('ignores non-AVWAP overlays', () => {
    const priceToY = (price: number) => price;
    expect(pickAvwapAt(overlays, 1, 100, priceToY, 6)).toBeNull();
  });
});
