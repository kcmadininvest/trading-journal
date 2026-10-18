export interface TradeOutcomePartitionInput {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakEvenTrades: number;
  breakEvenPositiveTrades: number;
}

export interface TradeOutcomePartition {
  winners: number;
  losers: number;
  breakEven: number;
  total: number;
  /** Parts relatives à la somme partitionnée (0–100). */
  winnersPct: number;
  losersPct: number;
  breakEvenPct: number;
  /** Part d’activité en BE soft (PnL > 0 sans TP) / total trades (0–100). */
  softBeShareOfActivityPct: number;
  /** Part des trades positifs qui sont du BE soft (0–100). */
  softBeShareOfPositivePct: number;
  softBeCount: number;
  isEmpty: boolean;
}

function safePct(part: number, whole: number): number {
  if (whole <= 0 || part <= 0) return 0;
  return (part / whole) * 100;
}

/**
 * Partition W / L / BE sans double comptage.
 * Les BE soft (gagnants sans TP) sont retirés des gagnants et inclus dans breakEven.
 */
export function computeTradeOutcomePartition(
  input: TradeOutcomePartitionInput,
): TradeOutcomePartition {
  const totalTrades = Math.max(0, input.totalTrades || 0);
  const winningTrades = Math.max(0, input.winningTrades || 0);
  const losingTrades = Math.max(0, input.losingTrades || 0);
  const breakEvenTrades = Math.max(0, input.breakEvenTrades || 0);
  const softBeCount = Math.max(0, input.breakEvenPositiveTrades || 0);

  const winners = Math.max(0, winningTrades - softBeCount);
  const losers = losingTrades;
  const breakEven = breakEvenTrades;

  const partitionedTotal = winners + losers + breakEven;
  const total = partitionedTotal > 0 ? partitionedTotal : totalTrades;

  return {
    winners,
    losers,
    breakEven,
    total,
    winnersPct: safePct(winners, total),
    losersPct: safePct(losers, total),
    breakEvenPct: safePct(breakEven, total),
    softBeShareOfActivityPct: safePct(softBeCount, totalTrades),
    softBeShareOfPositivePct: safePct(softBeCount, winningTrades),
    softBeCount,
    isEmpty: totalTrades === 0 && partitionedTotal === 0,
  };
}
