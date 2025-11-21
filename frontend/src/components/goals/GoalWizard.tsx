import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { TradingGoal } from '../../services/goals';
import { TradingAccount } from '../../services/tradingAccounts';
import { goalsService } from '../../services/goals';
import { CustomSelect } from '../common/CustomSelect';
import { DateInput } from '../common/DateInput';
import { NumberInput } from '../common/NumberInput';
import DeleteConfirmModal from '../ui/DeleteConfirmModal';
import { usePreferences } from '../../hooks/usePreferences';
import { formatNumber, formatCurrency } from '../../utils/numberFormat';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useTradingAccount } from '../../contexts/TradingAccountContext';

interface GoalWizardProps {
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

const STEPS = [
  { id: 1, label: 'goals:wizard.step1', title: 'goals:wizard.step1Title' },
  { id: 2, label: 'goals:wizard.step2', title: 'goals:wizard.step2Title' },
  { id: 3, label: 'goals:wizard.step3', title: 'goals:wizard.step3Title' },
  { id: 4, label: 'goals:wizard.step4', title: 'goals:wizard.step4Title' },
];

export const GoalWizard: React.FC<GoalWizardProps> = ({
  isOpen,
  onClose,
  onSave,
  goal,
  tradingAccounts,
}) => {
  const { t } = useI18nTranslation();
  const { preferences } = usePreferences();
  const { selectedAccountId } = useTradingAccount();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showWarningThreshold, setShowWarningThreshold] = useState(false);

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

  const directionOptions = useMemo(() => [
    { value: 'minimum', label: t('goals:directions.minimum', { defaultValue: 'Atteindre ou dépasser' }) },
    { value: 'maximum', label: t('goals:directions.maximum', { defaultValue: 'Ne pas dépasser' }) },
  ], [t]);

  const [formData, setFormData] = useState({
    goal_type: 'pnl_total' as TradingGoal['goal_type'],
    direction: 'minimum' as 'minimum' | 'maximum',
    period_type: 'monthly' as TradingGoal['period_type'],
    threshold_target: '',
    threshold_warning: '',
    start_date: '',
    end_date: '',
    trading_account: null as number | null,
    priority: 1,
    notes: '',
    status: 'active' as TradingGoal['status'],
  });

