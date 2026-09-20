import { describe, expect, it } from 'vitest';
import {
  buildPositionPricePath,
  hitTestPosition,
  positionHandlePoints,
  type PositionOverlayModel,
} from './positionToolPaint';
import type { CoordMapper } from './replayDrawings';

function mapper(): CoordMapper {
  return {
    width: 400,
    height: 300,
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
