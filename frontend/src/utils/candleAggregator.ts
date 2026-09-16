/**
 * Agrégation OHLC générique (post-MVP).
 * Non branchée en production tant que le TF demandé existe nativement.
 */

export interface AggregateCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function canAggregate(fromDurationSeconds: number, toDurationSeconds: number): boolean {
  return (
    fromDurationSeconds > 0 &&
    toDurationSeconds > fromDurationSeconds &&
    toDurationSeconds % fromDurationSeconds === 0
  );
}

/**
 * Agrège des bougies d'une granularité inférieure vers une supérieure.
 * `time` = unix seconds d'ouverture de chaque bougie source.
 */
export function aggregateCandles(
  source: AggregateCandle[],
  fromDurationSeconds: number,
  toDurationSeconds: number,
): AggregateCandle[] {
  if (!canAggregate(fromDurationSeconds, toDurationSeconds)) {
    throw new Error('Timeframes incompatibles pour agrégation');
  }
  const buckets = new Map<number, AggregateCandle>();
  for (const candle of source) {
    const open = Math.floor(candle.time / toDurationSeconds) * toDurationSeconds;
    const existing = buckets.get(open);
    if (!existing) {
      buckets.set(open, { ...candle, time: open });
      continue;
    }
    existing.high = Math.max(existing.high, candle.high);
    existing.low = Math.min(existing.low, candle.low);
    existing.close = candle.close;
    existing.volume += candle.volume;
  }
  return [...buckets.values()].sort((a, b) => a.time - b.time);
}
