import React from 'react';
import { useTranslation } from 'react-i18next';
import { MetricCard, MetricItem } from './MetricCard';
import { MetricGauge, GAUGE_CONFIGS } from './MetricGauge';
import { TradeOutcomeStrip } from './TradeOutcomeStrip';
import { TradesDistributionChart } from '../analytics/TradesDistributionChart';
import type { TradesDistributionChartData } from '../../utils/buildTradesDistributionData';
import type { StatisticsTabBaseProps } from './statisticsTypes';
import type { ChartColors } from '../../utils/chartConfig';

interface StatisticsOverviewTabProps extends StatisticsTabBaseProps {
  tradesDistributionData: TradesDistributionChartData | null;
  chartColors: ChartColors;
}

export const StatisticsOverviewTab: React.FC<StatisticsOverviewTabProps> = ({
  statisticsData,
  tradesDistributionData,
  chartColors,
  currencySymbol,
  formatCurrency,
  formatNumber,
  formatVolume,
  hideMoney = false,
}) => {
  const { t } = useTranslation();

  const displayCurrency = (value: number) =>
    hideMoney ? '***' : formatCurrency(value, currencySymbol);

  return (
    <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-[1fr_minmax(280px,360px)]">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <MetricCard
          title={t('statistics:overview.performance', { defaultValue: 'Performance' })}
          icon={
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        >
          <MetricItem
            label={t('statistics:overview.totalPnL')}
            value={displayCurrency(parseFloat(statisticsData.total_pnl))}
            tooltip={t('statistics:overview.totalPnLTooltip')}
            variant={parseFloat(statisticsData.total_pnl) >= 0 ? 'success' : 'danger'}
          />
          <div className="mt-4">
            <MetricGauge
              label={t('statistics:overview.winRate')}
              value={statisticsData.win_rate}
              config={GAUGE_CONFIGS.winRate}
              tooltip={t('statistics:overview.winRateTooltip')}
              formatValue={(val: number) => `${formatNumber(val, 2)}%`}
              showLabels
              size="md"
            />
          </div>
        </MetricCard>

        <MetricCard
          title={t('statistics:performanceRatios.drawdownAndRunup', { defaultValue: 'Drawdown & Run-up' })}
          icon={
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        >
          <MetricItem
            label={t('statistics:performanceRatios.maxDrawdown', { defaultValue: 'Max Drawdown' })}
            value={`${formatNumber(statisticsData.max_drawdown_global_pct, 2)}%`}
            subValue={displayCurrency(statisticsData.max_drawdown_global)}
            tooltip={t('statistics:performanceRatios.maxDrawdownGlobalTooltip', {
              defaultValue: 'Plus grande baisse depuis un pic (tous les temps).',
            })}
            variant="danger"
          />
          <MetricItem
            label={t('statistics:performanceRatios.maxRunupGlobal', { defaultValue: 'Max Run-up Global' })}
            value={`${formatNumber(statisticsData.max_runup_global_pct, 2)}%`}
            subValue={displayCurrency(statisticsData.max_runup_global)}
            tooltip={t('statistics:performanceRatios.maxRunupTooltip', {
              defaultValue: 'Plus grande hausse depuis un point bas',
            })}
            variant="success"
          />
        </MetricCard>

        <MetricCard
          title={t('statistics:performanceRatios.temporalAnalysis')}
          icon={
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        >
          <MetricItem
            label={t('statistics:performanceRatios.frequency')}
            value={`${formatNumber(statisticsData.frequency_ratio, 1)} ${t('statistics:performanceRatios.tradesPerDay')}`}
            tooltip={t('statistics:performanceRatios.frequencyTooltip')}
            variant="info"
          />
          <MetricItem
            label={t('statistics:overview.averageDuration')}
            value={statisticsData.average_duration}
            variant="info"
          />
          <MetricItem
            label={t('statistics:performanceRatios.avgTimeBetweenTrades')}
            value={statisticsData.avg_time_between_trades}
            tooltip={t('statistics:performanceRatios.avgTimeBetweenTradesTooltip')}
            variant="info"
          />
          <MetricItem
            label={t('statistics:performanceRatios.avgDailyExposureTime')}
            value={statisticsData.avg_daily_exposure_time || '00:00:00'}
            tooltip={t('statistics:performanceRatios.avgDailyExposureTimeTooltip')}
            variant="info"
          />
          <MetricItem
            label={t('statistics:performanceRatios.durationRatio')}
            value={formatNumber(statisticsData.duration_ratio, 2)}
            tooltip={t('statistics:performanceRatios.durationRatioTooltip')}
            variant={statisticsData.duration_ratio >= 1.0 ? 'success' : 'warning'}
          />
        </MetricCard>

        <MetricCard
          title={t('statistics:overview.generalStatistics')}
          icon={
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          }
        >
          <TradeOutcomeStrip
            totalTrades={statisticsData.total_trades || 0}
            totalVolumeLabel={formatVolume(statisticsData.total_volume)}
            winningTrades={statisticsData.winning_trades}
            losingTrades={statisticsData.losing_trades}
            breakEvenPositiveTrades={statisticsData.break_even_positive_trades ?? 0}
            breakEvenZeroTrades={statisticsData.break_even_zero_trades ?? 0}
          />
        </MetricCard>
      </div>

      <TradesDistributionChart data={tradesDistributionData} chartColors={chartColors} variant="compact" />
    </div>
  );
};
