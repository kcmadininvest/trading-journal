import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '../../hooks/usePreferences';
import {
  PrivacyOption,
  updatePrivacyOverrides,
  resetPrivacyOverrides,
  hideAllPrivacyOptions,
  countActiveOverrides,
  PAGE_CONTEXTS,
} from '../../utils/privacyHelpers';
import type { PrivacyOverrides } from '../../services/userService';
import Tooltip from '../ui/Tooltip';
import { SettingsStyleToggle } from '../ui/SettingsStyleToggle';

interface PrivacyDropdownProps {
  pageContext: string;
  availableOptions: PrivacyOption[];
  className?: string;
  variant?: 'default' | 'band';
}

function applyPrivacyOverridesPatch(
  current: PrivacyOverrides | undefined,
  pageContext: string,
  updates: Record<string, boolean>
): PrivacyOverrides {
  const next: PrivacyOverrides = { ...(current || {}) };
  const pageOverrides = { ...(next[pageContext] || {}) };

  Object.entries(updates).forEach(([key, value]) => {
    if (value) {
      pageOverrides[key] = true;
    } else {
      delete pageOverrides[key];
    }
  });

  if (Object.keys(pageOverrides).length === 0) {
    delete next[pageContext];
  } else {
    next[pageContext] = pageOverrides;
  }

  return next;
}

function clearPagePrivacyOverrides(
  current: PrivacyOverrides | undefined,
  pageContext: string
): PrivacyOverrides {
  const next: PrivacyOverrides = { ...(current || {}) };
  delete next[pageContext];
  return next;
}

