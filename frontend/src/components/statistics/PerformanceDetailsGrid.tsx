import React from 'react';
import { useTranslation } from 'react-i18next';
import { MetricCard } from './MetricCard';
import { EfficiencyStrip } from './EfficiencyStrip';
import { ResilienceStrip } from './ResilienceStrip';
import type { StatisticsData } from '../../hooks/useStatistics';
import type { StatisticsFormatters } from './statisticsTypes';

interface PerformanceDetailsGridProps
  extends Pick<StatisticsFormatters, 'formatNumber' | 'formatRatio'> {
  statisticsData: StatisticsData;
}

export const PerformanceDetailsGrid: React.FC<PerformanceDetailsGridProps> = ({
  statisticsData,
  formatNumber,
  formatRatio,
}) => {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
      <MetricCard
        title={t('statistics:performanceTab.details.efficiency')}
        fillHeight
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
        <EfficiencyStrip
          tradeEfficiency={statisticsData.trade_efficiency}
          feesRatio={statisticsData.fees_ratio}
          volumePnlRatio={statisticsData.volume_pnl_ratio}
          formatNumber={formatNumber}
          formatRatio={formatRatio}
        />
      </MetricCard>

      <MetricCard
        title={t('statistics:performanceTab.details.resilience')}
        fillHeight
        icon={
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        }
      >
        <ResilienceStrip
          recoveryFactor={statisticsData.recovery_factor}
          recoveryFactorAvailable={statisticsData.max_drawdown > 0}
          bestWorstTradeRatio={statisticsData.best_worst_trade_ratio}
          sortinoRatio={statisticsData.sortino_ratio}
          calmarRatio={statisticsData.calmar_ratio}
          recoveryTime={statisticsData.recovery_time}
          formatNumber={formatNumber}
        />
      </MetricCard>
    </div>
  );
};
