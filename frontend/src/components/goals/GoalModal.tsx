import React, { useState, useEffect, useMemo } from 'react';
import { TradingGoal } from '../../services/goals';
import { TradingAccount } from '../../services/tradingAccounts';
import { goalsService } from '../../services/goals';
import { CustomSelect } from '../common/CustomSelect';
import { DateInput } from '../common/DateInput';
import { NumberInput } from '../common/NumberInput';
import { usePreferences } from '../../hooks/usePreferences';
import { formatNumber, formatCurrency } from '../../utils/numberFormat';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useTradingAccount } from '../../contexts/TradingAccountContext';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  goal?: TradingGoal | null;
  tradingAccounts: TradingAccount[];
}

const GOAL_TYPES = [
  { value: 'pnl_total', label: 'goals:goalTypes.pnl_total' },
  { value: 'win_rate', label: 'goals:goalTypes.win_rate' },
  { value: 'trades_count', label: 'goals:goalTypes.trades_count' },
  { value: 'profit_factor', label: 'goals:goalTypes.profit_factor' },
  { value: 'max_drawdown', label: 'goals:goalTypes.max_drawdown' },
  { value: 'strategy_respect', label: 'goals:goalTypes.strategy_respect' },
  { value: 'winning_days', label: 'goals:goalTypes.winning_days' },
] as const;

const PERIOD_TYPES = [
  { value: 'monthly', label: 'goals:periodTypes.monthly' },
  { value: 'quarterly', label: 'goals:periodTypes.quarterly' },
  { value: 'yearly', label: 'goals:periodTypes.yearly' },
  { value: 'custom', label: 'goals:periodTypes.custom' },
] as const;

