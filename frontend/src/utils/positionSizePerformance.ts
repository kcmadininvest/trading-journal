import { getTradeDisplayPnlValue, type PnlDisplayMode } from './pnlDisplay';
import { classifyTradeOutcomeFromPnl } from './tradeDurationBuckets';

export interface TradeForPositionSizeAggregate {
  size?: string | number | null;
  pnl?: string | null;
  net_pnl?: string | null;
}

export interface PositionSizePerformanceRow {
  label: string;
  size: number;
  avgPnl: number;
  winRate: number;
  tradeCount: number;
  winningCount: number;
  losingCount: number;
  breakevenCount: number;
}

/** Normalise la taille pour éviter des clés dupliquées (1.0000001 vs 1). */
export function normalizePositionSize(size: number): number {
  return Math.round(size * 100) / 100;
}

export function formatPositionSizeLabel(size: number): string {
  const normalized = normalizePositionSize(size);
  if (Number.isInteger(normalized)) {
    return String(normalized);
  }
  return String(normalized);
}

function parseTradeSize(size: string | number | null | undefined): number | null {
  const parsed = typeof size === 'number' ? size : parseFloat(String(size ?? ''));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return normalizePositionSize(parsed);
}

/** Agrégation performance (P/L moyen + win rate) par taille de position exacte. */
export function aggregatePositionSizePerformance(
  trades: TradeForPositionSizeAggregate[],
  pnlDisplayMode: PnlDisplayMode
): PositionSizePerformanceRow[] {
  const buckets = new Map<
    number,
    { pnlSum: number; tradeCount: number; wins: number; losses: number; breakeven: number }
  >();

  trades.forEach((trade) => {
    const size = parseTradeSize(trade.size);
    if (size === null) return;

    const pnl = getTradeDisplayPnlValue(trade, pnlDisplayMode);
    if (pnl === null || !Number.isFinite(pnl)) return;

    const bucket = buckets.get(size) ?? {
      pnlSum: 0,
      tradeCount: 0,
      wins: 0,
      losses: 0,
      breakeven: 0,
    };

    bucket.pnlSum += pnl;
    bucket.tradeCount += 1;

    const outcome = classifyTradeOutcomeFromPnl(pnl);
    if (outcome === 'win') bucket.wins += 1;
    else if (outcome === 'loss') bucket.losses += 1;
    else bucket.breakeven += 1;

    buckets.set(size, bucket);
  });

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([size, bucket]) => ({
      label: formatPositionSizeLabel(size),
      size,
      avgPnl: bucket.pnlSum / bucket.tradeCount,
      winRate: (bucket.wins / bucket.tradeCount) * 100,
      tradeCount: bucket.tradeCount,
      winningCount: bucket.wins,
      losingCount: bucket.losses,
      breakevenCount: bucket.breakeven,
    }));
}
