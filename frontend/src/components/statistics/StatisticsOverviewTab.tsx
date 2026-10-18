import React from 'react';
import { useTranslation } from 'react-i18next';
import { MetricCard, MetricItem } from './MetricCard';
import { MetricGauge } from './MetricGauge';
import { GAUGE_CONFIGS } from './gaugeConfigs';
import { TradeOutcomeStrip } from './TradeOutcomeStrip';
import { TemporalAnalysisStrip } from './TemporalAnalysisStrip';
import type { StatisticsTabBaseProps } from './statisticsTypes';

export const StatisticsOverviewTab: React.FC<StatisticsTabBaseProps> = ({
  statisticsData,
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
          value={`${formatNumber(statisticsData.max_drawdown_pct, 2)}% (${displayCurrency(statisticsData.max_drawdown)})`}
          tooltip={t('statistics:performanceRatios.maxDrawdownPeriodTooltip', {
            defaultValue: 'Plus grande baisse depuis un pic sur la période filtrée.',
          })}
          variant="danger"
        />
        <MetricItem
          label={t('statistics:performanceRatios.maxRunup', { defaultValue: 'Max Run-up' })}
          value={`${formatNumber(statisticsData.max_runup_pct, 2)}% (${displayCurrency(statisticsData.max_runup)})`}
          tooltip={t('statistics:performanceRatios.maxRunupTooltip', {
            defaultValue: 'Plus grande hausse depuis un point bas sur la période filtrée.',
          })}
          variant="success"
        />
        <MetricItem
          label={t('statistics:performanceRatios.recoveryFactor', { defaultValue: 'Recovery Factor' })}
          value={
            statisticsData.max_drawdown > 0
              ? formatNumber(statisticsData.recovery_factor, 2)
              : t('statistics:performanceRatios.noRecovery', { defaultValue: 'N/A' })
          }
          tooltip={t('statistics:performanceRatios.recoveryFactorTooltip', {
            defaultValue:
              'Combien de fois le profit net de la période couvre la pire baisse. < 1 faible · ≥ 1 correct · ≥ 2 bon · ≥ 3 excellent.',
          })}
          variant={
            statisticsData.max_drawdown > 0 && statisticsData.recovery_factor >= 1
              ? 'success'
              : statisticsData.max_drawdown > 0
                ? 'danger'
                : 'default'
          }
        />
      </MetricCard>

      <MetricCard
        title={t('statistics:performanceRatios.temporalAnalysis')}
        fillHeight
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
        <TemporalAnalysisStrip
          frequencyRatio={statisticsData.frequency_ratio}
          averageDuration={statisticsData.average_duration}
          avgTimeBetweenTrades={statisticsData.avg_time_between_trades}
          avgDailyExposureTime={statisticsData.avg_daily_exposure_time || '00:00:00'}
          durationRatio={statisticsData.duration_ratio}
          formatNumber={formatNumber}
        />
      </MetricCard>

      <MetricCard
        title={t('statistics:overview.generalStatistics')}
        fillHeight
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
          breakEvenTrades={statisticsData.break_even_trades ?? 0}
          breakEvenPositiveTrades={statisticsData.break_even_positive_trades ?? 0}
          formatNumber={formatNumber}
        />
      </MetricCard>
    </div>
  );
};