export const PrivacyDropdown: React.FC<PrivacyDropdownProps> = ({
  pageContext,
  availableOptions,
  className = '',
  variant = 'default',
}) => {
  const { t } = useTranslation();
  const { preferences, mergePreferences } = usePreferences();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(
    null
  );

  const currentOverrides = preferences.privacy_overrides?.[pageContext] || {};
  const activeOverridesCount = countActiveOverrides(pageContext, preferences.privacy_overrides);

  const updateDropdownPosition = useCallback(() => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownWidth = 320;
    const viewportWidth = window.innerWidth;

    let left = rect.left;
    if (left + dropdownWidth > viewportWidth - 16) {
      left = rect.right - dropdownWidth;
    }
    if (left < 16) {
      left = 16;
    }

    setDropdownPosition({
      top: rect.bottom + 8,
      left,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setDropdownPosition(null);
      return;
    }

    updateDropdownPosition();
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);

    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [isOpen, updateDropdownPosition]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        containerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const getOptionState = (optionKey: string): boolean => {
    return currentOverrides[optionKey] ?? false;
  };

  const runPrivacyUpdate = async (
    optimisticOverrides: PrivacyOverrides,
    persist: () => Promise<void>
  ) => {
    const previousOverrides = preferences.privacy_overrides;
    mergePreferences({ privacy_overrides: optimisticOverrides });
    setIsSaving(true);

    try {
      await persist();
      window.dispatchEvent(new Event('preferences:updated'));
    } catch (error) {
      mergePreferences({ privacy_overrides: previousOverrides });
      console.error('Error updating privacy override:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOptionChange = async (optionKey: string, newState: boolean) => {
    if (isSaving || newState === getOptionState(optionKey)) return;

    const optimisticOverrides = applyPrivacyOverridesPatch(
      preferences.privacy_overrides,
      pageContext,
      { [optionKey]: newState }
    );

    await runPrivacyUpdate(optimisticOverrides, () =>
      updatePrivacyOverrides(pageContext, { [optionKey]: newState })
    );
  };

  const handleHideAll = async () => {
    if (isSaving) return;

    const updates = Object.fromEntries(
      availableOptions.map((option) => [option.key, true])
    ) as Record<string, boolean>;
    const optimisticOverrides = applyPrivacyOverridesPatch(
      preferences.privacy_overrides,
      pageContext,
      updates
    );

    await runPrivacyUpdate(optimisticOverrides, () =>
      hideAllPrivacyOptions(pageContext, availableOptions)
    );
  };

  const handleReset = async () => {
    if (isSaving) return;

    const optimisticOverrides = clearPagePrivacyOverrides(
      preferences.privacy_overrides,
      pageContext
    );

    await runPrivacyUpdate(optimisticOverrides, () => resetPrivacyOverrides(pageContext));
  };

  const dropdownMenu =
    isOpen &&
    dropdownPosition &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        ref={menuRef}
        className="fixed z-[9999] w-80 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
        style={{
          top: `${dropdownPosition.top}px`,
          left: `${dropdownPosition.left}px`,
        }}
      >
        <div className="p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            {t('dashboard:privacyControls', { defaultValue: 'Contrôles de Confidentialité' })}
          </h3>
          {pageContext === PAGE_CONTEXTS.DASHBOARD && (
            <p className="mb-3 text-justify text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              {t('dashboard:privacyControlsScopeHint', {
                defaultValue:
                  'Masquer le numéro de compte ou les soldes ici les masque aussi sur les autres pages. Masquer le MLL ou les profits/pertes ne concerne que le tableau de bord.',
              })}
            </p>
          )}

          <div className="mb-4 space-y-1">
            {availableOptions.map((option) => (
              <div
                key={option.key}
                className={`flex items-center justify-between gap-3 rounded-lg p-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/80 ${
                  isSaving ? 'pointer-events-none' : ''
                }`}
              >
                <span className="min-w-0 flex-1 text-sm leading-snug text-gray-700 dark:text-gray-300">
                  {t(option.label)}
                </span>
                <SettingsStyleToggle
                  pressed={getOptionState(option.key)}
                  onPressedChange={(next) => void handleOptionChange(option.key, next)}
                  disabled={isSaving}
                />
              </div>
            ))}
          </div>

          <div className="flex gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
            <button
              type="button"
              onClick={() => void handleHideAll()}
              disabled={isSaving}
              className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-wait"
            >
              {t('dashboard:hideAll', { defaultValue: 'Tout masquer' })}
            </button>
            <button
              type="button"
              onClick={() => void handleReset()}
              disabled={isSaving || activeOverridesCount === 0}
              className="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              {t('dashboard:reset', { defaultValue: 'Réinitialiser' })}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );

  const isBand = variant === 'band';
  const activeTriggerClass =
    'border-sky-300 bg-sky-50 text-sky-700 hover:border-sky-400 hover:bg-sky-100 dark:border-sky-500/45 dark:bg-sky-500/15 dark:text-sky-300 dark:hover:border-sky-400/55 dark:hover:bg-sky-500/25';
  const inactiveTriggerClass =
    'border-gray-300 bg-white text-gray-600 shadow-sm hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-600/80';
  const bandButtonClass = `relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border transition-colors ${
    activeOverridesCount > 0 ? activeTriggerClass : inactiveTriggerClass
  }`;
  const defaultButtonClass = `inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm shadow-sm transition-colors ${
    activeOverridesCount > 0 ? activeTriggerClass : inactiveTriggerClass
  }`;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <Tooltip
        content={t('dashboard:streamerModeTooltip', { defaultValue: 'Contrôles de confidentialité' })}
      >
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          disabled={isSaving && !isOpen}
          className={`${isBand ? bandButtonClass : defaultButtonClass} ${
            isSaving && !isOpen ? 'cursor-wait' : ''
          }`}
        >
          <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {activeOverridesCount > 0 ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            )}
          </svg>
          {activeOverridesCount > 0 && !isBand && (
            <span className="inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-sky-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white dark:bg-sky-400 dark:text-slate-900">
              {activeOverridesCount}
            </span>
          )}
          {activeOverridesCount > 0 && isBand && (
            <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full border border-sky-200 bg-sky-600 px-1 text-[10px] font-bold leading-none text-white dark:border-sky-300/50 dark:bg-sky-400 dark:text-slate-900">
              {activeOverridesCount}
            </span>
          )}
        </button>
      </Tooltip>

      {dropdownMenu}
    </div>
  );
};
