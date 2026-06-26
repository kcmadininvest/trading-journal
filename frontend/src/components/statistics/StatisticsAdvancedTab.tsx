import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MetricCard, MetricItem } from './MetricCard';
import { MetricGauge } from './MetricGauge';
import { GAUGE_CONFIGS } from './gaugeConfigs';
import { STATS_GRID } from './statisticsConstants';
import type { StatisticsTabBaseProps } from './statisticsTypes';
import { buildTradeOutcomeSeries } from '../../utils/computeRollingPeakWinRate';
import { StatisticsOutcomeSeriesCard } from './StatisticsOutcomeSeriesCard';
import { WIN_RATE_ROLLING_WINDOW } from '../../utils/tradingSampleThresholds';

export const StatisticsAdvancedTab: React.FC<StatisticsTabBaseProps> = ({
  statisticsData,
  analyticsData,
  currencySymbol,
  formatCurrency,
  formatNumber,
  hideMoney = false,
  filteredTrades = [],
  pnlDisplayMode = 'net',
  dateFormat = 'EU',
  timezone = 'UTC',
  numberFormat = 'comma',
}) => {
  const { t } = useTranslation();

  const recentOutcomeSeries = useMemo(
    () =>
      buildTradeOutcomeSeries(filteredTrades, pnlDisplayMode, {
        limit: WIN_RATE_ROLLING_WINDOW,
        tail: true,
      }),
    [filteredTrades, pnlDisplayMode],
  );

  const displayCurrency = (value: number) =>
    hideMoney ? '***' : formatCurrency(value, currencySymbol);

  if (!analyticsData) {
    return null;
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className={STATS_GRID}>
        <MetricCard
          title={t('statistics:advancedAnalysis.dailyGains')}
          icon={
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        >
          <MetricItem
            label={t('statistics:advancedAnalysis.average')}
            value={displayCurrency(analyticsData.daily_stats.avg_gain_per_day)}
            variant="success"
          />
          <MetricItem
            label={t('statistics:advancedAnalysis.median')}
            value={displayCurrency(analyticsData.daily_stats.median_gain_per_day)}
            variant="success"
          />
          <MetricItem
            label={t('statistics:advancedAnalysis.maximum')}
            value={displayCurrency(analyticsData.daily_stats.max_gain_per_day)}
            variant="success"
          />
        </MetricCard>

        <MetricCard
          title={t('statistics:advancedAnalysis.dailyLosses')}
          icon={
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6 6" />
            </svg>
          }
        >
          <MetricItem
            label={t('statistics:advancedAnalysis.average')}
            value={displayCurrency(analyticsData.daily_stats.avg_loss_per_day)}
            variant="danger"
          />
          <MetricItem
            label={t('statistics:advancedAnalysis.median')}
            value={displayCurrency(analyticsData.daily_stats.median_loss_per_day)}
            variant="danger"
          />
          <MetricItem
            label={t('statistics:advancedAnalysis.maximum')}
            value={displayCurrency(analyticsData.daily_stats.max_loss_per_day)}
            variant="danger"
          />
        </MetricCard>

        <MetricCard
          title={t('statistics:advancedAnalysis.tradesPerDay')}
          icon={
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        >
          <MetricItem
            label={t('statistics:advancedAnalysis.average')}
            value={formatNumber(analyticsData.daily_stats.avg_trades_per_day)}
            variant="info"
          />
          <MetricItem
            label={t('statistics:advancedAnalysis.median')}
            value={formatNumber(analyticsData.daily_stats.median_trades_per_day)}
            variant="info"
          />
        </MetricCard>

        <MetricCard
          title={t('statistics:advancedAnalysis.individualTrades')}
          icon={
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        >
          <MetricItem
            label={t('statistics:advancedAnalysis.maxGain')}
            value={displayCurrency(analyticsData.trade_stats.max_gain_per_trade)}
            variant="success"
          />
          <MetricItem
            label={t('statistics:advancedAnalysis.maxLoss')}
            value={displayCurrency(analyticsData.trade_stats.max_loss_per_trade)}
            variant="danger"
          />
        </MetricCard>

        <MetricCard
          title={t('statistics:advancedAnalysis.tradeDurations')}
          icon={
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        >
          <MetricItem
            label={t('statistics:advancedAnalysis.avgDurationWinningTrade')}
            value={analyticsData.trade_stats.avg_duration_winning_trade}
            variant="success"
          />
          <MetricItem
            label={t('statistics:advancedAnalysis.avgDurationLosingTrade')}
            value={analyticsData.trade_stats.avg_duration_losing_trade}
            variant="danger"
          />
        </MetricCard>

        <MetricCard
          title={t('statistics:advancedAnalysis.dailySequences')}
          icon={
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        >
          <MetricItem
            label={t('statistics:advancedAnalysis.consecutiveGains')}
            value={analyticsData.consecutive_stats.max_consecutive_wins_per_day}
            variant="success"
            tooltip={t('statistics:advancedAnalysis.consecutiveGainsTooltip')}
          />
          <MetricItem
            label={t('statistics:advancedAnalysis.consecutiveLosses')}
            value={analyticsData.consecutive_stats.max_consecutive_losses_per_day}
            variant="danger"
            tooltip={t('statistics:advancedAnalysis.consecutiveLossesTooltip')}
          />
        </MetricCard>

        <MetricCard
          title={t('statistics:advancedAnalysis.globalSequences')}
          icon={
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          }
        >
          <MetricItem
            label={t('statistics:advancedAnalysis.consecutiveGains')}
            value={analyticsData.consecutive_stats.max_consecutive_wins}
            variant="success"
            tooltip={t('statistics:advancedAnalysis.consecutiveGainsGlobalTooltip')}
          />
          <MetricItem
            label={t('statistics:advancedAnalysis.consecutiveLosses')}
            value={analyticsData.consecutive_stats.max_consecutive_losses}
            variant="danger"
            tooltip={t('statistics:advancedAnalysis.consecutiveLossesGlobalTooltip')}
          />
        </MetricCard>

        <StatisticsOutcomeSeriesCard
          series={recentOutcomeSeries}
          currencySymbol={currencySymbol}
          pnlDisplayMode={pnlDisplayMode}
          numberFormat={numberFormat}
          dateFormat={dateFormat}
          timezone={timezone}
          hideMoney={hideMoney}
        />
      </div>

      <div>
        <div className="mb-3 sm:mb-4">
          <h2 className="mb-1 text-xl font-bold text-gray-900 dark:text-gray-100 sm:text-2xl">
            {t('statistics:riskReward.title', { defaultValue: 'Risk/Reward Ratio' })}
          </h2>
          <p className="text-xs text-gray-600 dark:text-gray-400 sm:text-sm">
            {t('statistics:riskReward.subtitle', {
              defaultValue: 'Analyse du ratio risque/récompense prévu vs réel',
            })}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-3">
          <MetricCard
            title={t('statistics:riskReward.plannedRR', { defaultValue: 'R:R Prévu' })}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
          >
            <MetricItem
              label={t('statistics:riskReward.averagePlannedRR', { defaultValue: 'R:R moyen prévu' })}
              value={statisticsData.avg_planned_rr > 0 ? `1:${formatNumber(statisticsData.avg_planned_rr, 3)}` : '—'}
              tooltip={t('statistics:riskReward.averagePlannedRRTooltip', {
                defaultValue: "Ratio Risk/Reward moyen prévu à l'entrée des trades",
              })}
              variant={
                statisticsData.avg_planned_rr >= 2.0
                  ? 'success'
                  : statisticsData.avg_planned_rr >= 1.5
                    ? 'warning'
                    : 'default'
              }
            />
            <MetricItem
              label={t('statistics:riskReward.tradesWithPlannedRR', { defaultValue: 'Trades avec R:R prévu' })}
              value={`${statisticsData.trades_with_planned_rr} / ${statisticsData.total_trades}`}
              tooltip={t('statistics:riskReward.tradesWithPlannedRRTooltip', {
                defaultValue: 'Nombre de trades ayant un R:R prévu défini',
              })}
              variant="default"
            />
          </MetricCard>

          <MetricCard
            title={t('statistics:riskReward.actualRR', { defaultValue: 'R:R Réel' })}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
          >
            <MetricItem
              label={t('statistics:riskReward.averageActualRR', { defaultValue: 'R:R moyen réel' })}
              value={statisticsData.avg_actual_rr > 0 ? `1:${formatNumber(statisticsData.avg_actual_rr, 3)}` : '—'}
              tooltip={t('statistics:riskReward.averageActualRRTooltip', {
                defaultValue: 'Ratio Risk/Reward moyen réel obtenu à la sortie des trades',
              })}
              variant={
                statisticsData.avg_actual_rr >= 2.0
                  ? 'success'
                  : statisticsData.avg_actual_rr >= 1.5
                    ? 'warning'
                    : 'default'
              }
            />
            <MetricItem
              label={t('statistics:riskReward.tradesWithActualRR', { defaultValue: 'Trades avec R:R réel' })}
              value={`${statisticsData.trades_with_actual_rr} / ${statisticsData.total_trades}`}
              tooltip={t('statistics:riskReward.tradesWithActualRRTooltip', {
                defaultValue: 'Nombre de trades ayant un R:R réel calculé',
              })}
              variant="default"
            />
          </MetricCard>

          <MetricCard
            title={t('statistics:riskReward.planRespect', { defaultValue: 'Respect du Plan' })}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          >
            <MetricItem
              label={t('statistics:riskReward.tradesWithBothRR', { defaultValue: 'Trades comparables' })}
              value={statisticsData.trades_with_both_rr}
              tooltip={t('statistics:riskReward.tradesWithBothRRTooltip', {
                defaultValue: 'Nombre de trades ayant à la fois un R:R prévu et un R:R réel',
              })}
              variant="default"
            />
            <div className="mt-4">
              <MetricGauge
                label={t('statistics:riskReward.planRespectRate', { defaultValue: 'Taux de respect' })}
                value={statisticsData.plan_respect_rate}
                config={GAUGE_CONFIGS.planRespectRate}
                tooltip={t('statistics:riskReward.planRespectRateTooltip', {
                  defaultValue: 'Pourcentage de trades où le R:R réel est supérieur ou égal au R:R prévu',
                })}
                formatValue={(val: number) => `${formatNumber(val, 1)}%`}
                showLabels
                size="md"
              />
            </div>
          </MetricCard>
        </div>
        {statisticsData.trades_with_planned_rr === 0 && statisticsData.trades_with_actual_rr === 0 && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              {t('statistics:riskReward.noDataMessage', {
                defaultValue:
                  "Aucun R:R disponible. Ajoutez un Stop Loss et un Take Profit prévu lors de la création ou modification d'un trade pour voir les statistiques R:R.",
              })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
