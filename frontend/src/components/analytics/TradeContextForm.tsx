import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TradeContextFormData,
  TrendType,
  FibonacciLevel,
  MarketStructure,
  RangePosition,
  VolumeProfile,
  MacdSignal,
} from '../../types/analytics';
import {
  inputClassName,
  selectClassName,
  labelClassName,
  sectionClassName,
  sectionTitleClassName,
  buttonPrimaryClassName,
  buttonSecondaryClassName,
  checkboxLabelClassName,
} from './formStyles';

interface TradeContextFormProps {
  initialData?: Partial<TradeContextFormData>;
  onSubmit: (data: TradeContextFormData) => void;
  onChange?: (data: TradeContextFormData) => void;
  onCancel?: () => void;
}

const TradeContextForm: React.FC<TradeContextFormProps> = ({
  initialData = {},
  onSubmit,
  onChange,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<TradeContextFormData>({
    trend_m1: initialData.trend_m1,
    trend_m2: initialData.trend_m2,
    trend_m5: initialData.trend_m5,
    trend_m15: initialData.trend_m15,
    trend_m30: initialData.trend_m30,
    trend_h1: initialData.trend_h1,
    trend_h4: initialData.trend_h4,
    trend_daily: initialData.trend_daily,
    trend_weekly: initialData.trend_weekly,
    fibonacci_level: initialData.fibonacci_level || 'none',
    at_support_resistance: initialData.at_support_resistance || false,
    distance_from_key_level: initialData.distance_from_key_level,
    market_structure: initialData.market_structure,
    break_of_structure: initialData.break_of_structure || false,
    within_previous_day_range: initialData.within_previous_day_range || false,
    range_position: initialData.range_position,
    atr_percentile: initialData.atr_percentile,
    volume_profile: initialData.volume_profile,
    at_volume_node: initialData.at_volume_node || false,
    rsi_value: initialData.rsi_value,
    macd_signal: initialData.macd_signal,
  });

  // Timeframes disponibles
  const availableTimeframes = [
    { value: 'trend_m1', label: 'M1 (1 minute)' },
    { value: 'trend_m2', label: 'M2 (2 minutes)' },
    { value: 'trend_m5', label: 'M5 (5 minutes)' },
    { value: 'trend_m15', label: 'M15 (15 minutes)' },
    { value: 'trend_m30', label: 'M30 (30 minutes)' },
    { value: 'trend_h1', label: 'H1 (1 heure)' },
    { value: 'trend_h4', label: 'H4 (4 heures)' },
    { value: 'trend_daily', label: 'Daily (Journalier)' },
    { value: 'trend_weekly', label: 'Weekly (Hebdomadaire)' },
  ];

  // Timeframes actifs (ceux qui ont une valeur)
  const [activeTimeframes, setActiveTimeframes] = useState<string[]>(() => {
    const active: string[] = [];
    if (initialData.trend_m1) active.push('trend_m1');
    if (initialData.trend_m2) active.push('trend_m2');
    if (initialData.trend_m5) active.push('trend_m5');
    if (initialData.trend_m15) active.push('trend_m15');
    if (initialData.trend_m30) active.push('trend_m30');
    if (initialData.trend_h1) active.push('trend_h1');
    if (initialData.trend_h4) active.push('trend_h4');
    if (initialData.trend_daily) active.push('trend_daily');
    if (initialData.trend_weekly) active.push('trend_weekly');
    return active.length > 0 ? active : ['trend_h1', 'trend_m15', 'trend_m5']; // Par défaut
  });

  // Mettre à jour activeTimeframes seulement au premier chargement
  const [isInitialized, setIsInitialized] = useState(false);
  
  useEffect(() => {
    // Ne mettre à jour que si on n'a pas encore initialisé ET qu'on a des données
    if (!isInitialized && initialData && Object.keys(initialData).length > 0) {
      const active: string[] = [];
      if (initialData.trend_m1) active.push('trend_m1');
      if (initialData.trend_m2) active.push('trend_m2');
      if (initialData.trend_m5) active.push('trend_m5');
      if (initialData.trend_m15) active.push('trend_m15');
      if (initialData.trend_m30) active.push('trend_m30');
      if (initialData.trend_h1) active.push('trend_h1');
      if (initialData.trend_h4) active.push('trend_h4');
      if (initialData.trend_daily) active.push('trend_daily');
      if (initialData.trend_weekly) active.push('trend_weekly');
      
      if (active.length > 0) {
        setActiveTimeframes(active);
        setIsInitialized(true);
      }
    }
  }, [initialData, isInitialized]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Vérifier qu'au moins un timeframe a une valeur
    const hasTimeframe = activeTimeframes.some(tf => {
      const value = (formData as any)[tf];
      return value && value !== '';
    });

    if (!hasTimeframe) {
      newErrors.timeframes = t('analytics:tradeAnalytics.context.atLeastOneTimeframe', { defaultValue: 'Au moins un timeframe doit être sélectionné et renseigné' });
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

  const handleChange = (field: keyof TradeContextFormData, value: any) => {
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    onChange?.(newData);
  };

  const addTimeframe = (timeframe: string) => {
    if (!activeTimeframes.includes(timeframe)) {
      setActiveTimeframes([...activeTimeframes, timeframe]);
      // Initialiser la valeur à undefined pour que le select soit vide
      // L'utilisateur devra sélectionner une valeur
      const newData = { ...formData, [timeframe]: undefined };
      setFormData(newData);
      onChange?.(newData);
    }
  };

  const removeTimeframe = (timeframe: string) => {
    setActiveTimeframes(activeTimeframes.filter(tf => tf !== timeframe));
    // Mettre null pour supprimer la valeur du timeframe
    handleChange(timeframe as keyof TradeContextFormData, null);
  };

  const renderTrendOptions = () => (
    <>
      <option value="">-- {t('common:select', { defaultValue: 'Sélectionner' })} --</option>
      <option value="bullish">{t('analytics:trends.bullish', { defaultValue: 'Bullish' })}</option>
      <option value="bearish">{t('analytics:trends.bearish', { defaultValue: 'Bearish' })}</option>
      <option value="ranging">{t('analytics:trends.ranging', { defaultValue: 'Ranging' })}</option>
      <option value="unclear">{t('analytics:trends.unclear', { defaultValue: 'Unclear' })}</option>
    </>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Tendances Multi-Timeframe */}
      <div className={sectionClassName}>
        <div className="flex justify-between items-center mb-4">
          <h3 className={sectionTitleClassName + " mb-0"}>
            {t('analytics:tradeAnalytics.context.multiTimeframe')} <span className="text-red-500">*</span>
            <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-2">({t('analytics:tradeAnalytics.context.atLeastOne', { defaultValue: 'au moins 1 requis' })})</span>
          </h3>
          <select
            onChange={(e) => {
              if (e.target.value) {
                addTimeframe(e.target.value);
                e.target.value = '';
              }
            }}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">+ {t('analytics:tradeAnalytics.context.addTimeframe', { defaultValue: 'Ajouter un timeframe' })}</option>
            {availableTimeframes
              .filter(tf => !activeTimeframes.includes(tf.value))
              .map(tf => (
                <option key={tf.value} value={tf.value}>
                  {tf.label}
                </option>
              ))}
          </select>
        </div>
        
        {errors.timeframes && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{errors.timeframes}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeTimeframes.map(timeframe => {
            const tf = availableTimeframes.find(t => t.value === timeframe);
            if (!tf) return null;
            
            return (
              <div key={timeframe} className="relative">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {tf.label}
                  </label>
                  <button
                    type="button"
                    onClick={() => removeTimeframe(timeframe)}
                    className="px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:text-white hover:bg-red-600 dark:hover:bg-red-500 border border-red-600 dark:border-red-400 rounded transition-colors"
                    title={t('common:delete', { defaultValue: 'Supprimer' })}
                  >
                    {t('common:delete', { defaultValue: 'Supprimer' })}
                  </button>
                </div>
                <select
                  value={(formData as any)[timeframe] || ''}
                  onChange={(e) => handleChange(timeframe as keyof TradeContextFormData, e.target.value as TrendType || undefined)}
                  className={selectClassName}
                >
                  {renderTrendOptions()}
                </select>
              </div>
            );
          })}
        </div>

        {activeTimeframes.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
            {t('analytics:tradeAnalytics.context.noTimeframe', { defaultValue: 'Aucun timeframe sélectionné. Utilisez le menu déroulant ci-dessus pour ajouter des timeframes.' })}
          </p>
        )}
      </div>

      {/* Niveaux Techniques */}
      <div className={sectionClassName}>
        <h3 className={sectionTitleClassName}>{t('analytics:tradeAnalytics.context.technicalLevels')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClassName}>
              {t('analytics:tradeAnalytics.context.fibonacciLevel')}
            </label>
            <select
              value={formData.fibonacci_level || 'none'}
              onChange={(e) => handleChange('fibonacci_level', e.target.value as FibonacciLevel)}
              className={selectClassName}
            >
              <option value="none">{t('common:none', { defaultValue: 'Aucun' })}</option>
              <option value="23.6">23.6%</option>
              <option value="38.2">38.2%</option>
              <option value="50">50%</option>
              <option value="61.8">61.8%</option>
              <option value="78.6">78.6%</option>
            </select>
          </div>

          <div>
            <label className={labelClassName}>
              {t('analytics:tradeAnalytics.context.distanceFromKeyLevel')}
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.distance_from_key_level || ''}
              onChange={(e) => handleChange('distance_from_key_level', e.target.value ? parseFloat(e.target.value) : undefined)}
              className={inputClassName}
              placeholder="Ex: 10.5"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="at_support_resistance"
              checked={formData.at_support_resistance}
              onChange={(e) => handleChange('at_support_resistance', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="at_support_resistance" className={checkboxLabelClassName}>
              {t('analytics:tradeAnalytics.context.atSupportResistance')}
            </label>
          </div>
        </div>
      </div>

      {/* Structure de Marché */}
      <div className={sectionClassName}>
        <h3 className={sectionTitleClassName}>{t('analytics:tradeAnalytics.context.marketStructure')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClassName}>
              {t('analytics:tradeAnalytics.context.marketStructureType')}
            </label>
            <select
              value={formData.market_structure || ''}
              onChange={(e) => handleChange('market_structure', e.target.value as MarketStructure || undefined)}
              className={selectClassName}
            >
              <option value="">-- {t('common:select', { defaultValue: 'Sélectionner' })} --</option>
              <option value="higher_highs">{t('analytics:marketStructure.higherHighs', { defaultValue: 'Higher Highs' })}</option>
              <option value="lower_lows">{t('analytics:marketStructure.lowerLows', { defaultValue: 'Lower Lows' })}</option>
              <option value="consolidation">{t('analytics:marketStructure.consolidation', { defaultValue: 'Consolidation' })}</option>
            </select>
          </div>

          <div>
            <label className={labelClassName}>
              {t('analytics:tradeAnalytics.context.rangePosition')}
            </label>
            <select
              value={formData.range_position || ''}
              onChange={(e) => handleChange('range_position', e.target.value as RangePosition || undefined)}
              className={selectClassName}
            >
              <option value="">-- {t('common:select', { defaultValue: 'Sélectionner' })} --</option>
              <option value="top_third">{t('analytics:rangePosition.topThird', { defaultValue: 'Top Third' })}</option>
              <option value="middle_third">{t('analytics:rangePosition.middleThird', { defaultValue: 'Middle Third' })}</option>
              <option value="bottom_third">{t('analytics:rangePosition.bottomThird', { defaultValue: 'Bottom Third' })}</option>
            </select>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="break_of_structure"
              checked={formData.break_of_structure}
              onChange={(e) => handleChange('break_of_structure', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="break_of_structure" className={checkboxLabelClassName}>
              {t('analytics:tradeAnalytics.context.breakOfStructure', { defaultValue: 'Break of structure' })}
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="within_previous_day_range"
              checked={formData.within_previous_day_range}
              onChange={(e) => handleChange('within_previous_day_range', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="within_previous_day_range" className={checkboxLabelClassName}>
              {t('analytics:tradeAnalytics.context.withinPreviousDayRange', { defaultValue: 'Dans le range de la veille' })}
            </label>
          </div>
        </div>
      </div>

      {/* Volume et Indicateurs */}
      <div className={sectionClassName}>
        <h3 className={sectionTitleClassName}>{t('analytics:tradeAnalytics.context.volumeIndicators', { defaultValue: 'Volume et Indicateurs' })}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClassName}>
              {t('analytics:tradeAnalytics.context.volumeProfile')}
            </label>
            <select
              value={formData.volume_profile || ''}
              onChange={(e) => handleChange('volume_profile', e.target.value as VolumeProfile || undefined)}
              className={selectClassName}
            >
              <option value="">-- {t('common:select', { defaultValue: 'Sélectionner' })} --</option>
              <option value="high">{t('analytics:volumeProfile.high', { defaultValue: 'High' })}</option>
              <option value="medium">{t('analytics:volumeProfile.medium', { defaultValue: 'Medium' })}</option>
              <option value="low">{t('analytics:volumeProfile.low', { defaultValue: 'Low' })}</option>
            </select>
          </div>

          <div>
            <label className={labelClassName}>
              RSI
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={formData.rsi_value || ''}
              onChange={(e) => handleChange('rsi_value', e.target.value ? parseInt(e.target.value) : undefined)}
              className={inputClassName}
              placeholder="0-100"
            />
          </div>

          <div>
            <label className={labelClassName}>
              Signal MACD
            </label>
            <select
              value={formData.macd_signal || ''}
              onChange={(e) => handleChange('macd_signal', e.target.value as MacdSignal || undefined)}
              className={selectClassName}
            >
              <option value="">-- {t('common:select', { defaultValue: 'Sélectionner' })} --</option>
              <option value="bullish">{t('analytics:trends.bullish', { defaultValue: 'Bullish' })}</option>
              <option value="bearish">{t('analytics:trends.bearish', { defaultValue: 'Bearish' })}</option>
              <option value="neutral">{t('analytics:trends.neutral', { defaultValue: 'Neutral' })}</option>
            </select>
          </div>

          <div>
            <label className={labelClassName}>
              ATR Percentile
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={formData.atr_percentile || ''}
              onChange={(e) => handleChange('atr_percentile', e.target.value ? parseInt(e.target.value) : undefined)}
              className={inputClassName}
              placeholder="0-100"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="at_volume_node"
              checked={formData.at_volume_node}
              onChange={(e) => handleChange('at_volume_node', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="at_volume_node" className={checkboxLabelClassName}>
              {t('analytics:tradeAnalytics.context.atVolumeNode', { defaultValue: 'Au nœud de volume' })}
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

export default TradeContextForm;
