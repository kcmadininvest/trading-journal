/** Constantes viewBox du bandeau marché replay (partagées layout + rendu). */
export const TAPE_VIEW_W = 400;
export const TAPE_VIEW_H = 228;
export const TAPE_PAD_LEFT = 10;
export const TAPE_PAD_RIGHT = 10;
export const TAPE_PAD_TOP = 10;
export const TAPE_PAD_BOTTOM = 18;
export const TAPE_CHART_W = TAPE_VIEW_W - TAPE_PAD_LEFT - TAPE_PAD_RIGHT;
export const TAPE_CHART_H = TAPE_VIEW_H - TAPE_PAD_TOP - TAPE_PAD_BOTTOM;

export const TAPE_EXIT_DOT_R = 4.5;
export const TAPE_EXIT_TICK_R = 2.25;

export function tapeYForPrice(
  price: number,
  yMin: number,
  yMax: number,
): number {
  const range = yMax - yMin || 1;
  const ratio = (price - yMin) / range;
  return TAPE_PAD_TOP + TAPE_CHART_H * (1 - ratio);
}

export function tapeXForBarIndex(index: number, barCount: number): number {
  if (barCount <= 1) return TAPE_PAD_LEFT + TAPE_CHART_W / 2;
  const slot = TAPE_CHART_W / barCount;
  return TAPE_PAD_LEFT + index * slot + slot / 2;
}

export function tapeSlotWidth(barCount: number): number {
  if (barCount <= 0) return TAPE_CHART_W;
  return TAPE_CHART_W / barCount;
}

/** Demi-largeur du corps de bougie (aligné sur SessionMarketTape barSlotWidth). */
export function tapeCandleHalfWidth(
  barIndex: number,
  barCount: number,
  isFuture = false,
): number {
  if (barCount <= 0) return 9;
  const slot = tapeSlotWidth(barCount);
  const maxW = isFuture ? 12 : 18;
  const bodyW = Math.max(isFuture ? 4 : 6, Math.min(maxW, slot * 0.72));
  return bodyW / 2;
}
