/** Helpers d’état UI Position + placement initial depuis le chart. */

import type { DraftTrade } from '../components/marketReplay/ReplayTradePanel';
import type { VisibleCandle } from './replayEngine';
import {
  computeAtr,
  computeBoxEndTime,
  computeBoxWidthBars,
  computeInitialLevels,
  visiblePriceRangeFromBars,
  type PositionSide,
} from './positionToolSizing';
import type { PositionOverlayModel } from './positionToolPaint';

export type PositionUiState = {
  endTime: number | null;
  /** Largeur fixe en barres (évite le saut du bord droit au Play). */
  widthBars: number | null;
  qty: number;
  /** Pane sur lequel l’outil a été posé (null = pas d’overlay). */
  chartId: string | null;
  /** true une fois entry+SL+TP posés (outil ou auto-sizing). */
  active: boolean;
  selected: boolean;
};

export const emptyPositionUi = (): PositionUiState => ({
  endTime: null,
  widthBars: null,
  qty: 1,
  chartId: null,
  active: false,
  selected: false,
});

export function draftToPositionSide(direction: DraftTrade['direction']): PositionSide {
  return direction === 'SHORT' ? 'short' : 'long';
}

export function positionOverlayFromDraft(
  draft: DraftTrade,
  ui: PositionUiState,
  instrument?: string | null,
): PositionOverlayModel | null {
  if (
    !ui.active ||
    draft.entryTimestamp == null ||
    draft.entryPrice == null ||
    draft.stopPrice == null ||
    draft.targetPrice == null
  ) {
    return null;
  }
  const endTime = ui.endTime ?? draft.entryTimestamp;
  return {
    side: draftToPositionSide(draft.direction),
    entryTime: draft.entryTimestamp,
    entryPrice: draft.entryPrice,
    stopPrice: draft.stopPrice,
    targetPrice: draft.targetPrice,
    endTime,
    widthBars: ui.widthBars,
    qty: ui.qty,
    instrument,
  };
}

export type PlacePositionResult = {
  draftPatch: Pick<
    DraftTrade,
    'direction' | 'entryTimestamp' | 'entryPrice' | 'stopPrice' | 'targetPrice'
  > & { exitTimestamp: null; exitPrice: null };
  uiPatch: Partial<PositionUiState>;
};

/**
 * Calcule entry/SL/TP + endTime pour un clic (ou lastPrice) sur le chart.
 */
export function buildPlacedPosition(params: {
  side: PositionSide;
  entryPrice: number;
  entryTime: number;
  candles: VisibleCandle[];
  visiblePriceRange: number;
}): PlacePositionResult {
  const { side, entryPrice, entryTime, candles, visiblePriceRange } = params;
  const bars = candles.map((c) => ({ high: c.high, low: c.low, close: c.close }));
  const atr = computeAtr(bars, 14);
  const range =
    visiblePriceRange > 0 ? visiblePriceRange : visiblePriceRangeFromBars(bars);
  const levels = computeInitialLevels(entryPrice, side, atr, range, {}, bars);
  const times = candles.map((c) => c.time);
  const widthBars = computeBoxWidthBars(times);
  const endTime = computeBoxEndTime(times, entryTime);
  return {
    draftPatch: {
      direction: side === 'short' ? 'SHORT' : 'LONG',
      entryTimestamp: entryTime,
      entryPrice,
      stopPrice: levels.slPrice,
      targetPrice: levels.tpPrice,
      exitTimestamp: null,
      exitPrice: null,
    },
    uiPatch: {
      endTime,
      widthBars,
      active: true,
      selected: true,
      qty: 1,
    },
  };
}

export function flipDraftPosition(draft: DraftTrade): DraftTrade {
  if (draft.entryPrice == null || draft.stopPrice == null || draft.targetPrice == null) {
    return {
      ...draft,
      direction: draft.direction === 'LONG' ? 'SHORT' : 'LONG',
    };
  }
  const mid = draft.entryPrice;
  const slDist = draft.stopPrice - mid;
  const tpDist = draft.targetPrice - mid;
  return {
    ...draft,
    direction: draft.direction === 'LONG' ? 'SHORT' : 'LONG',
    stopPrice: mid - slDist,
    targetPrice: mid - tpDist,
  };
}
