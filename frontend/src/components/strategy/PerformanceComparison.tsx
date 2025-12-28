import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../utils/formatCurrency';
import { StrategyComplianceStats } from '../../services/tradeStrategies';
import { maskValue } from '../../hooks/usePrivacySettings';

interface PerformanceComparisonProps {
  performanceComparison: StrategyComplianceStats['performance_comparison'];
  currencySymbol: string;
  hideProfitLoss: boolean;
}

export const PerformanceComparison: React.FC<PerformanceComparisonProps> = ({
  performanceComparison,
  currencySymbol,
  hideProfitLoss,
}) => {
  const { t } = useTranslation();

  const { respected, not_respected } = performanceComparison;

  const winRateDiff = respected.win_rate - not_respected.win_rate;
  const avgPnlDiff = parseFloat(respected.avg_pnl) - parseFloat(not_respected.avg_pnl);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow p-6 h-full flex flex-col">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        {t('strategy:performance.title', { defaultValue: 'Impact du Respect de la Stratégie' })}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        {t('strategy:performance.subtitle', { defaultValue: 'Comparaison des performances selon le respect de la stratégie' })}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Stratégie respectée */}
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <h4 className="font-semibold text-green-900 dark:text-green-100">
              {t('strategy:performance.respected', { defaultValue: 'Stratégie Respectée' })}
            </h4>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t('strategy:performance.trades', { defaultValue: 'Trades' })}
              </span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">{respected.count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t('strategy:performance.winRate', { defaultValue: 'Win Rate' })}
              </span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                {respected.win_rate.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t('strategy:performance.avgPnl', { defaultValue: 'PnL Moyen' })}
              </span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                {formatCurrency(parseFloat(respected.avg_pnl), currencySymbol)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t('strategy:performance.totalPnl', { defaultValue: 'PnL Total' })}
              </span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                {hideProfitLoss 
                  ? maskValue(parseFloat(respected.total_pnl), currencySymbol)
                  : formatCurrency(parseFloat(respected.total_pnl), currencySymbol)
                }
              </span>
            </div>
          </div>
        </div>

        {/* Stratégie non respectée */}
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <h4 className="font-semibold text-red-900 dark:text-red-100">
              {t('strategy:performance.notRespected', { defaultValue: 'Stratégie Non Respectée' })}
            </h4>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t('strategy:performance.trades', { defaultValue: 'Trades' })}
              </span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">{not_respected.count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t('strategy:performance.winRate', { defaultValue: 'Win Rate' })}
              </span>
              <span className="font-semibold text-red-600 dark:text-red-400">
                {not_respected.win_rate.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t('strategy:performance.avgPnl', { defaultValue: 'PnL Moyen' })}
              </span>
              <span className="font-semibold text-red-600 dark:text-red-400">
                {formatCurrency(parseFloat(not_respected.avg_pnl), currencySymbol)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t('strategy:performance.totalPnl', { defaultValue: 'PnL Total' })}
              </span>
              <span className="font-semibold text-red-600 dark:text-red-400">
                {hideProfitLoss 
                  ? maskValue(parseFloat(not_respected.total_pnl), currencySymbol)
                  : formatCurrency(parseFloat(not_respected.total_pnl), currencySymbol)
                }
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Message motivationnel */}
      {winRateDiff > 0 && (
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                {t('strategy:performance.insight', { 
                  diff: winRateDiff.toFixed(1),
                  pnlDiff: formatCurrency(avgPnlDiff, currencySymbol)
                })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

