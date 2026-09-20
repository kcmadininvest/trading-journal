/** Dimensionnement initial de l’outil Position (ATR + clamp visuel). */

export type PositionSide = 'long' | 'short';

export type OhlcBar = {
  high: number;
  low: number;
  close: number;
};

export type InitialLevelsParams = {
  kStop?: number;
  defaultRRR?: number;
  minFraction?: number;
  maxFraction?: number;
  atrPeriod?: number;
  priceFallbackFraction?: number;
};

export type InitialLevelsResult = {
  tpPrice: number;
  slPrice: number;
  stopDistance: number;
  tpDistance: number;
};

export const DEFAULT_POSITION_SIZING: Required<InitialLevelsParams> = {
  kStop: 1.0,
  defaultRRR: 1.5,
  minFraction: 0.05,
  maxFraction: 0.4,
  atrPeriod: 14,
  priceFallbackFraction: 0.005,
};

/** Fraction de bougies visibles pour la largeur horizontale de la boîte. */
export const POSITION_BOX_WIDTH_FRACTION = 0.18;

export function clamp(value: number, min: number, max: number): number {
  if (max < min) return value;
  return Math.min(max, Math.max(min, value));
}

/**
 * ATR Wilder classique. Retourne null si historique insuffisant (&lt; period+1 barres).
 */
export function computeAtr(bars: OhlcBar[], period = 14): number | null {
  if (period < 1 || bars.length < period + 1) return null;
  const trueRanges: number[] = [];
  for (let i = 1; i < bars.length; i += 1) {
    const cur = bars[i];
    const prevClose = bars[i - 1].close;
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prevClose),
      Math.abs(cur.low - prevClose),
    );
    trueRanges.push(tr);
  }
  if (trueRanges.length < period) return null;
  let atr =
    trueRanges.slice(0, period).reduce((sum, tr) => sum + tr, 0) / period;
  for (let i = period; i < trueRanges.length; i += 1) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }
  return Number.isFinite(atr) && atr > 0 ? atr : null;
}

/** Moyenne des ranges (H−L) sur les N dernières barres. */
export function averageRange(bars: OhlcBar[], lookback = 14): number | null {
  if (bars.length === 0) return null;
  const slice = bars.slice(-Math.max(1, lookback));
  let sum = 0;
  let n = 0;
  for (const bar of slice) {
    const range = bar.high - bar.low;
    if (Number.isFinite(range) && range > 0) {
      sum += range;
      n += 1;
    }
  }
  if (n === 0) return null;
  const avg = sum / n;
  return Number.isFinite(avg) && avg > 0 ? avg : null;
}

/**
 * Volatilité de référence : ATR → moyenne des ranges → fraction du prix.
 */
export function resolveVolatilityDistance(
  bars: OhlcBar[],
  entryPrice: number,
  params: Required<InitialLevelsParams> = DEFAULT_POSITION_SIZING,
): number {
  const atr = computeAtr(bars, params.atrPeriod);
  if (atr != null) return atr * params.kStop;

  const avg = averageRange(bars, params.atrPeriod);
  if (avg != null) return avg * params.kStop;

  const fallback = Math.abs(entryPrice) * params.priceFallbackFraction;
  return fallback > 0 ? fallback : Math.abs(entryPrice) * 0.005 || 1;
}

export function computeInitialLevels(
  entryPrice: number,
  side: PositionSide,
  atrOrNull: number | null,
  visibleRange: number,
  params: InitialLevelsParams = {},
  barsForFallback?: OhlcBar[],
): InitialLevelsResult {
  const p = { ...DEFAULT_POSITION_SIZING, ...params };
  const safeVisible =
    Number.isFinite(visibleRange) && visibleRange > 0 ? visibleRange : 0;

  let distanceStopAtr: number;
  if (atrOrNull != null && Number.isFinite(atrOrNull) && atrOrNull > 0) {
    distanceStopAtr = atrOrNull * p.kStop;
  } else if (barsForFallback && barsForFallback.length > 0) {
    distanceStopAtr = resolveVolatilityDistance(barsForFallback, entryPrice, p);
  } else {
    distanceStopAtr =
      Math.abs(entryPrice) * p.priceFallbackFraction ||
      Math.abs(entryPrice) * 0.005 ||
      1;
  }

  const minPx = safeVisible > 0 ? p.minFraction * safeVisible : 0;
  const maxPx = safeVisible > 0 ? p.maxFraction * safeVisible : Number.POSITIVE_INFINITY;
  const stopDistance =
    safeVisible > 0
      ? clamp(distanceStopAtr, minPx, maxPx)
      : distanceStopAtr;
  const tpDistance = stopDistance * p.defaultRRR;

  if (side === 'long') {
    return {
      slPrice: entryPrice - stopDistance,
      tpPrice: entryPrice + tpDistance,
      stopDistance,
      tpDistance,
    };
  }
  return {
    slPrice: entryPrice + stopDistance,
    tpPrice: entryPrice - tpDistance,
    stopDistance,
    tpDistance,
  };
}

/**
 * Largeur horizontale de la boîte en nombre de barres (fraction du visible).
 */
export function computeBoxWidthBars(
  candleTimes: number[],
  widthFraction = POSITION_BOX_WIDTH_FRACTION,
): number {
  if (candleTimes.length === 0) return 2;
  return Math.max(2, Math.round(candleTimes.length * widthFraction));
}

/**
 * Calcule endTime (bord droit) à partir de l’index d’entrée et des timestamps bougies.
 */
export function computeBoxEndTime(
  candleTimes: number[],
  entryTime: number,
  widthFraction = POSITION_BOX_WIDTH_FRACTION,
): number {
  if (candleTimes.length === 0) return entryTime;
  let entryIdx = 0;
  let bestDist = Math.abs(candleTimes[0] - entryTime);
  for (let i = 1; i < candleTimes.length; i += 1) {
    const d = Math.abs(candleTimes[i] - entryTime);
    if (d < bestDist) {
      bestDist = d;
      entryIdx = i;
    }
  }
  const widthBars = computeBoxWidthBars(candleTimes, widthFraction);
  const endIdx = Math.min(candleTimes.length - 1, entryIdx + widthBars);
  if (endIdx > entryIdx) return candleTimes[endIdx];
  // Extrapolation si pas assez de bougies à droite
  if (candleTimes.length >= 2) {
    const step = candleTimes[candleTimes.length - 1] - candleTimes[candleTimes.length - 2];
    return entryTime + Math.max(step, 1) * widthBars;
  }
  return entryTime + widthBars;
}

/** Plage prix visible à partir des bougies (fallback si l’échelle Y LWC est absente). */
export function visiblePriceRangeFromBars(bars: OhlcBar[]): number {
  if (bars.length === 0) return 0;
  let min = bars[0].low;
  let max = bars[0].high;
  for (const bar of bars) {
    if (bar.low < min) min = bar.low;
    if (bar.high > max) max = bar.high;
  }
  const range = max - min;
  return Number.isFinite(range) && range > 0 ? range : 0;
}
