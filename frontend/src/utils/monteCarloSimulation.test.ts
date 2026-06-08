import {
  adjustStatsForExposure,
  buildDeterministicCurves,
  buildMilestones,
  computeDailyStats,
  computeTargetRiskUnits,
  gaussianRandom,
  percentile,
  runMonteCarloSimulation,
} from './monteCarloSimulation';

/** Deterministic PRNG for reproducible tests (LCG). */
function createSeededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe('monteCarloSimulation', () => {
  it('percentile interpolates linearly', () => {
    expect(percentile([10, 20, 30, 40], 0)).toBe(10);
    expect(percentile([10, 20, 30, 40], 50)).toBe(25);
    expect(percentile([10, 20, 30, 40], 100)).toBe(40);
    expect(percentile([], 50)).toBeNull();
  });

  it('gaussianRandom returns mean when std is 0', () => {
    const random = createSeededRandom(42);
    expect(gaussianRandom(100, 0, random)).toBe(100);
  });

  it('computeDailyStats excludes empty days and computes mu/sigma', () => {
    const stats = computeDailyStats([
      { date: '2026-01-01', pnl: 100 },
      { date: '2026-01-02', pnl: 200 },
      { date: '2026-01-08', pnl: 50 },
    ]);
    expect(stats.mu).toBeCloseTo(116.67, 1);
    expect(stats.sigma).toBeGreaterThan(0);
    expect(stats.tradingDayCount).toBe(3);
    expect(stats.tradingDaysPerWeek).toBeGreaterThan(0);
  });

  it('runMonteCarloSimulation returns zero success when mu <= 0', () => {
    const result = runMonteCarloSimulation({
      currentBalance: 5000,
      targetBalance: 10000,
      mu: 0,
      sigma: 100,
      nSims: 100,
      random: createSeededRandom(1),
    });
    expect(result.successRate).toBe(0);
    expect(result.median).toBeNull();
  });

  it('runMonteCarloSimulation produces high success with strong positive mu', () => {
    const result = runMonteCarloSimulation({
      currentBalance: 5000,
      targetBalance: 6000,
      mu: 500,
      sigma: 10,
      nSims: 500,
      random: createSeededRandom(99),
    });
    expect(result.successRate).toBeGreaterThan(90);
    expect(result.median).not.toBeNull();
    expect(result.p25!).toBeLessThanOrEqual(result.median!);
    expect(result.p75!).toBeGreaterThanOrEqual(result.median!);
  });

  it('buildDeterministicCurves caps at target plus buffer', () => {
    const curves = buildDeterministicCurves({
      currentBalance: 5000,
      targetBalance: 10000,
      mu: 100,
      sigma: 50,
    });
    expect(curves.labels[0]).toBe(0);
    expect(curves.optimistic.length).toBe(curves.displayDays + 1);
    const lastOptimistic = curves.optimistic[curves.optimistic.length - 1];
    expect(lastOptimistic).toBeLessThanOrEqual(10000 + 250);
    expect(lastOptimistic).toBeGreaterThanOrEqual(10000);
  });

  it('computeTargetRiskUnits multiplies lots and point value', () => {
    expect(computeTargetRiskUnits(1, 2)).toBe(2);
    expect(computeTargetRiskUnits(3, 20)).toBe(60);
  });

  it('adjustStatsForExposure scales mu and sigma by ratio', () => {
    const base = computeDailyStats([
      { date: '2026-01-01', pnl: 100 },
      { date: '2026-01-02', pnl: 200 },
    ]);
    const adjusted = adjustStatsForExposure(base, 2, 8);
    expect(adjusted.isAdjusted).toBe(true);
    expect(adjusted.exposureRatio).toBe(0.25);
    expect(adjusted.mu).toBeCloseTo(base.mu * 0.25, 5);
    expect(adjusted.sigma).toBeCloseTo(base.sigma * 0.25, 5);
    expect(adjusted.tradingDaysPerWeek).toBe(base.tradingDaysPerWeek);
  });

  it('adjustStatsForExposure returns unchanged stats when median invalid', () => {
    const base = computeDailyStats([{ date: '2026-01-01', pnl: 100 }]);
    const adjusted = adjustStatsForExposure(base, 2, 0);
    expect(adjusted.isAdjusted).toBe(false);
    expect(adjusted.mu).toBe(base.mu);
  });

  it('buildMilestones returns 6 evenly spaced targets', () => {
    const milestones = buildMilestones({
      currentBalance: 5000,
      targetBalance: 10000,
      mu: 100,
      tradingDaysPerWeek: 4,
    });
    expect(milestones).toHaveLength(6);
    expect(milestones[0].balance).toBeCloseTo(5833.33, 0);
    expect(milestones[5].balance).toBe(10000);
    expect(milestones[0].weeksEstimate).toBeGreaterThan(0);
  });
});
