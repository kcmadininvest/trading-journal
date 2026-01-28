import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { DateInput } from './DateInput';
import { CustomSelect } from './CustomSelect';

export type PeriodPreset = 
  | 'today'
  | 'thisWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'last3Months'
  | 'last6Months'
  | 'thisYear'
  | 'lastYear'
  | 'custom';

export interface PeriodRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  preset?: PeriodPreset;
}

interface PeriodSelectorProps {
  value: PeriodRange | null;
  onChange: (range: PeriodRange) => void;
  className?: string;
}

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  value,
  onChange,
  className = '',
}) => {
  const { t } = useI18nTranslation();

  // Calculer les périodes prédéfinies
  const presets = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Cette semaine (lundi à aujourd'hui)
    const thisWeekStart = new Date(today);
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Ajuster pour lundi
    thisWeekStart.setDate(diff);
    
    // Ce mois
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Mois dernier
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    
    // 3 derniers mois
    const last3MonthsStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    
    // 6 derniers mois
    const last6MonthsStart = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    
    // Cette année
    const thisYearStart = new Date(now.getFullYear(), 0, 1);
    
    // Année dernière
    const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
    const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);

    const formatDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return {
      today: {
        start: formatDate(today),
        end: formatDate(today),
        preset: 'today' as PeriodPreset,
      },
      thisWeek: {
        start: formatDate(thisWeekStart),
        end: formatDate(today),
        preset: 'thisWeek' as PeriodPreset,
      },
      thisMonth: {
        start: formatDate(thisMonthStart),
        end: formatDate(today),
        preset: 'thisMonth' as PeriodPreset,
      },
      lastMonth: {
        start: formatDate(lastMonthStart),
        end: formatDate(lastMonthEnd),
        preset: 'lastMonth' as PeriodPreset,
      },
      last3Months: {
        start: formatDate(last3MonthsStart),
        end: formatDate(today),
        preset: 'last3Months' as PeriodPreset,
      },
      last6Months: {
        start: formatDate(last6MonthsStart),
        end: formatDate(today),
        preset: 'last6Months' as PeriodPreset,
      },
      thisYear: {
        start: formatDate(thisYearStart),
        end: formatDate(today),
        preset: 'thisYear' as PeriodPreset,
      },
      lastYear: {
        start: formatDate(lastYearStart),
        end: formatDate(lastYearEnd),
        preset: 'lastYear' as PeriodPreset,
      },
    };
  }, []);

  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customStart, setCustomStart] = useState(value?.start || presets.today.start);
  const [customEnd, setCustomEnd] = useState(value?.end || presets.today.end);

  const presetOptions = useMemo(() => [
    { key: 'today', label: t('dashboard:periodPresets.today', { defaultValue: "Aujourd'hui" }) },
    { key: 'thisWeek', label: t('dashboard:periodPresets.thisWeek', { defaultValue: 'Cette semaine' }) },
    { key: 'thisMonth', label: t('dashboard:periodPresets.thisMonth', { defaultValue: 'Ce mois' }) },
    { key: 'lastMonth', label: t('dashboard:periodPresets.lastMonth', { defaultValue: 'Mois dernier' }) },
    { key: 'last3Months', label: t('dashboard:periodPresets.last3Months', { defaultValue: '3 derniers mois' }) },
    { key: 'last6Months', label: t('dashboard:periodPresets.last6Months', { defaultValue: '6 derniers mois' }) },
    { key: 'thisYear', label: t('dashboard:periodPresets.thisYear', { defaultValue: 'Cette année' }) },
    { key: 'lastYear', label: t('dashboard:periodPresets.lastYear', { defaultValue: 'Année dernière' }) },
    { key: 'custom', label: t('dashboard:periodPresets.custom', { defaultValue: 'Personnalisé' }) },
  ], [t]);

  // Options pour le CustomSelect
  const selectOptions = useMemo(() => {
    return presetOptions.map(option => ({
      value: option.key,
      label: option.label,
    }));
  }, [presetOptions]);

  // Trouver la clé de la période active
  const getActivePresetKey = (): string | null => {
    if (!value) return null;
    
    // Vérifier si c'est une période prédéfinie
    for (const option of presetOptions) {
      if (option.key !== 'custom') {
        const preset = presets[option.key as keyof typeof presets];
        if (preset && value.start === preset.start && value.end === preset.end) {
          return option.key;
        }
      }
    }
    
    // Si c'est une période personnalisée
    return 'custom';
  };

  const activePresetKey = getActivePresetKey();

  const handlePresetChange = (presetKey: string | null) => {
    if (!presetKey) return;
    
    if (presetKey === 'custom') {
      // Ouvrir la modale
      setShowCustomModal(true);
      // Si on a déjà une période personnalisée, l'utiliser
      if (value && (value.preset === 'custom' || (!value.preset && !Object.values(presets).some(p => p.start === value.start && p.end === value.end)))) {
        setCustomStart(value.start);
        setCustomEnd(value.end);
      } else {
        // Sinon, initialiser à aujourd'hui pour les deux dates
        const now = new Date();
        const formatDate = (date: Date): string => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        const today = formatDate(now);
        setCustomStart(today);
        setCustomEnd(today);
      }
    } else {
      onChange(presets[presetKey as keyof typeof presets]);
    }
  };

  const handleCustomApply = () => {
    if (customStart && customEnd && customStart <= customEnd) {
      onChange({
        start: customStart,
        end: customEnd,
        preset: 'custom',
      });
      setShowCustomModal(false);
    }
  };

  const handleCustomCancel = () => {
    setShowCustomModal(false);
    // Réinitialiser aux valeurs actuelles
    if (value) {
      setCustomStart(value.start);
      setCustomEnd(value.end);
    }
  };

  // Empêcher le scroll du body quand la modale est ouverte
  useEffect(() => {
    if (showCustomModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showCustomModal]);

  // Mettre à jour le label pour les périodes personnalisées dans le select
  const selectOptionsWithCustomLabel = useMemo(() => {
    return selectOptions.map(option => {
      if (option.value === 'custom' && value && activePresetKey === 'custom') {
        // Afficher les dates pour la période personnalisée
        const startDate = new Date(value.start);
        const endDate = new Date(value.end);
        const formatDate = (date: Date) => {
          return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
        };
        return {
          ...option,
          label: `${formatDate(startDate)} - ${formatDate(endDate)}`,
        };
      }
      return option;
    });
  }, [selectOptions, value, activePresetKey]);

  // Mettre à jour les dates personnalisées quand la valeur change
  React.useEffect(() => {
    if (value && (value.preset === 'custom' || !value.preset)) {
      const isCustom = !Object.values(presets).some(p => p.start === value.start && p.end === value.end);
      if (isCustom) {
        setCustomStart(value.start);
        setCustomEnd(value.end);
      }
    }
  }, [value, presets]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleCustomCancel();
    }
  };

  return (
    <div className={className}>
      <CustomSelect
        value={activePresetKey}
        onChange={(val) => handlePresetChange(val as string | null)}
        options={selectOptionsWithCustomLabel}
        placeholder={t('dashboard:period.select', { defaultValue: 'Sélectionner une période' })}
      />
      
      {/* Modale pour le sélecteur de période personnalisée */}
      {showCustomModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
          onClick={handleBackdropClick}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 animate-in zoom-in-95 slide-in-from-bottom-4 border border-gray-100 dark:border-gray-700 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {t('dashboard:period.custom', { defaultValue: 'Période personnalisée' })}
                </h2>
                <button
                  type="button"
                  onClick={handleCustomCancel}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('dashboard:period.startDate', { defaultValue: 'Date de début' })}
                  </label>
                  <DateInput
                    value={customStart}
                    onChange={setCustomStart}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    max={customEnd || undefined}
                  />
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('dashboard:period.endDate', { defaultValue: 'Date de fin' })}
                  </label>
                  <DateInput
                    value={customEnd}
                    onChange={setCustomEnd}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    min={customStart || undefined}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-2 justify-end flex-shrink-0">
              <button
                type="button"
                onClick={handleCustomCancel}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors text-sm font-medium"
              >
                {t('dashboard:period.cancel', { defaultValue: 'Annuler' })}
              </button>
              <button
                type="button"
                onClick={handleCustomApply}
                disabled={!customStart || !customEnd || customStart > customEnd}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {t('dashboard:period.apply', { defaultValue: 'Appliquer' })}
              </button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
};

