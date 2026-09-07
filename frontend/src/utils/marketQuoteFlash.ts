export type PriceFlashDirection = 'up' | 'down' | null;

export function getPriceFlashDirection(
  previous: number | null | undefined,
  next: number | null | undefined,
  decimals?: number,
): PriceFlashDirection {
  if (previous === null || previous === undefined || next === null || next === undefined) {
    return null;
  }
  if (Number.isNaN(previous) || Number.isNaN(next)) {
    return null;
  }

  let prevValue = previous;
  let nextValue = next;
  if (decimals !== undefined && Number.isFinite(decimals) && decimals >= 0) {
    const factor = 10 ** decimals;
    prevValue = Math.round(previous * factor) / factor;
    nextValue = Math.round(next * factor) / factor;
  }

  if (prevValue === nextValue) {
    return null;
  }
  return nextValue > prevValue ? 'up' : 'down';
}
