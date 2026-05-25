import { buildCumulativeWinRateSparkline } from './winRateSparkline';

describe('buildCumulativeWinRateSparkline', () => {
  it('agrège par mois et cumule le win rate', () => {
    const sparkline = buildCumulativeWinRateSparkline([
      { date: '2025-01-05', winning_count: 2, losing_count: 8 },
      { date: '2025-01-20', winning_count: 0, losing_count: 0 },
      { date: '2025-02-10', winning_count: 7, losing_count: 3 },
      { date: '2025-03-01', winning_count: 5, losing_count: 0 },
    ]);
    expect(sparkline).toHaveLength(3);
    expect(sparkline[0]).toBeCloseTo(20, 1);
    expect(sparkline[2]).toBeGreaterThan(sparkline[1]);
  });

  it('limite aux 12 derniers mois', () => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0');
      return { date: `2024-${m}-01`, winning_count: 1, losing_count: 0 };
    });
    const sparkline = buildCumulativeWinRateSparkline(days, 12);
    expect(sparkline).toHaveLength(12);
  });
});
