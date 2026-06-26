/**
 * Hook pour accéder aux préférences utilisateur dans toute l'application
 */

import { useState, useEffect, useCallback, createContext } from 'react';
import { Chart } from 'chart.js';
import userService, { UserPreferences } from '../services/userService';
import { changeLanguage } from '../i18n/config';
import { authService } from '../services/auth';
import i18n from '../i18n/config';
import {
  AppFontFamily,
  applyAppFontFamily,
  getStoredAppFontFamily,
  storeAppFontFamily,
  syncChartFontFamily,
} from '../utils/chartConfig';
import { applyThemePreference, isThemePreference, ThemePreference } from '../utils/theme';

export interface PreferencesContextType {
  preferences: UserPreferences;
  loading: boolean;
  refreshPreferences: () => Promise<void>;
  /** Fusion locale (sans GET) pour éviter un rechargement complet après une mise à jour déjà connue (ex. langue depuis le header). */
  mergePreferences: (partial: Partial<UserPreferences>) => void;
}

export const PreferencesContext = createContext<PreferencesContextType | null>(null);

// Lire le thème depuis localStorage immédiatement pour éviter le flash
const getInitialTheme = (): ThemePreference => {
  try {
    const savedTheme = localStorage.getItem('theme');
    if (isThemePreference(savedTheme)) {
      applyThemePreference(savedTheme);
      return savedTheme;
    }
  } catch {
    // Ignorer les erreurs de localStorage
  }
  return 'light';
};

// Lire la taille de police depuis localStorage immédiatement
export const getInitialFontSize = (): 'small' | 'medium' | 'large' => {
  try {
    const savedFontSize = localStorage.getItem('font_size');
    if (savedFontSize === 'small' || savedFontSize === 'medium' || savedFontSize === 'large') {
      // Appliquer immédiatement la taille de police au DOM avant le premier rendu
      const root = document.documentElement;
      root.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
      root.classList.add(`font-size-${savedFontSize}`);
      return savedFontSize;
    }
  } catch {
    // Ignorer les erreurs de localStorage
  }
  return 'medium';
};

