import React from 'react';
import { useTranslation } from 'react-i18next';
import Tooltip from '../ui/Tooltip';
import { MetricGauge } from './MetricGauge';
import { GAUGE_CONFIGS } from './gaugeConfigs';

interface PlanRespectStripProps {
  planRespectRate: number;
  tradesWithBothRr: number;
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

export const PlanRespectStrip: React.FC<PlanRespectStripProps> = ({
  planRespectRate,
  tradesWithBothRr,
  formatNumber,
}) => {
  const { t } = useTranslation();
  const hasComparable = tradesWithBothRr > 0;

  if (!hasComparable) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t('statistics:riskReward.planRespectEmpty', {
          defaultValue:
            'Aucun trade comparable (gagnant hors break-even avec R:R prévu et réel).',
        })}
      </p>
    );
  }

  const insightTone: 'good' | 'mid' | 'warn' =
    planRespectRate >= 70 ? 'good' : planRespectRate < 50 ? 'warn' : 'mid';

  const insightClass =
    insightTone === 'good'
      ? 'mt-auto rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 text-xs leading-relaxed text-emerald-900 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-100/90'
      : insightTone === 'warn'
        ? 'mt-auto rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-100/90'
        : 'mt-auto rounded-lg border border-sky-200/80 bg-sky-50/80 px-3 py-2 text-xs leading-relaxed text-sky-900 dark:border-sky-700/40 dark:bg-sky-900/20 dark:text-sky-100/90';

  const insightText =
    insightTone === 'good'
      ? t('statistics:riskReward.planRespectInsightGood', {
          defaultValue:
            'Sur {{comparableCount}} trades comparables, {{pct}}% ont un R:R réel ≥ prévu — bon respect du plan.',
          pct: formatNumber(planRespectRate, 1),
          comparableCount: formatNumber(tradesWithBothRr, 0),
        })
      : insightTone === 'warn'
        ? t('statistics:riskReward.planRespectInsightWarn', {
            defaultValue:
              'Sur {{comparableCount}} trades comparables, seulement {{pct}}% atteignent le R:R prévu — sorties trop tôt ou stop élargi.',
            pct: formatNumber(planRespectRate, 1),
            comparableCount: formatNumber(tradesWithBothRr, 0),
          })
        : t('statistics:riskReward.planRespectInsightMid', {
            defaultValue:
              'Sur {{comparableCount}} trades comparables, {{pct}}% respectent le R:R prévu — correct, marge pour viser 70%+.',
            pct: formatNumber(planRespectRate, 1),
            comparableCount: formatNumber(tradesWithBothRr, 0),
          });

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
      <MetricGauge
        label={t('statistics:riskReward.planRespectRate', { defaultValue: 'Taux de respect' })}
        value={planRespectRate}
        config={GAUGE_CONFIGS.planRespectRate}
        tooltip={t('statistics:riskReward.planRespectRateTooltip', {
          defaultValue:
            'Pourcentage de trades gagnants hors break-even où le R:R réel est supérieur ou égal au R:R prévu',
        })}
        formatValue={(val: number) => `${formatNumber(val, 1)}%`}
        showLabels
        size="md"
      />

      <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700/40">
        <div className="flex items-center gap-1">
          <span className="min-w-0 truncate text-xs text-gray-500 dark:text-gray-400">
            {t('statistics:riskReward.tradesWithBothRR', { defaultValue: 'Trades comparables' })}
          </span>
          <Tooltip
            content={t('statistics:riskReward.tradesWithBothRRTooltip', {
              defaultValue:
                'Nombre de trades gagnants hors break-even ayant à la fois un R:R prévu et un R:R réel',
            })}
            position="bottom"
            className="shrink-0 items-center leading-none"
            contentClassName="whitespace-pre-line block"
          >
            {HELP_ICON}
          </Tooltip>
        </div>
        <span className="mt-0.5 block text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
          {formatNumber(tradesWithBothRr, 0)}
        </span>
      </div>

      <p className={insightClass}>{insightText}</p>
    </div>
  );
};
