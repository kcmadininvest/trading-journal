import React from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import Tooltip from '../ui/Tooltip';
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

function KpiLabelWithTooltip({ label, tooltip }: { label: string; tooltip?: string }) {
  return (
    <div className="inline-flex min-w-0 items-center gap-1 leading-tight">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 sm:text-sm">{label}</span>
      {tooltip ? (
        <Tooltip
          content={tooltip}
          position="bottom"
          className="shrink-0 items-center leading-none"
          contentClassName="whitespace-pre-line block"
        >
          <svg
            className="block h-3.5 w-3.5 shrink-0 cursor-help text-gray-400 dark:text-gray-500 sm:h-4 sm:w-4"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
        </Tooltip>
      ) : null}
    </div>
  );
}

type KpiItem = {
  key: string;
  label: string;
  value: string;
  verdict: GaugeVerdictLevel;
  tooltip?: string;
  qualityHint?: string;
  excellent?: boolean;
};

export const PerformanceEdgeKpiStrip: React.FC<PerformanceEdgeKpiStripProps> = ({
  statisticsData,
  currencySymbol,
  formatCurrency,
  formatNumber,
  hideMoney = false,
}) => {
  const { t } = useTranslation();

  const sharpeAnnualized = statisticsData.sharpe_ratio_annualized ?? 0;
  const sharpePerTrade = statisticsData.sharpe_ratio ?? 0;

  const items: KpiItem[] = [
    {
      key: 'expectancy',
      label: t('statistics:performanceRatios.expectancy'),
      value: hideMoney ? maskValue(null, currencySymbol) : formatCurrency(statisticsData.expectancy, currencySymbol),
      verdict: getExpectancyVerdict(statisticsData.expectancy),
    },
    {
      key: 'profitFactor',
      label: t('statistics:performanceRatios.profitFactor'),
      value: formatNumber(statisticsData.profit_factor, 2),
      verdict: getGaugeVerdict(statisticsData.profit_factor, GAUGE_CONFIGS.profitFactor),
    },
    {
      key: 'sharpePerTrade',
      label: t('statistics:performanceRatios.sharpeRatioPerTradeLabel'),
      value: formatNumber(sharpePerTrade, 2),
      verdict: getGaugeVerdict(sharpePerTrade, GAUGE_CONFIGS.sharpeRatio),
      tooltip: t('statistics:performanceRatios.sharpeRatioPerTradeTooltip'),
      qualityHint: t('statistics:performanceRatios.sharpeRatioPerTradeQualityHint'),
    },
    {
      key: 'sharpeAnnualized',
      label: t('statistics:performanceRatios.sharpeRatioAnnualized'),
      value: formatNumber(sharpeAnnualized, 2),
      verdict: getGaugeVerdict(sharpeAnnualized, GAUGE_CONFIGS.sharpeRatioAnnualized),
      tooltip: t('statistics:performanceRatios.sharpeRatioAnnualizedTooltip'),
      qualityHint: t('statistics:performanceRatios.sharpeRatioQualityHint'),
      excellent: sharpeAnnualized >= 2,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4 sm:gap-4">
      {items.map((item) => (
        <div
          key={item.key}
          className={clsx('rounded-lg border px-4 py-3 shadow-sm', VERDICT_CARD_CLASSES[item.verdict])}
        >
          <KpiLabelWithTooltip label={item.label} tooltip={item.tooltip} />
          <p className={clsx('mt-1 text-lg font-bold tabular-nums sm:text-xl', VERDICT_TEXT_CLASSES[item.verdict])}>
            {item.value}
          </p>
          {item.qualityHint ? (
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{item.qualityHint}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {item.excellent ? (
              <span className="mt-2 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                {t('statistics:performanceRatios.sharpeRatioExcellent')}
              </span>
            ) : (
              <VerdictBadge level={item.verdict} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
