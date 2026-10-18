import React from 'react';
import { useTranslation } from 'react-i18next';
import Tooltip from '../ui/Tooltip';

interface RiskRewardCompareStripProps {
  avgPlannedRr: number;
  avgActualRr: number;
  tradesWithPlannedRr: number;
  tradesWithActualRr: number;
  totalTrades: number;
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

function formatRr(value: number, formatNumber: (value: number, digits?: number) => string): string {
  return value > 0 ? `1:${formatNumber(value, 3)}` : '—';
}

function rrToneClass(value: number): string {
  if (value >= 2) return 'text-blue-500 dark:text-blue-400';
  if (value >= 1.5) return 'text-orange-600 dark:text-orange-400';
  return 'text-gray-900 dark:text-gray-100';
}

export const RiskRewardCompareStrip: React.FC<RiskRewardCompareStripProps> = ({
  avgPlannedRr,
  avgActualRr,
  tradesWithPlannedRr,
  tradesWithActualRr,
  totalTrades,
  formatNumber,
}) => {
  const { t } = useTranslation();
  const hasAnyRr = avgPlannedRr > 0 || avgActualRr > 0 || tradesWithPlannedRr > 0 || tradesWithActualRr > 0;

  if (!hasAnyRr) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t('statistics:riskReward.compareEmpty', {
          defaultValue: 'Aucun R:R prévu ni réel sur cette période.',
        })}
      </p>
    );
  }

  const barMax = Math.max(avgPlannedRr, avgActualRr, 0.01);
  const plannedPct = avgPlannedRr > 0 ? (avgPlannedRr / barMax) * 100 : 0;
  const actualPct = avgActualRr > 0 ? (avgActualRr / barMax) * 100 : 0;

  const insightTone: 'good' | 'mid' | 'warn' =
    avgPlannedRr > 0 && avgActualRr > 0
      ? avgActualRr >= avgPlannedRr
        ? 'good'
        : 'warn'
      : 'mid';

  const insightClass =
    insightTone === 'good'
      ? 'mt-auto rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 text-xs leading-relaxed text-emerald-900 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-100/90'
      : insightTone === 'warn'
        ? 'mt-auto rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-100/90'
        : 'mt-auto rounded-lg border border-sky-200/80 bg-sky-50/80 px-3 py-2 text-xs leading-relaxed text-sky-900 dark:border-sky-700/40 dark:bg-sky-900/20 dark:text-sky-100/90';

  const insightText =
    insightTone === 'good'
      ? t('statistics:riskReward.compareInsightGood', {
          defaultValue:
            'R:R réel moyen ({{actual}}) ≥ prévu ({{planned}}) — vous capturez au moins ce que le plan vise.',
          planned: formatRr(avgPlannedRr, formatNumber),
          actual: formatRr(avgActualRr, formatNumber),
        })
      : insightTone === 'warn'
        ? t('statistics:riskReward.compareInsightWarn', {
            defaultValue:
              'R:R réel moyen ({{actual}}) sous le prévu ({{planned}}) — sorties souvent avant l’objectif planifié.',
            planned: formatRr(avgPlannedRr, formatNumber),
            actual: formatRr(avgActualRr, formatNumber),
          })
        : t('statistics:riskReward.compareInsightMid', {
            defaultValue:
              'Données partielles : prévu {{planned}} · réel {{actual}}. Complétez SL/TP pour comparer finement.',
            planned: formatRr(avgPlannedRr, formatNumber),
            actual: formatRr(avgActualRr, formatNumber),
          });

  const rows = [
    {
      key: 'planned',
      label: t('statistics:riskReward.averagePlannedRR', { defaultValue: 'R:R moyen prévu' }),
      value: formatRr(avgPlannedRr, formatNumber),
      pct: plannedPct,
      barClass: 'bg-blue-500 dark:bg-blue-400',
      tooltip: t('statistics:riskReward.averagePlannedRRTooltip', {
        defaultValue: "Ratio Risk/Reward moyen prévu à l'entrée des trades",
      }),
    },
    {
      key: 'actual',
      label: t('statistics:riskReward.averageActualRR', { defaultValue: 'R:R moyen réel' }),
      value: formatRr(avgActualRr, formatNumber),
      pct: actualPct,
      barClass: 'bg-cyan-500 dark:bg-cyan-400',
      tooltip: t('statistics:riskReward.averageActualRRTooltip', {
        defaultValue:
          'Ratio Risk/Reward moyen réel sur les trades gagnants hors break-even (PnL = 0 ou BE déclaré sans TP)',
      }),
    },
  ];

  const kpis = [
    {
      key: 'plannedCount',
      label: t('statistics:riskReward.tradesWithPlannedRR', { defaultValue: 'Trades avec R:R prévu' }),
      value: `${formatNumber(tradesWithPlannedRr, 0)} / ${formatNumber(totalTrades, 0)}`,
      tooltip: t('statistics:riskReward.tradesWithPlannedRRTooltip', {
        defaultValue: 'Nombre de trades ayant un R:R prévu défini',
      }),
      valueClass: rrToneClass(avgPlannedRr),
    },
    {
      key: 'actualCount',
      label: t('statistics:riskReward.tradesWithActualRR', { defaultValue: 'Trades avec R:R réel' }),
      value: `${formatNumber(tradesWithActualRr, 0)} / ${formatNumber(totalTrades, 0)}`,
      tooltip: t('statistics:riskReward.tradesWithActualRRTooltip', {
        defaultValue: 'Nombre de trades ayant un R:R réel calculé',
      }),
      valueClass: rrToneClass(avgActualRr),
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
      <div className="space-y-2.5">
        {rows.map((row) => (
          <div key={row.key}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="inline-flex min-w-0 items-center gap-1">
                <span className="truncate text-xs text-gray-500 dark:text-gray-400">{row.label}</span>
                <Tooltip
                  content={row.tooltip}
                  position="bottom"
                  className="shrink-0 items-center leading-none"
                  contentClassName="whitespace-pre-line block"
                >
                  {HELP_ICON}
                </Tooltip>
              </div>
              <span className={`shrink-0 text-sm font-semibold tabular-nums ${rrToneClass(row.key === 'planned' ? avgPlannedRr : avgActualRr)}`}>
                {row.value}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700/60">
              <div
                className={`h-full rounded-full ${row.barClass}`}
                style={{ width: `${row.pct}%` }}
                title={`${row.label}: ${row.value}`}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {kpis.map((kpi) => (
          <div key={kpi.key} className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700/40">
            <div className="flex items-center gap-1">
              <span className="min-w-0 truncate text-xs text-gray-500 dark:text-gray-400">{kpi.label}</span>
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

      <p className={insightClass}>{insightText}</p>
    </div>
  );
};
