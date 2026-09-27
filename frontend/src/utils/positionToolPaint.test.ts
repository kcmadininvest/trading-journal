import { describe, expect, it } from 'vitest';
import {
  buildPositionLabelCandidates,
  buildPositionPricePath,
  hitTestPosition,
  pickFittingLabelText,
  positionHandlePoints,
  positionHandleRadius,
  resolvePositionUiScale,
  shouldUseCompactPositionLabels,
  POSITION_UI_REF_AREA,
  POSITION_UI_SCALE_MAX,
  POSITION_UI_SCALE_MIN,
  type PositionLabelFormatters,
  type PositionOverlayModel,
} from './positionToolPaint';
import type { CoordMapper } from './replayDrawings';

function mapper(overrides?: Partial<Pick<CoordMapper, 'width' | 'height'>>): CoordMapper {
  return {
    width: overrides?.width ?? 400,
    height: overrides?.height ?? 300,
    toX: (time) => time,
    toY: (price) => 300 - price,
    fromXY: (x, y) => ({ time: x, price: 300 - y }),
  };
}

const model: PositionOverlayModel = {
  side: 'long',
  entryTime: 100,
  entryPrice: 150,
  stopPrice: 100,
  targetPrice: 220,
  endTime: 200,
  qty: 1,
};

const formatters: PositionLabelFormatters = {
  formatPrice: (n) => n.toFixed(2),
  formatRr: (n) => `1:${n.toFixed(2)}`,
  labels: {
    entry: 'Entry',
    stop: 'Stop',
    target: 'Target',
    rr: 'R:R',
  },
};

describe('positionToolPaint', () => {
  it('exposes entry/stop/target/end handles', () => {
    const handles = positionHandlePoints(model, mapper());
    expect(handles.entry).toEqual({ x: 100, y: 150 });
    expect(handles.stop).toEqual({ x: 150, y: 200 });
    expect(handles.target).toEqual({ x: 150, y: 80 });
    expect(handles.end).toEqual({ x: 200, y: 150 });
  });

  it('hit-tests body and selected handles', () => {
    const m = mapper();
    expect(hitTestPosition(model, { x: 150, y: 150 }, m, false)?.kind).toBe('body');
    expect(hitTestPosition(model, { x: 100, y: 150 }, m, true)).toEqual({
      kind: 'handle',
      handle: 'entry',
    });
    expect(hitTestPosition(model, { x: 10, y: 10 }, m, true)).toBeNull();
  });

  it('grabs the whole right edge for width, even unselected', () => {
    const m = mapper();
    expect(hitTestPosition(model, { x: 198, y: 120 }, m, false)).toEqual({
      kind: 'handle',
      handle: 'end',
    });
    expect(hitTestPosition(model, { x: 180, y: 120 }, m, false)?.kind).toBe('body');
  });

  it('buildPositionPricePath starts at entry and chains closes in range', () => {
    const path = buildPositionPricePath(model, [
      { time: 50, close: 140 },
      { time: 100, close: 149 },
      { time: 120, close: 155 },
      { time: 160, close: 148 },
      { time: 200, close: 152 },
      { time: 220, close: 160 },
    ]);
    expect(path).toEqual([
      { time: 100, price: 150 },
      { time: 120, price: 155 },
      { time: 160, price: 148 },
      { time: 200, price: 152 },
    ]);
  });

  it('buildPositionPricePath does not extend past last candle into the future', () => {
    const path = buildPositionPricePath(model, [
      { time: 100, close: 150 },
      { time: 140, close: 158 },
    ]);
    expect(path).toEqual([
      { time: 100, price: 150 },
      { time: 140, price: 158 },
    ]);
  });

  it('buildPositionPricePath with no candles after entry is just the entry point', () => {
    const path = buildPositionPricePath(model, []);
    expect(path).toEqual([{ time: 100, price: 150 }]);
  });

  it('buildPositionPricePath stops at target when close crosses upper bound', () => {
    const path = buildPositionPricePath(model, [
      { time: 120, close: 180 },
      { time: 140, close: 230 },
      { time: 160, close: 200 },
    ]);
    expect(path[0]).toEqual({ time: 100, price: 150 });
    expect(path[1]).toEqual({ time: 120, price: 180 });
    expect(path).toHaveLength(3);
    expect(path[2].price).toBe(220);
    expect(path[2].time).toBeGreaterThan(120);
    expect(path[2].time).toBeLessThanOrEqual(140);
  });

  it('buildPositionPricePath stops at stop when close crosses lower bound', () => {
    const path = buildPositionPricePath(model, [
      { time: 120, close: 130 },
      { time: 140, close: 90 },
      { time: 160, close: 110 },
    ]);
    expect(path).toHaveLength(3);
    expect(path[2].price).toBe(100);
    expect(path[2].time).toBeGreaterThan(120);
    expect(path[2].time).toBeLessThanOrEqual(140);
  });

  it('buildPositionPricePath stops when high touches TP even if close stays below', () => {
    const path = buildPositionPricePath(model, [
      { time: 120, close: 180, high: 190, low: 170 },
      { time: 140, close: 210, high: 225, low: 200 }, // high crosses 220
      { time: 160, close: 200, high: 205, low: 195 },
    ]);
    expect(path[path.length - 1].price).toBe(220);
    expect(path.some((p) => p.time > 140)).toBe(false);
  });

  it('buildPositionPricePath sorts candles so the path never goes back in time', () => {
    const path = buildPositionPricePath(model, [
      { time: 180, close: 160 },
      { time: 120, close: 155 },
      { time: 150, close: 158 },
    ]);
    for (let i = 1; i < path.length; i += 1) {
      expect(path[i].time).toBeGreaterThanOrEqual(path[i - 1].time);
    }
    expect(path.map((p) => p.time)).toEqual([100, 120, 150, 180]);
  });
});

