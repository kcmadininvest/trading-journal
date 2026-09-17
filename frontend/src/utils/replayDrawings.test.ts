import { describe, expect, it } from 'vitest';
import {
  canFinishDraft,
  finalizeDraft,
  hitTestDrawings,
  pointsNeeded,
  snapTrendPointWithShift,
  timeToLogicalIndex,
  logicalIndexToX,
  priceToYExtrapolated,
  translateDrawing,
  updateDrawingHandle,
  updateDrawingStyle,
  type CoordMapper,
  type Drawing,
  type DrawingDraft,
} from './replayDrawings';

function identityMapper(width = 400, height = 300): CoordMapper {
  return {
    width,
    height,
    toX: (time) => time,
    toY: (price) => height - price,
    fromXY: (x, y) => ({ time: x, price: height - y }),
  };
}

describe('replayDrawings', () => {
  it('pointsNeeded matches tool', () => {
    expect(pointsNeeded('trendLine')).toBe(2);
    expect(pointsNeeded('horizontalLine')).toBe(1);
    expect(pointsNeeded('horizontalRay')).toBe(1);
    expect(pointsNeeded('rectangle')).toBe(2);
    expect(pointsNeeded('path')).toBeNull();
  });

  it('finalizes trend line and horizontal tools', () => {
    const style = { color: '#2962FF', lineWidth: 2 };
    const trend: DrawingDraft = {
      tool: 'trendLine',
      points: [
        { time: 1, price: 10 },
        { time: 5, price: 20 },
      ],
      preview: null,
      style,
    };
    const created = finalizeDraft(trend);
    expect(created).toMatchObject({
      type: 'trendLine',
      p1: { time: 1, price: 10 },
      p2: { time: 5, price: 20 },
    });

    const hLine = finalizeDraft({
      tool: 'horizontalLine',
      points: [{ time: 3, price: 15 }],
      preview: null,
      style,
    });
    expect(hLine?.type).toBe('horizontalLine');
  });

  it('path requires at least two points', () => {
    const draft: DrawingDraft = {
      tool: 'path',
      points: [{ time: 1, price: 1 }],
      preview: null,
      style: { color: '#f00', lineWidth: 1 },
    };
    expect(canFinishDraft(draft)).toBe(false);
    draft.points.push({ time: 2, price: 2 });
    expect(canFinishDraft(draft)).toBe(true);
    expect(finalizeDraft(draft)?.type).toBe('path');
  });

  it('hit-tests trend line body and handle', () => {
    const drawing: Drawing = {
      id: 't1',
      type: 'trendLine',
      style: { color: '#2962FF', lineWidth: 1 },
      p1: { time: 50, price: 100 },
      p2: { time: 150, price: 100 },
    };
    const mapper = identityMapper();
    // y = height - price = 200 for price 100
    const bodyHit = hitTestDrawings([drawing], null, { x: 100, y: 200 }, mapper);
    expect(bodyHit).toEqual({ kind: 'body', drawingId: 't1' });

    const handleHit = hitTestDrawings([drawing], 't1', { x: 50, y: 200 }, mapper);
    expect(handleHit).toEqual({
      kind: 'handle',
      drawingId: 't1',
      handleIndex: 0,
    });
  });

  it('updates handle, translates and styles', () => {
    const drawing: Drawing = {
      id: 't1',
      type: 'trendLine',
      style: { color: '#2962FF', lineWidth: 1 },
      p1: { time: 1, price: 10 },
      p2: { time: 5, price: 20 },
    };
    const moved = updateDrawingHandle(drawing, 1, { time: 9, price: 30 });
    expect(moved.type === 'trendLine' && moved.p2).toEqual({ time: 9, price: 30 });

    const shifted = translateDrawing(drawing, 10, -2);
    expect(shifted.type === 'trendLine' && shifted.p1).toEqual({ time: 11, price: 8 });

    const styled = updateDrawingStyle(drawing, { color: '#EF5350', lineWidth: 3 });
    expect(styled.style).toEqual({ color: '#EF5350', lineWidth: 3 });
  });

  it('snapTrendPointWithShift locks to horizontal and vertical', () => {
    const mapper = identityMapper();
    const anchor = { time: 100, price: 100 };
    // Nearly horizontal cursor (price space: y = height - price)
    const horiz = snapTrendPointWithShift(
      anchor,
      { time: 180, price: 108 },
      mapper,
    );
    expect(horiz.price).toBe(100);
    expect(horiz.time).toBeGreaterThan(100);

    const vert = snapTrendPointWithShift(
      anchor,
      { time: 108, price: 160 },
      mapper,
    );
    expect(vert.time).toBe(100);
    expect(vert.price).toBeGreaterThan(100);
  });

  it('timeToLogicalIndex interpolates across candle times', () => {
    const times = [100, 200, 300];
    expect(timeToLogicalIndex(times, 50)).toBe(0);
    expect(timeToLogicalIndex(times, 400)).toBe(2);
    expect(timeToLogicalIndex(times, 150)).toBeCloseTo(0.5);
    expect(timeToLogicalIndex(times, 200)).toBe(1);
    expect(timeToLogicalIndex([], 100)).toBeNull();
  });

  it('logicalIndexToX extrapolates outside visible range', () => {
    const vis = { from: 10, to: 20 };
    const lookup = (logical: number): number | null => {
      if (logical < vis.from || logical > vis.to) return null;
      return logical * 10; // 10px per logical unit
    };
    expect(logicalIndexToX(15, lookup, vis)).toBe(150);
    // Outside visible: extrapolate
    expect(logicalIndexToX(5, lookup, vis)).toBeCloseTo(50);
    expect(logicalIndexToX(25, lookup, vis)).toBeCloseTo(250);
  });

  it('priceToYExtrapolated maps outside visible price scale', () => {
    const height = 100;
    // Visible: price 200 at y=0, price 100 at y=100
    const priceToCoordinate = (price: number): number | null => {
      if (price > 200 || price < 100) return null;
      return ((200 - price) / 100) * height;
    };
    const coordinateToPrice = (y: number): number | null => 200 - (y / height) * 100;
    expect(priceToYExtrapolated(150, height, priceToCoordinate, coordinateToPrice)).toBe(50);
    expect(priceToYExtrapolated(250, height, priceToCoordinate, coordinateToPrice)).toBeCloseTo(-50);
    expect(priceToYExtrapolated(50, height, priceToCoordinate, coordinateToPrice)).toBeCloseTo(150);
  });
});
