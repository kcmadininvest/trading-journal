import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SessionContextFormData,
  TradingSession,
  NewsImpact,
  DayOfWeek,
  PhysicalState,
  MentalState,
  EmotionalState,
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
    news_event: initialData.news_event || false,
    news_impact: initialData.news_impact || 'none',
    news_description: initialData.news_description || '',
    is_first_trade_of_day: initialData.is_first_trade_of_day || false,
    is_last_trade_of_day: initialData.is_last_trade_of_day || false,
    physical_state: initialData.physical_state,
    mental_state: initialData.mental_state,
    emotional_state: initialData.emotional_state,
    hours_of_sleep: initialData.hours_of_sleep,
    caffeine_consumed: initialData.caffeine_consumed || false,
    distractions_present: initialData.distractions_present || false,
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
    const newData = { ...formData, [field]: value };
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
        <h3 className={sectionTitleClassName}>{t('analytics:tradeAnalytics.session.externalEvents', { defaultValue: 'Événements Externes' })}</h3>
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="news_event"
              checked={formData.news_event}
              onChange={(e) => handleChange('news_event', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="news_event" className={checkboxLabelClassName}>
              {t('analytics:tradeAnalytics.session.newsEvent')}
            </label>
          </div>

          {formData.news_event && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
              <div>
                <label className={labelClassName}>
                  {t('analytics:tradeAnalytics.session.newsImpact')}
                </label>
                <select
                  value={formData.news_impact}
                  onChange={(e) => handleChange('news_impact', e.target.value as NewsImpact)}
                  className={selectClassName}
                >
                  <option value="none">{t('common:none', { defaultValue: 'Aucun' })}</option>
                  <option value="low">{t('analytics:newsImpact.low', { defaultValue: 'Low' })}</option>
                  <option value="medium">{t('analytics:newsImpact.medium', { defaultValue: 'Medium' })}</option>
                  <option value="high">{t('analytics:newsImpact.high', { defaultValue: 'High' })}</option>
                </select>
              </div>

              <div>
                <label className={labelClassName}>
                  {t('analytics:tradeAnalytics.session.newsDescription')}
                </label>
                <input
                  type="text"
                  value={formData.news_description}
                  onChange={(e) => handleChange('news_description', e.target.value)}
                  className={selectClassName}
                  placeholder={t('analytics:tradeAnalytics.session.newsDescriptionPlaceholder', { defaultValue: 'Ex: NFP, FOMC, CPI...' })}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* État du Trader */}
      <div className={sectionClassName}>
        <h3 className={sectionTitleClassName}>{t('analytics:tradeAnalytics.session.traderState', { defaultValue: 'État du Trader' })}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              {t('analytics:tradeAnalytics.session.emotionalState')}
            </label>
            <select
              value={formData.emotional_state || ''}
              onChange={(e) => handleChange('emotional_state', e.target.value as EmotionalState || undefined)}
              className={selectClassName}
            >
              <option value="">-- {t('common:select', { defaultValue: 'Sélectionner' })} --</option>
              <option value="calm">{t('analytics:emotionalState.calm', { defaultValue: 'Calm' })}</option>
              <option value="excited">{t('analytics:emotionalState.excited', { defaultValue: 'Excited' })}</option>
              <option value="anxious">{t('analytics:emotionalState.anxious', { defaultValue: 'Anxious' })}</option>
              <option value="frustrated">{t('analytics:emotionalState.frustrated', { defaultValue: 'Frustrated' })}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Contexte Personnel */}
      <div className={sectionClassName}>
        <h3 className={sectionTitleClassName}>{t('analytics:tradeAnalytics.session.personalContext', { defaultValue: 'Contexte Personnel' })}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

          <div className="flex items-center">
            <input
              type="checkbox"
              id="caffeine_consumed"
              checked={formData.caffeine_consumed}
              onChange={(e) => handleChange('caffeine_consumed', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="caffeine_consumed" className={checkboxLabelClassName}>
              {t('analytics:tradeAnalytics.session.caffeineConsumed', { defaultValue: 'Caféine consommée' })}
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="distractions_present"
              checked={formData.distractions_present}
              onChange={(e) => handleChange('distractions_present', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="distractions_present" className={checkboxLabelClassName}>
              {t('analytics:tradeAnalytics.session.distractionsPresent', { defaultValue: 'Distractions présentes' })}
            </label>
          </div>
        </div>
      </div>

      {/* Boutons d'action */}
      <div className="flex justify-end space-x-3">
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
    </form>
  );
};

export default SessionContextForm;
