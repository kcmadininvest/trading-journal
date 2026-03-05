import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TradeSetupFormData,
  SetupCategory,
  ChartPattern,
  SetupQuality,
  EntryTiming,
} from '../../types/analytics';
import {
  inputClassName,
  selectClassName,
  labelClassName,
  sectionClassName,
  sectionTitleClassName,
  buttonPrimaryClassName,
  buttonSecondaryClassName,
} from './formStyles';

interface TradeSetupFormProps {
  initialData?: Partial<TradeSetupFormData>;
  onSubmit: (data: TradeSetupFormData) => void;
  onChange?: (data: TradeSetupFormData) => void;
  onCancel?: () => void;
}

const TradeSetupForm: React.FC<TradeSetupFormProps> = ({
  initialData = {},
  onSubmit,
  onChange,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<TradeSetupFormData>({
    setup_category: initialData.setup_category || 'pullback',
    setup_subcategory: initialData.setup_subcategory || '',
    chart_pattern: initialData.chart_pattern || 'none',
    confluence_factors: initialData.confluence_factors || [],
    setup_quality: initialData.setup_quality || 'C',
    setup_confidence: initialData.setup_confidence || undefined,
    entry_timing: initialData.entry_timing || undefined,
    entry_in_range_percentage: initialData.entry_in_range_percentage,
    missed_better_entry: initialData.missed_better_entry || false,
    planned_hold_duration: initialData.planned_hold_duration || undefined,
  });

  const [newConfluence, setNewConfluence] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (field: keyof TradeSetupFormData, value: any) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    onChange?.(newData);
  };

  const addConfluence = () => {
    if (newConfluence.trim()) {
      const newData = {
        ...formData,
        confluence_factors: [...(formData.confluence_factors || []), newConfluence.trim()],
      };
      setFormData(newData);
      onChange?.(newData);
      setNewConfluence('');
    }
  };

  const removeConfluence = (index: number) => {
    const newData = {
      ...formData,
      confluence_factors: formData.confluence_factors?.filter((_, i) => i !== index) || [],
    };
    setFormData(newData);
    onChange?.(newData);
  };

  const handleReset = () => {
    if (window.confirm(t('analytics:tradeAnalytics.confirmReset', { defaultValue: 'Êtes-vous sûr de vouloir réinitialiser ce formulaire ?' }))) {
      const resetData: TradeSetupFormData = {
        setup_category: 'pullback',
        setup_subcategory: '',
        chart_pattern: 'none',
        confluence_factors: [],
        setup_quality: 'C',
        setup_confidence: undefined,
        entry_timing: undefined,
        entry_in_range_percentage: undefined,
        missed_better_entry: false,
        planned_hold_duration: undefined,
      };
      setFormData(resetData);
      setNewConfluence('');
      onChange?.(resetData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Classification du Setup */}
      <div className={sectionClassName}>
        <h3 className={sectionTitleClassName}>{t('analytics:tradeAnalytics.setup.title')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClassName}>
              {t('analytics:tradeAnalytics.setup.category')} <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.setup_category}
              onChange={(e) => handleChange('setup_category', e.target.value as SetupCategory)}
              className={selectClassName}
              required
            >
              <option value="pullback">{t('analytics:setupCategory.pullback', { defaultValue: 'Pullback' })}</option>
              <option value="breakout">{t('analytics:setupCategory.breakout', { defaultValue: 'Breakout' })}</option>
              <option value="reversal">{t('analytics:setupCategory.reversal', { defaultValue: 'Reversal' })}</option>
              <option value="continuation">{t('analytics:setupCategory.continuation', { defaultValue: 'Continuation' })}</option>
              <option value="range_bound">{t('analytics:setupCategory.rangeBound', { defaultValue: 'Range Bound' })}</option>
              <option value="news_driven">{t('analytics:setupCategory.newsDriven', { defaultValue: 'News Driven' })}</option>
              <option value="scalp">{t('analytics:setupCategory.scalp', { defaultValue: 'Scalp' })}</option>
              <option value="other">{t('analytics:setupCategory.other', { defaultValue: 'Other' })}</option>
            </select>
          </div>

          <div>
            <label className={labelClassName}>
              {t('analytics:tradeAnalytics.setup.subcategory')}
            </label>
            <input
              type="text"
              value={formData.setup_subcategory}
              onChange={(e) => handleChange('setup_subcategory', e.target.value)}
              className={inputClassName}
              placeholder="Ex: pullback_to_ema, breakout_consolidation"
            />
          </div>

          <div>
            <label className={labelClassName}>
              {t('analytics:tradeAnalytics.setup.chartPattern')}
            </label>
            <select
              value={formData.chart_pattern}
              onChange={(e) => handleChange('chart_pattern', e.target.value as ChartPattern)}
              className={selectClassName}
            >
              <option value="none">{t('common:none', { defaultValue: 'Aucun' })}</option>
              <option value="double_top">{t('analytics:chartPattern.doubleTop', { defaultValue: 'Double Top' })}</option>
              <option value="double_bottom">{t('analytics:chartPattern.doubleBottom', { defaultValue: 'Double Bottom' })}</option>
              <option value="head_shoulders">{t('analytics:chartPattern.headShoulders', { defaultValue: 'Head & Shoulders' })}</option>
              <option value="triangle">{t('analytics:chartPattern.triangle', { defaultValue: 'Triangle' })}</option>
              <option value="flag">{t('analytics:chartPattern.flag', { defaultValue: 'Flag' })}</option>
              <option value="wedge">{t('analytics:chartPattern.wedge', { defaultValue: 'Wedge' })}</option>
              <option value="channel">{t('analytics:chartPattern.channel', { defaultValue: 'Channel' })}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Confluence */}
      <div className={sectionClassName}>
        <h3 className={sectionTitleClassName}>{t('analytics:tradeAnalytics.setup.confluenceFactors')}</h3>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={newConfluence}
              onChange={(e) => setNewConfluence(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addConfluence())}
              className={inputClassName + " flex-1"}
              placeholder={t('analytics:tradeAnalytics.setup.confluencePlaceholder', { defaultValue: 'Ex: EMA 20, Support majeur, Volume élevé...' })}
            />
            <button
              type="button"
              onClick={addConfluence}
              className="px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-md hover:bg-green-700 dark:hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {t('common:add', { defaultValue: 'Ajouter' })}
            </button>
          </div>

          {formData.confluence_factors && formData.confluence_factors.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {formData.confluence_factors.length} {t('analytics:tradeAnalytics.setup.confluenceCount', { defaultValue: 'facteur(s) de confluence' })}
              </p>
              <div className="flex flex-wrap gap-2">
                {formData.confluence_factors.map((factor, index) => (
                  <div
                    key={index}
                    className="inline-flex items-center bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-3 py-1 rounded-full text-sm"
                  >
                    <span>{factor}</span>
                    <button
                      type="button"
                      onClick={() => removeConfluence(index)}
                      className="ml-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 focus:outline-none"
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

      {/* Qualité et Timing */}
      <div className={sectionClassName}>
        <h3 className={sectionTitleClassName}>{t('analytics:tradeAnalytics.setup.qualityTiming', { defaultValue: 'Qualité et Timing' })}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClassName}>
              {t('analytics:tradeAnalytics.setup.quality')} <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.setup_quality}
              onChange={(e) => handleChange('setup_quality', e.target.value as SetupQuality)}
              className={selectClassName}
              required
            >
              <option value="A">{t('analytics:setupQuality.A', { defaultValue: 'A - Excellent' })}</option>
              <option value="B">{t('analytics:setupQuality.B', { defaultValue: 'B - Good' })}</option>
              <option value="C">{t('analytics:setupQuality.C', { defaultValue: 'C - Average' })}</option>
              <option value="D">{t('analytics:setupQuality.D', { defaultValue: 'D - Poor' })}</option>
              <option value="F">{t('analytics:setupQuality.F', { defaultValue: 'F - Very Poor' })}</option>
            </select>
          </div>

          <div>
            <label className={labelClassName}>
              {t('analytics:tradeAnalytics.setup.confidence')}
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={formData.setup_confidence || ''}
              onChange={(e) => handleChange('setup_confidence', e.target.value ? parseInt(e.target.value) : undefined)}
              className={inputClassName}
              placeholder="1-10"
            />
          </div>

          <div>
            <label className={labelClassName}>
              {t('analytics:tradeAnalytics.setup.entryTiming')}
            </label>
            <select
              value={formData.entry_timing || ''}
              onChange={(e) => handleChange('entry_timing', e.target.value as EntryTiming || undefined)}
              className={selectClassName}
            >
              <option value="">-- {t('common:select', { defaultValue: 'Sélectionner' })} --</option>
              <option value="early">{t('analytics:entryTiming.early', { defaultValue: 'Early' })}</option>
              <option value="optimal">{t('analytics:entryTiming.optimal', { defaultValue: 'Optimal' })}</option>
              <option value="late">{t('analytics:entryTiming.late', { defaultValue: 'Late' })}</option>
              <option value="missed">{t('analytics:entryTiming.missed', { defaultValue: 'Missed' })}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Analyse du Setup (pour détection des biais) */}
      <div className={sectionClassName}>
        <h3 className={sectionTitleClassName}>{t('analytics:tradeAnalytics.setup.analysis', { defaultValue: 'Analyse du Setup' })}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClassName}>
              {t('analytics:tradeAnalytics.setup.entryInRange', { defaultValue: 'Position d\'entrée dans le range (%)' })}
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={formData.entry_in_range_percentage || ''}
              onChange={(e) => handleChange('entry_in_range_percentage', e.target.value ? parseFloat(e.target.value) : undefined)}
              className={inputClassName}
              placeholder="Ex: 75"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t('analytics:tradeAnalytics.setup.entryInRangeHelp', { defaultValue: '0% = bas du range, 100% = haut du range' })}
            </p>
          </div>

          <div>
            <label className={labelClassName}>
              {t('analytics:tradeAnalytics.setup.plannedHoldDuration', { defaultValue: 'Durée prévue en position (min)' })}
            </label>
            <input
              type="number"
              min="1"
              value={formData.planned_hold_duration || ''}
              onChange={(e) => handleChange('planned_hold_duration', e.target.value ? parseInt(e.target.value) : undefined)}
              className={inputClassName}
              placeholder="Ex: 15"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="missed_better_entry"
              checked={formData.missed_better_entry}
              onChange={(e) => handleChange('missed_better_entry', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="missed_better_entry" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              {t('analytics:tradeAnalytics.setup.missedBetterEntry', { defaultValue: 'Meilleure entrée ratée ?' })}
            </label>
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
          {t('common:next', { defaultValue: 'Suivant' })}
        </button>
        </div>
      </div>
    </form>
  );
};

export default TradeSetupForm;
