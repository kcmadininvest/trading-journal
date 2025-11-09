/**
 * Hook personnalisé qui combine usePreferences et useTranslation de react-i18next
 * pour une utilisation simplifiée
 */

import { useTranslation as useI18nTranslation } from 'react-i18next';
import { usePreferences } from './usePreferences';

export const useTranslation = () => {
  const { t, i18n } = useI18nTranslation();
  const { preferences } = usePreferences();
  
  return {
    t,
    i18n,
    language: preferences.language,
    isReady: i18n.isInitialized,
  };
};

