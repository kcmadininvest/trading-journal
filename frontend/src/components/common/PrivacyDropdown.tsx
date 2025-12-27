import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '../../hooks/usePreferences';
import { 
  PrivacyOption, 
  updatePrivacyOverrides, 
  resetPrivacyOverrides, 
  hideAllPrivacyOptions,
  countActiveOverrides 
} from '../../utils/privacyHelpers';
import Tooltip from '../ui/Tooltip';

interface PrivacyDropdownProps {
  pageContext: string;
  availableOptions: PrivacyOption[];
  className?: string;
}

export const PrivacyDropdown: React.FC<PrivacyDropdownProps> = ({
  pageContext,
  availableOptions,
  className = '',
}) => {
  const { t } = useTranslation();
  const { preferences } = usePreferences();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Récupérer les overrides actuels pour ce contexte
  const currentOverrides = preferences.privacy_overrides?.[pageContext] || {};
  
  // Compter les overrides actifs
  const activeOverridesCount = countActiveOverrides(pageContext, preferences.privacy_overrides);

  // Fermer le dropdown au clic extérieur
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Obtenir l'état d'une option (true ou false)
  const getOptionState = (optionKey: string): boolean => {
    return currentOverrides[optionKey] ?? false;
  };

  // Toggle une option
  const handleToggleOption = async (optionKey: string) => {
    const currentState = getOptionState(optionKey);
    const newState = !currentState; // Simple toggle true/false

    setIsSaving(true);
    try {
      await updatePrivacyOverrides(pageContext, { [optionKey]: newState });
      // Émettre un événement pour que le contexte se rafraîchisse (sans rechargement de page)
      window.dispatchEvent(new Event('preferences:updated'));
    } catch (error) {
      console.error('Error updating privacy override:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Tout masquer
  const handleHideAll = async () => {
    setIsSaving(true);
    try {
      await hideAllPrivacyOptions(pageContext, availableOptions);
      // Recharger les préférences depuis le contexte (sans rechargement de page)
      window.dispatchEvent(new Event('preferences:updated'));
    } catch (error) {
      console.error('Error hiding all:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Réinitialiser
  const handleReset = async () => {
    setIsSaving(true);
    try {
      await resetPrivacyOverrides(pageContext);
      // Recharger les préférences depuis le contexte (sans rechargement de page)
      window.dispatchEvent(new Event('preferences:updated'));
    } catch (error) {
      console.error('Error resetting:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Icône pour l'état de l'option
  const getStateIcon = (optionKey: string) => {
    const isHidden = getOptionState(optionKey);
    
    if (isHidden) {
      return <span title={t('dashboard:hidden', { defaultValue: 'Masqué' })}>☑️</span>;
    } else {
      return <span title={t('dashboard:visible', { defaultValue: 'Visible' })}>☐</span>;
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <Tooltip content={t('dashboard:streamerModeTooltip', { defaultValue: 'Contrôles de confidentialité' })}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isSaving}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            activeOverridesCount > 0
              ? 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {activeOverridesCount > 0 ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            )}
          </svg>
          <span className="text-sm font-medium whitespace-nowrap">
            {t('dashboard:streamerMode', { defaultValue: 'Streamer Mode' })}
          </span>
          {activeOverridesCount > 0 && (
            <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400">
              {activeOverridesCount}
            </span>
          )}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </Tooltip>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              {t('dashboard:privacyControls', { defaultValue: 'Contrôles de Confidentialité' })}
            </h3>
            
            {/* Options */}
            <div className="space-y-2 mb-4">
              {availableOptions.map((option) => (
                <button
                  key={option.key}
                  onClick={() => handleToggleOption(option.key)}
                  disabled={isSaving}
                  className="w-full flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left disabled:opacity-50"
                >
                  <span className="text-lg">{getStateIcon(option.key)}</span>
                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                    {t(option.label)}
                  </span>
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleHideAll}
                disabled={isSaving}
                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {t('dashboard:hideAll', { defaultValue: 'Tout masquer' })}
              </button>
              <button
                onClick={handleReset}
                disabled={isSaving || activeOverridesCount === 0}
                className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {t('dashboard:reset', { defaultValue: 'Réinitialiser' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

