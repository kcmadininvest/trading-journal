export type PriceFlashDirection = 'up' | 'down' | null;

export function getPriceFlashDirection(
  previous: number | null | undefined,
  next: number | null | undefined,
): PriceFlashDirection {
  if (previous === null || previous === undefined || next === null || next === undefined) {
    return null;
  }
  if (Number.isNaN(previous) || Number.isNaN(next) || previous === next) {
    return null;
  }
  return next > previous ? 'up' : 'down';
}
