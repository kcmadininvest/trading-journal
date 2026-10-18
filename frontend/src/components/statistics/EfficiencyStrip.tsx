import React from 'react';
import { useTranslation } from 'react-i18next';
import Tooltip from '../ui/Tooltip';
import { MetricGauge } from './MetricGauge';
import { GAUGE_CONFIGS } from './gaugeConfigs';
import {
  getGaugeVerdict,
  VERDICT_TEXT_CLASSES,
} from '../../utils/getGaugeVerdict';

interface EfficiencyStripProps {
  tradeEfficiency: number;
  feesRatio: number;
  volumePnlRatio: number;
  formatNumber: (value: number, digits?: number) => string;
  formatRatio: (ratio: number) => string;
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

export const EfficiencyStrip: React.FC<EfficiencyStripProps> = ({
  tradeEfficiency,
  feesRatio,
  volumePnlRatio,
  formatNumber,
  formatRatio,
}) => {
  const { t } = useTranslation();
  const feesPct = feesRatio * 100;
  const feesVerdict = getGaugeVerdict(feesPct, GAUGE_CONFIGS.feesRatio);
  const efficiencyInsightTone: 'good' | 'mid' | 'warn' =
    tradeEfficiency >= 50 ? 'good' : tradeEfficiency < 30 ? 'warn' : 'mid';
  const efficiencyInsightClass =
    efficiencyInsightTone === 'good'
      ? 'mt-auto rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 text-xs leading-relaxed text-emerald-900 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-100/90'
      : efficiencyInsightTone === 'warn'
        ? 'mt-auto rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-100/90'
        : 'mt-auto rounded-lg border border-sky-200/80 bg-sky-50/80 px-3 py-2 text-xs leading-relaxed text-sky-900 dark:border-sky-700/40 dark:bg-sky-900/20 dark:text-sky-100/90';
  const efficiencyInsightText =
    efficiencyInsightTone === 'good'
      ? t('statistics:performanceTab.details.efficiencyInsightGood', {
          defaultValue:
            'Vous atteignez le Take Profit sur {{pct}}% des trades — bonne exécution du plan.',
          pct: formatNumber(tradeEfficiency, 1),
        })
      : efficiencyInsightTone === 'warn'
        ? t('statistics:performanceTab.details.efficiencyInsightWarn', {
            defaultValue:
              'Seulement {{pct}}% des trades atteignent le Take Profit — revoir timing de sortie ou objectifs.',
            pct: formatNumber(tradeEfficiency, 1),
          })
        : t('statistics:performanceTab.details.efficiencyInsightMid', {
            defaultValue:
              'Take Profit atteint sur {{pct}}% des trades — exécution correcte, encore de la marge pour stabiliser au-dessus de 50%.',
            pct: formatNumber(tradeEfficiency, 1),
          });

  const kpis = [
    {
      key: 'fees',
      label: t('statistics:performanceRatios.feesRatio'),
      value: `${formatNumber(feesPct, 1)}%`,
      tooltip: t('statistics:performanceRatios.feesRatioTooltip'),
      valueClass: VERDICT_TEXT_CLASSES[feesVerdict],
    },
    {
      key: 'volume',
      label: t('statistics:performanceRatios.volumePnLRatio'),
      value: formatRatio(volumePnlRatio),
      tooltip: t('statistics:performanceRatios.volumePnLRatioTooltip'),
      valueClass: 'text-gray-900 dark:text-gray-100',
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
      <MetricGauge
        label={t('statistics:performanceRatios.tradeEfficiency')}
        value={tradeEfficiency}
        config={GAUGE_CONFIGS.tradeEfficiency}
        tooltip={t('statistics:performanceRatios.tradeEfficiencyTooltip')}
        formatValue={(val: number) => `${formatNumber(val, 1)}%`}
        showLabels
        size="md"
      />

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
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

      <p className={efficiencyInsightClass}>{efficiencyInsightText}</p>
    </div>
  );
};
