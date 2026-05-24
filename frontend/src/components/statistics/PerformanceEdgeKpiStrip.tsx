import React from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { maskValue } from '../../hooks/usePrivacySettings';
import type { StatisticsData } from '../../hooks/useStatistics';
import { GAUGE_CONFIGS } from './MetricGauge';
import {
  getExpectancyVerdict,
  getGaugeVerdict,
  VERDICT_BADGE_CLASSES,
  VERDICT_CARD_CLASSES,
  VERDICT_TEXT_CLASSES,
  type GaugeVerdictLevel,
} from '../../utils/getGaugeVerdict';

interface PerformanceEdgeKpiStripProps {
  statisticsData: StatisticsData;
  currencySymbol: string;
  formatCurrency: (value: number, currencySymbol?: string) => string;
  formatNumber: (value: number, digits?: number) => string;
  hideMoney?: boolean;
}

function VerdictBadge({ level }: { level: GaugeVerdictLevel }) {
  const { t } = useTranslation();
  const labelKey = `statistics:performanceTab.verdict.${level}`;

  return (
    <span
      className={clsx(
        'mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold',
        VERDICT_BADGE_CLASSES[level]
      )}
    >
      {t(labelKey)}
    </span>
  );
}

export const PerformanceEdgeKpiStrip: React.FC<PerformanceEdgeKpiStripProps> = ({
  statisticsData,
  currencySymbol,
  formatCurrency,
  formatNumber,
  hideMoney = false,
}) => {
  const { t } = useTranslation();

  const expectancyVerdict = getExpectancyVerdict(statisticsData.expectancy);
  const profitFactorVerdict = getGaugeVerdict(statisticsData.profit_factor, GAUGE_CONFIGS.profitFactor);
  const sharpeVerdict = getGaugeVerdict(statisticsData.sharpe_ratio, GAUGE_CONFIGS.sharpeRatio);

  const items = [
    {
      key: 'expectancy',
      label: t('statistics:performanceRatios.expectancy'),
      value: hideMoney ? maskValue(null, currencySymbol) : formatCurrency(statisticsData.expectancy, currencySymbol),
      verdict: expectancyVerdict,
    },
    {
      key: 'profitFactor',
      label: t('statistics:performanceRatios.profitFactor'),
      value: formatNumber(statisticsData.profit_factor, 2),
      verdict: profitFactorVerdict,
    },
    {
      key: 'sharpe',
      label: t('statistics:performanceRatios.sharpeRatio'),
      value: formatNumber(statisticsData.sharpe_ratio, 2),
      verdict: sharpeVerdict,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-3 sm:gap-4">
      {items.map((item) => (
        <div
          key={item.key}
          className={clsx('rounded-lg border px-4 py-3 shadow-sm', VERDICT_CARD_CLASSES[item.verdict])}
        >
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 sm:text-sm">{item.label}</p>
          <p className={clsx('mt-1 text-lg font-bold tabular-nums sm:text-xl', VERDICT_TEXT_CLASSES[item.verdict])}>
            {item.value}
          </p>
          <VerdictBadge level={item.verdict} />
        </div>
      ))}
    </div>
  );
};