export const GoalModal: React.FC<GoalModalProps> = ({
  isOpen,
  onClose,
  onSave,
  goal,
  tradingAccounts,
}) => {
  const { t } = useI18nTranslation();
  const { preferences } = usePreferences();
  const { selectedAccountId } = useTradingAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const goalTypeOptions = useMemo(() => 
    GOAL_TYPES.map(type => ({
      value: type.value,
      label: t(type.label),
    })), [t]);
  
  const periodTypeOptions = useMemo(() => 
    PERIOD_TYPES.map(type => ({
      value: type.value,
      label: t(type.label),
    })), [t]);
  
  const accountOptions = useMemo(() => [
    { value: null, label: t('goals:allAccounts') },
    ...tradingAccounts.map(account => ({
      value: account.id,
      label: account.name,
    })),
  ], [tradingAccounts, t]);
  
  const [formData, setFormData] = useState({
    goal_type: 'pnl_total' as TradingGoal['goal_type'],
    period_type: 'monthly' as TradingGoal['period_type'],
    target_value: '',
    start_date: '',
    end_date: '',
    trading_account: null as number | null,
    priority: 1,
    notes: '',
  });

  useEffect(() => {
    if (isOpen) {
      if (goal) {
        // Mode édition
        setFormData({
          goal_type: goal.goal_type,
          period_type: goal.period_type,
          target_value: String(goal.target_value),
          start_date: goal.start_date,
          end_date: goal.end_date,
          trading_account: goal.trading_account || null,
          priority: goal.priority,
          notes: goal.notes || '',
        });
      } else {
        // Mode création
        const today = new Date();
        const endDate = new Date(today);
        endDate.setMonth(endDate.getMonth() + 1); // Par défaut, 1 mois
        
        setFormData({
          goal_type: 'pnl_total',
          period_type: 'monthly',
          target_value: '',
          start_date: today.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          trading_account: selectedAccountId || null,
          priority: 1,
          notes: '',
        });
      }
      setError(null);
    }
  }, [isOpen, goal, selectedAccountId]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        goal_type: formData.goal_type,
        period_type: formData.period_type,
        target_value: parseFloat(formData.target_value),
        start_date: formData.start_date,
        end_date: formData.end_date,
        trading_account: formData.trading_account || undefined,
        priority: formData.priority,
        notes: formData.notes,
      };

      if (goal) {
        await goalsService.update(goal.id, payload);
      } else {
        await goalsService.create(payload);
      }

      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message || t('goals:form.saveError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!goal) return;
    if (!window.confirm(t('goals:form.confirmDelete'))) return;

    setIsLoading(true);
    setError(null);

    try {
      await goalsService.delete(goal.id);
      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message || t('goals:form.deleteError'));
    } finally {
      setIsLoading(false);
    }
  };

  const calculatePeriodDates = (periodType: string) => {
    const today = new Date();
    let endDate = new Date(today);

    switch (periodType) {
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case 'quarterly':
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      case 'yearly':
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
      default:
        return;
    }

    setFormData(prev => ({
      ...prev,
      start_date: today.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
    }));
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-t-xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 dark:bg-blue-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {goal ? t('goals:editGoal') : t('goals:createGoal')}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {goal ? t('goals:form.editDescription', { defaultValue: 'Modifier votre objectif de trading' }) : t('goals:form.createDescription', { defaultValue: 'Créer un nouvel objectif de trading' })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="w-8 h-8 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form id="goal-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}
            {/* Type d'objectif */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('goals:form.goalType')} *
              </label>
              <CustomSelect
                value={formData.goal_type}
                onChange={(value) => setFormData({ ...formData, goal_type: value as TradingGoal['goal_type'] })}
                options={goalTypeOptions}
              />
            </div>

            {/* Type de période */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('goals:form.periodType')} *
              </label>
              <CustomSelect
                value={formData.period_type}
                onChange={(value) => {
                  const periodType = value as TradingGoal['period_type'];
                  setFormData({ ...formData, period_type: periodType });
                  if (periodType !== 'custom') {
                    calculatePeriodDates(periodType);
                  }
                }}
                options={periodTypeOptions}
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('goals:startDate')} *
                </label>
                <DateInput
                  value={formData.start_date}
                  onChange={(value) => setFormData({ ...formData, start_date: value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min={undefined}
                  max={formData.end_date || undefined}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('goals:endDate')} *
                </label>
                <DateInput
                  value={formData.end_date}
                  onChange={(value) => setFormData({ ...formData, end_date: value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min={formData.start_date || undefined}
                  max={undefined}
                />
              </div>
            </div>

            {/* Valeur cible */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('goals:form.targetValue')} *
              </label>
              <NumberInput
                value={formData.target_value}
                onChange={(value) => setFormData({ ...formData, target_value: value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                min={0}
                step="0.01"
                digits={
                  formData.goal_type === 'win_rate' || formData.goal_type === 'strategy_respect' || formData.goal_type === 'max_drawdown'
                    ? 1
                    : formData.goal_type === 'pnl_total'
                    ? 2
                    : 0
                }
                placeholder={
                  formData.goal_type === 'win_rate' || formData.goal_type === 'strategy_respect' || formData.goal_type === 'max_drawdown'
                    ? formatNumber(70, 1, preferences.number_format) + '%'
                    : formData.goal_type === 'pnl_total'
                    ? formatCurrency(1000, '', preferences.number_format, 2)
                    : formatNumber(100, 0, preferences.number_format)
                }
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {formData.goal_type === 'win_rate' || formData.goal_type === 'strategy_respect' || formData.goal_type === 'max_drawdown'
                  ? t('goals:form.percentageHint') + ` (ex: ${formatNumber(70, 1, preferences.number_format)}%)`
                  : formData.goal_type === 'pnl_total'
                  ? t('goals:form.currencyHint') + ` (ex: ${formatCurrency(1000, '', preferences.number_format, 2)})`
                  : t('goals:form.numberHint') + ` (ex: ${formatNumber(100, 0, preferences.number_format)})`}
              </p>
            </div>

            {/* Compte de trading */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('goals:form.tradingAccount')}
              </label>
              <CustomSelect
                value={formData.trading_account}
                onChange={(value) => setFormData({ ...formData, trading_account: value as number | null })}
                options={accountOptions}
              />
            </div>

            {/* Priorité */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('goals:form.priority')} (1-5)
              </label>
              <input
                type="number"
                min="1"
                max="5"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('goals:form.notes')}
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder={t('goals:form.notesPlaceholder')}
              />
            </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0 bg-gray-50 dark:bg-gray-900/50 rounded-b-xl">
          <div>
            {goal && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isLoading}
                className="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50 transition-colors"
              >
                {t('goals:form.delete')}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {t('goals:form.cancel')}
            </button>
            <button
              type="submit"
              form="goal-form"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isLoading ? t('goals:form.saving', { defaultValue: 'Saving...' }) : t('goals:form.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

