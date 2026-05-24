import React from 'react';
import { useTranslation } from 'react-i18next';
import Tooltip from '../ui/Tooltip';

interface TradeOutcomeStripProps {
  totalTrades: number;
  totalVolumeLabel: string;
  winningTrades: number;
  losingTrades: number;
  breakEvenPositiveTrades: number;
  breakEvenZeroTrades?: number;
}

export const TradeOutcomeStrip: React.FC<TradeOutcomeStripProps> = ({
  totalTrades,
  totalVolumeLabel,
  winningTrades,
  losingTrades,
  breakEvenPositiveTrades,
  breakEvenZeroTrades = 0,
}) => {
  const { t } = useTranslation();

  const outcomes = [
    {
      key: 'winners',
      label: t('statistics:tradesAnalysis.winningTrades', { defaultValue: 'Gagnants' }),
      value: winningTrades,
      barClass: 'bg-blue-500 dark:bg-blue-400',
      valueClass: 'text-blue-500 dark:text-blue-400',
    },
    {
      key: 'losers',
      label: t('statistics:tradesAnalysis.losingTrades', { defaultValue: 'Perdants' }),
      value: losingTrades,
      barClass: 'bg-pink-500 dark:bg-pink-400',
      valueClass: 'text-pink-500 dark:text-pink-400',
    },
    {
      key: 'be',
      label: t('statistics:tradesAnalysis.breakEven', { defaultValue: 'Breakeven' }),
      value: breakEvenPositiveTrades,
      barClass: 'bg-gray-400 dark:bg-gray-500',
      valueClass: 'text-gray-600 dark:text-gray-300',
      tooltip:
        t('statistics:tradesAnalysis.breakEvenInlineExplanation', {
          defaultValue:
            'Les BE à PnL > 0 restent comptés dans les gagnants. Seuls les BE stricts (PnL = 0) sont exclus du total.',
        }) + ` | = 0 : ${breakEvenZeroTrades}`,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700/40 sm:text-center">
          <span className="block text-xs text-gray-500 dark:text-gray-400">
            {t('statistics:overview.totalTrades')}
          </span>
          <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100 sm:text-base">
            {totalTrades}
          </span>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700/40 sm:text-center">
          <span className="block text-xs text-gray-500 dark:text-gray-400">
            {t('statistics:overview.totalVolume')}
          </span>
          <span className="text-sm font-semibold tabular-nums text-blue-500 dark:text-blue-400 sm:text-base">
            {totalVolumeLabel}
          </span>
        </div>
      </div>

      <div className="space-y-2 sm:grid sm:grid-cols-3 sm:gap-3 sm:space-y-0">
        {outcomes.map((item) => (
          <div
            key={item.key}
            className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700/40 sm:flex-col sm:items-center sm:px-2 sm:py-3"
          >
            <div className={`hidden h-8 w-1 shrink-0 rounded-full sm:block ${item.barClass}`} />
            <div className={`h-full w-1 shrink-0 rounded-full sm:hidden ${item.barClass}`} />
            <div className="min-w-0 flex-1 sm:flex sm:flex-col sm:items-center">
              <div className="inline-flex items-center gap-1">
                <span className="text-xs text-gray-500 dark:text-gray-400 sm:text-sm">{item.label}</span>
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
              <span className={`text-sm font-semibold tabular-nums sm:text-base ${item.valueClass}`}>
                {item.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
