import { useMemo } from 'react';

export interface GainIfStrategyStats {
  total_trades_in_period?: number;
  total_not_respected: number;
  not_respected_rate_pct?: number;
  total_pnl_not_respected?: number;
  avg_pnl_not_respected?: number;
  losing_trades_count?: number;
  losing_trades_pnl?: number;
  winning_trades_count?: number;
  winning_trades_pnl?: number;
  total_answered: number;
  unanswered: number;
  would_have_won: number;
  would_have_won_pnl?: number;
  would_have_lost: number;
  would_have_lost_pnl?: number;
  would_have_won_pct: number | null;
  would_have_lost_pct: number | null;
}

/** Vrai dès qu'il existe une perte hors stratégie (PnL strictement négatif, au centime près). */
export function hasDeviationLossMix(stats: GainIfStrategyStats | null | undefined): boolean {
  return (stats?.losing_trades_pnl ?? 0) < -0.01;
}

export interface EmotionCountRow {
  emotion: string;
  count: number;
}

export interface EmotionsByRespect {
  respected: EmotionCountRow[];
  not_respected: EmotionCountRow[];
}

export interface ComplianceCompletionStats {
  total_trades: number;
  evaluated_trades: number;
  unevaluated_trades: number;
  trade_completion_rate_pct: number | null;
  total_trading_days: number;
  days_fully_evaluated: number;
  days_partially_unevaluated: number;
  day_completion_rate_pct: number | null;
}

export interface EmotionShareRow {
  emotion: string;
  label: string;
  count: number;
  sharePct: number;
}

export interface EmotionShareColumn {
  respected: boolean;
  totalOccurrences: number;
  rows: EmotionShareRow[];
  sampleTooSmall: boolean;
}

export interface EmotionsByRespectShares {
  respected: EmotionShareColumn;
  notRespected: EmotionShareColumn;
}

interface UseStrategyDisciplineInsightsParams {
  statistics: {
    statistics?: {
      gain_if_strategy_stats?: GainIfStrategyStats;
      emotions_by_respect?: EmotionsByRespect;
      compliance_completion_stats?: ComplianceCompletionStats;
    };
  } | null;
  isLoading: boolean;
  getEmotionLabel: (emotion: string) => string;
}

const TOP_EMOTIONS_PER_GROUP = 4;
const SMALL_SAMPLE_OCCURRENCES = 5;

function rankEmotionShareColumn(
  rows: EmotionCountRow[] | undefined,
  respected: boolean,
  getEmotionLabel: (emotion: string) => string
): EmotionShareColumn {
  const cleaned = (rows ?? []).filter((row) => row.emotion && row.count > 0);
  const totalOccurrences = cleaned.reduce((sum, row) => sum + row.count, 0);
  const ranked = [...cleaned]
    .sort((a, b) => b.count - a.count || a.emotion.localeCompare(b.emotion))
    .slice(0, TOP_EMOTIONS_PER_GROUP);

  return {
    respected,
    totalOccurrences,
    sampleTooSmall: totalOccurrences > 0 && totalOccurrences < SMALL_SAMPLE_OCCURRENCES,
    rows: ranked.map((row) => ({
      emotion: row.emotion,
      label: getEmotionLabel(row.emotion),
      count: row.count,
      sharePct: totalOccurrences > 0 ? (row.count / totalOccurrences) * 100 : 0,
    })),
  };
}

export function useStrategyDisciplineInsights({
  statistics,
  isLoading,
  getEmotionLabel,
}: UseStrategyDisciplineInsightsParams) {
  const gainStats = statistics?.statistics?.gain_if_strategy_stats ?? null;
  const completionStats = statistics?.statistics?.compliance_completion_stats ?? null;

  const emotionsByRespectShares = useMemo<EmotionsByRespectShares | null>(() => {
    if (isLoading) return null;
    const bucket = statistics?.statistics?.emotions_by_respect;
    if (!bucket) return null;

    const respected = rankEmotionShareColumn(bucket.respected, true, getEmotionLabel);
    const notRespected = rankEmotionShareColumn(bucket.not_respected, false, getEmotionLabel);
    if (respected.totalOccurrences === 0 && notRespected.totalOccurrences === 0) return null;

    return { respected, notRespected };
  }, [statistics?.statistics?.emotions_by_respect, getEmotionLabel, isLoading]);

  const hasGainInsight =
    gainStats != null &&
    (gainStats.total_answered > 0 || gainStats.total_not_respected > 0);
  const hasEmotionsInsight = emotionsByRespectShares != null;
  const hasCompletionInsight =
    completionStats != null && completionStats.total_trades > 0;

  return {
    gainStats,
    completionStats,
    emotionsByRespectShares,
    hasGainInsight,
    hasEmotionsInsight,
    hasCompletionInsight,
    hasAnyInsight: hasGainInsight || hasEmotionsInsight || hasCompletionInsight,
  };
}
