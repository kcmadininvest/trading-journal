import { buildGlobalStatsSparklines } from './globalStatsSparklines';

describe('buildGlobalStatsSparklines', () => {
  it('retourne discipline et win rate cumulés', () => {
    const { disciplineSparkline, winRateSparkline } = buildGlobalStatsSparklines({
      disciplinePeriodData: [
        { date: '2025-01', respected_count: 5, total_with_strategy: 10 },
        { date: '2025-02', respected_count: 8, total_with_strategy: 10 },
      ],
      dailyAggregates: [
        { date: '2025-01-01', winning_count: 3, losing_count: 7 },
        { date: '2025-02-01', winning_count: 6, losing_count: 4 },
      ],
    });
    expect(disciplineSparkline.length).toBeGreaterThanOrEqual(2);
    expect(winRateSparkline.length).toBeGreaterThanOrEqual(2);
  });
});
