import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '../../hooks/usePreferences';
import { maskValue } from '../../hooks/usePrivacySettings';
import { formatCurrency as formatCurrencyUtil, formatNumber as formatNumberUtil } from '../../utils/numberFormat';
import { ChartHelpTooltip } from '../charts/ChartHelpTooltip';
import type { GainIfStrategyStats } from '../../hooks/useStrategyDisciplineInsights';
import type { StrategyDrillDownFilters, StrategyDrillDownRequest } from '../../utils/strategyDrillDown';
import {
  STRATEGY_CHART_SECTION_SHELL_CLASS,
  STRATEGY_INSIGHTS_COMPACT_SHELL_CLASS,
  STRATEGY_INSIGHTS_STACKED_CARD_CLASS,
} from '../../utils/chartConfig';

interface StrategyGainIfRespectedCardProps {
  stats: GainIfStrategyStats | null | undefined;
  currencySymbol: string;
  hideProfitLoss?: boolean;
  /** Réduit la carte pour tenir dans une colonne empilée (moitié d'une tuile graphique). */
  stacked?: boolean;
  className?: string;
  onDrillDown?: (request: StrategyDrillDownRequest) => void;
}

export const StrategyGainIfRespectedCard: React.FC<StrategyGainIfRespectedCardProps> = React.memo(
  ({ stats, currencySymbol, hideProfitLoss = false, stacked = false, className = '', onDrillDown }) => {
    const { t } = useTranslation();
    const { preferences } = usePreferences();

    const formatCount = useCallback(
      (value: number) => formatNumberUtil(value, 0, preferences.number_format),
      [preferences.number_format]
    );

    const formatPctValue = useCallback(
      (value: number | null | undefined) => {
        if (value == null || !Number.isFinite(value)) {
          return t('strategies:insights.noAnsweredData');
        }
        return formatNumberUtil(value, 1, preferences.number_format);
      },
      [preferences.number_format, t]
    );

    const formatMoney = useCallback(
      (value: number) => {
        if (hideProfitLoss) return maskValue(value, currencySymbol);
        return formatCurrencyUtil(value, currencySymbol, preferences.number_format, 2);
      },
      [hideProfitLoss, currencySymbol, preferences.number_format]
    );

    const shellClass = stacked ? STRATEGY_INSIGHTS_COMPACT_SHELL_CLASS : STRATEGY_CHART_SECTION_SHELL_CLASS;
    const wrapperClass = stacked
      ? `${STRATEGY_INSIGHTS_STACKED_CARD_CLASS} ${className}`
      : `h-full min-h-0 ${className}`;
    const titleClass = stacked
      ? 'text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100'
      : 'text-lg font-semibold text-gray-900 dark:text-gray-100';

    const openGainDrillDown = (filters: StrategyDrillDownFilters, titleKey: string) => {
      if (!onDrillDown) return;
      onDrillDown({
        title: t(titleKey),
        filters: { strategy_respected: false, ...filters },
      });
    };

    const rowClass = (interactive: boolean) =>
      `w-full text-left rounded-md ${
        interactive
          ? 'cursor-pointer hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 dark:hover:bg-white/5 dark:focus-visible:ring-blue-500/50'
          : ''
      } ${stacked ? 'px-0.5 py-0.5' : 'px-1 py-1'}`;

    const renderRow = (
      filters: StrategyDrillDownFilters,
      titleKey: string,
      children: React.ReactNode,
      classNameExtra = ''
    ) => {
      const interactive = Boolean(onDrillDown);
      if (!interactive) {
        return <div className={`${rowClass(false)} ${classNameExtra}`}>{children}</div>;
      }
      return (
        <button
          type="button"
          className={`${rowClass(true)} ${classNameExtra}`}
          onClick={() => openGainDrillDown(filters, titleKey)}
        >
          {children}
        </button>
      );
    };

    if (!stats || stats.total_not_respected === 0) {
      return (
        <div className={`${shellClass} ${wrapperClass} flex flex-col`}>
          <div className={`flex items-center gap-1.5 ${stacked ? 'mb-0.5' : 'mb-2'} shrink-0`}>
            <h3 className={titleClass}>{t('strategies:insights.gainIfTitle')}</h3>
            <ChartHelpTooltip content={t('strategies:insights.gainIfTooltip')} />
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <p
              className={`text-center text-gray-600 dark:text-gray-400 ${stacked ? 'text-xs' : 'text-sm'}`}
            >
              {t('strategies:insights.gainIfNoDeviations')}
            </p>
          </div>
        </div>
      );
    }

    const totalPnl = stats.total_pnl_not_respected ?? 0;
    const pnlTone = hideProfitLoss
      ? 'text-gray-900 dark:text-gray-100'
      : totalPnl > 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : totalPnl < 0
          ? 'text-rose-600 dark:text-rose-400'
          : 'text-gray-900 dark:text-gray-100';

    const losingCount = stats.losing_trades_count ?? 0;
    const winningCount = stats.winning_trades_count ?? 0;
    const showPreventable = stats.total_answered > 0;

    return (
      <div className={`${shellClass} ${wrapperClass} flex flex-col ${stacked ? 'overflow-hidden' : ''}`}>
        <div className={`flex items-center gap-1.5 shrink-0 ${stacked ? 'mb-1' : 'mb-3'}`}>
          <h3 className={titleClass}>{t('strategies:insights.gainIfTitle')}</h3>
          <ChartHelpTooltip content={t('strategies:insights.gainIfTooltip')} />
        </div>

        <div className={`flex min-h-0 flex-1 flex-col ${stacked ? 'justify-center gap-1.5' : 'gap-3'}`}>
          <div className="shrink-0">
            <div
              className={`uppercase tracking-wide text-gray-500 dark:text-gray-400 ${
                stacked ? 'text-[10px] leading-tight' : 'text-xs mb-1'
              }`}
            >
              {t('strategies:insights.netCostOfDeviations')}
            </div>
            <div
              className={`font-bold tabular-nums ${pnlTone} ${
                stacked ? 'text-xl sm:text-2xl' : 'text-3xl'
              }`}
            >
              {formatMoney(totalPnl)}
            </div>
            <p
              className={`text-gray-600 dark:text-gray-400 tabular-nums ${
                stacked ? 'mt-0.5 text-[11px] leading-snug line-clamp-2' : 'mt-1 text-sm'
              }`}
            >
              {t('strategies:insights.contextDeviations', {
                formatted: formatCount(stats.total_not_respected),
                total: formatCount(stats.total_trades_in_period ?? stats.total_not_respected),
                pct: formatPctValue(stats.not_respected_rate_pct ?? 0),
              })}
              <span className="text-gray-400 dark:text-gray-500"> · </span>
              {t('strategies:insights.avgCostPerDeviation', {
                avg: formatMoney(stats.avg_pnl_not_respected ?? 0),
              })}
            </p>
          </div>

          <div className={`grid shrink-0 ${stacked ? 'gap-1.5' : 'gap-3'}`}>
            <div
              className={`rounded-lg border border-rose-200 bg-rose-50/80 dark:border-rose-800/60 dark:bg-rose-950/30 ${
                stacked ? 'p-1.5' : 'p-3'
              }`}
            >
              {renderRow(
                { pnl_outcome: 'loss' },
                'strategies:drillDown.deviationsLosingTrades',
                <>
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={`font-medium text-rose-800 dark:text-rose-300 ${
                        stacked ? 'text-xs' : 'text-sm'
                      }`}
                    >
                      {t('strategies:insights.deviationsLosses')}
                    </span>
                    <span
                      className={`font-semibold tabular-nums text-rose-700 dark:text-rose-400 ${
                        stacked ? 'text-sm' : 'text-base'
                      }`}
                    >
                      {formatMoney(stats.losing_trades_pnl ?? 0)}
                    </span>
                  </div>
                  <div className={`text-gray-600 dark:text-gray-400 tabular-nums ${stacked ? 'text-[11px]' : 'text-xs mt-0.5'}`}>
                    {t('strategies:insights.losingTradesCount', { formatted: formatCount(losingCount) })}
                  </div>
                </>
              )}

              {showPreventable &&
                renderRow(
                  { pnl_outcome: 'loss', gain_if_strategy_respected: true },
                  'strategies:drillDown.wouldHaveWonTrades',
                  <>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`text-rose-800/90 dark:text-rose-300 ${stacked ? 'text-[11px]' : 'text-xs'}`}>
                        {t('strategies:insights.preventableLosses')}
                      </span>
                      <span className={`font-semibold tabular-nums text-rose-700 dark:text-rose-400 ${stacked ? 'text-xs' : 'text-sm'}`}>
                        {formatMoney(stats.would_have_won_pnl ?? 0)}
                      </span>
                    </div>
                    <div
                      className={`text-gray-600 dark:text-gray-400 ${
                        stacked ? 'text-[11px] leading-snug line-clamp-2' : 'text-xs mt-0.5'
                      }`}
                    >
                      {t('strategies:insights.preventableLossesDetail', {
                        formatted: formatCount(stats.would_have_won),
                        pct: formatPctValue(stats.would_have_won_pct),
                      })}
                    </div>
                  </>
                )}

              {stats.unanswered > 0 &&
                renderRow(
                  { pnl_outcome: 'loss', gain_if_strategy_respected__isnull: true },
                  'strategies:drillDown.unansweredGainTrades',
                  <div className={`flex justify-between gap-2 tabular-nums text-gray-600 dark:text-gray-400 ${stacked ? 'text-[11px]' : 'text-xs'}`}>
                    <span>{t('strategies:insights.unansweredTrades')}</span>
                    <span className="font-semibold">{formatCount(stats.unanswered)}</span>
                  </div>
                )}
            </div>

            <div
              className={`rounded-lg border border-emerald-200 bg-emerald-50/80 dark:border-emerald-800/60 dark:bg-emerald-950/30 ${
                stacked ? 'p-1.5' : 'p-3'
              }`}
            >
              {renderRow(
                { pnl_outcome: 'win' },
                'strategies:drillDown.deviationsWinningTrades',
                <>
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={`font-medium text-emerald-800 dark:text-emerald-300 ${
                        stacked ? 'text-xs' : 'text-sm'
                      }`}
                    >
                      {t('strategies:insights.deviationsGains')}
                    </span>
                    <span
                      className={`font-semibold tabular-nums text-emerald-700 dark:text-emerald-400 ${
                        stacked ? 'text-sm' : 'text-base'
                      }`}
                    >
                      {formatMoney(stats.winning_trades_pnl ?? 0)}
                    </span>
                  </div>
                  <div className={`text-gray-600 dark:text-gray-400 tabular-nums ${stacked ? 'text-[11px]' : 'text-xs mt-0.5'}`}>
                    {t('strategies:insights.winningTradesCount', { formatted: formatCount(winningCount) })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

StrategyGainIfRespectedCard.displayName = 'StrategyGainIfRespectedCard';
