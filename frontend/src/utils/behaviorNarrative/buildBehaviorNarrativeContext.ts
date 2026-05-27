import type { AnalyticsData, StatisticsData } from '../../hooks/useStatistics';
import type { PnlDisplayMode } from '../pnlDisplay';
import { aggregateDurationPerformance } from '../tradeDurationBuckets';
import {
  aggregateHourlyPerformance,
  aggregateWeekdayPerformance,
  aggregateWeeklyPerformance,
} from './aggregateBehaviorTimeContext';
import { classifyNarrativeTone, computeTrajectorySignals } from './classifyNarrativeTone';
import type { BehaviorNarrativeContext } from './types';
import type { TradeForTimeAggregate } from './aggregateBehaviorTimeContext';

function findWorstMonthLabel(
  monthly: Array<{ month: string; pnl: number }>,
  formatMonthLabel: (monthKey: string) => string,
): string | null {
  if (monthly.length === 0) return null;
  const worst = monthly.reduce((acc, row) => (row.pnl < acc.pnl ? row : acc), monthly[0]);
  if (worst.pnl >= 0) return null;
  return formatMonthLabel(worst.month);
}

export interface BuildBehaviorNarrativeContextInput {
  statisticsData: StatisticsData | null | undefined;
  analyticsData: AnalyticsData | null | undefined;
  trades: TradeForTimeAggregate[];
  timezone: string;
  pnlDisplayMode: PnlDisplayMode;
  weekdayDayNames: string[];
  formatMonthLabel: (monthKey: string) => string;
}

export function buildBehaviorNarrativeContext(
  input: BuildBehaviorNarrativeContextInput,
): BehaviorNarrativeContext {
  const { statisticsData, analyticsData, trades, timezone, pnlDisplayMode, weekdayDayNames, formatMonthLabel } =
    input;

  const discipline = analyticsData?.behavior_discipline;
  const consecutive = analyticsData?.consecutive_stats;
  const monthlyPerformance = analyticsData?.monthly_performance ?? [];
  const trajectorySignals = computeTrajectorySignals(monthlyPerformance);

  const revenge = discipline
    ? {
        alertLevel: discipline.revenge_trading.alert_level,
        hasSufficientData: discipline.revenge_trading.has_sufficient_data,
        pctIncrease: discipline.revenge_trading.pct_increase,
        avgAfterLoss: discipline.revenge_trading.avg_trades_after_negative_day,
        avgAfterWin: discipline.revenge_trading.avg_trades_after_positive_day,
      }
    : null;

  const sizing = discipline
    ? {
        alertLevel: discipline.sizing_discipline.alert_level,
        hasSufficientData: discipline.sizing_discipline.has_sufficient_data,
        pctLargerOnLosers: discipline.sizing_discipline.pct_larger_on_losers,
      }
    : null;

  const profitFactor = statisticsData?.profit_factor ?? null;
  const sharpeAnnualized = statisticsData?.sharpe_ratio_annualized ?? null;
  const expectancy = statisticsData?.expectancy ?? 0;

  const tone = classifyNarrativeTone({
    profitFactor,
    sharpeAnnualized,
    expectancy,
    revenge,
    sizing,
    trajectoryProgression: trajectorySignals.progression,
    trajectoryVolatile: trajectorySignals.volatile,
  });

  return {
    tradeCount: trades.length,
    profitFactor,
    sharpeAnnualized,
    expectancy,
    winRate: statisticsData?.win_rate ?? 0,
    tone,
    trajectoryProgression: trajectorySignals.progression,
    trajectoryVolatile: trajectorySignals.volatile,
    maxConsecutiveWins: consecutive?.max_consecutive_wins ?? 0,
    maxConsecutiveLosses: consecutive?.max_consecutive_losses ?? 0,
    revenge,
    sizing,
    worstMonthLabel: findWorstMonthLabel(monthlyPerformance, formatMonthLabel),
    hourly: aggregateHourlyPerformance(trades, timezone, pnlDisplayMode),
    weekday: aggregateWeekdayPerformance(trades, weekdayDayNames, timezone, pnlDisplayMode),
    weekly: aggregateWeeklyPerformance(trades, timezone, pnlDisplayMode),
    durationBuckets: aggregateDurationPerformance(trades, pnlDisplayMode),
    monthlyPerformance,
    timezone: timezone?.trim() || 'Europe/Paris',
  };
}
