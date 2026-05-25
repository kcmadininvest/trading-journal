export interface DailyWinLossPoint {
  date: string;
  winning_count?: number;
  losing_count?: number;
}

/**
 * Win rate cumulé par mois (12 derniers mois avec trades), aligné sur le sparkline discipline.
 */
export function buildCumulativeWinRateSparkline(
  dailyAggregates: DailyWinLossPoint[],
  maxMonths = 12
): number[] {
  const byMonth = new Map<string, { wins: number; losses: number }>();

  for (const day of dailyAggregates) {
    if (!day.date) continue;
    const month = day.date.slice(0, 7);
    const prev = byMonth.get(month) ?? { wins: 0, losses: 0 };
    byMonth.set(month, {
      wins: prev.wins + (day.winning_count ?? 0),
      losses: prev.losses + (day.losing_count ?? 0),
    });
  }

  const months = Array.from(byMonth.entries())
    .filter(([, v]) => v.wins + v.losses > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-maxMonths);

  let cumWins = 0;
  let cumLosses = 0;
  return months.map(([, v]) => {
    cumWins += v.wins;
    cumLosses += v.losses;
    const total = cumWins + cumLosses;
    return total > 0 ? (cumWins / total) * 100 : 0;
  });
}
