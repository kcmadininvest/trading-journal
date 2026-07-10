import { useContext } from 'react';
import i18n from '../i18n/config';
import { getStoredAppFontFamily } from '../utils/chartConfig';
import {
  DEFAULT_ITEMS_PER_PAGE,
  getInitialFontSize,
  PreferencesContext,
  type PreferencesContextType,
} from './preferencesProvider';

export const usePreferences = (): PreferencesContextType => {
  const context = useContext(PreferencesContext);
  if (!context) {
    const defaultFontSize = getInitialFontSize();
    const detectedLang = i18n.language?.split('-')[0] || 'en';
    const supportedLangs: Array<'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh'> = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'ko', 'zh'];
    const defaultLang = (supportedLangs.includes(detectedLang as 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh') ? detectedLang : 'en') as 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh';
    const getDefaultTimezone = (): string => {
      try {
        const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (detectedTimezone) {
          return detectedTimezone;
        }
      } catch {
        // Ignorer les erreurs
      }
      return 'Europe/Paris';
    };
    return {
      preferences: {
        language: defaultLang,
        timezone: getDefaultTimezone(),
        date_format: 'EU',
        number_format: 'comma',
        theme: 'light',
        font_size: defaultFontSize,
        font_family: getStoredAppFontFamily(),
        items_per_page: DEFAULT_ITEMS_PER_PAGE,
        email_goal_alerts: true,
        show_pre_market: false,
        pnl_display: 'net',
      },
      loading: false,
      refreshPreferences: async () => {},
      mergePreferences: () => {},
    };
  }
  return context;
};
