/**
 * Hook pour accéder aux préférences utilisateur dans toute l'application
 */

import { useState, useEffect, useContext, createContext } from 'react';
import userService, { UserPreferences } from '../services/userService';
import { changeLanguage } from '../i18n/config';
import { authService } from '../services/auth';
import i18n from '../i18n/config';

interface PreferencesContextType {
  preferences: UserPreferences;
  loading: boolean;
  refreshPreferences: () => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextType | null>(null);

// Lire le thème depuis localStorage immédiatement pour éviter le flash
const getInitialTheme = (): 'light' | 'dark' => {
  try {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      // Appliquer immédiatement le thème au DOM avant le premier rendu
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return savedTheme;
    }
  } catch (e) {
    // Ignorer les erreurs de localStorage
  }
  return 'light';
};

// Lire la taille de police depuis localStorage immédiatement
const getInitialFontSize = (): 'small' | 'medium' | 'large' => {
  try {
    const savedFontSize = localStorage.getItem('font_size');
    if (savedFontSize === 'small' || savedFontSize === 'medium' || savedFontSize === 'large') {
      // Appliquer immédiatement la taille de police au DOM avant le premier rendu
      const root = document.documentElement;
      root.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
      root.classList.add(`font-size-${savedFontSize}`);
      return savedFontSize;
    }
  } catch (e) {
    // Ignorer les erreurs de localStorage
  }
  return 'medium';
};

const DEFAULT_ITEMS_PER_PAGE = 20;

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialiser la langue avec celle détectée par i18n (depuis navigator)
  // Au lieu de forcer 'fr' par défaut
  const getInitialLanguage = (): 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh' => {
    // Utiliser la langue actuelle de i18n (détectée depuis navigator)
    const currentLang = i18n.language?.split('-')[0] || 'en';
    const supportedLangs: Array<'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh'> = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'ko', 'zh'];
    return (supportedLangs.includes(currentLang as any) ? currentLang : 'en') as 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh';
  };

  const [preferences, setPreferences] = useState<UserPreferences>({
    language: getInitialLanguage(), // Utiliser la langue détectée au lieu de 'fr'
    timezone: 'Europe/Paris',
    date_format: 'EU',
    number_format: 'comma',
    theme: getInitialTheme(),
    font_size: getInitialFontSize(),
    email_goal_alerts: true,
    items_per_page: DEFAULT_ITEMS_PER_PAGE,
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
        });
        // Appliquer le thème immédiatement
        const root = document.documentElement;
        if (prefs.theme === 'dark') {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
        
        // Appliquer la taille de police immédiatement
        root.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
        root.classList.add(`font-size-${prefs.font_size || 'medium'}`);
        
        // Sauvegarder le thème et la taille de police dans localStorage pour éviter le flash au prochain chargement
        try {
          localStorage.setItem('theme', prefs.theme || 'light');
          localStorage.setItem('font_size', prefs.font_size || 'medium');
        } catch (e) {
          // Ignorer les erreurs de localStorage
        }
        
        // BACKEND = SOURCE DE VÉRITÉ ABSOLUE
        // Toujours appliquer la langue du backend, sans condition
        // Le backend a déjà détecté la langue du navigateur lors de la première création
        if (prefs.language) {
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
          timezone: 'Europe/Paris',
          date_format: 'EU',
          number_format: 'comma',
          theme: getInitialTheme(),
          font_size: defaultFontSize,
          items_per_page: DEFAULT_ITEMS_PER_PAGE,
          email_goal_alerts: true,
        });
        // Réinitialiser la taille de police au document
        const root = document.documentElement;
        root.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
        root.classList.add(`font-size-${defaultFontSize}`);
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
    if (preferences.language && authService.isAuthenticated()) {
      // Seulement changer la langue si l'utilisateur est authentifié
      // Sinon, laisser i18n utiliser la langue détectée depuis navigator
      changeLanguage(preferences.language);
    }
  }, [preferences.language]);

  // Écouter les changements de taille de police dans les préférences
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
    root.classList.add(`font-size-${preferences.font_size || 'medium'}`);
    
    // Sauvegarder dans localStorage
    try {
      localStorage.setItem('font_size', preferences.font_size || 'medium');
    } catch (e) {
      // Ignorer les erreurs de localStorage
    }
  }, [preferences.font_size]);

  return (
    <PreferencesContext.Provider value={{ preferences, loading, refreshPreferences }}>
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = (): PreferencesContextType => {
  const context = useContext(PreferencesContext);
  if (!context) {
    // Retourner des valeurs par défaut si le contexte n'est pas disponible
      const defaultFontSize = getInitialFontSize();
      // Utiliser la langue détectée depuis i18n au lieu de 'fr'
      const detectedLang = i18n.language?.split('-')[0] || 'en';
      const supportedLangs: Array<'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh'> = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'ko', 'zh'];
      const defaultLang = (supportedLangs.includes(detectedLang as any) ? detectedLang : 'en') as 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh';
      return {
        preferences: {
          language: defaultLang, // Utiliser la langue détectée au lieu de 'fr'
          timezone: 'Europe/Paris',
          date_format: 'EU',
          number_format: 'comma',
          theme: 'light',
          font_size: defaultFontSize,
          items_per_page: DEFAULT_ITEMS_PER_PAGE,
          email_goal_alerts: true,
        },
        loading: false,
        refreshPreferences: async () => {},
      };
  }
  return context;
};

