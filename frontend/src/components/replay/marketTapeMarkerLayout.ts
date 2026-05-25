import type { TapeMarker, TapeRenderModel } from './marketTapeData';
import {
  TAPE_EXIT_DOT_R,
  TAPE_PAD_LEFT,
  TAPE_VIEW_W,
  tapeCandleHalfWidth,
  tapeXForBarIndex,
  tapeYForPrice,
} from './marketTapeChartMetrics';
import type { MarketTapeTheme } from './replayStyles';

export interface TapeExitMarkerLayout {
  barX: number;
  priceY: number;
  dotX: number;
  dotY: number;
  fill: string;
}

const EXIT_DOT_GAP_PX = 6;

function exitFill(marker: Pick<TapeMarker, 'pnl'>, theme: MarketTapeTheme): string {
  const win = marker.pnl != null && marker.pnl >= 0;
  return win ? theme.exitWin : theme.exitLoss;
}

/**
 * Pastille entièrement à gauche du corps de bougie (ou à droite si stackOffsetX > 0 / bord).
 */
function computeExitDotX(
  barX: number,
  barCount: number,
  candleHalfW: number,
  stackOffsetX = 0,
): number {
  const baseOffset = candleHalfW + TAPE_EXIT_DOT_R + EXIT_DOT_GAP_PX;
  const minX = TAPE_PAD_LEFT + TAPE_EXIT_DOT_R + 1;
  const maxX = TAPE_VIEW_W - TAPE_EXIT_DOT_R - 1;

  if (stackOffsetX > 0) {
    const rightCandidate = barX + baseOffset + stackOffsetX;
    return Math.min(rightCandidate, maxX);
  }

  const leftCandidate = barX - baseOffset + stackOffsetX;
  if (leftCandidate >= minX) {
    return leftCandidate;
  }

  const rightCandidate = barX + baseOffset;
  return Math.min(rightCandidate, maxX);
}

export function computeTapeExitMarkerLayout(
  marker: TapeMarker,
  model: TapeRenderModel,
  barCount: number,
  theme: MarketTapeTheme,
): TapeExitMarkerLayout | null {
  if (marker.kind !== 'exit') return null;

  const bar = model.bars[marker.barIndex];
  const isFuture = bar?.isFuture ?? false;
  const barX = tapeXForBarIndex(marker.barIndex, barCount);
  const stackY = marker.offsetY ?? 0;
  const stackX = marker.offsetX ?? 0;
  const priceY = tapeYForPrice(marker.price, model.yMin, model.yMax) + stackY;
  const candleHalfW = tapeCandleHalfWidth(marker.barIndex, barCount, isFuture);
  const dotX = computeExitDotX(barX, barCount, candleHalfW, stackX);

  return {
    barX,
    priceY,
    dotX,
    dotY: priceY,
    fill: exitFill(marker, theme),
  };
}

/** Coordonnées d’interaction (centre pastille pour sorties, ancre entrée inchangée). */
export function computeTapeMarkerHitCoords(
  marker: TapeMarker,
  model: TapeRenderModel,
  barCount: number,
  theme: MarketTapeTheme,
  entryAnchorOffsetY: number,
): { x: number; y: number } {
  if (marker.kind === 'exit') {
    const layout = computeTapeExitMarkerLayout(marker, model, barCount, theme);
    if (layout) {
      return { x: layout.dotX, y: layout.dotY };
    }
  }
  return {
    x: tapeXForBarIndex(marker.barIndex, barCount),
    y: tapeYForPrice(marker.price, model.yMin, model.yMax) + entryAnchorOffsetY,
  };
}
