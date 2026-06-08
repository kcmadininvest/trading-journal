import { addDays } from 'date-fns';
import type { TFunction } from 'i18next';
import { getMonthName, type LanguageType } from './dateFormat';
import {
  estimateWeeks,
  MONTE_CARLO_DEFAULTS,
  type MonteCarloMilestone,
  type MonteCarloSimulationResult,
} from './monteCarloSimulation';

export type ProbabilityTone =
  | 'certainty'
  | 'veryLikely'
  | 'likely'
  | 'uncertain'
  | 'unlikely'
  | 'veryUnlikely';

export type TimelinePacing = 'relaxed' | 'patient' | 'cautious' | 'steady';

export interface MonteCarloNarrativeSection {
  labelKey: string;
  text: string;
  muted?: boolean;
}

export interface MonteCarloNarrative {
  sections: MonteCarloNarrativeSection[];
  probabilityTone: ProbabilityTone;
}

export interface BuildMonteCarloNarrativeInput {
  simulation: Pick<MonteCarloSimulationResult, 'successRate' | 'p25' | 'p75' | 'median'>;
  currentBalance: number;
  targetBalance: number;
  nextMilestone: Pick<MonteCarloMilestone, 'balance' | 'daysEstimate' | 'pct'> | null;
  mu: number;
  sigma: number;
  tradingDaysPerWeek: number;
  tradingDayCount: number;
  isExposureAdjusted: boolean;
  exposureRatio: number;
  language: LanguageType;
  t: TFunction;
  formatNumber: (value: number, digits?: number) => string;
  formatTarget: (value: number) => string;
  formatMoney: (value: number, digits?: number) => string;
  formatDayCount: (days: number | null) => string;
  formatWeekCount: (days: number | null) => string;
  referenceDate?: Date;
}

const LIMITED_HISTORY_DAY_THRESHOLD = 20;

const WEEKS_PER_MONTH = 4.33;
const MIN_WEEK_SPREAD_FOR_DATE_RANGE = 3;
const TIGHT_WEEK_SPREAD = 2;

export function classifyProbabilityTone(successRate: number): ProbabilityTone {
  if (successRate >= 95) return 'certainty';
  if (successRate >= 80) return 'veryLikely';
  if (successRate >= 60) return 'likely';
  if (successRate >= 40) return 'uncertain';
  if (successRate >= 20) return 'unlikely';
  return 'veryUnlikely';
}

export function tradingDaysToCalendarDays(
  tradingDays: number,
  tradingDaysPerWeek: number,
): number {
  const daysPerWeek = Math.max(tradingDaysPerWeek, 1);
  return Math.round((tradingDays / daysPerWeek) * 7);
}

export function weeksToMonths(weeks: number): number {
  return Math.max(1, Math.round(weeks / WEEKS_PER_MONTH));
}

export function projectDateFromTradingDays(
  tradingDays: number,
  tradingDaysPerWeek: number,
  fromDate: Date,
): Date {
  return addDays(fromDate, tradingDaysToCalendarDays(tradingDays, tradingDaysPerWeek));
}

type MonthQualifier = 'early' | 'mid' | 'late';

function getMonthQualifier(day: number): MonthQualifier {
  if (day <= 12) return 'early';
  if (day >= 20) return 'late';
  return 'mid';
}

export function formatProjectedMonthLabel(
  date: Date,
  language: LanguageType,
  t: TFunction,
): string {
  const month = getMonthName(date.getMonth() + 1, language);
  const qualifier = getMonthQualifier(date.getDate());

  if (qualifier === 'early') {
    return t('analytics:monteCarlo.narrative.dateEarly', { month });
  }
  if (qualifier === 'late') {
    return t('analytics:monteCarlo.narrative.dateLate', { month });
  }
  return month;
}

export function classifyTimelinePacing(
  successRate: number,
  weeksMin: number,
  weeksMax: number,
): TimelinePacing {
  const spread = weeksMax - weeksMin;

  if (successRate < 60) return 'cautious';
  if (successRate >= 80) {
    return spread <= TIGHT_WEEK_SPREAD ? 'relaxed' : 'patient';
  }
  return 'steady';
}

