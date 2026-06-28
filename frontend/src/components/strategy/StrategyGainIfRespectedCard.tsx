import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '../../hooks/usePreferences';
import { formatNumber as formatNumberUtil } from '../../utils/numberFormat';
import { ChartHelpTooltip } from '../charts/ChartHelpTooltip';
import type { GainIfStrategyStats } from '../../hooks/useStrategyDisciplineInsights';
import type { StrategyDrillDownRequest } from '../../utils/strategyDrillDown';
import {
  STRATEGY_CHART_SECTION_SHELL_CLASS,
  STRATEGY_INSIGHTS_COMPACT_SHELL_CLASS,
  STRATEGY_INSIGHTS_STACKED_CARD_CLASS,
} from '../../utils/chartConfig';

interface StrategyGainIfRespectedCardProps {
  stats: GainIfStrategyStats | null | undefined;
  /** Réduit la carte pour tenir dans une colonne empilée (moitié d'une tuile graphique). */
  stacked?: boolean;
  className?: string;
  onDrillDown?: (request: StrategyDrillDownRequest) => void;
}

export const StrategyGainIfRespectedCard: React.FC<StrategyGainIfRespectedCardProps> = React.memo(
  ({ stats, stacked = false, className = '', onDrillDown }) => {
    const { t } = useTranslation();
    const { preferences } = usePreferences();

    const formatCount = useCallback(
      (value: number) => formatNumberUtil(value, 0, preferences.number_format),
      [preferences.number_format]
    );

    const formatPct = (value: number | null | undefined) => {
      if (value == null || !Number.isFinite(value)) {
        return t('strategies:insights.noAnsweredData');
      }
      return `${formatNumberUtil(value, 1, preferences.number_format)}%`;
    };

    const insight = useMemo(() => {
      if (!stats || stats.total_answered === 0) return null;
      if (stats.would_have_won_pct == null) return null;
      return t('strategies:insights.gainIfInsight')
        .replace('__ANSWERED__', formatCount(stats.total_answered))
        .replace(
          '__PCT__',
          formatNumberUtil(stats.would_have_won_pct, 1, preferences.number_format)
        );
    }, [stats, preferences.number_format, t, formatCount]);

    const shellClass = stacked ? STRATEGY_INSIGHTS_COMPACT_SHELL_CLASS : STRATEGY_CHART_SECTION_SHELL_CLASS;
    const wrapperClass = stacked
      ? `${STRATEGY_INSIGHTS_STACKED_CARD_CLASS} ${className}`
      : `h-full min-h-0 ${className}`;
    const titleClass = stacked
      ? 'text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100'
      : 'text-lg font-semibold text-gray-900 dark:text-gray-100';

    const openGainDrillDown = (filters: StrategyDrillDownRequest['filters'], titleKey: string) => {
      if (!onDrillDown) return;
      onDrillDown({
        title: t(titleKey),
        filters: { strategy_respected: false, ...filters },
      });
    };

    const tileShellClass = (interactive: boolean) =>
      `rounded-lg ${interactive ? 'cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-blue-400/60 dark:hover:ring-blue-500/50' : ''} ${
        stacked ? 'p-1.5 sm:p-2' : 'p-3'
      }`;

    const tileInteractionProps = (
      filters: StrategyDrillDownRequest['filters'],
      titleKey: string
    ) =>
      onDrillDown
        ? {
            role: 'button' as const,
            tabIndex: 0,
            onClick: () => openGainDrillDown(filters, titleKey),
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openGainDrillDown(filters, titleKey);
              }
            },
          }
        : {};

    if (!stats || stats.total_not_respected === 0) {
      return (
        <div className={`${shellClass} ${wrapperClass} flex flex-col`}>
          <div className={`flex items-center gap-1.5 ${stacked ? 'mb-0.5' : 'mb-2'} shrink-0`}>
            <h3 className={titleClass}>{t('strategies:insights.gainIfTitle')}</h3>
            <ChartHelpTooltip content={t('strategies:insights.gainIfTooltip')} />
          </div>
          <p className={stacked ? 'text-xs text-gray-600 dark:text-gray-400' : 'text-sm text-gray-600 dark:text-gray-400'}>
            {t('strategies:insights.gainIfNoDeviations')}
          </p>
        </div>
      );
    }

    return (
      <div className={`${shellClass} ${wrapperClass} flex flex-col overflow-hidden`}>
        <div className={`flex items-center gap-1.5 shrink-0 ${stacked ? 'mb-1.5' : 'mb-4'}`}>
          <h3 className={titleClass}>{t('strategies:insights.gainIfTitle')}</h3>
          <ChartHelpTooltip content={t('strategies:insights.gainIfTooltip')} />
        </div>

        <div className={`flex min-h-0 flex-1 flex-col ${stacked ? 'justify-center gap-1.5' : 'gap-0'}`}>
          <div className={`grid grid-cols-2 shrink-0 ${stacked ? 'gap-1.5 mb-1.5' : 'gap-3 mb-4'}`}>
            <div
              {...tileInteractionProps(
                { gain_if_strategy_respected: true },
                'strategies:drillDown.wouldHaveWonTrades'
              )}
              className={`${tileShellClass(Boolean(onDrillDown))} border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/80 dark:bg-emerald-950/30`}
            >
              <div
                className={`uppercase tracking-wide text-emerald-700 dark:text-emerald-400 mb-0.5 ${
                  stacked ? 'text-xs leading-tight' : 'text-xs mb-1'
                }`}
              >
                {t('strategies:insights.wouldHaveWon')}
              </div>
              <div
                className={`font-bold tabular-nums text-emerald-700 dark:text-emerald-400 ${
                  stacked ? 'text-base sm:text-lg' : 'text-2xl'
                }`}
              >
                {formatPct(stats.would_have_won_pct)}
              </div>
              <div
                className={`text-gray-600 dark:text-gray-400 tabular-nums ${
                  stacked ? 'text-xs mt-0.5' : 'text-xs mt-1'
                }`}
              >
                {formatCount(stats.would_have_won)} {t('trades:trades')}
              </div>
            </div>
            <div
              {...tileInteractionProps(
                { gain_if_strategy_respected: false },
                'strategies:drillDown.wouldHaveLostTrades'
              )}
              className={`${tileShellClass(Boolean(onDrillDown))} border border-rose-200 dark:border-rose-800/60 bg-rose-50/80 dark:bg-rose-950/30`}
            >
              <div
                className={`uppercase tracking-wide text-rose-700 dark:text-rose-400 mb-0.5 ${
                  stacked ? 'text-xs leading-tight' : 'text-xs mb-1'
                }`}
              >
                {t('strategies:insights.wouldHaveLost')}
              </div>
              <div
                className={`font-bold tabular-nums text-rose-700 dark:text-rose-400 ${
                  stacked ? 'text-base sm:text-lg' : 'text-2xl'
                }`}
              >
                {formatPct(stats.would_have_lost_pct)}
              </div>
              <div
                className={`text-gray-600 dark:text-gray-400 tabular-nums ${
                  stacked ? 'text-xs mt-0.5' : 'text-xs mt-1'
                }`}
              >
                {formatCount(stats.would_have_lost)} {t('trades:trades')}
              </div>
            </div>
          </div>

          <div
            className={`text-gray-700 dark:text-gray-300 shrink-0 ${
              stacked ? 'space-y-0.5 text-xs sm:text-sm' : 'space-y-2 text-sm'
            }`}
          >
            <div className="flex justify-between gap-2 tabular-nums">
              <span className="text-gray-500 dark:text-gray-400">
                {t('strategies:insights.answeredTrades')}
              </span>
              {onDrillDown && stats.total_answered > 0 ? (
                <button
                  type="button"
                  className="font-semibold hover:underline cursor-pointer"
                  onClick={() =>
                    openGainDrillDown(
                      { gain_if_strategy_respected__isnull: false },
                      'strategies:drillDown.answeredGainTrades'
                    )
                  }
                >
                  {formatCount(stats.total_answered)}
                </button>
              ) : (
                <span className="font-semibold">{formatCount(stats.total_answered)}</span>
              )}
            </div>
            {stats.unanswered > 0 && (
              <div className="flex justify-between gap-2 tabular-nums">
                <span className="text-gray-500 dark:text-gray-400">
                  {t('strategies:insights.unansweredTrades')}
                </span>
                {onDrillDown ? (
                  <button
                    type="button"
                    className="font-semibold hover:underline cursor-pointer"
                    onClick={() =>
                      openGainDrillDown(
                        { gain_if_strategy_respected__isnull: true },
                        'strategies:drillDown.unansweredGainTrades'
                      )
                    }
                  >
                    {formatCount(stats.unanswered)}
                  </button>
                ) : (
                  <span className="font-semibold">{formatCount(stats.unanswered)}</span>
                )}
              </div>
            )}
            {insight && (
              <p
                className={`text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 ${
                  stacked ? 'pt-1 line-clamp-2' : 'pt-2 text-sm'
                }`}
              >
                {insight}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }
);

StrategyGainIfRespectedCard.displayName = 'StrategyGainIfRespectedCard';
