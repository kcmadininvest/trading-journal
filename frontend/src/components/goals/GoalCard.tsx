import React from 'react';
import { TradingGoal } from '../../services/goals';
import { formatCurrency, formatNumber } from '../../utils/numberFormat';
import { formatDate } from '../../utils/dateFormat';
import { usePreferences } from '../../hooks/usePreferences';
import { useTranslation as useI18nTranslation } from 'react-i18next';

interface GoalCardProps {
  goal: TradingGoal;
  currencySymbol?: string;
  onClick?: () => void;
}

export const GoalCard: React.FC<GoalCardProps> = ({ goal, currencySymbol = '', onClick }) => {
  const { preferences } = usePreferences();
  const { t } = useI18nTranslation();
  
  const progressPercentage = goal.progress_percentage || 0;
  const remainingDays = goal.remaining_days || 0;
  
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
  
  return (
    <div
      className={`p-4 rounded-lg border-2 ${getStatusColor()} cursor-pointer hover:shadow-lg transition-shadow`}
      onClick={onClick}
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
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatNumber(progressPercentage, 1, preferences.number_format)}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {formatValue(goal.current_value, goal.goal_type)} / {formatValue(goal.target_value, goal.goal_type)}
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

