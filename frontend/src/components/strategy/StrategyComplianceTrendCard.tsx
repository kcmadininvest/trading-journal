import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StrategyComplianceStats } from '../../services/tradeStrategies';
import { usePreferences } from '../../hooks/usePreferences';
import { formatNumber as formatNumberUtil } from '../../utils/numberFormat';
import { ChartHelpTooltip } from '../charts/ChartHelpTooltip';

interface StrategyComplianceTrendCardProps {
  compliance: StrategyComplianceStats | null | undefined;
}

function getRateToneClass(rate: number): string {
  if (rate >= 80) {
    return 'text-emerald-700 dark:text-emerald-400';
  }
  if (rate >= 50) {
    return 'text-amber-700 dark:text-amber-400';
  }
  return 'text-rose-700 dark:text-rose-400';
}

function MetricLabel({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-1">
      <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 leading-tight text-center">
        {label}
      </span>
      <ChartHelpTooltip content={tooltip} position="top" />
    </div>
  );
}

export const StrategyComplianceTrendCard: React.FC<StrategyComplianceTrendCardProps> = React.memo(
  ({ compliance }) => {
    const { t } = useTranslation();
    const { preferences } = usePreferences();

    const formatPercent = useCallback(
      (value: number | null | undefined): string => {
        if (value == null || !Number.isFinite(value)) {
          return t('strategies:statsInsights.trendNoData');
        }
        return `${formatNumberUtil(value, 1, preferences.number_format)}%`;
      },
      [preferences.number_format, t]
    );

    const formatCount = useCallback(
      (value: number): string => formatNumberUtil(value, 0, preferences.number_format),
      [preferences.number_format]
    );

    const rollingWindows = useMemo(
      () =>
        [
          {
            key: '7d' as const,
            label: t('strategy:metrics.last7Days'),
            tooltip: t('strategies:statsInsights.trendTooltip7d'),
            value: compliance?.compliance_7d,
          },
          {
            key: '30d' as const,
            label: t('strategy:metrics.last30Days'),
            tooltip: t('strategies:statsInsights.trendTooltip30d'),
            value: compliance?.compliance_30d,
          },
          {
            key: '90d' as const,
            label: t('strategy:metrics.last90Days'),
            tooltip: t('strategies:statsInsights.trendTooltip90d'),
            value: compliance?.compliance_90d,
          },
        ] as const,
      [compliance?.compliance_7d, compliance?.compliance_30d, compliance?.compliance_90d, t]
    );

    const tradeRate = compliance?.overall_compliance_rate;
    const totalTrades = compliance?.total_trades ?? 0;
    const totalRespected = compliance?.total_respected ?? 0;
    const totalNotRespected = compliance?.total_not_respected ?? 0;

    const metricCellClass =
      'rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 p-3 text-center flex flex-col justify-center min-h-[5.5rem]';

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {t('strategies:statsInsights.trendTitle')}
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {rollingWindows.map((window) => (
            <div key={window.key} className={metricCellClass}>
              <MetricLabel label={window.label} tooltip={window.tooltip} />
              <div
                className={`text-xl font-bold tabular-nums leading-tight ${
                  window.value != null && Number.isFinite(window.value)
                    ? getRateToneClass(window.value)
                    : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {formatPercent(window.value)}
              </div>
            </div>
          ))}

          <div className={`${metricCellClass} col-span-2 md:col-span-1`}>
            <MetricLabel
              label={t('strategies:statsInsights.tradeLevelRate')}
              tooltip={t('strategies:statsInsights.trendTooltipTradeLevel')}
            />
            <div
              className={`text-xl font-bold tabular-nums leading-tight ${
                tradeRate != null && Number.isFinite(tradeRate) && totalTrades > 0
                  ? getRateToneClass(tradeRate)
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              {totalTrades > 0 ? formatPercent(tradeRate) : t('strategies:statsInsights.trendNoData')}
            </div>
            {totalTrades > 0 && (
              <div className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug tabular-nums">
                <span className="text-emerald-600 dark:text-emerald-400">{formatCount(totalRespected)}</span>
                {' / '}
                <span className="text-rose-600 dark:text-rose-400">{formatCount(totalNotRespected)}</span>
                <span className="text-gray-400 dark:text-gray-500">
                  {' '}
                  ({formatCount(totalTrades)} {t('trades:trades')})
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

StrategyComplianceTrendCard.displayName = 'StrategyComplianceTrendCard';