function buildProbabilityParagraph(input: BuildMonteCarloNarrativeInput): string {
  const { simulation, t, formatNumber, formatTarget, isExposureAdjusted, exposureRatio } = input;
  const tone = classifyProbabilityTone(simulation.successRate);
  const probability = formatNumber(simulation.successRate, 2);
  const target = formatTarget(input.targetBalance);

  let paragraph = t(`analytics:monteCarlo.narrative.probability.${tone}`, {
    probability,
    target,
  });

  if (isExposureAdjusted) {
    paragraph += ` ${t('analytics:monteCarlo.narrative.probability.withSizing', {
      ratio: formatNumber(exposureRatio, 2),
    })}`;
  }

  return paragraph;
}

function buildGapParagraph(input: BuildMonteCarloNarrativeInput): string | null {
  const { currentBalance, targetBalance, t, formatTarget, formatMoney } = input;
  const gap = targetBalance - currentBalance;

  if (gap <= 0) return null;

  return t('analytics:monteCarlo.narrative.gap.remaining', {
    gap: formatMoney(gap),
    target: formatTarget(targetBalance),
    current: formatTarget(currentBalance),
  });
}

function buildHorizonFailureParagraph(input: BuildMonteCarloNarrativeInput): string | null {
  const { simulation, t, formatNumber, formatTarget } = input;
  const failureRate = Math.max(0, 100 - simulation.successRate);

  if (failureRate < 0.005) return null;

  return t('analytics:monteCarlo.narrative.horizon.failure', {
    failureRate: formatNumber(failureRate, 2),
    target: formatTarget(input.targetBalance),
    maxDays: formatNumber(MONTE_CARLO_DEFAULTS.MAX_DAYS, 0),
  });
}

function buildNextMilestoneParagraph(input: BuildMonteCarloNarrativeInput): string | null {
  const { nextMilestone, t, formatTarget, formatDayCount, formatWeekCount, formatNumber } = input;

  if (!nextMilestone) return null;

  return t('analytics:monteCarlo.narrative.milestone.next', {
    balance: formatTarget(nextMilestone.balance),
    days: formatDayCount(nextMilestone.daysEstimate),
    weeks: formatWeekCount(nextMilestone.daysEstimate),
    pct: formatNumber(nextMilestone.pct, 0),
  });
}

function buildTimelineParagraph(
  input: BuildMonteCarloNarrativeInput,
  successRate: number,
): string | null {
  const { simulation, tradingDaysPerWeek, language, t, formatNumber } = input;
  const { p25, p75 } = simulation;

  if (p25 == null || p75 == null) {
    return t('analytics:monteCarlo.narrative.timeline.insufficient');
  }

  const referenceDate = input.referenceDate ?? new Date();
  const weeksMin = estimateWeeks(p25, tradingDaysPerWeek) ?? 1;
  const weeksMax = Math.max(weeksMin, estimateWeeks(p75, tradingDaysPerWeek) ?? weeksMin);
  const monthsMin = weeksToMonths(weeksMin);
  const monthsMax = Math.max(monthsMin, weeksToMonths(weeksMax));

  let dateRange: string | null = null;
  if (weeksMax - weeksMin >= MIN_WEEK_SPREAD_FOR_DATE_RANGE) {
    const optimisticDate = projectDateFromTradingDays(p25, tradingDaysPerWeek, referenceDate);
    const prudentDate = projectDateFromTradingDays(p75, tradingDaysPerWeek, referenceDate);
    const optimisticLabel = formatProjectedMonthLabel(optimisticDate, language, t);
    const prudentLabel = formatProjectedMonthLabel(prudentDate, language, t);
    dateRange =
      optimisticLabel === prudentLabel
        ? optimisticLabel
        : `${optimisticLabel} / ${prudentLabel}`;
  }

  const pacing = classifyTimelinePacing(successRate, weeksMin, weeksMax);
  const monthsMinLabel = formatNumber(monthsMin, 0);
  const monthsMaxLabel = formatNumber(monthsMax, 0);

  let rangeText: string;
  if (monthsMin === monthsMax) {
    rangeText = dateRange
      ? t('analytics:monteCarlo.narrative.timeline.singleMonthWithDateRange', {
          months: monthsMinLabel,
          dateRange,
        })
      : t('analytics:monteCarlo.narrative.timeline.singleMonth', {
          months: monthsMinLabel,
        });
  } else if (dateRange) {
    rangeText = t('analytics:monteCarlo.narrative.timeline.withDateRange', {
      monthsMin: monthsMinLabel,
      monthsMax: monthsMaxLabel,
      dateRange,
    });
  } else {
    rangeText = t('analytics:monteCarlo.narrative.timeline.range', {
      monthsMin: monthsMinLabel,
      monthsMax: monthsMaxLabel,
    });
  }

  const pacingText = t(`analytics:monteCarlo.narrative.timeline.${pacing}`);

  return `${rangeText} ${pacingText}`;
}