  useEffect(() => {
    if (isOpen) {
      if (goal) {
        setFormData({
          goal_type: goal.goal_type,
          direction: goal.direction || 'minimum',
          period_type: goal.period_type,
          threshold_target: String(goal.threshold_target || goal.target_value || ''),
          threshold_warning: goal.threshold_warning ? String(goal.threshold_warning) : '',
          start_date: goal.start_date,
          end_date: goal.end_date,
          trading_account: goal.trading_account || null,
          priority: goal.priority,
          notes: goal.notes || '',
          status: goal.status,
        });
        setShowWarningThreshold(!!goal.threshold_warning);
        setCurrentStep(1);
      } else {
        const today = new Date();
        const endDate = new Date(today);
        endDate.setMonth(endDate.getMonth() + 1);

        setFormData({
          goal_type: 'pnl_total',
          direction: 'minimum',
          period_type: 'monthly',
          threshold_target: '',
          threshold_warning: '',
          start_date: today.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          trading_account: selectedAccountId || null,
          priority: 1,
          notes: '',
          status: 'active',
        });
        setShowWarningThreshold(false);
        setCurrentStep(1);
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

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!formData.goal_type && !!formData.direction;
      case 2:
        return !!formData.threshold_target;
      case 3:
        return !!formData.start_date && !!formData.end_date;
      default:
        return true;
    }
  };

  const handleNext = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (validateStep(currentStep)) {
      setCurrentStep(prev => {
        const nextStep = Math.min(prev + 1, STEPS.length);
        return nextStep;
      });
      setError(null); // Effacer les erreurs précédentes
    } else {
      setError(t('goals:wizard.pleaseComplete', { defaultValue: 'Veuillez compléter tous les champs requis' }));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Ne soumettre que si on est à la dernière étape
    if (currentStep < STEPS.length) {
      // Empêcher toute soumission et passer à l'étape suivante
      handleNext();
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      const payload: any = {
        goal_type: formData.goal_type,
        direction: formData.direction,
        period_type: formData.period_type,
        threshold_target: parseFloat(formData.threshold_target),
        start_date: formData.start_date,
        end_date: formData.end_date,
        trading_account: formData.trading_account || undefined,
        priority: formData.priority,
        notes: formData.notes,
      };

      if (showWarningThreshold && formData.threshold_warning) {
        payload.threshold_warning = parseFloat(formData.threshold_warning);
      }

      if (goal) {
        payload.status = formData.status;
        await goalsService.update(goal.id, payload);
        toast.success(t('goals:form.updateSuccess', { defaultValue: 'Objectif mis à jour avec succès' }));
      } else {
        await goalsService.create(payload);
        toast.success(t('goals:form.createSuccess', { defaultValue: 'Objectif créé avec succès' }));
      }

      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message || t('goals:form.saveError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!goal) return;

    setIsDeleting(true);
    setError(null);

    try {
      await goalsService.delete(goal.id);
      toast.success(t('goals:form.deleteSuccess', { defaultValue: 'Objectif supprimé avec succès' }));
      setShowDeleteModal(false);
      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message || t('goals:form.deleteError'));
    } finally {
      setIsDeleting(false);
    }
  };

  const getTargetValuePlaceholder = () => {
    const type = formData.goal_type;
    if (type === 'win_rate' || type === 'strategy_respect' || type === 'max_drawdown') {
      return formatNumber(70, 1, preferences.number_format) + '%';
    } else if (type === 'pnl_total') {
      return formatCurrency(1000, '', preferences.number_format, 2);
    } else {
      return formatNumber(100, 0, preferences.number_format);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white dark:bg-gray-800 w-full max-w-3xl rounded-xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header avec étapes */}
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-t-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {goal ? t('goals:editGoal') : t('goals:createGoal')}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {t(`goals:wizard.step${currentStep}Title`, { defaultValue: STEPS[currentStep - 1]?.title })}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="w-8 h-8 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Indicateur de progression */}
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className="flex items-center flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-colors ${
                      currentStep > step.id
                        ? 'bg-green-500 text-white'
                        : currentStep === step.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {currentStep > step.id ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      step.id
                    )}
                  </div>
                  <span className={`ml-2 text-xs font-medium hidden sm:block ${
                    currentStep >= step.id ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {t(step.label, { defaultValue: `Étape ${step.id}` })}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${
                    currentStep > step.id ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <form 
          id="goal-wizard-form" 
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Ne permettre la soumission que si on est à la dernière étape
            if (currentStep === STEPS.length) {
              handleSubmit(e);
            } else {
              // Sinon, passer à l'étape suivante
              handleNext();
            }
          }}
          onKeyDown={(e) => {
            // Empêcher la soumission du formulaire avec Entrée si on n'est pas à la dernière étape
            if (e.key === 'Enter' && currentStep < STEPS.length) {
              e.preventDefault();
              e.stopPropagation();
              handleNext();
            }
          }}
          className="flex-1 overflow-y-auto p-4 sm:p-6"
        >
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-4">
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Étape 1: Type et direction */}
          {currentStep === 1 && (
            <div className="space-y-4">
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

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('goals:wizard.direction', { defaultValue: 'Direction' })} *
                </label>
                <CustomSelect
                  value={formData.direction}
                  onChange={(value) => setFormData({ ...formData, direction: value as 'minimum' | 'maximum' })}
                  options={directionOptions}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {formData.direction === 'minimum'
                    ? t('goals:wizard.directionMinimumHint', { defaultValue: 'L\'objectif doit être atteint ou dépassé' })
                    : t('goals:wizard.directionMaximumHint', { defaultValue: 'L\'objectif ne doit pas être dépassé' })}
                </p>
              </div>
            </div>
          )}

          {/* Étape 2: Seuils */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('goals:wizard.targetThreshold', { defaultValue: 'Seuil cible' })} *
                </label>
                <NumberInput
                  value={formData.threshold_target}
                  onChange={(value) => setFormData({ ...formData, threshold_target: value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  placeholder={getTargetValuePlaceholder()}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t('goals:wizard.targetThresholdHint', { defaultValue: 'Valeur à atteindre ou ne pas dépasser' })}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('goals:wizard.warningThreshold', { defaultValue: 'Seuil d\'alerte (optionnel)' })}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowWarningThreshold(!showWarningThreshold);
                      if (!showWarningThreshold) {
                        setFormData({ ...formData, threshold_warning: '' });
                      }
                    }}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800"
                  >
                    {showWarningThreshold ? t('goals:wizard.disable', { defaultValue: 'Désactiver' }) : t('goals:wizard.enable', { defaultValue: 'Activer' })}
                  </button>
                </div>
                {showWarningThreshold && (
                  <>
                    <NumberInput
                      value={formData.threshold_warning}
                      onChange={(value) => setFormData({ ...formData, threshold_warning: value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min={0}
                      step="0.01"
                      digits={
                        formData.goal_type === 'win_rate' || formData.goal_type === 'strategy_respect' || formData.goal_type === 'max_drawdown'
                          ? 1
                          : formData.goal_type === 'pnl_total'
                          ? 2
                          : 0
                      }
                      placeholder={getTargetValuePlaceholder()}
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {formData.direction === 'minimum'
                        ? t('goals:wizard.warningThresholdMinimumHint', { defaultValue: 'Seuil en dessous duquel l\'objectif est en danger' })
                        : t('goals:wizard.warningThresholdMaximumHint', { defaultValue: 'Seuil au-dessus duquel l\'objectif est en danger' })}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Étape 3: Période et compte */}
          {currentStep === 3 && (
            <div className="space-y-4">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('goals:startDate')} *
                  </label>
                  <DateInput
                    value={formData.start_date}
                    onChange={(value) => setFormData({ ...formData, start_date: value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min={formData.start_date || undefined}
                    max={undefined}
                  />
                </div>
              </div>

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
            </div>
          )}

          {/* Étape 4: Options avancées */}
          {currentStep === 4 && (
            <div className="space-y-4">
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
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t('goals:form.priorityHint')}
                </p>
              </div>

              {goal && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('goals:form.status')}
                  </label>
                  <CustomSelect
                    value={formData.status}
                    onChange={(value) => setFormData({ ...formData, status: value as TradingGoal['status'] })}
                    options={[
                      { value: 'active', label: t('goals:status.active') },
                      { value: 'achieved', label: t('goals:status.achieved') },
                      { value: 'failed', label: t('goals:status.failed') },
                      { value: 'cancelled', label: t('goals:status.cancelled') },
                    ]}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('goals:form.notes')}
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-y"
                  placeholder={t('goals:form.notesPlaceholder')}
                />
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gray-50 dark:bg-gray-900/50 rounded-b-xl">
          <div>
            {goal && (
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={isLoading}
                className="px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50 transition-colors"
              >
                {t('goals:form.delete')}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handlePrevious}
                disabled={isLoading}
                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {t('goals:wizard.previous', { defaultValue: 'Précédent' })}
              </button>
            )}
            {currentStep < STEPS.length ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleNext(e);
                }}
                disabled={isLoading}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {t('goals:wizard.next', { defaultValue: 'Suivant' })}
              </button>
            ) : (
              <button
                type="submit"
                form="goal-wizard-form"
                disabled={isLoading}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isLoading ? t('goals:form.saving', { defaultValue: 'Sauvegarde...' }) : t('goals:form.save')}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {t('goals:form.cancel')}
            </button>
          </div>
        </div>
      </div>

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        title={t('goals:form.deleteConfirmTitle', { defaultValue: 'Supprimer l\'objectif' })}
        message={t('goals:form.deleteConfirmMessage', { defaultValue: 'Êtes-vous sûr de vouloir supprimer cet objectif ? Cette action est irréversible.' })}
        isLoading={isDeleting}
        confirmButtonText={t('goals:form.delete', { defaultValue: 'Supprimer' })}
      />
    </div>
  );
};

