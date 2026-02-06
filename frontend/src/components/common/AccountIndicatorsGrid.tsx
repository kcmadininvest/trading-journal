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

  // Barre de progression pour le Consistency Target
  const progressPercentage = consistencyTarget
    ? Math.min((consistencyTarget.bestDayPercentage / consistencyTarget.targetPercentage) * 100, 100)
    : 0;

  return (
    <div className={`${className}`}>
      {/* Grille responsive : toutes les cartes sur une ligne en grand écran */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${consistencyTarget ? 'xl:grid-cols-4' : 'xl:grid-cols-3'} gap-3`}>
        {/* Solde initial et actuel regroupés */}
        <div className="relative flex flex-col xl:flex-row xl:items-stretch gap-3 xl:gap-0 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-colors duration-150">
          {onNavigateToTransactions && (
            <Tooltip content={t('dashboard:viewTransactions', { defaultValue: 'Voir les transactions' })} position="bottom" className="absolute top-2 right-2 z-10">
              <button
                onClick={onNavigateToTransactions}
                className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </Tooltip>
          )}
          <div className="flex flex-col gap-1 flex-1">
            <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              {t('dashboard:initialBalance', { defaultValue: 'Solde initial' })}
            </span>
            <span className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {hideInitialBalance 
                ? maskValue(accountBalance.initial, currencySymbol)
                : formatCurrency(accountBalance.initial, currencySymbol, preferences.number_format, 2)
              }
            </span>
          </div>
          <div className="hidden xl:block w-px bg-gray-200 dark:bg-gray-600 mx-4 my-1 self-stretch"></div>
          <div className="flex flex-col gap-1 flex-1">
            <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
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

        {/* Variation et Total Trades regroupés */}
        <div className="flex flex-col xl:flex-row xl:items-stretch gap-3 xl:gap-0 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-colors duration-150">
          {accountBalance.initial > 0 && (
            <div className="flex flex-col gap-1 flex-1">
              <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {variationValue >= 0 
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  }
                </svg>
                {t('dashboard:variation', { defaultValue: 'Variation' })}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xl font-semibold ${
                  variationValue >= 0 
                    ? 'text-blue-600 dark:text-blue-400' 
                    : 'text-pink-600 dark:text-pink-400'
                }`}>
                  {hideProfitLoss 
                    ? maskValue(variationValue, currencySymbol)
                    : formatCurrency(variationValue, currencySymbol, preferences.number_format, 2)
                  }
                </span>
                {!hideProfitLoss && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    variationValue >= 0
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                      : 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300'
                  }`}>
                    {variationValue >= 0 ? '+' : ''}{formatNumber(variationPercentage, 2, preferences.number_format)}%
                  </span>
                )}
              </div>
            </div>
          )}
          {totalTrades > 0 && accountBalance.initial > 0 && (
            <div className="hidden xl:block w-px bg-gray-200 dark:bg-gray-600 mx-4 my-1 self-stretch"></div>
          )}
          {totalTrades > 0 && (
            <div className="flex flex-col gap-1 flex-1">
              <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
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
          <div className="flex flex-col xl:flex-row xl:items-stretch xl:gap-0 gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-colors duration-150">
            {bestAndWorstDays.bestDay && (
              <div className="flex flex-col gap-1 flex-1">
                <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-blue-600 dark:text-blue-300">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  {t('dashboard:bestDay', { defaultValue: 'Meilleur jour' })}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xl font-semibold text-blue-600 dark:text-blue-400">
                    {formatCurrency(bestAndWorstDays.bestDay.pnl, currencySymbol, preferences.number_format, 2)}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    {formatDate(bestAndWorstDays.bestDay.date, preferences.date_format, false, preferences.timezone)}
                  </span>
                </div>
              </div>
            )}
            {bestAndWorstDays.bestDay && bestAndWorstDays.worstDay && (
              <div className="hidden xl:block w-px bg-gray-200 dark:bg-gray-600 mx-4 my-1 self-stretch"></div>
            )}
            {bestAndWorstDays.worstDay && (
              <div className="flex flex-col gap-1 flex-1">
                <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-pink-600 dark:text-pink-300">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {t('dashboard:worstDay', { defaultValue: 'Pire jour' })}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xl font-semibold text-pink-600 dark:text-pink-400">
                    {formatCurrency(bestAndWorstDays.worstDay.pnl, currencySymbol, preferences.number_format, 2)}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300">
                    {formatDate(bestAndWorstDays.worstDay.date, preferences.date_format, false, preferences.timezone)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Consistency Target (si applicable) */}
        {consistencyTarget && (
          <div className={`flex flex-col gap-2 p-4 rounded-lg border transition-colors duration-150 ${
            consistencyTarget.isCompliant
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30'
              : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/30'
          }`}>
            <span className={`flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider ${
              consistencyTarget.isCompliant
                ? 'text-green-700 dark:text-green-300'
                : 'text-orange-700 dark:text-orange-300'
            }`}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="10" strokeWidth={2} />
                <circle cx="12" cy="12" r="6" strokeWidth={2} />
                <circle cx="12" cy="12" r="2" strokeWidth={2} />
              </svg>
              {t('dashboard:consistencyTarget', { defaultValue: 'Consistency Target' })}
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-lg font-semibold ${
                consistencyTarget.isCompliant
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-orange-600 dark:text-orange-400'
              }`}>
                {formatNumber(consistencyTarget.bestDayPercentage, 2, preferences.number_format)}% / {formatNumber(consistencyTarget.targetPercentage, 2, preferences.number_format)}%
              </span>
              {/* Mini barre de progression inline */}
              <div className="flex-1 min-w-[60px] bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    consistencyTarget.isCompliant
                      ? 'bg-green-500 dark:bg-green-400'
                      : 'bg-orange-500 dark:bg-orange-400'
                  }`}
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            </div>
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
                <div className="text-xs text-orange-600 dark:text-orange-400">
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

