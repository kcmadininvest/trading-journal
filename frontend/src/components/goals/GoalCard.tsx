import React, { useState, useRef, useEffect } from 'react';
import { TradingGoal } from '../../services/goals';
import { formatCurrency, formatNumber } from '../../utils/numberFormat';
import { formatDate } from '../../utils/dateFormat';
import { usePreferences } from '../../hooks/usePreferences';
import { useTranslation as useI18nTranslation } from 'react-i18next';

interface GoalCardProps {
  goal: TradingGoal;
  currencySymbol?: string;
  onClick?: () => void;
  onCancel?: (goal: TradingGoal) => void;
  onReactivate?: (goal: TradingGoal) => void;
  onDelete?: (goal: TradingGoal) => void;
}

export const GoalCard: React.FC<GoalCardProps> = ({ goal, currencySymbol = '', onClick, onCancel, onReactivate, onDelete }) => {
  const { preferences } = usePreferences();
  const { t } = useI18nTranslation();
  const [openMenu, setOpenMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const progressPercentage = goal.progress_percentage || 0;
  const remainingDays = goal.remaining_days || 0;

  // Fermer le menu si on clique en dehors
  useEffect(() => {
    if (!openMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenu(false);
      }
    };

    // Utiliser un délai pour éviter que le clic qui ouvre le menu ne le ferme immédiatement
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [openMenu]);
  
  // Déterminer la couleur selon le statut
  const getStatusColor = () => {
    switch (goal.status) {
      case 'achieved':
        return 'border-green-500 bg-green-50 dark:bg-green-900/20';
      case 'failed':
        return 'border-red-500 bg-red-50 dark:bg-red-900/20';
      case 'cancelled':
        return 'border-gray-400 bg-gray-50 dark:bg-gray-800';
      default:
        if (progressPercentage < 50 && remainingDays < 7) {
          return 'border-orange-500 bg-orange-50 dark:bg-orange-900/20';
        }
        return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';
    }
  };
  
  const getStatusBadge = () => {
    switch (goal.status) {
      case 'achieved':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-500 text-white">{t('goals:status.achieved')}</span>;
      case 'failed':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-500 text-white">{t('goals:status.failed')}</span>;
      case 'cancelled':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-500 text-white">{t('goals:status.cancelled')}</span>;
      default:
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-500 text-white">{t('goals:status.active')}</span>;
    }
  };
  
  const formatValue = (value: string | number, goalType: string) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    if (goalType === 'pnl_total' || goalType === 'max_drawdown') {
      return formatCurrency(numValue, currencySymbol, preferences.number_format, 2);
    } else if (goalType === 'win_rate' || goalType === 'strategy_respect') {
      return `${formatNumber(numValue, 1, preferences.number_format)}%`;
    } else if (goalType === 'profit_factor') {
      return formatNumber(numValue, 2, preferences.number_format);
    } else {
      return formatNumber(numValue, 0, preferences.number_format);
    }
  };
  
  const getGoalTypeLabel = (type: string) => {
    return t(`goals:goalTypes.${type}`, { defaultValue: type });
  };
  
  const handleCardClick = (e: React.MouseEvent) => {
    // Ne pas déclencher onClick si on clique sur le menu
    if ((e.target as HTMLElement).closest('.goal-menu')) {
      return;
    }
    onClick?.();
  };

  const handleCancelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('Cancel button clicked for goal:', goal.id, 'onCancel callback:', onCancel);
    setOpenMenu(false);
    // Appeler le callback immédiatement
    if (onCancel) {
      onCancel(goal);
    } else {
      console.warn('onCancel callback is not defined');
    }
  };

  const handleReactivateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('Reactivate button clicked for goal:', goal.id, 'onReactivate callback:', onReactivate);
    setOpenMenu(false);
    if (onReactivate) {
      onReactivate(goal);
    } else {
      console.warn('onReactivate callback is not defined');
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenu(false);
    onDelete?.(goal);
  };

  return (
    <div
      className={`p-4 rounded-lg border-2 ${getStatusColor()} cursor-pointer hover:shadow-lg transition-shadow relative`}
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              {getGoalTypeLabel(goal.goal_type)}
            </h3>
            {getStatusBadge()}
          </div>
          {goal.trading_account_name && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {goal.trading_account_name}
            </p>
          )}
        </div>
        <div className="flex items-start gap-2">
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatNumber(progressPercentage, 1, preferences.number_format)}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {formatValue(goal.current_value, goal.goal_type)} / {formatValue(goal.target_value, goal.goal_type)}
            </div>
          </div>
          {/* Menu d'actions */}
          <div className="relative goal-menu" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenu(!openMenu);
              }}
              className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title={t('goals:actions', { defaultValue: 'Actions' })}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            
            {openMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                {goal.status === 'active' && onCancel && (
                  <button
                    onClick={handleCancelClick}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 flex items-center gap-2 transition-colors"
                  >
                    <svg className="w-4 h-4 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {t('goals:cancelGoal', { defaultValue: 'Annuler l\'objectif' })}
                  </button>
                )}
                {goal.status === 'cancelled' && onReactivate && (
                  <button
                    onClick={handleReactivateClick}
                    className="w-full px-4 py-2 text-left text-sm text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center gap-2 transition-colors"
                  >
                    <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {t('goals:reactivateGoal', { defaultValue: 'Réactiver l\'objectif' })}
                  </button>
                )}
                {onDelete && (
                  <>
                    {(goal.status === 'active' && onCancel) || (goal.status === 'cancelled' && onReactivate) ? (
                      <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                    ) : null}
                    <button
                      onClick={handleDeleteClick}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      {t('goals:deleteGoal', { defaultValue: 'Supprimer' })}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Barre de progression */}
      <div className="mb-3">
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${
              goal.status === 'achieved' ? 'bg-green-500' :
              goal.status === 'failed' ? 'bg-red-500' :
              progressPercentage < 50 && remainingDays < 7 ? 'bg-orange-500' :
              'bg-blue-500'
            }`}
            style={{ width: `${Math.min(100, progressPercentage)}%` }}
          />
        </div>
      </div>
      
      {/* Informations supplémentaires */}
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>
          {formatDate(goal.start_date, preferences.date_format, false, preferences.timezone)} - {formatDate(goal.end_date, preferences.date_format, false, preferences.timezone)}
        </span>
        {remainingDays > 0 && goal.status === 'active' && (
          <span className="font-medium">
            {remainingDays} {remainingDays === 1 ? t('goals:dayRemaining') : t('goals:daysRemaining')}
          </span>
        )}
      </div>
    </div>
  );
};

