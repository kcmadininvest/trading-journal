import React from 'react';
import { formatCurrency, formatNumber } from '../../utils/numberFormat';
import { formatDate } from '../../utils/dateFormat';
import { usePreferences } from '../../hooks/usePreferences';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { AccountIndicators } from '../../hooks/useAccountIndicators';
import { Tooltip } from '../ui';
import { maskValue } from '../../hooks/usePrivacySettings';

interface AccountIndicatorsGridProps {
  indicators: AccountIndicators;
  currencySymbol?: string;
  className?: string;
  onNavigateToTransactions?: () => void;
  hideInitialBalance?: boolean;
  hideCurrentBalance?: boolean;
  hideProfitLoss?: boolean;
}

export const AccountIndicatorsGrid: React.FC<AccountIndicatorsGridProps> = ({
  indicators,
  currencySymbol = '',
  className = '',
  onNavigateToTransactions,
  hideInitialBalance = false,
  hideCurrentBalance = false,
  hideProfitLoss = false,
}) => {
  const { preferences } = usePreferences();
  const { t } = useI18nTranslation();
  const { accountBalance, totalTrades, bestAndWorstDays, consistencyTarget } = indicators;

  const variationValue = accountBalance.current - accountBalance.initial;
  const variationPercentage = accountBalance.initial > 0 
    ? ((variationValue / accountBalance.initial) * 100) 
    : 0;

  return (
    <div className={`${className}`}>
      {/* Grille responsive : toutes les cartes sur une ligne en grand écran */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${consistencyTarget ? 'xl:grid-cols-4' : 'xl:grid-cols-3'} gap-4`}>
        {/* Solde initial et actuel regroupés */}
        <div className="relative flex flex-col gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
          {onNavigateToTransactions && (
            <Tooltip content={t('dashboard:viewTransactions', { defaultValue: 'Voir les transactions' })} position="bottom" className="absolute top-2 right-2">
              <button
                onClick={onNavigateToTransactions}
                className="p-2.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </Tooltip>
          )}
          <div className="flex flex-col xl:flex-row xl:gap-4 gap-3">
            <div className="flex flex-col gap-1 flex-1">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('dashboard:initialBalance', { defaultValue: 'Solde initial' })}
              </span>
              <span className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {hideInitialBalance 
                  ? maskValue(accountBalance.initial, currencySymbol)
                  : formatCurrency(accountBalance.initial, currencySymbol, preferences.number_format, 2)
                }
              </span>
            </div>
            <div className="flex flex-col gap-1 flex-1 xl:border-l xl:border-gray-300 xl:dark:border-gray-600 xl:pl-4">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('dashboard:currentBalance', { defaultValue: 'Solde actuel' })}
              </span>
              <span className={`text-xl font-semibold ${
                accountBalance.current >= accountBalance.initial 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-pink-600 dark:text-pink-400'
              }`}>
                {hideCurrentBalance 
                  ? maskValue(accountBalance.current, currencySymbol)
                  : formatCurrency(accountBalance.current, currencySymbol, preferences.number_format, 2)
                }
              </span>
            </div>
          </div>
        </div>

        {/* Variation et Total Trades regroupés */}
        <div className="flex flex-col xl:flex-row xl:gap-4 gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
          {accountBalance.initial > 0 && (
            <div className="flex flex-col gap-1 flex-1">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('dashboard:variation', { defaultValue: 'Variation' })}
              </span>
              <span className={`text-xl font-semibold ${
                variationValue >= 0 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-pink-600 dark:text-pink-400'
              }`}>
                {hideProfitLoss 
                  ? maskValue(variationValue, currencySymbol)
                  : formatCurrency(variationValue, currencySymbol, preferences.number_format, 2)
                }
                {!hideProfitLoss && (
                  <>
                    {' '}
                    <span className="text-base">
                      ({formatNumber(variationPercentage, 2, preferences.number_format)}%)
                    </span>
                  </>
                )}
              </span>
            </div>
          )}
          {totalTrades > 0 && (
            <div className={`flex flex-col gap-1 flex-1 ${accountBalance.initial > 0 ? 'xl:border-l xl:border-gray-300 xl:dark:border-gray-600 xl:pl-4' : ''}`}>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('dashboard:totalTrades', { defaultValue: 'Total Trades' })}
              </span>
              <span className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {totalTrades}
              </span>
            </div>
          )}
        </div>

        {/* Meilleur jour et Pire jour regroupés */}
        {(bestAndWorstDays.bestDay || bestAndWorstDays.worstDay) && (
          <div className="flex flex-col xl:flex-row xl:gap-4 gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            {bestAndWorstDays.bestDay && (
              <div className="flex flex-col gap-1 flex-1">
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  {t('dashboard:bestDay', { defaultValue: 'Meilleur jour' })}
                </span>
                <span className="text-xl font-semibold text-blue-600 dark:text-blue-400">
                  {formatCurrency(bestAndWorstDays.bestDay.pnl, currencySymbol, preferences.number_format, 2)}
                </span>
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  {formatDate(bestAndWorstDays.bestDay.date, preferences.date_format, false, preferences.timezone)}
                </span>
              </div>
            )}
            {bestAndWorstDays.worstDay && (
              <div className={`flex flex-col gap-1 flex-1 ${bestAndWorstDays.bestDay ? 'xl:border-l xl:border-gray-300 xl:dark:border-gray-600 xl:pl-4' : ''}`}>
                <span className="text-sm font-medium text-pink-700 dark:text-pink-300">
                  {t('dashboard:worstDay', { defaultValue: 'Pire jour' })}
                </span>
                <span className="text-xl font-semibold text-pink-600 dark:text-pink-400">
                  {formatCurrency(bestAndWorstDays.worstDay.pnl, currencySymbol, preferences.number_format, 2)}
                </span>
                <span className="text-xs text-pink-600 dark:text-pink-400">
                  {formatDate(bestAndWorstDays.worstDay.date, preferences.date_format, false, preferences.timezone)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Consistency Target (si applicable) */}
        {consistencyTarget && (
          <div className={`flex flex-col gap-2 p-4 rounded-lg border ${
            consistencyTarget.isCompliant
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
          }`}>
            <span className={`text-sm font-medium ${
              consistencyTarget.isCompliant
                ? 'text-green-700 dark:text-green-300'
                : 'text-orange-700 dark:text-orange-300'
            }`}>
              {t('dashboard:consistencyTarget', { defaultValue: 'Consistency Target' })}
            </span>
            <span className={`text-lg font-semibold ${
              consistencyTarget.isCompliant
                ? 'text-green-600 dark:text-green-400'
                : 'text-orange-600 dark:text-orange-400'
            }`}>
              {formatNumber(consistencyTarget.bestDayPercentage, 2, preferences.number_format)}% / {formatNumber(consistencyTarget.targetPercentage, 2, preferences.number_format)}%
            </span>
            {!consistencyTarget.isCompliant && 
             typeof consistencyTarget.additionalProfitNeeded === 'number' &&
             consistencyTarget.additionalProfitNeeded > 0 && (() => {
              const formattedAmount = formatCurrency(consistencyTarget.additionalProfitNeeded, currencySymbol, preferences.number_format, 2);
              // Ne pas afficher si le montant formaté est invalide, vide ou contient des caractères non désirés
              if (!formattedAmount || 
                  formattedAmount === '-' || 
                  formattedAmount.trim() === '' || 
                  formattedAmount.includes('{amount}') ||
                  formattedAmount.includes('NaN') ||
                  formattedAmount.includes('undefined')) {
                return null;
              }
              // Construire le texte avec interpolation
              const label = t('dashboard:additionalProfitNeeded', { 
                defaultValue: 'Profit supplémentaire requis: {amount}',
                amount: formattedAmount
              });
              // Si l'interpolation n'a pas fonctionné (le placeholder est encore présent), ne pas afficher
              if (label.includes('{amount}')) {
                return null;
              }
              return (
                <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                  {label}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

