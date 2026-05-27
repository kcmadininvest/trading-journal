import type { AnalyticsData, StatisticsData } from '../../hooks/useStatistics';
import type { FinancialAggregationMode } from '../financialAggregationMode';
import type { PnlDisplayMode } from '../pnlDisplay';
import { aggregateDurationPerformance } from '../tradeDurationBuckets';
import {
  aggregateHourlyPerformance,
  aggregateWeekdayPerformance,
  aggregateWeeklyPerformance,
} from './aggregateBehaviorTimeContext';
import { classifyNarrativeTone, computeTrajectorySignals } from './classifyNarrativeTone';
import type { BehaviorNarrativeContext, DailyRhythmContext } from './types';
import type { TradeForTimeAggregate } from './aggregateBehaviorTimeContext';
import { BEHAVIOR_NARRATIVE_POST_SIZING_MIN_SAMPLE } from './types';
import type { PostLossSizingBaseline } from '../../hooks/useStatistics';

function findWorstMonthLabel(
  monthly: Array<{ month: string; pnl: number }>,
  formatMonthLabel: (monthKey: string) => string,
): string | null {
  if (monthly.length === 0) return null;
  const worst = monthly.reduce((acc, row) => (row.pnl < acc.pnl ? row : acc), monthly[0]);
  if (worst.pnl >= 0) return null;
  return formatMonthLabel(worst.month);
}

function dominantSizingCategory(
  baseline: PostLossSizingBaseline | undefined,
  minSample: number,
): 'larger' | 'equal' | 'smaller' | null {
  if (!baseline) return null;
  const entries: Array<{ key: 'larger' | 'equal' | 'smaller'; pct: number; count: number }> = [
    { key: 'larger', pct: baseline.larger.pct, count: baseline.larger.count },
    { key: 'equal', pct: baseline.equal.pct, count: baseline.equal.count },
    { key: 'smaller', pct: baseline.smaller.pct, count: baseline.smaller.count },
  ];
  const top = [...entries].sort((a, b) => b.pct - a.pct)[0];
  if (!top || top.count < minSample) return null;
  return top.key;
}

function buildDailyRhythm(analyticsData: AnalyticsData | null | undefined): DailyRhythmContext | null {
  const daily = analyticsData?.daily_stats;
  if (!daily) return null;
  return {
    avgTradesPerDay: daily.avg_trades_per_day,
    worstDay: daily.worst_day,
    worstDayPnl: daily.worst_day_pnl,
    bestDay: daily.best_day,
    bestDayPnl: daily.best_day_pnl,
  };
}

export interface BuildBehaviorNarrativeContextInput {
  statisticsData: StatisticsData | null | undefined;
  analyticsData: AnalyticsData | null | undefined;
  trades: TradeForTimeAggregate[];
  timezone: string;
  pnlDisplayMode: PnlDisplayMode;
  weekdayDayNames: string[];
  formatMonthLabel: (monthKey: string) => string;
  monetaryNarrativesEnabled: boolean;
  aggregationMode: FinancialAggregationMode;
  useConvertedPnl: boolean;
}

export function buildBehaviorNarrativeContext(
  input: BuildBehaviorNarrativeContextInput,
): BehaviorNarrativeContext {
  const {
    statisticsData,
    analyticsData,
    trades,
    timezone,
    pnlDisplayMode,
    weekdayDayNames,
    formatMonthLabel,
    monetaryNarrativesEnabled,
    aggregationMode,
    useConvertedPnl,
  } = input;

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
  const winRate = statisticsData?.win_rate ?? 0;

  const tone = classifyNarrativeTone({
    profitFactor,
    sharpeAnnualized,
    expectancy,
    winRate,
    maxDrawdownPct: statisticsData?.max_drawdown_global_pct ?? null,
    recoveryRatio: statisticsData?.recovery_ratio ?? null,
    revenge,
    sizing,
    trajectoryProgression: trajectorySignals.progression,
    trajectoryVolatile: trajectorySignals.volatile,
    monetaryNarrativesEnabled,
  });

  const postLoss = analyticsData?.post_loss_sizing;
  const postWin = analyticsData?.post_win_sizing;
  const tradeType = analyticsData?.trade_type_stats;

  return {
    tradeCount: trades.length,
    profitFactor,
    sharpeAnnualized,
    expectancy,
    winRate,
    tone,
    monetaryNarrativesEnabled,
    aggregationMode,
    trajectoryProgression: trajectorySignals.progression,
    trajectoryVolatile: trajectorySignals.volatile,
    maxConsecutiveWins: consecutive?.max_consecutive_wins ?? 0,
    maxConsecutiveLosses: consecutive?.max_consecutive_losses ?? 0,
    maxDrawdownPct: statisticsData?.max_drawdown_global_pct ?? null,
    maxDrawdownGlobal: statisticsData?.max_drawdown_global ?? null,
    recoveryRatio: statisticsData?.recovery_ratio ?? null,
    calmarRatio: statisticsData?.calmar_ratio ?? null,
    revenge,
    sizing,
    worstMonthLabel: findWorstMonthLabel(monthlyPerformance, formatMonthLabel),
    dailyRhythm: buildDailyRhythm(analyticsData),
    postLossDominantCategory: dominantSizingCategory(
      postLoss?.vs_losing_trade,
      BEHAVIOR_NARRATIVE_POST_SIZING_MIN_SAMPLE,
    ),
    postLossSampleSize: postLoss?.sample_size ?? 0,
    postWinDominantCategory: dominantSizingCategory(
      postWin?.vs_winning_trade,
      BEHAVIOR_NARRATIVE_POST_SIZING_MIN_SAMPLE,
    ),
    postWinSampleSize: postWin?.sample_size ?? 0,
    planRespectRate:
      statisticsData && statisticsData.trades_with_both_rr > 0
        ? statisticsData.plan_respect_rate
        : null,
    avgPlannedRr: statisticsData?.avg_planned_rr ?? null,
    avgActualRr: statisticsData?.avg_actual_rr ?? null,
    tradesWithPlannedRr: statisticsData?.trades_with_planned_rr ?? 0,
    tradesWithBothRr: statisticsData?.trades_with_both_rr ?? 0,
    longPercentage: tradeType?.long_percentage ?? null,
    shortPercentage: tradeType?.short_percentage ?? null,
    hourly: aggregateHourlyPerformance(trades, timezone, pnlDisplayMode, useConvertedPnl),
    weekday: aggregateWeekdayPerformance(
      trades,
      weekdayDayNames,
      timezone,
      pnlDisplayMode,
      useConvertedPnl,
    ),
    weekly: aggregateWeeklyPerformance(trades, timezone, pnlDisplayMode, useConvertedPnl),
    durationBuckets: aggregateDurationPerformance(trades, pnlDisplayMode, useConvertedPnl),
    monthlyPerformance,
    timezone: timezone?.trim() || 'Europe/Paris',
  };
}
