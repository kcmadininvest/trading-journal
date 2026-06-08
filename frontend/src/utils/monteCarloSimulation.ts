export const MONTE_CARLO_DEFAULTS = {
  N_SIMULATIONS: 10_000,
  MAX_DAYS: 365,
  MIN_TRADING_DAYS: 5,
  MIN_TRADES_FOR_EXPOSURE: 5,
  DANGER_THRESHOLD_RATIO: 0.3,
} as const;

export interface DailyAggregateInput {
  date: string;
  pnl: number;
}

export interface MonteCarloDailyStats {
  mu: number;
  sigma: number;
  tradingDaysPerWeek: number;
  tradingDayCount: number;
}

export interface MonteCarloSimulationParams {
  currentBalance: number;
  targetBalance: number;
  mu: number;
  sigma: number;
  nSims?: number;
  maxDays?: number;
  random?: () => number;
}

export interface MonteCarloSimulationResult {
  successRate: number;
  p25: number | null;
  median: number | null;
  p75: number | null;
  p90: number | null;
  successfulRuns: number;
  totalSimulations: number;
}

export interface DeterministicCurves {
  optimistic: number[];
  median: number[];
  prudent: number[];
  displayDays: number;
  labels: number[];
}

export interface MonteCarloMilestone {
  balance: number;
  daysEstimate: number;
  weeksEstimate: number;
  pct: number;
}

/** Box-Muller transform — no external dependency. */
export function gaussianRandom(mean: number, std: number, random: () => number = Math.random): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = random();
  while (v === 0) v = random();
  return mean + std * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function percentile(arr: number[], p: number): number | null {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function sampleStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function countCalendarWeeks(dates: string[]): number {
  if (dates.length === 0) return 1;
  const sorted = [...dates].sort();
  const first = new Date(`${sorted[0]}T12:00:00Z`);
  const last = new Date(`${sorted[sorted.length - 1]}T12:00:00Z`);
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const spanMs = Math.max(last.getTime() - first.getTime(), 0);
  return Math.max(1, Math.ceil((spanMs + msPerWeek) / msPerWeek));
}

export interface AdjustedMonteCarloStats extends MonteCarloDailyStats {
  exposureRatio: number;
  isAdjusted: boolean;
}

export function computeTargetRiskUnits(lots: number, pointValue: number): number {
  return lots * pointValue;
}

export function adjustStatsForExposure(
  stats: MonteCarloDailyStats,
  targetRiskUnits: number,
  historicalMedianRiskUnits: number,
): AdjustedMonteCarloStats {
  if (
    !Number.isFinite(targetRiskUnits) ||
    targetRiskUnits <= 0 ||
    !Number.isFinite(historicalMedianRiskUnits) ||
    historicalMedianRiskUnits <= 0
  ) {
    return { ...stats, exposureRatio: 1, isAdjusted: false };
  }

  const exposureRatio = targetRiskUnits / historicalMedianRiskUnits;
  return {
    ...stats,
    mu: stats.mu * exposureRatio,
    sigma: stats.sigma * exposureRatio,
    exposureRatio,
    isAdjusted: true,
  };
}

export function computeDailyStats(
  dailyAggregates: DailyAggregateInput[],
): MonteCarloDailyStats {
  const pnls = dailyAggregates.map((d) => d.pnl);
  const dates = dailyAggregates.map((d) => d.date);
  const mu = pnls.length ? pnls.reduce((s, v) => s + v, 0) / pnls.length : 0;
  const sigma = sampleStdDev(pnls);
  const weeks = countCalendarWeeks(dates);
  const tradingDaysPerWeek = pnls.length / weeks;

  return {
    mu,
    sigma,
    tradingDaysPerWeek,
    tradingDayCount: pnls.length,
  };
}

export function runMonteCarloSimulation(
  params: MonteCarloSimulationParams,
): MonteCarloSimulationResult {
  const {
    currentBalance,
    targetBalance,
    mu,
    sigma,
    nSims = MONTE_CARLO_DEFAULTS.N_SIMULATIONS,
    maxDays = MONTE_CARLO_DEFAULTS.MAX_DAYS,
    random = Math.random,
  } = params;

  if (mu <= 0 || targetBalance <= currentBalance) {
    return {
      successRate: 0,
      p25: null,
      median: null,
      p75: null,
      p90: null,
      successfulRuns: 0,
      totalSimulations: nSims,
    };
  }

  const results: number[] = [];

  for (let i = 0; i < nSims; i += 1) {
    let balance = currentBalance;
    let days = 0;

    while (balance < targetBalance && balance > 0 && days < maxDays) {
      balance += gaussianRandom(mu, sigma, random);
      days += 1;
    }

    if (balance >= targetBalance) {
      results.push(days);
    }
  }

  const successfulRuns = results.length;
  const successRate = (successfulRuns / nSims) * 100;

  return {
    successRate,
    p25: percentile(results, 25),
    median: percentile(results, 50),
    p75: percentile(results, 75),
    p90: percentile(results, 90),
    successfulRuns,
    totalSimulations: nSims,
  };
}

export function buildDeterministicCurves(params: {
  currentBalance: number;
  targetBalance: number;
  mu: number;
  sigma: number;
}): DeterministicCurves {
  const { currentBalance, targetBalance, mu, sigma } = params;
  const gainOptimistic = mu + 0.5 * sigma;
  const gainMedian = mu;
  const gainPrudent = mu - 0.3 * sigma;

  const gap = targetBalance - currentBalance;
  const prudentDaily = gainPrudent > 0 ? gainPrudent : Math.max(gainMedian, 1);
  const displayDays = Math.max(1, Math.ceil(gap / prudentDaily) + 10);
  const buffer = Math.max(gap * 0.05, 1);
  const cap = targetBalance + buffer;

  const optimistic: number[] = [];
  const median: number[] = [];
  const prudent: number[] = [];
  const labels: number[] = [];

  for (let j = 0; j <= displayDays; j += 1) {
    labels.push(j);
    optimistic.push(Math.min(currentBalance + gainOptimistic * j, cap));
    median.push(Math.min(currentBalance + gainMedian * j, cap));
    prudent.push(Math.min(currentBalance + gainPrudent * j, cap));
  }

  return { optimistic, median, prudent, displayDays, labels };
}

export function buildMilestones(params: {
  currentBalance: number;
  targetBalance: number;
  mu: number;
  tradingDaysPerWeek: number;
  count?: number;
}): MonteCarloMilestone[] {
  const {
    currentBalance,
    targetBalance,
    mu,
    tradingDaysPerWeek,
    count = 6,
  } = params;

  const gap = targetBalance - currentBalance;
  if (gap <= 0 || mu <= 0) return [];

  const daysPerWeek = Math.max(tradingDaysPerWeek, 1);
  const milestones: MonteCarloMilestone[] = [];

  for (let i = 1; i <= count; i += 1) {
    const balance = currentBalance + (gap * i) / count;
    const daysEstimate = Math.max(0, (balance - currentBalance) / mu);
    const weeksEstimate = Math.ceil(daysEstimate / daysPerWeek);
    const pct = ((balance - currentBalance) / gap) * 100;

    milestones.push({
      balance,
      daysEstimate,
      weeksEstimate,
      pct,
    });
  }

  return milestones;
}

export function estimateWeeks(days: number | null, tradingDaysPerWeek: number): number | null {
  if (days == null) return null;
  const daysPerWeek = Math.max(tradingDaysPerWeek, 1);
  return Math.ceil(days / daysPerWeek);
}
