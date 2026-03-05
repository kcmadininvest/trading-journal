import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SessionContextFormData,
  NewsEvent,
  TradingSession,
  NewsImpact,
  DayOfWeek,
  PhysicalState,
  MentalState,
} from '../../types/analytics';
import {
  selectClassName,
  labelClassName,
  sectionClassName,
  sectionTitleClassName,
  buttonPrimaryClassName,
  buttonSecondaryClassName,
  checkboxLabelClassName,
} from './formStyles';

interface SessionContextFormProps {
  initialData?: Partial<SessionContextFormData>;
  onSubmit: (data: SessionContextFormData) => void;
  onChange?: (data: SessionContextFormData) => void;
  onCancel?: () => void;
}

const SessionContextForm: React.FC<SessionContextFormProps> = ({
  initialData = {},
  onSubmit,
  onChange,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<SessionContextFormData>({
    trading_session: initialData.trading_session || 'asian',
    day_of_week: initialData.day_of_week || 'monday',
    session_time_slot: initialData.session_time_slot || '',
    news_events: initialData.news_events || [],
    is_first_trade_of_day: initialData.is_first_trade_of_day || false,
    is_last_trade_of_day: initialData.is_last_trade_of_day || false,
    physical_state: initialData.physical_state || undefined,
    mental_state: initialData.mental_state || undefined,
    hours_of_sleep: initialData.hours_of_sleep,
    previous_trade_result: initialData.previous_trade_result || undefined,
    minutes_since_last_trade: initialData.minutes_since_last_trade,
    trade_motivation: initialData.trade_motivation || undefined,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.trading_session) {
      newErrors.trading_session = t('analytics:tradeAnalytics.session.sessionRequired', { defaultValue: 'La session de trading est obligatoire' });
    }
    if (!formData.day_of_week) {
      newErrors.day_of_week = t('analytics:tradeAnalytics.session.dayRequired', { defaultValue: 'Le jour de la semaine est obligatoire' });
    }
    if (formData.is_first_trade_of_day && formData.is_last_trade_of_day) {
      newErrors.trade_position = t('analytics:tradeAnalytics.session.cannotBeBothFirstAndLast', { defaultValue: 'Un trade ne peut pas être à la fois le premier et le dernier du jour' });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleChange = (field: keyof SessionContextFormData, value: any) => {
    let newData = { ...formData, [field]: value };
    
    // Si on coche first_trade_of_day, décocher last_trade_of_day
    if (field === 'is_first_trade_of_day' && value === true) {
      newData.is_last_trade_of_day = false;
    }
    // Si on coche last_trade_of_day, décocher first_trade_of_day
    if (field === 'is_last_trade_of_day' && value === true) {
      newData.is_first_trade_of_day = false;
    }
    
    setFormData(newData);
    onChange?.(newData);
  };

  const handleReset = () => {
    if (window.confirm(t('analytics:tradeAnalytics.confirmReset', { defaultValue: 'Êtes-vous sûr de vouloir réinitialiser ce formulaire ?' }))) {
      const resetData: SessionContextFormData = {
        trading_session: 'asian',
        day_of_week: 'monday',
        session_time_slot: '',
        news_events: [],
        is_first_trade_of_day: false,
        is_last_trade_of_day: false,
        physical_state: undefined,
        mental_state: undefined,
        hours_of_sleep: undefined,
        previous_trade_result: undefined,
        minutes_since_last_trade: undefined,
        trade_motivation: undefined,
      };
      setFormData(resetData);
      onChange?.(resetData);
    }
  };

  const addNewsEvent = () => {
    const newEvent: NewsEvent = {
      impact: 'none',
      description: '',
    };
    const newData = {
      ...formData,
      news_events: [...(formData.news_events || []), newEvent],
    };
    setFormData(newData);
    onChange?.(newData);
  };

  const removeNewsEvent = (index: number) => {
    const newData = {
      ...formData,
      news_events: formData.news_events?.filter((_, i) => i !== index) || [],
    };
    setFormData(newData);
    onChange?.(newData);
  };

  const updateNewsEvent = (index: number, field: keyof NewsEvent, value: any) => {
    const newEvents = [...(formData.news_events || [])];
    newEvents[index] = { ...newEvents[index], [field]: value };
    const newData = { ...formData, news_events: newEvents };
    setFormData(newData);
    onChange?.(newData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Session de Trading */}
      <div className={sectionClassName}>
        <h3 className={sectionTitleClassName}>{t('analytics:tradeAnalytics.session.tradingSession')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClassName}>
              {t('analytics:tradeAnalytics.session.sessionLabel')} <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.trading_session}
              onChange={(e) => handleChange('trading_session', e.target.value as TradingSession)}
              className={`${selectClassName} ${errors.trading_session ? 'border-red-500 dark:border-red-500' : ''}`}
              required
            >
              <option value="asian">{t('analytics:tradingSession.asian', { defaultValue: 'Asian' })}</option>
              <option value="london">{t('analytics:tradingSession.london', { defaultValue: 'London' })}</option>
              <option value="new_york">{t('analytics:tradingSession.newYork', { defaultValue: 'New York' })}</option>
              <option value="overlap_london_ny">{t('analytics:tradingSession.overlapLondonNY', { defaultValue: 'London/NY Overlap' })}</option>
              <option value="after_hours">{t('analytics:tradingSession.afterHours', { defaultValue: 'After Hours' })}</option>
            </select>
            {errors.trading_session && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.trading_session}</p>
            )}
          </div>

          <div>
            <label className={labelClassName}>
              {t('analytics:tradeAnalytics.session.dayOfWeek')} <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.day_of_week}
              onChange={(e) => handleChange('day_of_week', e.target.value as DayOfWeek)}
              className={`${selectClassName} ${errors.day_of_week ? 'border-red-500 dark:border-red-500' : ''}`}
              required
            >
              <option value="monday">{t('analytics:dayOfWeek.monday', { defaultValue: 'Lundi' })}</option>
              <option value="tuesday">{t('analytics:dayOfWeek.tuesday', { defaultValue: 'Mardi' })}</option>
              <option value="wednesday">{t('analytics:dayOfWeek.wednesday', { defaultValue: 'Mercredi' })}</option>
              <option value="thursday">{t('analytics:dayOfWeek.thursday', { defaultValue: 'Jeudi' })}</option>
              <option value="friday">{t('analytics:dayOfWeek.friday', { defaultValue: 'Vendredi' })}</option>
            </select>
            {errors.day_of_week && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.day_of_week}</p>
            )}
          </div>

          <div>
            <label className={labelClassName}>
              {t('analytics:tradeAnalytics.session.timeSlot')}
            </label>
            <input
              type="text"
              value={formData.session_time_slot}
              onChange={(e) => handleChange('session_time_slot', e.target.value)}
              className={selectClassName}
              placeholder="Ex: 09:30-10:00"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_first_trade_of_day"
              checked={formData.is_first_trade_of_day}
              onChange={(e) => handleChange('is_first_trade_of_day', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="is_first_trade_of_day" className={checkboxLabelClassName}>
              {t('analytics:tradeAnalytics.session.firstTradeOfDay', { defaultValue: 'Premier trade du jour' })}
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_last_trade_of_day"
              checked={formData.is_last_trade_of_day}
              onChange={(e) => handleChange('is_last_trade_of_day', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="is_last_trade_of_day" className={checkboxLabelClassName}>
              {t('analytics:tradeAnalytics.session.lastTradeOfDay', { defaultValue: 'Dernier trade du jour' })}
            </label>
          </div>
        </div>
      </div>

      {/* Événements Externes */}
      <div className={sectionClassName}>
        <div className="flex justify-between items-center mb-4">
          <h3 className={sectionTitleClassName + " mb-0"}>{t('analytics:tradeAnalytics.session.externalEvents', { defaultValue: 'Événements Externes' })}</h3>
          <button
            type="button"
            onClick={addNewsEvent}
            className="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-white hover:bg-blue-600 dark:hover:bg-blue-500 border border-blue-600 dark:border-blue-400 rounded transition-colors"
          >
            + {t('analytics:tradeAnalytics.session.addNewsEvent', { defaultValue: 'Ajouter un événement' })}
          </button>
        </div>

        <div className="space-y-3">
          {formData.news_events && formData.news_events.length > 0 ? (
            formData.news_events.map((event, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClassName}>
                      {t('analytics:tradeAnalytics.session.newsImpact')}
                    </label>
                    <select
                      value={event.impact}
                      onChange={(e) => updateNewsEvent(index, 'impact', e.target.value as NewsImpact)}
                      className={selectClassName}
                    >
                      <option value="none">{t('common:none', { defaultValue: 'Aucun' })}</option>
                      <option value="low">{t('analytics:newsImpact.low', { defaultValue: 'Low' })}</option>
                      <option value="medium">{t('analytics:newsImpact.medium', { defaultValue: 'Medium' })}</option>
                      <option value="high">{t('analytics:newsImpact.high', { defaultValue: 'High' })}</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={labelClassName}>
                        {t('analytics:tradeAnalytics.session.newsDescription')}
                      </label>
                      <button
                        type="button"
                        onClick={() => removeNewsEvent(index)}
                        className="px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:text-white hover:bg-red-600 dark:hover:bg-red-500 border border-red-600 dark:border-red-400 rounded transition-colors"
                        title={t('common:delete', { defaultValue: 'Supprimer' })}
                      >
                        ✕
                      </button>
                    </div>
                    <input
                      type="text"
                      value={event.description}
                      onChange={(e) => updateNewsEvent(index, 'description', e.target.value)}
                      className={selectClassName}
                      placeholder={t('analytics:tradeAnalytics.session.newsDescriptionPlaceholder', { defaultValue: 'Ex: NFP, FOMC, CPI...' })}
                    />
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              {t('analytics:tradeAnalytics.session.noNewsEvents', { defaultValue: 'Aucun événement externe. Cliquez sur "Ajouter un événement" pour en ajouter.' })}
            </p>
          )}
        </div>
      </div>

      {/* État du Trader & Contexte Personnel */}
      <div className={sectionClassName}>
        <h3 className={sectionTitleClassName}>{t('analytics:tradeAnalytics.session.traderState', { defaultValue: 'État du Trader' })}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClassName}>
              {t('analytics:tradeAnalytics.session.physicalState')}
            </label>
            <select
              value={formData.physical_state || ''}
              onChange={(e) => handleChange('physical_state', e.target.value as PhysicalState || undefined)}
              className={selectClassName}
            >
              <option value="">-- {t('common:select', { defaultValue: 'Sélectionner' })} --</option>
              <option value="optimal">{t('analytics:physicalState.optimal', { defaultValue: 'Optimal' })}</option>
              <option value="rested">{t('analytics:physicalState.rested', { defaultValue: 'Rested' })}</option>
              <option value="tired">{t('analytics:physicalState.tired', { defaultValue: 'Tired' })}</option>
              <option value="sick">{t('analytics:physicalState.sick', { defaultValue: 'Sick' })}</option>
            </select>
          </div>

          <div>
            <label className={labelClassName}>
              {t('analytics:tradeAnalytics.session.mentalState')}
            </label>
            <select
              value={formData.mental_state || ''}
              onChange={(e) => handleChange('mental_state', e.target.value as MentalState || undefined)}
              className={selectClassName}
            >
              <option value="">-- {t('common:select', { defaultValue: 'Sélectionner' })} --</option>
              <option value="focused">{t('analytics:mentalState.focused', { defaultValue: 'Focused' })}</option>
              <option value="confident">{t('analytics:mentalState.confident', { defaultValue: 'Confident' })}</option>
              <option value="distracted">{t('analytics:mentalState.distracted', { defaultValue: 'Distracted' })}</option>
              <option value="stressed">{t('analytics:mentalState.stressed', { defaultValue: 'Stressed' })}</option>
            </select>
          </div>

          <div>
            <label className={labelClassName}>
              {t('analytics:tradeAnalytics.session.hoursOfSleep', { defaultValue: 'Heures de Sommeil' })}
            </label>
            <input
              type="number"
              min="0"
              max="24"
              step="0.5"
              value={formData.hours_of_sleep || ''}
              onChange={(e) => handleChange('hours_of_sleep', e.target.value ? parseFloat(e.target.value) : undefined)}
              className={selectClassName}
              placeholder="Ex: 7.5"
            />
          </div>
        </div>
      </div>

      {/* Contexte du Trade */}
      <div className={sectionClassName}>
        <h3 className={sectionTitleClassName}>{t('analytics:tradeAnalytics.session.tradeContext', { defaultValue: 'Contexte du Trade' })}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClassName}>
              {t('analytics:tradeAnalytics.session.previousTradeResult', { defaultValue: 'Résultat du trade précédent' })}
            </label>
            <select
              value={formData.previous_trade_result || ''}
              onChange={(e) => handleChange('previous_trade_result', e.target.value || undefined)}
              className={selectClassName}
            >
              <option value="">-- {t('common:select', { defaultValue: 'Sélectionner' })} --</option>
              <option value="win">{t('analytics:previousTradeResult.win', { defaultValue: 'Gain' })}</option>
              <option value="loss">{t('analytics:previousTradeResult.loss', { defaultValue: 'Perte' })}</option>
              <option value="breakeven">{t('analytics:previousTradeResult.breakeven', { defaultValue: 'Breakeven' })}</option>
              <option value="first_trade_of_session">{t('analytics:previousTradeResult.firstTrade', { defaultValue: 'Premier trade de la session' })}</option>
            </select>
          </div>

          <div>
            <label className={labelClassName}>
              {t('analytics:tradeAnalytics.session.tradeMotivation', { defaultValue: 'Motivation principale du trade' })}
            </label>
            <select
              value={formData.trade_motivation || ''}
              onChange={(e) => handleChange('trade_motivation', e.target.value || undefined)}
              className={selectClassName}
            >
              <option value="">-- {t('common:select', { defaultValue: 'Sélectionner' })} --</option>
              <option value="setup_signal">{t('analytics:tradeMotivation.setupSignal', { defaultValue: 'Signal de setup' })}</option>
              <option value="fomo">{t('analytics:tradeMotivation.fomo', { defaultValue: 'FOMO' })}</option>
              <option value="revenge">{t('analytics:tradeMotivation.revenge', { defaultValue: 'Revenge' })}</option>
              <option value="boredom">{t('analytics:tradeMotivation.boredom', { defaultValue: 'Ennui' })}</option>
              <option value="recovery_attempt">{t('analytics:tradeMotivation.recoveryAttempt', { defaultValue: 'Tentative de récupération' })}</option>
              <option value="planned">{t('analytics:tradeMotivation.planned', { defaultValue: 'Planifié' })}</option>
            </select>
          </div>

          {formData.minutes_since_last_trade !== undefined && (
            <div>
              <label className={labelClassName}>
                {t('analytics:tradeAnalytics.session.minutesSinceLastTrade', { defaultValue: 'Minutes depuis le dernier trade' })}
              </label>
              <input
                type="number"
                value={formData.minutes_since_last_trade || ''}
                readOnly
                className={`${selectClassName} bg-gray-100 dark:bg-gray-700 cursor-not-allowed`}
                placeholder={t('analytics:tradeAnalytics.session.calculatedAuto', { defaultValue: 'Calculé automatiquement' })}
              />
            </div>
          )}
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
            {t('analytics:tradeAnalytics.cancel')}
          </button>
        )}
        <button
          type="submit"
          className={buttonPrimaryClassName}
        >
          {t('common:next', { defaultValue: 'Suivant' })}
        </button>
        </div>
      </div>
    </form>
  );
};

export default SessionContextForm;
