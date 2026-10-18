import React from 'react';
import { useTranslation } from 'react-i18next';
import Tooltip from '../ui/Tooltip';
import { MetricGauge } from './MetricGauge';
import { GAUGE_CONFIGS } from './gaugeConfigs';
import {
  getGaugeVerdict,
  VERDICT_TEXT_CLASSES,
} from '../../utils/getGaugeVerdict';

interface ResilienceStripProps {
  recoveryRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  recoveryTime: number | null | undefined;
  formatNumber: (value: number, digits?: number) => string;
}

const HELP_ICON = (
  <svg
    className="block h-3.5 w-3.5 shrink-0 cursor-help text-gray-400 dark:text-gray-500"
    fill="currentColor"
    viewBox="0 0 20 20"
  >
    <path
      fillRule="evenodd"
      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
      clipRule="evenodd"
    />
  </svg>
);

export const ResilienceStrip: React.FC<ResilienceStripProps> = ({
  recoveryRatio,
  sortinoRatio,
  calmarRatio,
  recoveryTime,
  formatNumber,
}) => {
  const { t } = useTranslation();
  const hasRecoveryRatio = recoveryRatio > 0;
  const recoveryCoversDrawdown = recoveryRatio >= 1;

  const sortinoVerdict = getGaugeVerdict(sortinoRatio, GAUGE_CONFIGS.sharpeRatio);
  const calmarVerdict = getGaugeVerdict(calmarRatio, GAUGE_CONFIGS.sharpeRatio);

  const recoveryTimeValue =
    recoveryTime !== undefined && recoveryTime !== null && recoveryTime > 0
      ? `${formatNumber(recoveryTime, 1)} ${t('statistics:performanceRatios.trades')}`
      : t('statistics:performanceRatios.noRecovery', { defaultValue: 'N/A' });

  const kpis = [
    {
      key: 'sortino',
      label: t('statistics:performanceRatios.sortinoRatio'),
      value: formatNumber(sortinoRatio, 2),
      tooltip: t('statistics:performanceRatios.sortinoRatioTooltip'),
      valueClass: VERDICT_TEXT_CLASSES[sortinoVerdict],
    },
    {
      key: 'calmar',
      label: t('statistics:performanceRatios.calmarRatio'),
      value: formatNumber(calmarRatio, 2),
      tooltip: t('statistics:performanceRatios.calmarRatioTooltip'),
      valueClass: VERDICT_TEXT_CLASSES[calmarVerdict],
    },
    {
      key: 'recoveryTime',
      label: t('statistics:performanceRatios.recoveryTime'),
      value: recoveryTimeValue,
      tooltip: t('statistics:performanceRatios.recoveryTimeTooltip'),
      valueClass: 'text-gray-900 dark:text-gray-100',
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
      {hasRecoveryRatio ? (
        <MetricGauge
          label={t('statistics:performanceRatios.recoveryRatio')}
          value={recoveryRatio}
          config={GAUGE_CONFIGS.recoveryRatio}
          tooltip={t('statistics:performanceRatios.recoveryRatioTooltip')}
          formatValue={(val: number) => formatNumber(val, 2)}
          showLabels
          size="md"
        />
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('statistics:performanceTab.details.recoveryRatioEmpty', {
            defaultValue: 'Ratio de récupération indisponible (données insuffisantes sur la période).',
          })}
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
        {kpis.map((kpi) => (
          <div
            key={kpi.key}
            className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700/40"
          >
            <div className="flex items-center gap-1">
              <span className="min-w-0 truncate text-xs text-gray-500 dark:text-gray-400">
                {kpi.label}
              </span>
              <Tooltip
                content={kpi.tooltip}
                position="bottom"
                className="shrink-0 items-center leading-none"
                contentClassName="whitespace-pre-line block"
              >
                {HELP_ICON}
              </Tooltip>
            </div>
            <span className={`mt-0.5 block text-sm font-semibold tabular-nums ${kpi.valueClass}`}>
              {kpi.value}
            </span>
          </div>
        ))}
      </div>

      {hasRecoveryRatio && recoveryCoversDrawdown && (
        <p className="mt-auto rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 text-xs leading-relaxed text-emerald-900 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-100/90">
          {t('statistics:performanceTab.details.resilienceInsightGood', {
            defaultValue:
              'Votre max run-up couvre {{ratio}}× le max drawdown — bonne capacité de récupération.',
            ratio: formatNumber(recoveryRatio, 2),
          })}
        </p>
      )}
      {hasRecoveryRatio && !recoveryCoversDrawdown && (
        <p className="mt-auto rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-100/90">
          {t('statistics:performanceTab.details.resilienceInsightWarn', {
            defaultValue:
              'Le drawdown dépasse le run-up (ratio {{ratio}}) — récupération encore incomplète.',
            ratio: formatNumber(recoveryRatio, 2),
          })}
        </p>
      )}
    </div>
  );
};
