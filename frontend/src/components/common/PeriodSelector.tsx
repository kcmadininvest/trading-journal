import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { DateInput } from './DateInput';
import Tooltip from '../ui/Tooltip';
import {
  type PeriodPreset,
  type PeriodRange,
  computePeriodPresetRanges,
} from '../../utils/periodPresetRanges';

export type { PeriodPreset, PeriodRange };

interface PeriodSelectorProps {
  value: PeriodRange | null;
  onChange: (range: PeriodRange) => void;
  className?: string;
}

/** Ordre logique : horizons courts → mois → années / historique ; personnalisé à part. */
const PERIOD_MENU_GROUPS: ReadonlyArray<{
  labelKey: string;
  labelDefault: string;
  presets: readonly PeriodPreset[];
}> = [
  {
    labelKey: 'dashboard:periodGroups.calendar',
    labelDefault: 'Jours et mois',
    presets: ['today', 'thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'last3Months', 'last6Months'],
  },
  {
    labelKey: 'dashboard:periodGroups.yearAndHistory',
    labelDefault: 'Années et historique',
    presets: ['thisYear', 'rollingYear', 'lastYear', 'allTime'],
  },
];

const ALL_PRESET_KEYS: PeriodPreset[] = PERIOD_MENU_GROUPS.flatMap((g) => [...g.presets]);

const pillTrigger =
  'inline-flex w-full min-w-0 items-center gap-2 truncate rounded-lg border px-3 py-2 text-sm font-medium shadow-sm transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:ring-offset-0 dark:focus:ring-blue-400/30';
const pillTriggerStyle =
  'border-gray-200 bg-white text-gray-900 hover:border-gray-300 hover:bg-gray-50/90 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:border-gray-500 dark:hover:bg-gray-700/70';

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({
  value,
  onChange,
  className = '',
}) => {
  const { t, i18n } = useI18nTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });

  const presets = computePeriodPresetRanges(new Date());

  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customStart, setCustomStart] = useState(value?.start || presets.today.start);
  const [customEnd, setCustomEnd] = useState(value?.end || presets.today.end);

  const fullLabels = useMemo(
    () => ({
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
    }),
    [t]
  );

  const getActivePresetKey = useCallback((): string | null => {
    if (!value) return null;
    for (const key of ALL_PRESET_KEYS) {
      const preset = presets[key as keyof typeof presets];
      if (preset && value.start === preset.start && value.end === preset.end) {
        return key;
      }
    }
    return 'custom';
  }, [value, presets]);

  const activePresetKey = getActivePresetKey();

  const formatCustomDateLabel = useCallback(() => {
    if (!value) return '';
    const locale = i18n.language?.startsWith('fr') ? 'fr-FR' : 'en-US';
    const startDate = new Date(value.start);
    const endDate = new Date(value.end);
    const fmt = (date: Date) => date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    return `${fmt(startDate)} – ${fmt(endDate)}`;
  }, [value, i18n.language]);

  const displayLabel = useMemo(() => {
    const periodFallback = t('dashboard:period', { defaultValue: 'Période' });
    if (!value) return periodFallback;
    const key = getActivePresetKey();
    if (key === 'custom') return formatCustomDateLabel() || fullLabels.custom;
    if (!key) return periodFallback;
    return fullLabels[key as keyof typeof fullLabels];
  }, [value, getActivePresetKey, formatCustomDateLabel, fullLabels, t]);

  const tooltipLabel = useMemo(() => {
    if (!value) return t('dashboard:period', { defaultValue: 'Période' });
    const key = getActivePresetKey();
    if (key === 'custom') return formatCustomDateLabel() || fullLabels.custom;
    if (!key) return t('dashboard:period', { defaultValue: 'Période' });
    return fullLabels[key as keyof typeof fullLabels];
  }, [value, getActivePresetKey, formatCustomDateLabel, fullLabels, t]);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    let w = Math.max(rect.width, 220);
    const temp = document.createElement('span');
    temp.style.cssText =
      'visibility:hidden;position:absolute;white-space:nowrap;font-size:' +
      window.getComputedStyle(buttonRef.current).fontSize +
      ';font-family:' +
      window.getComputedStyle(buttonRef.current).fontFamily;
    document.body.appendChild(temp);
    ALL_PRESET_KEYS.forEach((key) => {
      temp.textContent = fullLabels[key];
      w = Math.max(w, temp.offsetWidth + 48);
    });
    PERIOD_MENU_GROUPS.forEach((g) => {
      temp.textContent = t(g.labelKey, { defaultValue: g.labelDefault });
      w = Math.max(w, temp.offsetWidth + 48);
    });
    temp.textContent = t('dashboard:periodGroups.custom', { defaultValue: 'Plage personnalisée' });
    w = Math.max(w, temp.offsetWidth + 48);
    temp.textContent = fullLabels.custom;
    w = Math.max(w, temp.offsetWidth + 48);
    document.body.removeChild(temp);
    w = Math.min(Math.max(w, 220), 380);
    // `fixed` = repère viewport : getBoundingClientRect() sans scrollX/Y
    const margin = 8;
    const vw = window.innerWidth;
    const maxW = Math.min(w, vw - margin * 2);
    let left = rect.left;
    left = Math.max(margin, Math.min(left, vw - maxW - margin));
    const top = rect.bottom + 4;
    setMenuPos({
      top,
      left,
      width: maxW,
    });
  }, [fullLabels, t]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => updatePosition(), 0);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = e.target as Node;
      if (rootRef.current?.contains(el) || menuRef.current?.contains(el)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const handlePresetChange = (presetKey: string) => {
    setOpen(false);
    if (presetKey === 'custom') {
      setShowCustomModal(true);
      if (
        value &&
        (value.preset === 'custom' ||
          !Object.values(presets).some((p) => p.start === value.start && p.end === value.end))
      ) {
        setCustomStart(value.start);
        setCustomEnd(value.end);
      } else {
        const today = computePeriodPresetRanges(new Date()).today.start;
        setCustomStart(today);
        setCustomEnd(today);
      }
      return;
    }
    onChange(presets[presetKey as keyof typeof presets]);
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
    if (value) {
      setCustomStart(value.start);
      setCustomEnd(value.end);
    }
  };

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

  // Synchroniser les champs « personnalisé » quand la période change côté parent — pas pendant
  // l’édition du modal (sinon chaque rendu réinitialise la saisie). Ne pas dépendre de
  // `presets` (nouvel objet à chaque rendu) sinon l’effet s’exécute en boucle et bloque
  // toute nouvelle plage après la première validation.
  useEffect(() => {
    if (showCustomModal) return;
    if (!value) return;
    if (value.preset !== 'custom' && value.preset) return;

    const presetRanges = computePeriodPresetRanges(new Date());
    const isCustom =
      value.preset === 'custom' ||
      !Object.values(presetRanges).some((p) => p.start === value.start && p.end === value.end);
    if (!isCustom) return;

    setCustomStart(value.start);
    setCustomEnd(value.end);
  }, [value, showCustomModal]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleCustomCancel();
    }
  };

  const menu =
    open &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        ref={menuRef}
        role="listbox"
        aria-label={t('dashboard:period', { defaultValue: 'Période' })}
        className="fixed z-[9999] max-h-[min(24rem,70vh)] overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-gray-800"
        style={{
          top: menuPos.top,
          left: menuPos.left,
          width: menuPos.width,
          minWidth: menuPos.width,
        }}
      >
        {PERIOD_MENU_GROUPS.map((group, groupIndex) => (
          <div key={group.labelKey}>
            {groupIndex > 0 && (
              <div
                className="my-1 border-t border-gray-100 dark:border-gray-700"
                role="separator"
                aria-hidden
              />
            )}
            <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t(group.labelKey, { defaultValue: group.labelDefault })}
            </div>
            {group.presets.map((key) => (
              <button
                key={key}
                type="button"
                role="option"
                aria-selected={activePresetKey === key}
                onClick={() => handlePresetChange(key)}
                className={`flex w-full items-center px-3 py-2 text-left text-sm transition-colors ${
                  activePresetKey === key
                    ? 'bg-blue-50/90 font-medium text-blue-900 dark:bg-blue-950/45 dark:text-blue-100'
                    : 'text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <span className="min-w-0 whitespace-normal break-words">{fullLabels[key]}</span>
              </button>
            ))}
          </div>
        ))}
        <div className="my-1 border-t border-gray-100 dark:border-gray-700" role="separator" aria-hidden />
        <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t('dashboard:periodGroups.custom', { defaultValue: 'Plage personnalisée' })}
        </div>
        <button
          type="button"
          role="option"
          aria-selected={activePresetKey === 'custom'}
          onClick={() => handlePresetChange('custom')}
          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
            activePresetKey === 'custom'
              ? 'bg-blue-50/90 font-medium text-blue-900 dark:bg-blue-950/45 dark:text-blue-100'
              : 'text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="min-w-0 whitespace-normal break-words">{fullLabels.custom}</span>
        </button>
      </div>,
      document.body
    );

  return (
    <div ref={rootRef} className={`relative min-w-0 w-full max-w-full ${className}`.trim()}>
      <Tooltip content={tooltipLabel} position="top" delay={250} className="w-full min-w-0">
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen((o) => !o)}
          className={`${pillTrigger} ${pillTriggerStyle}`}
        >
          <span className="min-w-0 flex-1 truncate text-left">{displayLabel}</span>
          <svg
            className={`h-4 w-4 flex-shrink-0 text-gray-400 transition-transform dark:text-gray-500 ${open ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </Tooltip>
      {menu}

      {showCustomModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={handleBackdropClick}
        >
          <div
            className="my-auto w-full max-w-md transform rounded-2xl border border-gray-100 bg-white shadow-2xl transition-all duration-300 animate-in zoom-in-95 slide-in-from-bottom-4 dark:border-gray-700 dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {t('dashboard:periodModal.custom', { defaultValue: 'Période personnalisée' })}
                </h2>
                <button
                  type="button"
                  onClick={handleCustomCancel}
                  className="text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="px-6 py-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="relative">
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('dashboard:periodModal.startDate', { defaultValue: 'Date de début' })}
                  </label>
                  <DateInput
                    value={customStart}
                    onChange={setCustomStart}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    max={customEnd || undefined}
                  />
                </div>
                <div className="relative">
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('dashboard:periodModal.endDate', { defaultValue: 'Date de fin' })}
                  </label>
                  <DateInput
                    value={customEnd}
                    onChange={setCustomEnd}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    min={customStart || undefined}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-shrink-0 justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
              <button
                type="button"
                onClick={handleCustomCancel}
                className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
              >
                {t('dashboard:periodModal.cancel', { defaultValue: 'Annuler' })}
              </button>
              <button
                type="button"
                onClick={handleCustomApply}
                disabled={!customStart || !customEnd || customStart > customEnd}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
