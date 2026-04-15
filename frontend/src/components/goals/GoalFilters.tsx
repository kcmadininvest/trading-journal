import React, { useState, useMemo, useEffect } from 'react';
import { GoalsFilters } from '../../services/goals';
import type { TradingAccount } from '../../services/tradingAccounts';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { CustomSelect } from '../common/CustomSelect';
import { AccountSelector } from '../accounts/AccountSelector';

interface GoalFiltersProps {
  filters: GoalsFilters;
  onFiltersChange: (filters: GoalsFilters) => void;
  goalCounts?: {
    active: number;
    achieved: number;
    failed: number;
    cancelled: number;
  };
  onCreateClick?: () => void;
  hideAccountNumber?: boolean;
  /** Comptes du parent : null = chargement en cours, tableau = liste prête (évite list() côté sélecteur). */
  tradingAccounts?: TradingAccount[] | null;
  /** Même source que les autres pages (TradingAccountContext) — évite l’init locale divergente du sélecteur. */
  selectedAccountId: number | null;
  onTradingAccountChange: (accountId: number | null) => void;
  accountLoading: boolean;
}

export const GoalFilters: React.FC<GoalFiltersProps> = ({
  filters,
  onFiltersChange,
  goalCounts,
  onCreateClick,
  hideAccountNumber = false,
  tradingAccounts,
  selectedAccountId,
  onTradingAccountChange,
  accountLoading,
}) => {
  const { t } = useI18nTranslation();
  const [searchQuery, setSearchQuery] = useState(filters.search || '');

  // Synchroniser searchQuery avec filters.search quand il change de l'extérieur
  useEffect(() => {
    if (filters.search !== searchQuery) {
      setSearchQuery(filters.search || '');
    }
  }, [filters.search, searchQuery]);

  const statusOptions = useMemo(
    () => [
      { value: 'active', label: t('goals:status.active') },
      { value: 'achieved', label: t('goals:status.achieved') },
      { value: 'failed', label: t('goals:status.failed') },
      { value: 'cancelled', label: t('goals:status.cancelled') },
    ],
    [t]
  );

  const goalTypeOptions = useMemo(() => [
    { value: '', label: t('goals:filters.allTypes', { defaultValue: 'Tous les types' }) },
    { value: 'pnl_total', label: t('goals:goalTypes.pnl_total') },
    { value: 'withdrawal_amount', label: t('goals:goalTypes.withdrawal_amount') },
    { value: 'max_consecutive_losses', label: t('goals:goalTypes.max_consecutive_losses') },
    { value: 'daily_loss_limit_breaches', label: t('goals:goalTypes.daily_loss_limit_breaches') },
    { value: 'expectancy', label: t('goals:goalTypes.expectancy') },
    { value: 'avg_rr_actual', label: t('goals:goalTypes.avg_rr_actual') },
    { value: 'journal_completion_rate', label: t('goals:goalTypes.journal_completion_rate') },
    { value: 'win_rate', label: t('goals:goalTypes.win_rate') },
    { value: 'trades_count', label: t('goals:goalTypes.trades_count') },
    { value: 'profit_factor', label: t('goals:goalTypes.profit_factor') },
    { value: 'max_drawdown', label: t('goals:goalTypes.max_drawdown') },
    { value: 'strategy_respect', label: t('goals:goalTypes.strategy_respect') },
    { value: 'winning_days', label: t('goals:goalTypes.winning_days') },
  ], [t]);

  const directionOptions = useMemo(() => [
    { value: '', label: t('goals:filters.allDirections', { defaultValue: 'Toutes les directions' }) },
    { value: 'minimum', label: t('goals:directions.minimum', { defaultValue: 'Atteindre' }) },
    { value: 'maximum', label: t('goals:directions.maximum', { defaultValue: 'Ne pas dépasser' }) },
  ], [t]);

  const handleStatusChange = (status: string) => {
    onFiltersChange({
      ...filters,
      status,
    });
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onFiltersChange({
        ...filters,
        search: searchQuery || undefined,
      });
    }, 300);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const getStatusCount = (status: string) => {
    if (!goalCounts) return 0;
    switch (status) {
      case 'active':
        return goalCounts.active;
      case 'achieved':
        return goalCounts.achieved;
      case 'failed':
        return goalCounts.failed;
      case 'cancelled':
        return goalCounts.cancelled;
      default:
        return 0;
    }
  };

  const currentStatus = filters.status ?? 'active';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
      {/* Filtres principaux */}
      <div className="flex flex-col gap-4">
        {/* Compte | recherche | type | direction | bouton — grille lg ; &lt; lg : compte puis recherche puis sm pour type+direction */}
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:gap-x-4 lg:gap-y-2 lg:items-end">
          <div className="w-full min-w-0 sm:max-w-md lg:max-w-none [&>div]:max-w-none">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              {t('goals:filters.account', { defaultValue: 'Compte' })}
            </label>
            {accountLoading ? (
              <div
                className="h-10 w-full max-w-md rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse"
                aria-busy="true"
                aria-label={t('goals:filters.account', { defaultValue: 'Compte' })}
              />
            ) : (
              <AccountSelector
                value={selectedAccountId}
                onChange={onTradingAccountChange}
                allowAllActive
                hideLabel
                hideAccountNumber={hideAccountNumber}
                prefetchedAccounts={tradingAccounts}
              />
            )}
          </div>

          <div className="w-full min-w-0">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('goals:filters.searchPlaceholder', { defaultValue: 'Rechercher dans les objectifs...' })}
                className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end w-full sm:gap-3 lg:contents">
            <div className="w-full min-w-0 sm:flex-1 sm:min-w-[140px] lg:min-w-0">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                {t('goals:filters.goalType', { defaultValue: "Type d'objectif" })}
              </label>
              <CustomSelect
                className="w-full"
                value={filters.goal_type || ''}
                onChange={(value) => onFiltersChange({ ...filters, goal_type: value ? String(value) : undefined })}
                options={goalTypeOptions}
                searchable
                searchPlaceholder={t('goals:filters.searchTypePlaceholder', { defaultValue: "Rechercher un type d'objectif..." })}
              />
            </div>
            <div className="w-full min-w-0 sm:flex-1 sm:min-w-[140px] lg:min-w-0">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                {t('goals:filters.direction', { defaultValue: 'Direction' })}
              </label>
              <CustomSelect
                className="w-full"
                value={filters.direction || ''}
                onChange={(value) => onFiltersChange({ ...filters, direction: value ? String(value) : undefined })}
                options={directionOptions}
              />
            </div>
          </div>

          {onCreateClick && (
            <button
              type="button"
              onClick={onCreateClick}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors whitespace-nowrap flex items-center justify-center gap-2 shrink-0 lg:self-end lg:justify-self-end"
            >
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('goals:createGoal', { defaultValue: 'Créer un objectif' })}
            </button>
          )}
        </div>

        {/* Filtres par statut */}
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleStatusChange(option.value)}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                currentStatus === option.value
                  ? option.value === 'active'
                    ? 'bg-blue-600 text-white'
                    : option.value === 'achieved'
                      ? 'bg-green-600 text-white'
                      : option.value === 'failed'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {option.label}
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                currentStatus === option.value
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
              }`}>
                {getStatusCount(option.value)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

