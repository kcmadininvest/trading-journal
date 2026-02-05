import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { DateInput } from './DateInput';

export type PeriodPreset = 
  | 'today'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'last3Months'
  | 'last6Months'
  | 'thisYear'
  | 'lastYear'
  | 'rollingYear'
  | 'allTime'
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

// Boutons rapides visibles (pill buttons) — les plus courants pour le trading
const QUICK_PRESETS: PeriodPreset[] = ['thisWeek', 'thisMonth', 'last3Months', 'last6Months', 'thisYear', 'rollingYear', 'allTime'];

// Presets dans le dropdown "Plus" — moins courants
const MORE_PRESETS: PeriodPreset[] = ['today', 'lastWeek', 'lastMonth', 'lastYear'];


export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  value,
  onChange,
  className = '',
}) => {
  const { t, i18n } = useI18nTranslation();
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const moreDropdownRef = useRef<HTMLDivElement>(null);
  const [showMore, setShowMore] = useState(false);
  const [morePosition, setMorePosition] = useState({ top: 0, left: 0 });

  // Calculer les périodes prédéfinies
  const presets = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Cette semaine (lundi à aujourd'hui)
    const thisWeekStart = new Date(today);
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Ajuster pour lundi
    thisWeekStart.setDate(diff);
    
    // Semaine dernière (lundi à dimanche)
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(lastWeekStart);
    lastWeekEnd.setDate(lastWeekEnd.getDate() + 6);
    
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
    
    // Année glissante (12 derniers mois)
    const rollingYearStart = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());

    // Tout (depuis 2000-01-01)
    const allTimeStart = new Date(2000, 0, 1);

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
      lastWeek: {
        start: formatDate(lastWeekStart),
        end: formatDate(lastWeekEnd),
        preset: 'lastWeek' as PeriodPreset,
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
      rollingYear: {
        start: formatDate(rollingYearStart),
        end: formatDate(today),
        preset: 'rollingYear' as PeriodPreset,
      },
      allTime: {
        start: formatDate(allTimeStart),
        end: formatDate(today),
        preset: 'allTime' as PeriodPreset,
      },
    };
  }, []);

  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customStart, setCustomStart] = useState(value?.start || presets.today.start);
  const [customEnd, setCustomEnd] = useState(value?.end || presets.today.end);

  // Labels complets pour le dropdown "Plus"
  const fullLabels = useMemo(() => ({
    today: t('dashboard:periodPresets.today', { defaultValue: "Aujourd'hui" }),
    thisWeek: t('dashboard:periodPresets.thisWeek', { defaultValue: 'Cette semaine' }),
    lastWeek: t('dashboard:periodPresets.lastWeek', { defaultValue: 'Semaine dernière' }),
    thisMonth: t('dashboard:periodPresets.thisMonth', { defaultValue: 'Ce mois' }),
    lastMonth: t('dashboard:periodPresets.lastMonth', { defaultValue: 'Mois dernier' }),
    last3Months: t('dashboard:periodPresets.last3Months', { defaultValue: '3 derniers mois' }),
    last6Months: t('dashboard:periodPresets.last6Months', { defaultValue: '6 derniers mois' }),
    thisYear: t('dashboard:periodPresets.thisYear', { defaultValue: 'Cette année' }),
    lastYear: t('dashboard:periodPresets.lastYear', { defaultValue: 'Année dernière' }),
    rollingYear: t('dashboard:periodPresets.rollingYear', { defaultValue: 'Année glissante' }),
    allTime: t('dashboard:periodPresets.allTime', { defaultValue: 'Depuis le début' }),
    custom: t('dashboard:periodPresets.custom', { defaultValue: 'Personnalisé' }),
  }), [t]);

  // Labels courts pour les pill buttons
  const shortLabels = useMemo(() => ({
    thisWeek: t('dashboard:periodShort.1W', { defaultValue: '1S' }),
    thisMonth: t('dashboard:periodShort.1M', { defaultValue: '1M' }),
    last3Months: t('dashboard:periodShort.3M', { defaultValue: '3M' }),
    last6Months: t('dashboard:periodShort.6M', { defaultValue: '6M' }),
    thisYear: t('dashboard:periodShort.YTD', { defaultValue: 'YTD' }),
    rollingYear: t('dashboard:periodShort.1Y', { defaultValue: '1A' }),
    allTime: t('dashboard:periodShort.all', { defaultValue: 'Tout' }),
  }), [t]);

  // Trouver la clé de la période active
  const getActivePresetKey = useCallback((): string | null => {
    if (!value) return null;
    
    // Vérifier toutes les périodes prédéfinies
    const allPresetKeys = [...QUICK_PRESETS, ...MORE_PRESETS];
    for (const key of allPresetKeys) {
      const preset = presets[key as keyof typeof presets];
      if (preset && value.start === preset.start && value.end === preset.end) {
        return key;
      }
    }
    
    // Si c'est une période personnalisée
    return 'custom';
  }, [value, presets]);

  const activePresetKey = getActivePresetKey();

  // Vérifier si le preset actif est dans le dropdown "Plus"
  const isMorePresetActive = activePresetKey !== null && MORE_PRESETS.includes(activePresetKey as PeriodPreset);

  const handlePresetChange = (presetKey: string) => {
    if (presetKey === 'custom') {
      setShowCustomModal(true);
      if (value && (value.preset === 'custom' || (!value.preset && !Object.values(presets).some(p => p.start === value.start && p.end === value.end)))) {
        setCustomStart(value.start);
        setCustomEnd(value.end);
      } else {
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
    setShowMore(false);
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

  // Mettre à jour les dates personnalisées quand la valeur change
  useEffect(() => {
    if (value && (value.preset === 'custom' || !value.preset)) {
      const isCustom = !Object.values(presets).some(p => p.start === value.start && p.end === value.end);
      if (isCustom) {
        setCustomStart(value.start);
        setCustomEnd(value.end);
      }
    }
  }, [value, presets]);

  // Position du dropdown "Plus"
  useEffect(() => {
    if (showMore && moreButtonRef.current) {
      const updatePosition = () => {
        if (moreButtonRef.current) {
          const rect = moreButtonRef.current.getBoundingClientRect();
          setMorePosition({
            top: rect.bottom + window.scrollY + 4,
            left: rect.left + window.scrollX,
          });
        }
      };
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [showMore]);

  // Fermer le dropdown "Plus" en cliquant à l'extérieur
  useEffect(() => {
    if (!showMore) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        moreButtonRef.current && !moreButtonRef.current.contains(target) &&
        moreDropdownRef.current && !moreDropdownRef.current.contains(target)
      ) {
        setShowMore(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showMore]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleCustomCancel();
    }
  };

  // Formater la date personnalisée pour l'affichage
  const formatCustomDateLabel = () => {
    if (!value) return '';
    const locale = i18n.language?.startsWith('fr') ? 'fr-FR' : 'en-US';
    const startDate = new Date(value.start);
    const endDate = new Date(value.end);
    const fmt = (date: Date) => date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    return `${fmt(startDate)} – ${fmt(endDate)}`;
  };

  // Pill button classes — aligné sur la hauteur et le style du AccountSelector (px-3 py-2 text-sm rounded-md border-gray-300)
  const pillBase = 'px-3 py-2 text-sm font-medium rounded-md transition-all duration-150 whitespace-nowrap border shadow-sm';
  const pillActive = 'bg-blue-600 text-white border-blue-600';
  const pillInactive = 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-500';

  // Dropdown "Plus" content
  const moreDropdownContent = showMore && (
    <div
      ref={moreDropdownRef}
      className="fixed z-[9999] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl py-1 min-w-[180px]"
      style={{
        top: `${morePosition.top}px`,
        left: `${morePosition.left}px`,
      }}
    >
      {MORE_PRESETS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => handlePresetChange(key)}
          className={`w-full flex items-center px-3 py-2 text-sm transition-colors ${
            activePresetKey === key
              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          {fullLabels[key as keyof typeof fullLabels]}
        </button>
      ))}
    </div>
  );

  return (
    <div className={`${className}`}>
      {/* Barre de boutons segmentés */}
      <div className="flex items-center gap-1 flex-wrap sm:flex-nowrap">
        {/* Quick preset pills */}
        {QUICK_PRESETS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => handlePresetChange(key)}
            className={`${pillBase} ${activePresetKey === key ? pillActive : pillInactive}`}
            title={fullLabels[key as keyof typeof fullLabels]}
          >
            {shortLabels[key as keyof typeof shortLabels]}
          </button>
        ))}

        {/* Séparateur vertical */}
        <div className="h-5 w-px bg-gray-200 dark:bg-gray-600 mx-0.5" />

        {/* Bouton "Plus" avec dropdown */}
        <div className="relative">
          <button
            ref={moreButtonRef}
            type="button"
            onClick={() => setShowMore(!showMore)}
            className={`${pillBase} flex items-center gap-1 ${
              isMorePresetActive ? pillActive : pillInactive
            }`}
            title={t('dashboard:periodMore', { defaultValue: 'Plus de périodes' })}
          >
            {isMorePresetActive ? fullLabels[activePresetKey as keyof typeof fullLabels] : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
                </svg>
                <span className="hidden sm:inline">{t('dashboard:periodMore', { defaultValue: 'Plus' })}</span>
              </>
            )}
            <svg className={`w-3 h-3 transition-transform ${showMore ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Séparateur vertical */}
        <div className="h-5 w-px bg-gray-200 dark:bg-gray-600 mx-0.5" />

        {/* Bouton Personnalisé avec icône calendrier */}
        <button
          type="button"
          onClick={() => handlePresetChange('custom')}
          className={`${pillBase} flex items-center gap-1 ${
            activePresetKey === 'custom' ? pillActive : pillInactive
          }`}
          title={fullLabels.custom}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {activePresetKey === 'custom' ? (
            <span className="text-xs">{formatCustomDateLabel()}</span>
          ) : (
            <span className="hidden sm:inline">{fullLabels.custom}</span>
          )}
        </button>
      </div>

      {/* Portal pour le dropdown "Plus" */}
      {showMore && typeof document !== 'undefined' && createPortal(moreDropdownContent, document.body)}
      
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
                  {t('dashboard:periodModal.custom', { defaultValue: 'Période personnalisée' })}
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
                    {t('dashboard:periodModal.startDate', { defaultValue: 'Date de début' })}
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
                    {t('dashboard:periodModal.endDate', { defaultValue: 'Date de fin' })}
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
                {t('dashboard:periodModal.cancel', { defaultValue: 'Annuler' })}
              </button>
              <button
                type="button"
                onClick={handleCustomApply}
                disabled={!customStart || !customEnd || customStart > customEnd}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {t('dashboard:periodModal.apply', { defaultValue: 'Appliquer' })}
              </button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
};