export const DEFAULT_ITEMS_PER_PAGE = 20;
const DEFAULT_FONT_FAMILY: AppFontFamily = 'inter';

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialiser la langue avec celle détectée par i18n (depuis navigator)
  // Au lieu de forcer 'fr' par défaut
  const getInitialLanguage = (): 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh' => {
    // Utiliser la langue actuelle de i18n (détectée depuis navigator)
    const currentLang = i18n.language?.split('-')[0] || 'en';
    const supportedLangs: Array<'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh'> = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'ko', 'zh'];
    return (supportedLangs.includes(currentLang as any) ? currentLang : 'en') as 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh';
  };

  // Détecter automatiquement le timezone du navigateur
  const getInitialTimezone = (): string => {
    try {
      const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // Vérifier que le timezone détecté est valide
      if (detectedTimezone) {
        return detectedTimezone;
      }
    } catch {
      // Ignorer les erreurs de détection
    }
    return 'Europe/Paris'; // Fallback
  };

  const [preferences, setPreferences] = useState<UserPreferences>({
    language: getInitialLanguage(), // Utiliser la langue détectée au lieu de 'fr'
    timezone: getInitialTimezone(), // Détecter automatiquement le timezone
    date_format: 'EU',
    number_format: 'comma',
    default_currency: 'USD',
    theme: getInitialTheme(),
    font_size: getInitialFontSize(),
    font_family: getStoredAppFontFamily(),
    email_goal_alerts: true,
    items_per_page: DEFAULT_ITEMS_PER_PAGE,
    show_pre_market: false,
    pnl_display: 'net',
  });
  const [loading, setLoading] = useState(true);

  const refreshPreferences = async () => {
    // Ne pas charger les préférences si l'utilisateur n'est pas authentifié
    if (!authService.isAuthenticated()) {
      setLoading(false);
      return;
    }

    try {
      const prefs = await userService.getPreferences();
      
      if (prefs && prefs.date_format) {
        setPreferences({
          ...prefs,
          items_per_page: prefs.items_per_page ?? DEFAULT_ITEMS_PER_PAGE,
          default_currency: prefs.default_currency || 'USD',
          pnl_display: prefs.pnl_display === 'gross' ? 'gross' : 'net',
        });
        // Appliquer le thème immédiatement
        const effectiveTheme: ThemePreference = isThemePreference(prefs.theme)
          ? prefs.theme
          : 'light';
        applyThemePreference(effectiveTheme);
        
        // Appliquer la taille de police immédiatement
        const root = document.documentElement;
        root.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
        root.classList.add(`font-size-${prefs.font_size || 'medium'}`);
        const effectiveFontFamily = prefs.font_family || DEFAULT_FONT_FAMILY;
        const fontStack = applyAppFontFamily(effectiveFontFamily);
        syncChartFontFamily(fontStack);
        Chart.defaults.font.family = fontStack;
        
        // Sauvegarder le thème et la taille de police dans localStorage pour éviter le flash au prochain chargement
        try {
          localStorage.setItem('theme', effectiveTheme);
          localStorage.setItem('font_size', prefs.font_size || 'medium');
          storeAppFontFamily(effectiveFontFamily);
        } catch {
          // Ignorer les erreurs de localStorage
        }
        
        // BACKEND = SOURCE DE VÉRITÉ ABSOLUE
        // Toujours appliquer la langue du backend, sans condition
        // Le backend a déjà détecté la langue du navigateur lors de la première création
        if (prefs.language && prefs.language !== i18n.language?.split('-')[0]) {
          changeLanguage(prefs.language);
        }
      }
    } catch (error: any) {
      // Utiliser les valeurs par défaut si erreur (par exemple si l'utilisateur n'est pas authentifié)
      // Ne pas logger l'erreur si c'est juste une erreur d'authentification (401)
      const isAuthError = error?.message?.includes('401') || 
                          error?.message?.includes('Unauthorized') ||
                          (error?.response?.status === 401);
      
      if (!isAuthError) {
        console.error('[usePreferences] Erreur lors du chargement des préférences:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const mergePreferences = useCallback((partial: Partial<UserPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...partial }));
  }, []);

  useEffect(() => {
    refreshPreferences();
    
    // Écouter les mises à jour des préférences et les changements d'authentification
    const handlePreferencesUpdated = async () => {
      // Vérifier à nouveau l'authentification avant de rafraîchir
      if (authService.isAuthenticated()) {
        await refreshPreferences();
      }
    };
    
    const handleAuthChange = async () => {
      // Si l'utilisateur vient de se connecter, charger les préférences
      if (authService.isAuthenticated()) {
        await refreshPreferences();
      } else {
        // Si l'utilisateur vient de se déconnecter, réinitialiser les préférences par défaut
        // Utiliser la langue détectée depuis navigator au lieu de forcer 'fr'
        const defaultFontSize = getInitialFontSize();
        const detectedLang = i18n.language?.split('-')[0] || 'en';
        const supportedLangs: Array<'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh'> = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'ko', 'zh'];
        const defaultLang = (supportedLangs.includes(detectedLang as any) ? detectedLang : 'en') as 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh';
        setPreferences({
          language: defaultLang, // Utiliser la langue détectée au lieu de 'fr'
          timezone: getInitialTimezone(), // Détecter automatiquement le timezone
          date_format: 'EU',
          number_format: 'comma',
          theme: getInitialTheme(),
          font_size: defaultFontSize,
          font_family: DEFAULT_FONT_FAMILY,
          items_per_page: DEFAULT_ITEMS_PER_PAGE,
          email_goal_alerts: true,
          show_pre_market: false,
          pnl_display: 'net',
        });
        // Réinitialiser la taille de police au document
        const root = document.documentElement;
        root.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
        root.classList.add(`font-size-${defaultFontSize}`);
        const fontStack = applyAppFontFamily(DEFAULT_FONT_FAMILY);
        syncChartFontFamily(fontStack);
        Chart.defaults.font.family = fontStack;
      }
    };
    
    window.addEventListener('preferences:updated', handlePreferencesUpdated);
    window.addEventListener('user:login', handleAuthChange);
    window.addEventListener('user:logout', handleAuthChange);
    
    return () => {
      window.removeEventListener('preferences:updated', handlePreferencesUpdated);
      window.removeEventListener('user:login', handleAuthChange);
      window.removeEventListener('user:logout', handleAuthChange);
    };
  }, []);

  // Écouter les changements de langue dans les préférences
  // Mais seulement si l'utilisateur est authentifié (pour respecter la détection du navigateur si non authentifié)
  useEffect(() => {
    if (!preferences.language || !authService.isAuthenticated()) {
      return;
    }
    const i18nCode = i18n.language?.split('-')[0];
    // Évite un second chargement i18n quand la langue UI est déjà alignée (ex. après changement depuis le header)
    if (preferences.language === i18nCode) {
      return;
    }
    changeLanguage(preferences.language);
  }, [preferences.language]);

  // Écouter les changements de taille de police dans les préférences
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
    root.classList.add(`font-size-${preferences.font_size || 'medium'}`);
    
    // Sauvegarder dans localStorage
    try {
      localStorage.setItem('font_size', preferences.font_size || 'medium');
    } catch {
      // Ignorer les erreurs de localStorage
    }
  }, [preferences.font_size]);

  useEffect(() => {
    const effectiveFontFamily = preferences.font_family || DEFAULT_FONT_FAMILY;
    const fontStack = applyAppFontFamily(effectiveFontFamily);
    syncChartFontFamily(fontStack);
    Chart.defaults.font.family = fontStack;
    storeAppFontFamily(effectiveFontFamily);
  }, [preferences.font_family]);

  return (
    <PreferencesContext.Provider value={{ preferences, loading, refreshPreferences, mergePreferences }}>
      {children}
    </PreferencesContext.Provider>
  );
};

