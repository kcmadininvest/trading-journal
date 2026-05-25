import { buildCumulativeDisciplineSparkline } from './disciplineSparkline';

describe('buildCumulativeDisciplineSparkline', () => {
  it('monte quand les périodes récentes sont meilleures (taux cumulé)', () => {
    const sparkline = buildCumulativeDisciplineSparkline([
      { date: '2025-01', respected_count: 2, total_with_strategy: 10 },
      { date: '2025-02', respected_count: 8, total_with_strategy: 10 },
      { date: '2025-03', respected_count: 9, total_with_strategy: 10 },
    ]);
    expect(sparkline).toHaveLength(3);
    expect(sparkline[0]).toBeCloseTo(20, 1);
    expect(sparkline[2]).toBeGreaterThan(sparkline[1]);
    expect(sparkline[2]).toBeGreaterThan(sparkline[0]);
  });
});
