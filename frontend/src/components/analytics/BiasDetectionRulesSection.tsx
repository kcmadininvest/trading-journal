import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw, Save, Info } from 'lucide-react';
import { BiasThresholds } from '../../types/analytics';
import biasThresholdsService from '../../services/biasThresholdsService';

const buttonPrimaryClassName = "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2";
const buttonSecondaryClassName = "px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2";

interface BiasDetectionRulesSectionProps {
  onThresholdsChange?: (thresholds: BiasThresholds) => void;
}

const BiasDetectionRulesSection: React.FC<BiasDetectionRulesSectionProps> = ({ onThresholdsChange }) => {
  const { t } = useTranslation(['analytics']);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [thresholds, setThresholds] = useState<BiasThresholds | null>(null);
  const [defaults, setDefaults] = useState<BiasThresholds | null>(null);
  const [activeBiasTab, setActiveBiasTab] = useState<string>('overtrading');
  const [editedThresholds, setEditedThresholds] = useState<Partial<BiasThresholds>>({});

  useEffect(() => {
    loadThresholds();
  }, []);

  const loadThresholds = async () => {
    try {
      setLoading(true);
      const response = await biasThresholdsService.getThresholds();
      setThresholds(response.thresholds);
      setDefaults(response.defaults);
      setEditedThresholds(response.thresholds);
    } catch (error) {
      console.error('Erreur lors du chargement des seuils:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await biasThresholdsService.updateThresholds(editedThresholds);
      await loadThresholds();
      if (onThresholdsChange && thresholds) {
        onThresholdsChange(thresholds);
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (window.confirm(t('analytics:biasRules.resetConfirm'))) {
      try {
        setSaving(true);
        await biasThresholdsService.resetThresholds();
        await loadThresholds();
        if (onThresholdsChange && defaults) {
          onThresholdsChange(defaults);
        }
      } catch (error) {
        console.error('Erreur lors de la réinitialisation:', error);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleThresholdChange = (biasType: keyof BiasThresholds, key: string, value: number) => {
    setEditedThresholds(prev => ({
      ...prev,
      [biasType]: {
        ...(prev[biasType] || {}),
        [key]: value
      }
    }));
  };


  if (loading || !thresholds || !defaults) {
    return <div className="text-center py-4">{t('analytics:loadingData')}</div>;
  }

  const biasInfo = {
    overtrading: {
      title: t('analytics:biasRules.biases.overtrading.title'),
      explanation: t('analytics:biasRules.biases.overtrading.explanation'),
      fields: [
        { key: 'min_days', label: t('analytics:biasRules.biases.overtrading.minDays'), description: t('analytics:biasRules.biases.overtrading.minDaysDesc') },
        { key: 'min_trades_per_day', label: t('analytics:biasRules.biases.overtrading.minTradesPerDay'), description: t('analytics:biasRules.biases.overtrading.minTradesPerDayDesc') },
        { key: 'high_severity_threshold', label: t('analytics:biasRules.biases.overtrading.highSeverityThreshold'), description: t('analytics:biasRules.biases.overtrading.highSeverityThresholdDesc') }
      ]
    },
    revenge_trading: {
      title: t('analytics:biasRules.biases.revengeTrading.title'),
      explanation: t('analytics:biasRules.biases.revengeTrading.explanation'),
      fields: [
        { key: 'min_occurrences', label: t('analytics:biasRules.biases.revengeTrading.minOccurrences'), description: t('analytics:biasRules.biases.revengeTrading.minOccurrencesDesc') },
        { key: 'quick_trade_minutes', label: t('analytics:biasRules.biases.revengeTrading.quickTradeMinutes'), description: t('analytics:biasRules.biases.revengeTrading.quickTradeMinutesDesc') }
      ]
    },
    fomo: {
      title: t('analytics:biasRules.biases.fomo.title'),
      explanation: t('analytics:biasRules.biases.fomo.explanation'),
      fields: [
        { key: 'min_occurrences', label: t('analytics:biasRules.biases.fomo.minOccurrences'), description: t('analytics:biasRules.biases.fomo.minOccurrencesDesc') },
        { key: 'entry_range_threshold', label: t('analytics:biasRules.biases.fomo.entryRangeThreshold'), description: t('analytics:biasRules.biases.fomo.entryRangeThresholdDesc') }
      ]
    },
    loss_aversion: {
      title: t('analytics:biasRules.biases.lossAversion.title'),
      explanation: t('analytics:biasRules.biases.lossAversion.explanation'),
      fields: [
        { key: 'min_occurrences', label: t('analytics:biasRules.biases.lossAversion.minOccurrences'), description: t('analytics:biasRules.biases.lossAversion.minOccurrencesDesc') }
      ]
    },
    premature_exit: {
      title: t('analytics:biasRules.biases.prematureExit.title'),
      explanation: t('analytics:biasRules.biases.prematureExit.explanation'),
      fields: [
        { key: 'min_occurrences', label: t('analytics:biasRules.biases.prematureExit.minOccurrences'), description: t('analytics:biasRules.biases.prematureExit.minOccurrencesDesc') },
        { key: 'rr_threshold', label: t('analytics:biasRules.biases.prematureExit.rrThreshold'), description: t('analytics:biasRules.biases.prematureExit.rrThresholdDesc') }
      ]
    },
    stop_loss_widening: {
      title: t('analytics:biasRules.biases.stopLossWidening.title'),
      explanation: t('analytics:biasRules.biases.stopLossWidening.explanation'),
      fields: [
        { key: 'min_occurrences', label: t('analytics:biasRules.biases.stopLossWidening.minOccurrences'), description: t('analytics:biasRules.biases.stopLossWidening.minOccurrencesDesc') }
      ]
    }
  };

  const currentBiasInfo = biasInfo[activeBiasTab as keyof typeof biasInfo];
  const currentThresholds = editedThresholds[activeBiasTab as keyof BiasThresholds] || thresholds[activeBiasTab as keyof BiasThresholds];
  const defaultThresholds = defaults[activeBiasTab as keyof BiasThresholds];

  return (
    <div className="space-y-4">
      {/* Header avec info et boutons */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('analytics:biasRules.helpText')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            disabled={saving}
            className={`${buttonSecondaryClassName} flex items-center gap-2`}
          >
            <RotateCcw className="w-4 h-4" />
            {t('analytics:biasRules.reset')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`${buttonPrimaryClassName} flex items-center gap-2`}
          >
            <Save className="w-4 h-4" />
            {saving ? t('analytics:biasRules.saving') : t('analytics:biasRules.save')}
          </button>
        </div>
      </div>

      {/* Onglets des biais */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex space-x-1 overflow-x-auto scrollbar-hide">
          {Object.entries(biasInfo).map(([biasType, info]) => (
            <button
              key={biasType}
              onClick={() => setActiveBiasTab(biasType)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                activeBiasTab === biasType
                  ? 'bg-blue-600 dark:bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {info.title}
            </button>
          ))}
        </div>
      </div>

      {/* Contenu de l'onglet actif */}
      <div className="space-y-4 pt-4">
        {/* Explication du biais */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-semibold">📖 Explication : </span>
            {currentBiasInfo.explanation}
          </p>
        </div>

        {/* Critères de détection */}
        <div className="space-y-4">
          <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Critères de détection</h4>
          {currentBiasInfo.fields.map(field => (
            <div key={field.key} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {field.label}
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{field.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  step={field.key.includes('threshold') && field.key.includes('rr') ? '0.1' : '1'}
                  value={currentThresholds[field.key as keyof typeof currentThresholds] || 0}
                  onChange={(e) => handleThresholdChange(
                    activeBiasTab as keyof BiasThresholds,
                    field.key,
                    parseFloat(e.target.value)
                  )}
                  className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({t('analytics:biasRules.default')}: {defaultThresholds[field.key as keyof typeof defaultThresholds]})
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BiasDetectionRulesSection;