describe('position chrome scale', () => {
  it('resolvePositionUiScale is below 1 on a small pane and above 1 on a large pane', () => {
    const small = resolvePositionUiScale({ width: 280, height: 180 });
    const side = Math.sqrt(POSITION_UI_REF_AREA);
    const ref = resolvePositionUiScale({ width: side, height: side });
    const large = resolvePositionUiScale({ width: 1200, height: 800 });
    expect(small).toBeLessThan(1);
    expect(small).toBeGreaterThanOrEqual(POSITION_UI_SCALE_MIN);
    expect(ref).toBeCloseTo(1, 5);
    expect(large).toBeGreaterThan(1);
    expect(large).toBeLessThanOrEqual(POSITION_UI_SCALE_MAX);
  });

  it('resolvePositionUiScale clamps extreme pane sizes', () => {
    expect(resolvePositionUiScale({ width: 40, height: 40 })).toBe(
      POSITION_UI_SCALE_MIN,
    );
    expect(resolvePositionUiScale({ width: 4000, height: 3000 })).toBe(
      POSITION_UI_SCALE_MAX,
    );
  });

  it('resolvePositionUiScale respects font_size preference', () => {
    const medium = resolvePositionUiScale({ width: 640, height: 360 }, 'medium');
    const small = resolvePositionUiScale({ width: 640, height: 360 }, 'small');
    const large = resolvePositionUiScale({ width: 640, height: 360 }, 'large');
    expect(small).toBeLessThan(medium);
    expect(large).toBeGreaterThan(medium);
  });

  it('shouldUseCompactPositionLabels when box is narrow', () => {
    expect(shouldUseCompactPositionLabels(80, 1)).toBe(true);
    expect(shouldUseCompactPositionLabels(200, 1)).toBe(false);
  });

  it('pickFittingLabelText picks the longest that fits', () => {
    const measure = (t: string) => t.length;
    expect(
      pickFittingLabelText(measure, ['Entry 150.00', '150.00'], 20),
    ).toBe('Entry 150.00');
    expect(
      pickFittingLabelText(measure, ['Entry 150.00', '150.00'], 8),
    ).toBe('150.00');
  });

  it('buildPositionLabelCandidates includes full then compact variants', () => {
    const c = buildPositionLabelCandidates(model, formatters);
    expect(c.entry[0]).toContain('Entry');
    expect(c.entry[c.entry.length - 1]).toBe('150.00');
    expect(c.target[0]).toContain('R:R');
    expect(c.target[c.target.length - 1]).toBe('220.00');
  });

  it('hit-test handle radius follows uiScale', () => {
    const largeMapper = mapper({ width: 1200, height: 800 });
    const scale = resolvePositionUiScale(largeMapper, 'large');
    const r = positionHandleRadius(scale);
    // À gauche de l’entry : hors body sur petit pane, dans le rayon handle sur grand pane.
    const baseMiss = hitTestPosition(
      model,
      { x: 100 - 10, y: 150 },
      mapper({ width: 200, height: 120 }),
      true,
      { fontSizePref: 'small' },
    );
    const scaledHit = hitTestPosition(
      model,
      { x: 100 - Math.floor(r * 0.85), y: 150 },
      largeMapper,
      true,
      { fontSizePref: 'large' },
    );
    expect(baseMiss).toBeNull();
    expect(scaledHit).toEqual({ kind: 'handle', handle: 'entry' });
  });
});
