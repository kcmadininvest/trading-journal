import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StrategyComplianceStats } from '../../services/tradeStrategies';
import { SAMPLE_MODERATE_MIN, SAMPLE_STRONG_MAX } from '../../utils/tradingSampleThresholds';

type PerformanceSide = StrategyComplianceStats['performance_comparison']['respected'];

function appendSampleWarnings(
  count: number,
  bucket: 'Respected' | 'NotRespected',
  warnings: string[],
  t: (k: string, o?: Record<string, unknown>) => string
): void {
  if (count <= 0) return;
  const params = {
    count,
    minModerate: SAMPLE_MODERATE_MIN,
    minStrong: SAMPLE_STRONG_MAX,
  };
  if (count < SAMPLE_STRONG_MAX) {
    warnings.push(t(`strategies:statsInsights.lowSampleStrong${bucket}`, params));
  } else if (count < SAMPLE_MODERATE_MIN) {
    warnings.push(t(`strategies:statsInsights.lowSampleModerate${bucket}`, params));
  }
}

function formatProfitFactorForSide(
  side: PerformanceSide,
  t: (k: string, o?: Record<string, unknown>) => string
): string {
  if (side.profit_factor_infinite) {
    return t('strategies:statsInsights.profitFactorInfinite');
  }
  const apiPf = side.profit_factor;
  if (apiPf != null && Number.isFinite(Number(apiPf))) {
    return Number(apiPf).toFixed(2);
  }
  const gw = parseFloat(String(side.gross_wins ?? '0'));
  const gl = parseFloat(String(side.gross_losses ?? '0'));
  if (Number.isFinite(gw) && Number.isFinite(gl) && gl < 0) {
    const absLoss = Math.abs(gl);
    if (absLoss > 0) {
      return (gw / absLoss).toFixed(2);
    }
  }
  if (gw > 0 && gl >= 0) {
    return t('strategies:statsInsights.profitFactorInfinite');
  }
  return t('strategies:statsInsights.profitFactorNA');
}

function formatExpectancy(avgPnl: string): string {
  const n = parseFloat(avgPnl);
  if (!Number.isFinite(n)) return avgPnl;
  return n.toFixed(2);
}

interface StrategyStatsTradingMetricsCardProps {
  performanceComparison: StrategyComplianceStats['performance_comparison'] | null | undefined;
}

export const StrategyStatsTradingMetricsCard: React.FC<StrategyStatsTradingMetricsCardProps> = React.memo(
  ({ performanceComparison }) => {
    const { t } = useTranslation();

    const { warnings, expectancyDiff, expectancyGapUnreliable } = useMemo(() => {
      if (!performanceComparison) {
        return {
          warnings: [] as string[],
          expectancyDiff: null as number | null,
          expectancyGapUnreliable: false,
        };
      }
      const w: string[] = [];
      const { respected, not_respected } = performanceComparison;
      appendSampleWarnings(respected.count, 'Respected', w, t);
      appendSampleWarnings(not_respected.count, 'NotRespected', w, t);

      const ar = parseFloat(respected.avg_pnl);
      const an = parseFloat(not_respected.avg_pnl);
      const minBucket = Math.min(respected.count, not_respected.count);
      const canCompareExpectancy =
        respected.count > 0 && not_respected.count > 0 && minBucket >= SAMPLE_STRONG_MAX;
      const diff =
        canCompareExpectancy && Number.isFinite(ar) && Number.isFinite(an) ? ar - an : null;
      const gapUnreliable =
        respected.count > 0 && not_respected.count > 0 && !canCompareExpectancy;

      return { warnings: w, expectancyDiff: diff, expectancyGapUnreliable: gapUnreliable };
    }, [performanceComparison, t]);

    if (!performanceComparison) {
      return null;
    }

    const { respected, not_respected } = performanceComparison;

    const renderSide = (label: string, side: PerformanceSide, tone: 'green' | 'red') => {
      const isGreen = tone === 'green';
      const border = isGreen
        ? 'border-green-200 dark:border-green-800'
        : 'border-red-200 dark:border-red-800';
      const bg = isGreen ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20';
      const dot = isGreen ? 'bg-green-500' : 'bg-red-500';
      const title = isGreen ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100';
      return (
        <div className={`rounded-lg p-4 border ${border} ${bg}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-3 h-3 ${dot} rounded-full`} />
            <h4 className={`font-semibold ${title}`}>{label}</h4>
          </div>
          <dl className="space-y-2">
            <div className="flex justify-between gap-2">
              <dt className="text-sm text-gray-600 dark:text-gray-400">
                {t('strategies:statsInsights.expectancyPerTrade')}
              </dt>
              <dd className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums text-sm">
                {formatExpectancy(side.avg_pnl)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-sm text-gray-600 dark:text-gray-400">
                {t('strategies:statsInsights.profitFactor')}
              </dt>
              <dd className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums text-sm">
                {formatProfitFactorForSide(side, t)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-sm text-gray-600 dark:text-gray-400">{t('strategies:statsInsights.tradesEvaluated')}</dt>
              <dd className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums text-sm">{side.count}</dd>
            </div>
          </dl>
        </div>
      );
    };

    const hasAnyTrades = respected.count + not_respected.count > 0;
    if (!hasAnyTrades) {
      return null;
    }

    const hasExpectancy = expectancyDiff != null && Number.isFinite(expectancyDiff);
    const hasMeta = warnings.length > 0 || hasExpectancy || expectancyGapUnreliable;

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow p-6 h-full flex flex-col">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {t('strategies:statsInsights.tradingMetricsTitle')}
        </h3>
        <p className={`text-sm text-gray-600 dark:text-gray-400 ${hasMeta ? 'mb-4' : 'mb-6'}`}>
          {t('strategies:statsInsights.tradingMetricsSubtitle')}
        </p>

        {warnings.length > 0 && (
          <ul
            className={`space-y-2 text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 list-disc list-inside ${
              hasExpectancy || expectancyGapUnreliable ? 'mb-4' : 'mb-6'
            }`}
          >
            {warnings.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        )}

        {expectancyGapUnreliable && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {t('strategies:statsInsights.expectancyComparisonUnreliable', {
              minBoth: SAMPLE_STRONG_MAX,
            })}
          </p>
        )}

        {hasExpectancy && expectancyDiff !== null && (
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">
            <span className="font-medium">{t('strategies:statsInsights.expectancyGapLabel')}</span>{' '}
            <span className="tabular-nums font-semibold text-gray-900 dark:text-gray-100">
              {expectancyDiff > 0 ? '+' : ''}
              {expectancyDiff.toFixed(2)}
            </span>
            <span className="text-gray-500 dark:text-gray-400"> {t('strategies:statsInsights.perTradeVsNot')}</span>
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
          {renderSide(t('strategy:performance.respected', { defaultValue: 'Stratégie Respectée' }), respected, 'green')}
          {renderSide(
            t('strategy:performance.notRespected', { defaultValue: 'Stratégie Non Respectée' }),
            not_respected,
            'red'
          )}
        </div>
      </div>
    );
  }
);

StrategyStatsTradingMetricsCard.displayName = 'StrategyStatsTradingMetricsCard';
