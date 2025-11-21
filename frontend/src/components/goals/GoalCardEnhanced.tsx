import React, { useState, useRef, useEffect } from 'react';
import { TradingGoal } from '../../services/goals';
import { formatCurrency, formatNumber } from '../../utils/numberFormat';
import { formatDate } from '../../utils/dateFormat';
import { usePreferences } from '../../hooks/usePreferences';
import { useTranslation as useI18nTranslation } from 'react-i18next';

interface GoalCardEnhancedProps {
  goal: TradingGoal;
  currencySymbol?: string;
  onClick?: () => void;
  onCancel?: (goal: TradingGoal) => void;
  onReactivate?: (goal: TradingGoal) => void;
  onDelete?: (goal: TradingGoal) => void;
}

export const GoalCardEnhanced: React.FC<GoalCardEnhancedProps> = ({
  goal,
  currencySymbol = '',
  onClick,
  onCancel,
  onReactivate,
  onDelete,
}) => {
  const { preferences } = usePreferences();
  const { t } = useI18nTranslation();
  const [openMenu, setOpenMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showProgressTooltip, setShowProgressTooltip] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const progressPercentage = goal.progress_percentage || 0;
  const remainingDays = goal.remaining_days || 0;
  const zoneStatus = goal.zone_status || (goal.status === 'active' ? 'progress' : goal.status);

  // Fermer le menu si on clique en dehors
  useEffect(() => {
    if (!openMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenu(false);
      }
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [openMenu]);

  // Obtenir les couleurs selon la zone
  const getZoneColors = () => {
    switch (zoneStatus) {
      case 'success':
        return {
          border: 'border-green-500',
          bg: 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20',
          progress: 'bg-gradient-to-r from-green-500 to-emerald-500',
          text: 'text-green-700 dark:text-green-300',
          badge: 'bg-green-500 text-white',
        };
      case 'danger':
        return {
          border: 'border-orange-500',
          bg: 'bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20',
          progress: 'bg-gradient-to-r from-orange-500 to-red-500',
          text: 'text-orange-700 dark:text-orange-300',
          badge: 'bg-orange-500 text-white',
        };
      case 'failed':
        return {
          border: 'border-red-500',
          bg: 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20',
          progress: 'bg-gradient-to-r from-red-500 to-rose-500',
          text: 'text-red-700 dark:text-red-300',
          badge: 'bg-red-500 text-white',
        };
      case 'cancelled':
        return {
          border: 'border-gray-400',
          bg: 'bg-gray-50 dark:bg-gray-800',
          progress: 'bg-gray-400',
          text: 'text-gray-600 dark:text-gray-400',
          badge: 'bg-gray-500 text-white',
        };
      default:
        return {
          border: 'border-blue-500',
          bg: 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20',
          progress: 'bg-gradient-to-r from-blue-500 to-indigo-500',
          text: 'text-blue-700 dark:text-blue-300',
          badge: 'bg-blue-500 text-white',
        };
    }
  };

  const colors = getZoneColors();

  const getStatusBadge = () => {
    const statusLabels: Record<string, string> = {
      achieved: t('goals:status.achieved'),
      failed: t('goals:status.failed'),
      cancelled: t('goals:status.cancelled'),
      active: t('goals:status.active'),
    };

    const status = goal.status;
    return (
      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${colors.badge} shadow-sm`}>
        {statusLabels[status] || status}
      </span>
    );
  };

  const formatValue = (value: string | number, goalType: string) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    if (goalType === 'pnl_total') {
      return formatCurrency(numValue, currencySymbol, preferences.number_format, 2);
    } else if (goalType === 'win_rate' || goalType === 'strategy_respect' || goalType === 'max_drawdown') {
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

  const getGoalTypeIcon = (type: string) => {
    const icons: Record<string, React.ReactElement> = {
      pnl_total: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      win_rate: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      trades_count: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      profit_factor: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      max_drawdown: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
        </svg>
      ),
      strategy_respect: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      winning_days: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    };
    return icons[type] || icons.pnl_total;
  };

  const getTargetValue = (): string | number => {
    return goal.threshold_target !== undefined ? goal.threshold_target : (goal.target_value || 0);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.goal-menu')) {
      return;
    }
    onClick?.();
  };

  const handleCancelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenu(false);
    onCancel?.(goal);
  };

  const handleReactivateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenu(false);
    onReactivate?.(goal);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenu(false);
    onDelete?.(goal);
  };

  // Calculer le pourcentage pour l'animation de la barre
  const progressWidth = Math.min(100, Math.max(0, progressPercentage));

  return (
    <div
      className={`relative p-4 rounded-xl border-2 ${colors.border} ${colors.bg} cursor-pointer transition-all duration-300 ${
        isHovered ? 'shadow-xl scale-[1.02]' : 'shadow-md hover:shadow-lg'
      }`}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header avec icône et badge */}
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={`p-2 rounded-lg ${colors.bg} ${colors.text} flex-shrink-0`}>
            {getGoalTypeIcon(goal.goal_type)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
              {getGoalTypeLabel(goal.goal_type)}
            </h3>
            {goal.trading_account_name && (
              <p className="text-xs text-gray-600 dark:text-gray-400 truncate mt-0.5">
                {goal.trading_account_name}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {getStatusBadge()}
          {/* Menu d'actions */}
          <div className="relative goal-menu" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenu(!openMenu);
              }}
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title={t('goals:actions', { defaultValue: 'Actions' })}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>

            {openMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 z-50">
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

      {/* Métrique principale */}
      <div className="mb-3">
        <div className="flex items-baseline justify-end gap-2">
          <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {formatValue(goal.current_value, goal.goal_type)}
          </span>
          <span className="text-lg font-semibold text-gray-600 dark:text-gray-400">
            / {formatValue(getTargetValue(), goal.goal_type)}
          </span>
        </div>
      </div>

      {/* Barre de progression animée */}
      <div className="mb-3 w-full relative">
        <div
          ref={progressBarRef}
          className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden cursor-pointer relative"
          onMouseEnter={() => setShowProgressTooltip(true)}
          onMouseLeave={() => setShowProgressTooltip(false)}
        >
          <div
            className={`h-3 rounded-full transition-all duration-1000 ease-out ${colors.progress} relative`}
            style={{ width: `${progressWidth}%` }}
          >
            {goal.threshold_warning && (() => {
              const target = parseFloat(String(getTargetValue()));
              const warning = parseFloat(String(goal.threshold_warning));
              if (target === 0) return null;
              return (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 dark:bg-yellow-500"
                  style={{
                    left: `${((warning / target) * 100)}%`,
                  }}
                  title={t('goals:warningThreshold', { defaultValue: 'Seuil d\'alerte' })}
                />
              );
            })()}
          </div>
        </div>
        
        {/* Tooltip spécifique pour la barre de progression */}
        {showProgressTooltip && (
          <div
            className="absolute z-50 px-3 py-2 text-sm font-normal text-gray-900 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg pointer-events-none whitespace-nowrap"
            style={{
              bottom: 'calc(100% + 6px)',
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          >
            {t('goals:progress', { defaultValue: 'Progression' })}: {formatNumber(progressPercentage, 1, preferences.number_format)}%
            {/* Flèche pointant vers le bas */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-white/70 backdrop-blur-sm border-r border-b border-gray-200 transform rotate-45 -mt-1" />
          </div>
        )}
      </div>

      {/* Informations supplémentaires */}
      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
        <span className="truncate">
          {formatDate(goal.start_date, preferences.date_format, false, preferences.timezone)} - {formatDate(goal.end_date, preferences.date_format, false, preferences.timezone)}
        </span>
        {remainingDays > 0 && goal.status === 'active' && (
          <div className="flex items-center gap-1 font-medium whitespace-nowrap">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {remainingDays} {remainingDays === 1 ? t('goals:dayRemaining') : t('goals:daysRemaining')}
          </div>
        )}
      </div>
    </div>
  );
};

