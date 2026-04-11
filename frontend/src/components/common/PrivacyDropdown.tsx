import React, { useState, useRef, useEffect } from 'react';
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
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);

  // Récupérer les overrides actuels pour ce contexte
  const currentOverrides = preferences.privacy_overrides?.[pageContext] || {};
  
  // Compter les overrides actifs
  const activeOverridesCount = countActiveOverrides(pageContext, preferences.privacy_overrides);

  // Calculer la position du dropdown
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const dropdownWidth = 320; // w-80 = 320px
      const viewportWidth = window.innerWidth;
      
      // Calculer la position left pour que le dropdown ne dépasse pas de l'écran
      let left = rect.left;
      if (left + dropdownWidth > viewportWidth - 16) {
        // Si le dropdown dépasse à droite, l'aligner à droite du bouton
        left = rect.right - dropdownWidth;
      }
      // S'assurer qu'il ne dépasse pas à gauche
      if (left < 16) {
        left = 16;
      }
      
      setDropdownPosition({
        top: rect.bottom + 8,
        left: left
      });
    } else {
      setDropdownPosition(null);
    }
  }, [isOpen]);

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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            )}
          </svg>
          {activeOverridesCount > 0 && (
            <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400">
              {activeOverridesCount}
            </span>
          )}
        </button>
      </Tooltip>

      {isOpen && dropdownPosition && (
        <div 
          className="fixed w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50" 
          style={{ 
            top: `${dropdownPosition.top}px`, 
            left: `${dropdownPosition.left}px` 
          }}
        >
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {t('dashboard:privacyControls', { defaultValue: 'Contrôles de Confidentialité' })}
            </h3>
            {pageContext === PAGE_CONTEXTS.DASHBOARD && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed text-justify">
                {t('dashboard:privacyControlsScopeHint', {
                  defaultValue:
                    'Masquer le numéro de compte ou les soldes ici les masque aussi sur les autres pages. Masquer le MLL ou les profits/pertes ne concerne que le tableau de bord.',
                })}
              </p>
            )}
            
            {/* Options */}
            <div className="space-y-2 mb-4">
              {availableOptions.map((option) => (
                <label
                  key={option.key}
                  className="w-full flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={getOptionState(option.key)}
                    onChange={() => handleToggleOption(option.key)}
                    disabled={isSaving}
                    className="h-5 w-5 text-blue-600 dark:text-blue-400 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 cursor-pointer disabled:opacity-50"
                  />
                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                    {t(option.label)}
                  </span>
                </label>
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

