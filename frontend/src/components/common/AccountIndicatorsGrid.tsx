import React, { useMemo } from 'react';
import { formatCurrency, formatNumber } from '../../utils/numberFormat';
import { formatDate } from '../../utils/dateFormat';
import { usePreferences } from '../../hooks/usePreferences';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { AccountIndicators } from '../../hooks/useAccountIndicators';
import { maskValue } from '../../hooks/usePrivacySettings';
import {
  DASHBOARD_INNER_TILE_CLASS,
  DASHBOARD_PNL_NEGATIVE_TEXT_CLASS,
  DASHBOARD_PNL_POSITIVE_TEXT_CLASS,
  DASHBOARD_TILE_DIVIDER_CLASS,
} from '../dashboard/tickerShell';
import Tooltip from '../ui/Tooltip';
import type { GlobalAllAccountsActivity } from './AccountSummaryCard';

interface IndicatorMetricLabelProps {
  icon: React.ReactNode;
  label: string;
  labelClassName: string;
  tooltip?: string;
  isBand?: boolean;
}

const IndicatorMetricLabel: React.FC<IndicatorMetricLabelProps> = ({
  icon,
  label,
  labelClassName,
  tooltip,
  isBand = false,
}) => (
  <span className={`flex min-w-0 flex-wrap items-center gap-1.5 text-xs font-medium uppercase tracking-wider ${labelClassName}`}>
    {icon}
    <span className="truncate">{label}</span>
    {tooltip ? (
      <Tooltip
        content={tooltip}
        position="bottom"
        className="shrink-0 items-center leading-none"
        contentClassName="whitespace-pre-line block max-w-xs"
      >
        <svg
          className={`block h-3.5 w-3.5 shrink-0 cursor-help ${isBand ? 'text-white/40' : 'text-gray-400 dark:text-gray-500'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      </Tooltip>
    ) : null}
  </span>
);

interface AccountIndicatorsGridProps {
  indicators: AccountIndicators;
  currencySymbol?: string;
  className?: string;
  onNavigateToTransactions?: () => void;
  hideInitialBalance?: boolean;
  hideCurrentBalance?: boolean;
  hideProfitLoss?: boolean;
  hideConsistencyTarget?: boolean;
  globalAllAccountsActivity?: GlobalAllAccountsActivity | null;
  theme?: 'default' | 'band';
  balanceLoading?: boolean;
  peakLoading?: boolean;
  detailsLoading?: boolean;
  valueSkeletonClass?: string;
}

export const AccountIndicatorsGrid: React.FC<AccountIndicatorsGridProps> = ({
  indicators,
  currencySymbol = '',
  className = '',
  onNavigateToTransactions,
  hideInitialBalance = false,
  hideCurrentBalance = false,
  hideProfitLoss = false,
  hideConsistencyTarget = false,
  globalAllAccountsActivity = null,
  theme = 'default',
  balanceLoading = false,
  peakLoading = false,
  detailsLoading = false,
  valueSkeletonClass = 'h-7 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700',
}) => {
  const { preferences } = usePreferences();
  const { t } = useI18nTranslation();
  const isBand = theme === 'band';
  const tileClass = isBand
    ? DASHBOARD_INNER_TILE_CLASS
    : 'flex h-full min-w-0 w-full flex-col gap-3 xl:flex-row xl:items-stretch xl:gap-0 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-colors duration-150';
  const dividerClass = isBand
    ? DASHBOARD_TILE_DIVIDER_CLASS
    : 'hidden xl:block w-px bg-gray-200 dark:bg-gray-600 mx-4 my-1 self-stretch';
  const labelMuted = isBand
    ? 'text-white/50'
    : 'text-gray-500 dark:text-gray-400';
  const valuePrimary = isBand ? 'text-white/90' : 'text-gray-900 dark:text-gray-100';
  const valueUp = isBand ? DASHBOARD_PNL_POSITIVE_TEXT_CLASS : 'text-blue-600 dark:text-blue-400';
  const valueDown = isBand ? DASHBOARD_PNL_NEGATIVE_TEXT_CLASS : 'text-pink-600 dark:text-pink-400';
  const badgeUp = isBand
    ? 'bg-blue-500/15 text-blue-300'
    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
  const badgeDown = isBand
    ? 'bg-pink-500/15 text-pink-300'
    : 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300';
  const badgeNeutral = isBand
    ? 'bg-white/10 text-white/60'
    : 'bg-gray-200/70 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  const cumulBorder = isBand ? 'border-white/15' : 'border-gray-200 dark:border-gray-600';
  const { accountBalance, totalTrades, bestAndWorstDays, consistencyTarget, activeDays, accountCreatedAt } = indicators;

  const hasActiveDays = useMemo(() => typeof activeDays === 'number' && activeDays >= 0, [activeDays]);
  const showTradesSection = useMemo(() => totalTrades > 0 || hasActiveDays, [totalTrades, hasActiveDays]);
  const formattedAccountCreatedDate = useMemo(() => {
    if (!accountCreatedAt) return '';
    return formatDate(accountCreatedAt, preferences.date_format, false, preferences.timezone);
  }, [accountCreatedAt, preferences.date_format, preferences.timezone]);
  const visibleConsistencyTarget = consistencyTarget && !hideConsistencyTarget;

  const currentBalanceTooltip = t('dashboard:currentBalanceTooltip', {
    defaultValue:
      'Solde de trésorerie réel du compte (capital initial + PnL cumulé + dépôts − retraits). Il n’est pas filtré par la période sélectionnée.',
  });
  const highestBalanceTooltip = t('dashboard:highestBalanceReachedTooltip', {
    defaultValue:
      'Pic de solde sur tout l’historique du compte (trades et transactions). Il n’est pas filtré par la période sélectionnée.',
  });

  // Barre de progression pour le Consistency Target
  const progressPercentage = consistencyTarget
    ? Math.min((consistencyTarget.bestDayPercentage / consistencyTarget.targetPercentage) * 100, 100)
    : 0;

  return (
    <div className={`${className}`}>
      {/* Grille responsive : toutes les cartes sur une ligne en grand écran */}
      <div
        className={`grid w-full min-w-0 grid-cols-1 md:grid-cols-2 ${visibleConsistencyTarget ? 'xl:grid-cols-4' : 'xl:grid-cols-3'} gap-3`}
      >
        {/* Solde initial et actuel regroupés */}
        <div className={tileClass}>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <IndicatorMetricLabel
              labelClassName={labelMuted}
              isBand={isBand}
              label={t('dashboard:initialBalance', { defaultValue: 'Solde initial' })}
              icon={(
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              )}
            />
            <span className={`text-xl font-semibold ${valuePrimary}`}>
              {hideInitialBalance 
                ? maskValue(accountBalance.initial, currencySymbol)
                : formatCurrency(accountBalance.initial, currencySymbol, preferences.number_format, 2)
              }
            </span>
          </div>
          <div className={dividerClass} aria-hidden />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <IndicatorMetricLabel
              labelClassName={labelMuted}
              isBand={isBand}
              label={t('dashboard:currentBalance', { defaultValue: 'Solde actuel' })}
              tooltip={currentBalanceTooltip}
              icon={(
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            />
            <span className={`text-xl font-semibold ${
              accountBalance.current >= accountBalance.initial ? valueUp : valueDown
            }`}>
              {balanceLoading ? (
                <span className={valueSkeletonClass} aria-hidden />
              ) : hideCurrentBalance 
                ? maskValue(accountBalance.current, currencySymbol)
                : formatCurrency(accountBalance.current, currencySymbol, preferences.number_format, 2)
              }
            </span>
          </div>
          <div className={dividerClass} aria-hidden />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <IndicatorMetricLabel
              labelClassName={labelMuted}
              isBand={isBand}
              label={t('dashboard:highestBalanceReached', { defaultValue: 'Plus haut atteint' })}
              tooltip={highestBalanceTooltip}
              icon={(
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              )}
            />
            <span className={`text-xl font-semibold ${
              accountBalance.peak >= accountBalance.initial ? valueUp : valueDown
            }`}>
              {peakLoading ? (
                <span className={valueSkeletonClass} aria-hidden />
              ) : hideCurrentBalance
                ? maskValue(accountBalance.peak, currencySymbol)
                : formatCurrency(accountBalance.peak, currencySymbol, preferences.number_format, 2)
              }
            </span>
          </div>
        </div>

        {/* Total Trades et cumul multi-comptes */}
        <div className={tileClass}>
          {showTradesSection && (
            <div
              className={
                globalAllAccountsActivity
                  ? 'flex min-w-0 flex-1 flex-col gap-3 xl:flex-row xl:items-stretch xl:gap-0'
                  : 'flex min-w-0 flex-1 flex-col gap-1'
              }
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`flex min-w-0 flex-1 items-center gap-1.5 text-xs font-medium uppercase tracking-wider ${labelMuted}`}>
                    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span className="truncate">{t('dashboard:totalTrades', { defaultValue: 'Total Trades' })}</span>
                  </span>
                  {formattedAccountCreatedDate ? (
                    <span
                      className={`min-w-0 max-w-[45%] shrink truncate text-right text-[10px] font-normal normal-case tracking-normal ${labelMuted}`}
                      title={t('dashboard:accountCreatedOn', {
                        date: formattedAccountCreatedDate,
                        defaultValue: 'Depuis le {{date}}',
                      })}
                    >
                      {t('dashboard:accountCreatedOn', {
                        date: formattedAccountCreatedDate,
                        defaultValue: 'Depuis le {{date}}',
                      })}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-xl font-semibold ${valuePrimary}`}>
                    {detailsLoading ? (
                      <span className={valueSkeletonClass} aria-hidden />
                    ) : (
                      totalTrades
                    )}
                  </span>
                  {hasActiveDays && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badgeNeutral}`}>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-11 8h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {t('dashboard:activeDays', { defaultValue: 'Jours actifs' })}: <span className="font-semibold">{activeDays}</span>
                    </span>
                  )}
                </div>
              </div>
              {globalAllAccountsActivity && (
                <>
                  <div
                    aria-hidden
                    className={`mx-0 hidden min-h-0 w-px shrink-0 self-stretch xl:mx-4 xl:block ${isBand ? 'bg-white/15' : 'bg-gray-200 dark:bg-gray-600'}`}
                  />
                  <div
                    className={`flex min-w-0 flex-1 flex-col justify-center gap-1 border-t pt-3 font-sans xl:border-t-0 xl:pt-0 ${cumulBorder}`}
                  >
                    <span className={`break-words text-xs font-medium uppercase tracking-wider ${labelMuted}`}>
                      {t('dashboard:allAccountsCumulative', { defaultValue: 'Tous comptes (cumul)' })}
                    </span>
                    <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 sm:gap-x-2 xl:gap-x-1 2xl:gap-x-2">
                      <span className={`text-base font-semibold tabular-nums xl:text-sm 2xl:text-base min-[1800px]:text-xl ${valuePrimary}`}>
                        {globalAllAccountsActivity.totalPositions}
                      </span>
                      <span className={`text-xs font-medium lowercase leading-tight xl:text-[0.625rem] xl:leading-tight 2xl:text-xs min-[1800px]:text-sm ${isBand ? 'text-white/60' : 'text-gray-700 dark:text-gray-300'}`}>
                        {t('dashboard:globalPositionsLabel', { defaultValue: 'positions' })}
                      </span>
                      <span
                        className={`select-none text-xs leading-none xl:text-[0.625rem] 2xl:text-xs min-[1800px]:text-sm ${isBand ? 'text-white/40' : 'text-gray-400 dark:text-gray-500'}`}
                        aria-hidden
                      >
                        ·
                      </span>
                      <span className={`text-base font-semibold tabular-nums xl:text-sm 2xl:text-base min-[1800px]:text-xl ${valuePrimary}`}>
                        {globalAllAccountsActivity.globalActiveDays}
                      </span>
                      <span className={`text-xs font-medium lowercase leading-tight xl:text-[0.625rem] xl:leading-tight 2xl:text-xs min-[1800px]:text-sm ${isBand ? 'text-white/60' : 'text-gray-700 dark:text-gray-300'}`}>
                        {t('dashboard:activeDays', { defaultValue: 'Jours actifs' })}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Meilleur jour et Pire jour regroupés */}
        {(bestAndWorstDays.bestDay || bestAndWorstDays.worstDay) && (
          <div className={tileClass}>
            {bestAndWorstDays.bestDay && (
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className={`flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider ${valueUp}`}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  {t('dashboard:bestDay', { defaultValue: 'Meilleur jour' })}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xl font-semibold ${valueUp}`}>
                    {formatCurrency(bestAndWorstDays.bestDay.pnl, currencySymbol, preferences.number_format, 2)}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeUp}`}>
                    {formatDate(bestAndWorstDays.bestDay.date, preferences.date_format, false, preferences.timezone)}
                  </span>
                </div>
              </div>
            )}
            {bestAndWorstDays.bestDay && bestAndWorstDays.worstDay && (
              <div className={dividerClass} aria-hidden />
            )}
            {bestAndWorstDays.worstDay && (
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className={`flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider ${valueDown}`}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {t('dashboard:worstDay', { defaultValue: 'Pire jour' })}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xl font-semibold ${valueDown}`}>
                    {formatCurrency(bestAndWorstDays.worstDay.pnl, currencySymbol, preferences.number_format, 2)}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeDown}`}>
                    {formatDate(bestAndWorstDays.worstDay.date, preferences.date_format, false, preferences.timezone)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Consistency Target (si applicable) */}
        {visibleConsistencyTarget && (
          <div
            className={`flex h-full min-w-0 w-full flex-col gap-2 rounded-lg border p-4 transition-colors duration-150 ${
              isBand
                ? consistencyTarget.isCompliant
                  ? 'border-emerald-400/30 bg-emerald-500/10 hover:bg-emerald-500/15'
                  : 'border-amber-400/30 bg-amber-500/10 hover:bg-amber-500/15'
                : consistencyTarget.isCompliant
                  ? 'border-green-200 bg-green-50 hover:bg-green-100 dark:border-green-800 dark:bg-green-900/20 dark:hover:bg-green-900/30'
                  : 'border-amber-200 bg-amber-50 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:hover:bg-amber-900/30'
            }`}
          >
            <span
              className={`flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider ${
                consistencyTarget.isCompliant
                  ? isBand
                    ? 'text-emerald-400'
                    : 'text-green-700 dark:text-green-300'
                  : isBand
                    ? 'text-amber-400'
                    : 'text-amber-700 dark:text-amber-300'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="10" strokeWidth={2} />
                <circle cx="12" cy="12" r="6" strokeWidth={2} />
                <circle cx="12" cy="12" r="2" strokeWidth={2} />
              </svg>
              {t('dashboard:consistencyTarget', { defaultValue: 'Consistency Target' })}
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-lg font-semibold ${
                  consistencyTarget.isCompliant
                    ? isBand
                      ? 'text-emerald-400'
                      : 'text-green-600 dark:text-green-400'
                    : isBand
                      ? 'text-amber-400'
                      : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {formatNumber(consistencyTarget.bestDayPercentage, 2, preferences.number_format)}% / {formatNumber(consistencyTarget.targetPercentage, 2, preferences.number_format)}%
              </span>
              {/* Mini barre de progression inline */}
              <div
                className={`h-1.5 min-w-[60px] flex-1 rounded-full ${isBand ? 'bg-white/15' : 'bg-gray-200 dark:bg-gray-600'}`}
              >
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    consistencyTarget.isCompliant
                      ? isBand
                        ? 'bg-emerald-400'
                        : 'bg-green-500 dark:bg-green-400'
                      : isBand
                        ? 'bg-amber-400'
                        : 'bg-amber-500 dark:bg-amber-400'
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
                <div className={`text-xs ${isBand ? 'text-amber-400' : 'text-amber-600 dark:text-amber-400'}`}>
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

