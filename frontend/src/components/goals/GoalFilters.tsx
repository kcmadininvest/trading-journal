import React, { useState, useMemo, useEffect } from 'react';
import { GoalsFilters } from '../../services/goals';
import { TradingAccount } from '../../services/tradingAccounts';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { CustomSelect } from '../common/CustomSelect';

interface GoalFiltersProps {
  filters: GoalsFilters;
  onFiltersChange: (filters: GoalsFilters) => void;
  tradingAccounts: TradingAccount[];
  goalCounts?: {
    all: number;
    active: number;
    achieved: number;
    failed: number;
    cancelled: number;
  };
  onCreateClick?: () => void;
}

export const GoalFilters: React.FC<GoalFiltersProps> = ({
  filters,
  onFiltersChange,
  tradingAccounts,
  goalCounts,
  onCreateClick,
}) => {
  const { t } = useI18nTranslation();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchQuery, setSearchQuery] = useState(filters.search || '');

  // Synchroniser searchQuery avec filters.search quand il change de l'extérieur
  useEffect(() => {
    if (filters.search !== searchQuery) {
      setSearchQuery(filters.search || '');
    }
  }, [filters.search, searchQuery]);

  const statusOptions = useMemo(() => [
    { value: 'all', label: t('goals:allStatuses', { defaultValue: 'Tous' }) },
    { value: 'active', label: t('goals:status.active') },
    { value: 'achieved', label: t('goals:status.achieved') },
    { value: 'failed', label: t('goals:status.failed') },
    { value: 'cancelled', label: t('goals:status.cancelled') },
  ], [t]);

  const goalTypeOptions = useMemo(() => [
    { value: '', label: t('goals:filters.allTypes', { defaultValue: 'Tous les types' }) },
    { value: 'pnl_total', label: t('goals:goalTypes.pnl_total') },
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

  const accountOptions = useMemo(() => [
    { value: null, label: t('goals:allAccounts', { defaultValue: 'Tous les comptes' }) },
    ...tradingAccounts.map(account => ({
      value: account.id,
      label: account.name,
    })),
  ], [tradingAccounts, t]);

  const handleStatusChange = (status: string) => {
    onFiltersChange({
      ...filters,
      status: status === 'all' ? undefined : status,
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

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.status) count++;
    if (filters.goal_type) count++;
    if (filters.direction) count++;
    if (filters.trading_account) count++;
    if (filters.search) count++;
    return count;
  }, [filters]);

  const getStatusCount = (status: string) => {
    if (!goalCounts) return 0;
    switch (status) {
      case 'all':
        return goalCounts.all;
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

  const currentStatus = filters.status || 'all';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
      {/* Filtres principaux */}
      <div className="flex flex-col gap-4">
        {/* Barre de recherche et bouton de création */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('goals:filters.searchPlaceholder', { defaultValue: 'Rechercher dans les objectifs...' })}
              className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {onCreateClick && (
            <button
              onClick={onCreateClick}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors whitespace-nowrap flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    : option.value === 'cancelled'
                    ? 'bg-gray-600 text-white'
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

        {/* Filtres avancés */}
        <div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {t('goals:filters.advanced', { defaultValue: 'Filtres avancés' })}
            {activeFiltersCount > 0 && (
              <span className="px-2 py-0.5 bg-blue-500 text-white rounded-full text-xs font-semibold">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {showAdvanced && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('goals:filters.goalType', { defaultValue: 'Type d\'objectif' })}
                </label>
                <CustomSelect
                  value={filters.goal_type || ''}
                  onChange={(value) => onFiltersChange({ ...filters, goal_type: value ? String(value) : undefined })}
                  options={goalTypeOptions}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('goals:filters.direction', { defaultValue: 'Direction' })}
                </label>
                <CustomSelect
                  value={filters.direction || ''}
                  onChange={(value) => onFiltersChange({ ...filters, direction: value ? String(value) : undefined })}
                  options={directionOptions}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('goals:filters.account', { defaultValue: 'Compte' })}
                </label>
                <CustomSelect
                  value={filters.trading_account || null}
                  onChange={(value) => onFiltersChange({ ...filters, trading_account: value as number | undefined })}
                  options={accountOptions}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

