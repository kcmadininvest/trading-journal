import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TradeExecutionFormData,
  StopLossDirection,
  ExitReason,
} from '../../types/analytics';
import {
  inputClassName,
  selectClassName,
  labelClassName,
  textareaClassName,
  sectionClassName,
  sectionTitleClassName,
  buttonPrimaryClassName,
  buttonSecondaryClassName,
  checkboxLabelClassName,
} from './formStyles';

interface TradeExecutionFormProps {
  initialData?: Partial<TradeExecutionFormData>;
  onSubmit: (data: TradeExecutionFormData) => void;
  onCancel?: () => void;
}

const TradeExecutionForm: React.FC<TradeExecutionFormProps> = ({
  initialData = {},
  onSubmit,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<TradeExecutionFormData>({
    entry_as_planned: initialData.entry_as_planned,
    exit_as_planned: initialData.exit_as_planned,
    position_size_as_planned: initialData.position_size_as_planned,
    moved_stop_loss: initialData.moved_stop_loss || false,
    stop_loss_direction: initialData.stop_loss_direction || 'none',
    partial_exit_taken: initialData.partial_exit_taken || false,
    partial_exit_percentage: initialData.partial_exit_percentage,
    exit_reason: initialData.exit_reason,
    execution_errors: initialData.execution_errors || [],
    slippage_points: initialData.slippage_points,
    would_take_again: initialData.would_take_again,
    lesson_learned: initialData.lesson_learned || '',
    time_in_position_vs_planned: initialData.time_in_position_vs_planned,
    exit_emotional_context: initialData.exit_emotional_context || 'neutral',
    position_size_change_reason: initialData.position_size_change_reason || '',
  });

  const [newError, setNewError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (field: keyof TradeExecutionFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addError = () => {
    if (newError.trim()) {
      const newData = {
        ...formData,
        execution_errors: [...(formData.execution_errors || []), newError.trim()],
      };
      setFormData(newData);
      setNewError('');
    }
  };

  const removeError = (index: number) => {
    const newData = {
      ...formData,
      execution_errors: formData.execution_errors?.filter((_, i) => i !== index) || [],
    };
    setFormData(newData);
  };

  const handleReset = () => {
    if (window.confirm(t('analytics:tradeAnalytics.confirmReset', { defaultValue: 'Êtes-vous sûr de vouloir réinitialiser ce formulaire ?' }))) {
      const resetData: TradeExecutionFormData = {
        entry_as_planned: undefined,
        exit_as_planned: undefined,
        position_size_as_planned: undefined,
        moved_stop_loss: false,
        stop_loss_direction: 'none',
        partial_exit_taken: false,
        partial_exit_percentage: undefined,
        exit_reason: undefined,
        execution_errors: [],
        slippage_points: undefined,
        would_take_again: undefined,
        lesson_learned: '',
        time_in_position_vs_planned: undefined,
        exit_emotional_context: 'neutral',
        position_size_change_reason: '',
      };
      setFormData(resetData);
      setNewError('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Respect du Plan */}
      <div className={sectionClassName}>
        <h3 className={sectionTitleClassName}>{t('analytics:tradeAnalytics.execution.planRespect')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClassName}>
              {t('analytics:tradeAnalytics.execution.entryAsPlanned')}
            </label>
            <div className="space-y-2">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  checked={formData.entry_as_planned === true}
                  onChange={() => handleChange('entry_as_planned', true)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">{t('common:yes', { defaultValue: 'Oui' })}</span>
              </label>
              <label className="inline-flex items-center ml-4">
                <input
                  type="radio"
                  checked={formData.entry_as_planned === false}
                  onChange={() => handleChange('entry_as_planned', false)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">{t('common:no', { defaultValue: 'Non' })}</span>
              </label>
            </div>
          </div>

          <div>
            <label className={labelClassName}>
              {t('analytics:tradeAnalytics.execution.exitAsPlanned')}
            </label>
            <div className="space-y-2">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  checked={formData.exit_as_planned === true}
                  onChange={() => handleChange('exit_as_planned', true)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">{t('common:yes', { defaultValue: 'Oui' })}</span>
              </label>
              <label className="inline-flex items-center ml-4">
                <input
                  type="radio"
                  checked={formData.exit_as_planned === false}
                  onChange={() => handleChange('exit_as_planned', false)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">{t('common:no', { defaultValue: 'Non' })}</span>
              </label>
            </div>
          </div>

          <div>
            <label className={labelClassName}>
              {t('analytics:tradeAnalytics.execution.exitEmotionalContext', { defaultValue: 'Contexte émotionnel de sortie' })}
            </label>
            <select
              value={formData.exit_emotional_context || 'neutral'}
              onChange={(e) => handleChange('exit_emotional_context', e.target.value)}
              className={selectClassName}
            >
              <option value="neutral">{t('analytics:exitEmotionalContext.neutral', { defaultValue: 'Neutre/Discipline' })}</option>
              <option value="fear">{t('analytics:exitEmotionalContext.fear', { defaultValue: 'Peur' })}</option>
              <option value="greed">{t('analytics:exitEmotionalContext.greed', { defaultValue: 'Avidité' })}</option>
              <option value="fomo">{t('analytics:exitEmotionalContext.fomo', { defaultValue: 'FOMO' })}</option>
              <option value="discipline">{t('analytics:exitEmotionalContext.discipline', { defaultValue: 'Discipline stricte' })}</option>
            </select>
          </div>

          <div>
            <label className={labelClassName}>
              {t('analytics:tradeAnalytics.execution.positionSizeAsPlanned')}
            </label>
            <div className="space-y-2">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  checked={formData.position_size_as_planned === true}
                  onChange={() => handleChange('position_size_as_planned', true)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">{t('common:yes', { defaultValue: 'Oui' })}</span>
              </label>
              <label className="inline-flex items-center ml-4">
                <input
                  type="radio"
                  checked={formData.position_size_as_planned === false}
                  onChange={() => handleChange('position_size_as_planned', false)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">{t('common:no', { defaultValue: 'Non' })}</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Gestion du Trade & Sortie */}
      <div className={sectionClassName}>
        <h3 className={sectionTitleClassName}>{t('analytics:tradeAnalytics.execution.tradeManagement')}</h3>
        
        {/* Checkboxes pour Stop Loss et Sortie Partielle */}
        <div className="space-y-4 mb-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="moved_stop_loss"
                checked={formData.moved_stop_loss}
                onChange={(e) => handleChange('moved_stop_loss', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="moved_stop_loss" className={checkboxLabelClassName}>
                {t('analytics:tradeAnalytics.execution.movedStopLoss', { defaultValue: 'Stop Loss déplacé' })}
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="partial_exit_taken"
                checked={formData.partial_exit_taken}
                onChange={(e) => handleChange('partial_exit_taken', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="partial_exit_taken" className={checkboxLabelClassName}>
                {t('analytics:tradeAnalytics.execution.partialExitTaken', { defaultValue: 'Sortie partielle effectuée' })}
              </label>
            </div>
          </div>

          {formData.moved_stop_loss && (
            <div className="pl-6">
              <label className={labelClassName}>
                {t('analytics:tradeAnalytics.execution.stopLossDirection', { defaultValue: 'Direction du déplacement' })}
              </label>
              <select
                value={formData.stop_loss_direction}
                onChange={(e) => handleChange('stop_loss_direction', e.target.value as StopLossDirection)}
                className="w-full md:w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="none">{t('common:none', { defaultValue: 'Aucun' })}</option>
                <option value="tighter">{t('analytics:stopLossDirection.tighter', { defaultValue: 'Plus serré' })}</option>
                <option value="wider">{t('analytics:stopLossDirection.wider', { defaultValue: 'Plus large' })}</option>
              </select>
            </div>
          )}

          {formData.partial_exit_taken && (
            <div className="pl-6">
              <label className={labelClassName}>
                {t('analytics:tradeAnalytics.execution.partialExitPercentage', { defaultValue: 'Pourcentage de sortie partielle' })}
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.partial_exit_percentage || ''}
                onChange={(e) => handleChange('partial_exit_percentage', e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full md:w-1/2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: 50"
              />
            </div>
          )}
        </div>

        {/* Raison de sortie et Slippage */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClassName}>
              {t('analytics:tradeAnalytics.execution.exitReason')}
            </label>
            <select
              value={formData.exit_reason || ''}
              onChange={(e) => handleChange('exit_reason', e.target.value as ExitReason || undefined)}
              className={selectClassName}
            >
              <option value="">-- {t('common:select', { defaultValue: 'Sélectionner' })} --</option>
              <option value="take_profit_hit">{t('analytics:exitReason.takeProfitHit', { defaultValue: 'Take Profit Hit' })}</option>
              <option value="stop_loss_hit">{t('analytics:exitReason.stopLossHit', { defaultValue: 'Stop Loss Hit' })}</option>
              <option value="manual_exit">{t('analytics:exitReason.manualExit', { defaultValue: 'Manual Exit' })}</option>
              <option value="time_based">{t('analytics:exitReason.timeBased', { defaultValue: 'Time Based' })}</option>
              <option value="target_reached">{t('analytics:exitReason.targetReached', { defaultValue: 'Target Reached' })}</option>
              <option value="setup_invalidated">{t('analytics:exitReason.setupInvalidated', { defaultValue: 'Setup Invalidated' })}</option>
              <option value="emotional">{t('analytics:exitReason.emotional', { defaultValue: 'Emotional' })}</option>
              <option value="news_event">{t('analytics:exitReason.newsEvent', { defaultValue: 'News Event' })}</option>
            </select>
          </div>

          <div>
            <label className={labelClassName}>
              {t('analytics:tradeAnalytics.execution.slippage', { defaultValue: 'Slippage (points)' })}
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.slippage_points || ''}
              onChange={(e) => handleChange('slippage_points', e.target.value ? parseFloat(e.target.value) : undefined)}
              className={inputClassName}
              placeholder="Ex: 2.5"
            />
          </div>

          <div>
            <label className={labelClassName}>
              {t('analytics:tradeAnalytics.execution.timeInPositionVsPlanned', { defaultValue: 'Durée en position vs plan' })}
            </label>
            <select
              value={formData.time_in_position_vs_planned || ''}
              onChange={(e) => handleChange('time_in_position_vs_planned', e.target.value || undefined)}
              className={selectClassName}
            >
              <option value="">-- {t('common:select', { defaultValue: 'Sélectionner' })} --</option>
              <option value="much_shorter">{t('analytics:timeInPosition.muchShorter', { defaultValue: 'Beaucoup plus court' })}</option>
              <option value="shorter">{t('analytics:timeInPosition.shorter', { defaultValue: 'Plus court' })}</option>
              <option value="as_planned">{t('analytics:timeInPosition.asPlanned', { defaultValue: 'Comme prévu' })}</option>
              <option value="longer">{t('analytics:timeInPosition.longer', { defaultValue: 'Plus long' })}</option>
              <option value="much_longer">{t('analytics:timeInPosition.muchLonger', { defaultValue: 'Beaucoup plus long' })}</option>
            </select>
          </div>

          {formData.position_size_as_planned === false && (
            <div className="md:col-span-2">
              <label className={labelClassName}>
                {t('analytics:tradeAnalytics.execution.positionSizeChangeReason', { defaultValue: 'Raison du changement de taille' })}
              </label>
              <textarea
                value={formData.position_size_change_reason}
                onChange={(e) => handleChange('position_size_change_reason', e.target.value)}
                rows={3}
                className={textareaClassName}
                placeholder={t('analytics:tradeAnalytics.execution.positionSizeChangeReasonPlaceholder', { defaultValue: 'Pourquoi avez-vous modifié la taille de position ?' })}
              />
            </div>
          )}
        </div>
      </div>

      {/* Erreurs d'Exécution */}
      <div className={sectionClassName}>
        <h3 className={sectionTitleClassName}>{t('analytics:tradeAnalytics.execution.executionErrors', { defaultValue: 'Erreurs d\'Exécution' })}</h3>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={newError}
              onChange={(e) => setNewError(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addError())}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={t('analytics:tradeAnalytics.execution.errorPlaceholder', { defaultValue: 'Ex: Entrée trop tôt, SL trop large, FOMO...' })}
            />
            <button
              type="button"
              onClick={addError}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              {t('common:add', { defaultValue: 'Ajouter' })}
            </button>
          </div>

          {formData.execution_errors && formData.execution_errors.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {formData.execution_errors.length} {t('analytics:tradeAnalytics.execution.errorsCount', { defaultValue: 'erreur(s) identifiée(s)' })}
              </p>
              <div className="flex flex-wrap gap-2">
                {formData.execution_errors.map((error, index) => (
                  <div
                    key={index}
                    className="inline-flex items-center bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 px-3 py-1 rounded-full text-sm"
                  >
                    <span>{error}</span>
                    <button
                      type="button"
                      onClick={() => removeError(index)}
                      className="ml-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 focus:outline-none font-bold"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Post-Trade */}
      <div className={sectionClassName}>
        <h3 className={sectionTitleClassName}>{t('analytics:tradeAnalytics.execution.postTradeAnalysis', { defaultValue: 'Analyse Post-Trade' })}</h3>
        <div className="space-y-4">
          <div>
            <label className={labelClassName}>
              {t('analytics:tradeAnalytics.execution.wouldTakeAgain', { defaultValue: 'Reprendriez-vous ce trade ?' })}
            </label>
            <div className="space-y-2">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  checked={formData.would_take_again === true}
                  onChange={() => handleChange('would_take_again', true)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">{t('common:yes', { defaultValue: 'Oui' })}</span>
              </label>
              <label className="inline-flex items-center ml-4">
                <input
                  type="radio"
                  checked={formData.would_take_again === false}
                  onChange={() => handleChange('would_take_again', false)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">{t('common:no', { defaultValue: 'Non' })}</span>
              </label>
            </div>
          </div>

          <div>
            <label className={labelClassName}>
              {t('analytics:tradeAnalytics.execution.lessonLearned', { defaultValue: 'Leçon Apprise' })}
            </label>
            <textarea
              value={formData.lesson_learned}
              onChange={(e) => handleChange('lesson_learned', e.target.value)}
              rows={4}
              className={textareaClassName}
              placeholder={t('analytics:tradeAnalytics.execution.lessonPlaceholder', { defaultValue: 'Qu\'avez-vous appris de ce trade ? Que feriez-vous différemment ?' })}
            />
          </div>
        </div>
      </div>

      {/* Boutons d'action */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={handleReset}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
        >
          {t('analytics:tradeAnalytics.reset', { defaultValue: 'Réinitialiser' })}
        </button>
        <div className="flex space-x-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className={buttonSecondaryClassName}
          >
            {t('common:previous', { defaultValue: 'Précédent' })}
          </button>
        )}
        <button
          type="submit"
          className={buttonPrimaryClassName}
        >
          {t('analytics:tradeAnalytics.saveAndFinish', { defaultValue: 'Enregistrer et Terminer' })}
        </button>
        </div>
      </div>
    </form>
  );
};

export default TradeExecutionForm;
