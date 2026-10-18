import React from 'react';
import { useTranslation } from 'react-i18next';
import Tooltip from '../ui/Tooltip';
import { computeTradeOutcomePartition } from '../../utils/tradeOutcomePartition';

interface TradeOutcomeStripProps {
  totalTrades: number;
  totalVolumeLabel: string;
  winningTrades: number;
  losingTrades: number;
  breakEvenTrades: number;
  breakEvenPositiveTrades: number;
  formatNumber: (value: number, digits?: number) => string;
}

export const TradeOutcomeStrip: React.FC<TradeOutcomeStripProps> = ({
  totalTrades,
  totalVolumeLabel,
  winningTrades,
  losingTrades,
  breakEvenTrades,
  breakEvenPositiveTrades,
  formatNumber,
}) => {
  const { t } = useTranslation();

  const partition = computeTradeOutcomePartition({
    totalTrades,
    winningTrades,
    losingTrades,
    breakEvenTrades,
    breakEvenPositiveTrades,
  });

  const segments = [
    {
      key: 'winners',
      label: t('statistics:tradesAnalysis.winningTrades', { defaultValue: 'Gagnants' }),
      count: partition.winners,
      pct: partition.winnersPct,
      barClass: 'bg-blue-500 dark:bg-blue-400',
      valueClass: 'text-blue-500 dark:text-blue-400',
      swatchClass: 'bg-blue-500 dark:bg-blue-400',
      tooltip: t('statistics:overview.netWinnersTooltip', {
        defaultValue:
          'Trades à PnL positif avec au moins un Take Profit atteint. Les gains sans TP (BE soft) sont comptés à part dans Break-even.',
      }),
    },
    {
      key: 'losers',
      label: t('statistics:tradesAnalysis.losingTrades', { defaultValue: 'Perdants' }),
      count: partition.losers,
      pct: partition.losersPct,
      barClass: 'bg-pink-500 dark:bg-pink-400',
      valueClass: 'text-pink-500 dark:text-pink-400',
      swatchClass: 'bg-pink-500 dark:bg-pink-400',
    },
    {
      key: 'be',
      label: t('statistics:tradesAnalysis.breakEven', { defaultValue: 'Breakeven' }),
      count: partition.breakEven,
      pct: partition.breakEvenPct,
      barClass: 'bg-gray-400 dark:bg-gray-500',
      valueClass: 'text-gray-600 dark:text-gray-300',
      swatchClass: 'bg-gray-400 dark:bg-gray-500',
      tooltip: t('statistics:tradesAnalysis.breakEvenInlineExplanation', {
        defaultValue:
          'Trades à PnL = 0, ou trades positifs notés comme break-even dans votre journal (aucun TP atteint).',
      }),
    },
  ];

  if (partition.isEmpty) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t('statistics:overview.outcomeCompositionEmpty', {
          defaultValue: 'Aucun trade sur cette période.',
        })}
      </p>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700/40 sm:text-center">
          <span className="block text-xs text-gray-500 dark:text-gray-400">
            {t('statistics:overview.totalTrades')}
          </span>
          <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100 sm:text-base">
            {formatNumber(totalTrades, 0)}
          </span>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700/40 sm:text-center">
          <div className="flex items-center gap-1 sm:justify-center">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('statistics:overview.totalVolume')}
            </span>
            <Tooltip
              content={t('statistics:overview.totalVolumeTooltip', {
                defaultValue:
                  'Somme des tailles (size) de tous les trades de la période filtrée. Mesure le volume d’exposition cumulé, pas un montant monétaire.',
              })}
              position="bottom"
              className="items-center leading-none"
              contentClassName="whitespace-pre-line block"
            >
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
            </Tooltip>
          </div>
          <span className="text-sm font-semibold tabular-nums text-blue-500 dark:text-blue-400 sm:text-base">
            {totalVolumeLabel}
          </span>
        </div>
      </div>

      <div
        className="flex h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700/60"
        role="img"
        aria-label={t('statistics:overview.outcomeCompositionAria', {
          defaultValue: 'Répartition des trades : {{winners}}% gagnants, {{losers}}% perdants, {{breakEven}}% breakeven',
          winners: formatNumber(partition.winnersPct, 1),
          losers: formatNumber(partition.losersPct, 1),
          breakEven: formatNumber(partition.breakEvenPct, 1),
        })}
      >
        {segments.map((segment) =>
          segment.pct > 0 ? (
            <div
              key={segment.key}
              className={`h-full min-w-0 ${segment.barClass}`}
              style={{ width: `${segment.pct}%` }}
              title={`${segment.label}: ${segment.count} (${formatNumber(segment.pct, 1)}%)`}
            />
          ) : null,
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
        {segments.map((item) => (
          <div
            key={item.key}
            className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700/40 sm:flex-col sm:items-center sm:px-2 sm:py-2.5"
          >
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.swatchClass}`} aria-hidden />
            <div className="min-w-0 flex-1 sm:flex sm:flex-col sm:items-center">
              <div className="inline-flex items-center gap-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">{item.label}</span>
                {item.tooltip && (
                  <Tooltip
                    content={item.tooltip}
                    position="bottom"
                    className="items-center leading-none"
                    contentClassName="whitespace-pre-line block"
                  >
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
                  </Tooltip>
                )}
              </div>
              <div className="flex items-baseline gap-1.5 sm:justify-center">
                <span className={`text-sm font-semibold tabular-nums ${item.valueClass}`}>
                  {formatNumber(item.count, 0)}
                </span>
                <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                  {formatNumber(item.pct, 1)}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {partition.softBeCount > 0 && (
        <p className="mt-auto rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-100/90">
          {t('statistics:overview.softBeInsight', {
            defaultValue:
              '{{activityPct}}% de l’activité en BE soft ({{softBeCount}} trades positifs sans TP) — soit {{positivePct}}% de vos trades positifs.',
            activityPct: formatNumber(partition.softBeShareOfActivityPct, 1),
            positivePct: formatNumber(partition.softBeShareOfPositivePct, 1),
            softBeCount: formatNumber(partition.softBeCount, 0),
          })}
        </p>
      )}
    </div>
  );
};
