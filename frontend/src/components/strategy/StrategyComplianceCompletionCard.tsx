import React, { useMemo } from 'react';
import type { ChartOptions } from 'chart.js';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { ChartHelpTooltip } from '../charts/ChartHelpTooltip';
import { LazyChart } from './charts/LazyChart';
import { MemoizedDoughnut as Doughnut } from './charts/MemoizedCharts';
import {
  CHART_FONT_FAMILY,
  buildChartTooltipPlugin,
  STRATEGY_INSIGHTS_COMPACT_SHELL_CLASS,
  STRATEGY_INSIGHTS_STACKED_CARD_CLASS,
  type ChartColors,
} from '../../utils/chartConfig';
import type { ComplianceCompletionStats } from '../../hooks/useStrategyDisciplineInsights';
import type { StrategyDrillDownRequest } from '../../utils/strategyDrillDown';

interface StrategyComplianceCompletionCardProps {
  stats: ComplianceCompletionStats;
  chartColors: ChartColors;
  formatNumber: (value: number, digits?: number) => string;
  isMobile: boolean;
  className?: string;
  onDrillDown?: (request: StrategyDrillDownRequest) => void;
}

export const StrategyComplianceCompletionCard: React.FC<StrategyComplianceCompletionCardProps> =
  React.memo(({ stats, chartColors, formatNumber, isMobile, className = '', onDrillDown }) => {
    const { t } = useTranslation();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const chartData = useMemo(() => {
      const evaluated = stats.evaluated_trades;
      const unevaluated = stats.unevaluated_trades;
      if (evaluated === 0 && unevaluated === 0) return null;

      return {
        labels: [
          t('strategies:insights.completionEvaluated'),
          t('strategies:insights.completionUnevaluated'),
        ],
        values: [evaluated, unevaluated],
        total: evaluated + unevaluated,
      };
    }, [stats.evaluated_trades, stats.unevaluated_trades, t]);

    const chartOptions = useMemo<ChartOptions<'doughnut'>>(
      () => ({
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            display: false,
          },
          datalabels: {
            display: (context: any) => {
              const value = context.dataset.data[context.dataIndex] as number;
              const total = stats.evaluated_trades + stats.unevaluated_trades;
              if (!value || total <= 0) return false;
              return (value / total) * 100 >= 8;
            },
            color: () => '#ffffff',
            font: {
              family: CHART_FONT_FAMILY,
              weight: 600,
              size: isMobile ? 11 : 12,
            },
            formatter: (value: number) => {
              const total = stats.evaluated_trades + stats.unevaluated_trades;
              const pct = total > 0 ? (value / total) * 100 : 0;
              return `${formatNumber(pct, 1)}%`;
            },
          },
          tooltip: {
            ...buildChartTooltipPlugin(chartColors, 'barStackedLike', undefined, {
              callbacks: {
                label: (context: any) => {
                  const label = context.label ?? '';
                  const value = context.parsed ?? 0;
                  const total = stats.evaluated_trades + stats.unevaluated_trades;
                  const pct = total > 0 ? (value / total) * 100 : 0;
                  return `${label}: ${formatNumber(value, 0)} (${formatNumber(pct, 1)}%)`;
                },
              },
            }),
          },
        },
      }),
      [
        chartColors,
        formatNumber,
        isMobile,
        stats.evaluated_trades,
        stats.unevaluated_trades,
      ]
    );

    const tradeRate = stats.trade_completion_rate_pct;
    const dayRate = stats.day_completion_rate_pct;
    const showWarning =
      stats.unevaluated_trades > 0 || stats.days_partially_unevaluated > 0;

    const textSizeClass = isMobile ? 'text-xs leading-snug' : 'text-xs sm:text-sm leading-snug';

    const openDrill = (filters: StrategyDrillDownRequest['filters'], titleKey: string) => {
      if (!onDrillDown) return;
      onDrillDown({ title: t(titleKey), filters });
    };

    return (
      <div
        className={`${STRATEGY_INSIGHTS_COMPACT_SHELL_CLASS} ${STRATEGY_INSIGHTS_STACKED_CARD_CLASS} ${className}`}
      >
        <div className="flex items-center gap-1.5 mb-0.5 shrink-0">
          <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">
            {t('strategies:insights.completionTitle')}
          </h3>
          <ChartHelpTooltip content={t('strategies:insights.completionTooltip')} />
        </div>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1 line-clamp-1 shrink-0">
          {t('strategies:insights.completionSubtitle')}
        </p>

        {chartData ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden justify-center">
            <div className="flex min-h-0 flex-1 items-center gap-2 sm:gap-3">
              <div
                className={`flex min-w-0 flex-1 flex-col items-start justify-center gap-1 sm:gap-1.5 ${textSizeClass}`}
              >
                <span className="text-left text-gray-500 dark:text-gray-400">
                  {t('strategies:insights.completionTradeRate')}
                </span>
                <span className="text-left text-gray-500 dark:text-gray-400">
                  {t('strategies:insights.completionDayRate')}
                </span>
                <span className="text-left text-gray-500 dark:text-gray-400">
                  {t('strategies:insights.completionTradeCounts')}
                </span>
                <span className="text-left text-gray-500 dark:text-gray-400">
                  {t('strategies:insights.completionDayCounts')}
                </span>
              </div>
              <div className="flex shrink-0 items-center justify-center">
                <div
                  className={`relative ${
                    isMobile ? 'h-[6.25rem] w-[6.25rem]' : 'h-[6.75rem] w-[6.75rem] sm:h-[7.75rem] sm:w-[7.75rem]'
                  }`}
                >
                  <LazyChart height="h-full">
                    <Doughnut
                      data={{
                        labels: chartData.labels,
                        datasets: [
                          {
                            data: chartData.values,
                            backgroundColor: [
                              isDark ? 'rgba(16, 185, 129, 0.85)' : 'rgba(16, 185, 129, 0.8)',
                              isDark ? 'rgba(107, 114, 128, 0.85)' : 'rgba(156, 163, 175, 0.85)',
                            ],
                            borderColor: [
                              isDark ? '#34d399' : '#10b981',
                              isDark ? '#9ca3af' : '#6b7280',
                            ],
                            borderWidth: 0,
                          },
                        ],
                      }}
                      options={chartOptions}
                    />
                  </LazyChart>
                </div>
              </div>
              <div
                className={`flex min-w-0 flex-1 flex-col items-end justify-center gap-1 sm:gap-1.5 tabular-nums ${textSizeClass}`}
              >
                <span className="text-right font-semibold text-gray-900 dark:text-gray-100">
                  {tradeRate != null ? `${formatNumber(tradeRate, 1)}%` : '—'}
                </span>
                <span className="text-right font-semibold text-gray-900 dark:text-gray-100">
                  {dayRate != null ? `${formatNumber(dayRate, 1)}%` : '—'}
                </span>
                {onDrillDown ? (
                  <button
                    type="button"
                    className="text-right text-gray-700 dark:text-gray-300 hover:underline cursor-pointer tabular-nums"
                    onClick={() =>
                      openDrill(
                        { strategy_respected__isnull: false },
                        'strategies:drillDown.evaluatedTrades'
                      )
                    }
                  >
                    {formatNumber(stats.evaluated_trades, 0)} / {formatNumber(stats.total_trades, 0)}
                  </button>
                ) : (
                  <span className="text-right text-gray-700 dark:text-gray-300">
                    {formatNumber(stats.evaluated_trades, 0)} / {formatNumber(stats.total_trades, 0)}
                  </span>
                )}
                <span className="text-right text-gray-700 dark:text-gray-300">
                  {formatNumber(stats.days_fully_evaluated, 0)} /{' '}
                  {formatNumber(stats.total_trading_days, 0)}
                </span>
              </div>
            </div>

            {showWarning && (
              onDrillDown && stats.unevaluated_trades > 0 ? (
                <button
                  type="button"
                  className="mt-1 pt-1 border-t border-gray-200 dark:border-gray-700 w-full text-left text-xs leading-snug text-amber-700 dark:text-amber-400 shrink-0 line-clamp-2 hover:underline"
                  onClick={() =>
                    openDrill(
                      { strategy_respected__isnull: true },
                      'strategies:drillDown.unevaluatedTrades'
                    )
                  }
                >
                  {t('strategies:insights.completionWarning')
                    .replace('__UNEVALUATED__', formatNumber(stats.unevaluated_trades, 0))
                    .replace('__DAYS__', formatNumber(stats.days_partially_unevaluated, 0))}
                </button>
              ) : (
                <p className="mt-1 pt-1 border-t border-gray-200 dark:border-gray-700 text-xs leading-snug text-amber-700 dark:text-amber-400 shrink-0 line-clamp-2">
                  {t('strategies:insights.completionWarning')
                    .replace('__UNEVALUATED__', formatNumber(stats.unevaluated_trades, 0))
                    .replace('__DAYS__', formatNumber(stats.days_partially_unevaluated, 0))}
                </p>
              )
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-600 dark:text-gray-400 flex-1 flex items-center justify-center">
            {t('strategies:insights.completionNoTrades')}
          </p>
        )}
      </div>
    );
  });

StrategyComplianceCompletionCard.displayName = 'StrategyComplianceCompletionCard';
