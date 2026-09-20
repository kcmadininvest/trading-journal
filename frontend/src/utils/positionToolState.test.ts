import { describe, expect, it } from 'vitest';
import {
  buildPlacedPosition,
  emptyPositionUi,
  flipDraftPosition,
  positionOverlayFromDraft,
} from './positionToolState';
import type { DraftTrade } from '../components/marketReplay/ReplayTradePanel';
import type { VisibleCandle } from './replayEngine';

function candle(time: number, close: number, range = 4): VisibleCandle {
  return {
    time,
    open: close,
    high: close + range / 2,
    low: close - range / 2,
    close,
    volume: 1,
  };
}

describe('positionToolState', () => {
  it('buildPlacedPosition fills draft + ui with ATR clamp', () => {
    const candles = Array.from({ length: 40 }, (_, i) =>
      candle(1_000_000 + i * 60, 100 + i * 0.1, 2),
    );
    const placed = buildPlacedPosition({
      side: 'long',
      entryPrice: 105,
      entryTime: candles[20].time,
      candles,
      visiblePriceRange: 20,
    });
    expect(placed.draftPatch.direction).toBe('LONG');
    expect(placed.draftPatch.entryPrice).toBe(105);
    expect(placed.draftPatch.stopPrice).toBeLessThan(105);
    expect(placed.draftPatch.targetPrice).toBeGreaterThan(105);
    expect(placed.uiPatch.active).toBe(true);
    expect(placed.uiPatch.endTime).toBeGreaterThan(candles[20].time);
  });

  it('positionOverlayFromDraft requires active ui + full levels', () => {
    const draft: DraftTrade = {
      direction: 'LONG',
      entryTimestamp: 100,
      entryPrice: 10,
      exitTimestamp: null,
      exitPrice: null,
      stopPrice: 9,
      targetPrice: 12,
    };
    expect(positionOverlayFromDraft(draft, emptyPositionUi())).toBeNull();
    expect(
      positionOverlayFromDraft(draft, {
        ...emptyPositionUi(),
        active: true,
        endTime: 200,
      }),
    ).toMatchObject({
      side: 'long',
      entryPrice: 10,
      stopPrice: 9,
      targetPrice: 12,
      endTime: 200,
    });
  });

  it('flipDraftPosition mirrors SL/TP', () => {
    const flipped = flipDraftPosition({
      direction: 'LONG',
      entryTimestamp: 1,
      entryPrice: 100,
      exitTimestamp: null,
      exitPrice: null,
      stopPrice: 90,
      targetPrice: 120,
    });
    expect(flipped.direction).toBe('SHORT');
    expect(flipped.stopPrice).toBe(110);
    expect(flipped.targetPrice).toBe(80);
  });
});