function buildTypicalParagraph(input: BuildMonteCarloNarrativeInput): string | null {
  const { simulation, t, formatDayCount, formatWeekCount } = input;
  const { median } = simulation;

  if (median == null) {
    return t('analytics:monteCarlo.narrative.typical.insufficient');
  }

  return t('analytics:monteCarlo.narrative.typical.withDuration', {
    days: formatDayCount(median),
    weeks: formatWeekCount(median),
  });
}

function buildAssumptionsParagraph(input: BuildMonteCarloNarrativeInput): string {
  const { t, formatMoney, formatNumber, isExposureAdjusted, exposureRatio, mu, sigma, tradingDaysPerWeek } =
    input;

  let text = t('analytics:monteCarlo.narrative.assumptions.base', {
    mu: formatMoney(mu, 0),
    sigma: formatMoney(sigma, 0),
    daysPerWeek: formatNumber(tradingDaysPerWeek, 1),
  });

  if (isExposureAdjusted) {
    text += ` ${t('analytics:monteCarlo.narrative.assumptions.adjusted', {
      ratio: formatNumber(exposureRatio, 2),
    })}`;
  }

  return text;
}

function buildHistoryParagraph(input: BuildMonteCarloNarrativeInput): string {
  const { tradingDayCount, t, formatNumber } = input;
  const dayCount = formatNumber(tradingDayCount, 0);
  const minDays = formatNumber(MONTE_CARLO_DEFAULTS.MIN_TRADING_DAYS, 0);

  if (tradingDayCount < LIMITED_HISTORY_DAY_THRESHOLD) {
    return t('analytics:monteCarlo.narrative.history.limited', { dayCount, minDays });
  }

  return t('analytics:monteCarlo.narrative.history.standard', { dayCount });
}

export function buildMonteCarloNarrative(input: BuildMonteCarloNarrativeInput): MonteCarloNarrative {
  const probabilityTone = classifyProbabilityTone(input.simulation.successRate);
  const sections: MonteCarloNarrativeSection[] = [
    {
      labelKey: 'analytics:monteCarlo.narrative.labels.main',
      text: buildProbabilityParagraph(input),
    },
  ];

  const gap = buildGapParagraph(input);
  if (gap) {
    sections.push({
      labelKey: 'analytics:monteCarlo.narrative.labels.gap',
      text: gap,
    });
  }

  const horizonFailure = buildHorizonFailureParagraph(input);
  if (horizonFailure) {
    sections.push({
      labelKey: 'analytics:monteCarlo.narrative.labels.horizon',
      text: horizonFailure,
    });
  }

  const typical = buildTypicalParagraph(input);
  if (typical) {
    sections.push({
      labelKey: 'analytics:monteCarlo.narrative.labels.typical',
      text: typical,
    });
  }

  const timeline = buildTimelineParagraph(input, input.simulation.successRate);
  if (timeline) {
    sections.push({
      labelKey: 'analytics:monteCarlo.narrative.labels.timeline',
      text: timeline,
    });
  }

  const nextMilestone = buildNextMilestoneParagraph(input);
  if (nextMilestone) {
    sections.push({
      labelKey: 'analytics:monteCarlo.narrative.labels.milestone',
      text: nextMilestone,
    });
  }

  sections.push(
    {
      labelKey: 'analytics:monteCarlo.narrative.labels.assumptions',
      text: buildAssumptionsParagraph(input),
      muted: true,
    },
    {
      labelKey: 'analytics:monteCarlo.narrative.labels.history',
      text: buildHistoryParagraph(input),
      muted: true,
    },
  );

  return { sections, probabilityTone };
}
