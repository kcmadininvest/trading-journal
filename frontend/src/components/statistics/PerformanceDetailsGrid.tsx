import React from 'react';
import { useTranslation } from 'react-i18next';
import { MetricCard, MetricItem } from './MetricCard';
import { MetricGauge, GAUGE_CONFIGS } from './MetricGauge';
import type { StatisticsData } from '../../hooks/useStatistics';
import {
  getGaugeVerdict,
  verdictToMetricVariant,
} from '../../utils/getGaugeVerdict';
import type { StatisticsFormatters } from './statisticsTypes';

interface PerformanceDetailsGridProps
  extends Pick<StatisticsFormatters, 'formatNumber' | 'formatRatio'> {
  statisticsData: StatisticsData;
}

function CompactGaugeRow({
  label,
  value,
  config,
  tooltip,
  formatValue,
  showScale = false,
}: {
  label: string;
  value: number;
  config: (typeof GAUGE_CONFIGS)[keyof typeof GAUGE_CONFIGS];
  tooltip?: string;
  formatValue: (val: number) => string;
  showScale?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
        <span className="text-base font-semibold tabular-nums text-gray-900 dark:text-gray-100">
          {formatValue(value)}
        </span>
      </div>
      <MetricGauge
        label={label}
        value={value}
        config={config}
        tooltip={tooltip}
        formatValue={formatValue}
        showLabels={showScale}
        size="sm"
        compactBar
      />
    </div>
  );
}

export const PerformanceDetailsGrid: React.FC<PerformanceDetailsGridProps> = ({
  statisticsData,
  formatNumber,
  formatRatio,
}) => {
  const { t } = useTranslation();

  const sortinoVerdict = verdictToMetricVariant(
    getGaugeVerdict(statisticsData.sortino_ratio, GAUGE_CONFIGS.sharpeRatio)
  );
  const calmarVerdict = verdictToMetricVariant(
    getGaugeVerdict(statisticsData.calmar_ratio, GAUGE_CONFIGS.sharpeRatio)
  );

  const recoveryTimeValue =
    statisticsData.recovery_time !== undefined &&
    statisticsData.recovery_time !== null &&
    statisticsData.recovery_time > 0
      ? `${formatNumber(statisticsData.recovery_time, 1)} ${t('statistics:performanceRatios.trades')}`
      : t('statistics:performanceRatios.noRecovery', { defaultValue: 'N/A' });

  return (
    <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
      <MetricCard
        title={t('statistics:performanceTab.details.efficiency')}
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
          label={t('statistics:performanceRatios.volumePnLRatio')}
          value={formatRatio(statisticsData.volume_pnl_ratio)}
          tooltip={t('statistics:performanceRatios.volumePnLRatioTooltip')}
          variant="default"
        />
        <CompactGaugeRow
          label={t('statistics:performanceRatios.feesRatio')}
          value={statisticsData.fees_ratio * 100}
          config={GAUGE_CONFIGS.feesRatio}
          tooltip={t('statistics:performanceRatios.feesRatioTooltip')}
          formatValue={(val) => `${formatNumber(val, 1)}%`}
        />
        <CompactGaugeRow
          label={t('statistics:performanceRatios.tradeEfficiency')}
          value={statisticsData.trade_efficiency}
          config={GAUGE_CONFIGS.tradeEfficiency}
          tooltip={t('statistics:performanceRatios.tradeEfficiencyTooltip')}
          formatValue={(val) => `${formatNumber(val, 1)}%`}
        />
      </MetricCard>

      <MetricCard
        title={t('statistics:performanceTab.details.resilience')}
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
        <MetricItem
          label={t('statistics:performanceRatios.sortinoRatio')}
          value={formatNumber(statisticsData.sortino_ratio, 2)}
          tooltip={t('statistics:performanceRatios.sortinoRatioTooltip')}
          variant={sortinoVerdict}
        />
        <MetricItem
          label={t('statistics:performanceRatios.calmarRatio')}
          value={formatNumber(statisticsData.calmar_ratio, 2)}
          tooltip={t('statistics:performanceRatios.calmarRatioTooltip')}
          variant={calmarVerdict}
        />
        <MetricItem
          label={t('statistics:performanceRatios.recoveryTime')}
          value={recoveryTimeValue}
          tooltip={t('statistics:performanceRatios.recoveryTimeTooltip')}
          variant="default"
        />
        <CompactGaugeRow
          label={t('statistics:performanceRatios.recoveryRatio')}
          value={statisticsData.recovery_ratio}
          config={GAUGE_CONFIGS.recoveryRatio}
          tooltip={t('statistics:performanceRatios.recoveryRatioTooltip')}
          formatValue={(val) => formatNumber(val, 2)}
          showScale
        />
      </MetricCard>
    </div>
  );
};
