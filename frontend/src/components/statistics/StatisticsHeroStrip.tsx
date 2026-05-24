import React from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { maskValue } from '../../hooks/usePrivacySettings';
import type { StatisticsData } from '../../hooks/useStatistics';

interface StatisticsHeroStripProps {
  statisticsData: StatisticsData;
  currencySymbol: string;
  formatCurrency: (value: number, currencySymbol?: string) => string;
  formatNumber: (value: number, digits?: number) => string;
  hideMoney?: boolean;
}

function getPnLCardClasses(pnl: number): string {
  if (pnl > 0) {
    return 'border-blue-200 bg-blue-50/80 dark:border-blue-800 dark:bg-blue-900/20';
  }
  if (pnl < 0) {
    return 'border-pink-200 bg-pink-50/80 dark:border-pink-800 dark:bg-pink-900/20';
  }
  return 'border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700/40';
}

function getPnLTextClasses(pnl: number): string {
  if (pnl > 0) return 'text-blue-600 dark:text-blue-400';
  if (pnl < 0) return 'text-pink-600 dark:text-pink-400';
  return 'text-gray-700 dark:text-gray-300';
}

export const StatisticsHeroStrip: React.FC<StatisticsHeroStripProps> = ({
  statisticsData,
  currencySymbol,
  formatCurrency,
  formatNumber,
  hideMoney = false,
}) => {
  const { t } = useTranslation();
  const totalPnl = parseFloat(statisticsData.total_pnl);

  const items = [
    {
      key: 'pnl',
      label: t('statistics:overview.totalPnL'),
      value: hideMoney ? maskValue(null, currencySymbol) : formatCurrency(totalPnl, currencySymbol),
      valueClass: hideMoney ? 'text-gray-700 dark:text-gray-300' : getPnLTextClasses(totalPnl),
      cardClass: hideMoney
        ? 'border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700/40'
        : getPnLCardClasses(totalPnl),
    },
    {
      key: 'winRate',
      label: t('statistics:overview.winRate'),
      value: `${formatNumber(statisticsData.win_rate, 2)}%`,
      valueClass: 'text-gray-900 dark:text-gray-100',
      cardClass: 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800',
    },
    {
      key: 'drawdown',
      label: t('statistics:performanceRatios.maxDrawdown', { defaultValue: 'Max Drawdown' }),
      value: `${formatNumber(statisticsData.max_drawdown_global_pct, 2)}%`,
      subValue: hideMoney
        ? maskValue(null, currencySymbol)
        : formatCurrency(statisticsData.max_drawdown_global, currencySymbol),
      valueClass: 'text-pink-600 dark:text-pink-400',
      cardClass: 'border-pink-200 bg-pink-50/50 dark:border-pink-900/50 dark:bg-pink-900/10',
    },
  ];

  return (
    <div className="mb-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-3 sm:mb-6 sm:gap-4">
      {items.map((item) => (
        <div key={item.key} className={clsx('rounded-lg border px-4 py-3 shadow-sm', item.cardClass)}>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 sm:text-sm">{item.label}</p>
          <p className={clsx('mt-1 text-lg font-bold tabular-nums sm:text-xl', item.valueClass)}>
            {item.value}
          </p>
          {'subValue' in item && item.subValue && (
            <p className="mt-0.5 text-xs tabular-nums text-gray-500 dark:text-gray-400">{item.subValue}</p>
          )}
        </div>
      ))}
    </div>
  );
};
