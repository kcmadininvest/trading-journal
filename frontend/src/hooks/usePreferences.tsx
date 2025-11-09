/**
 * Hook pour accéder aux préférences utilisateur dans toute l'application
 */

import { useState, useEffect, useContext, createContext } from 'react';
import userService, { UserPreferences } from '../services/userService';
import { changeLanguage } from '../i18n/config';
import { authService } from '../services/auth';

interface PreferencesContextType {
  preferences: UserPreferences;
  loading: boolean;
  refreshPreferences: () => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextType | null>(null);

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  const [preferences, setPreferences] = useState<UserPreferences>({
    language: 'fr',
    timezone: 'Europe/Paris',
    date_format: 'EU',
    number_format: 'comma',
    theme: getInitialTheme(),
    font_size: 'medium',
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
        setPreferences(prefs);
        // Appliquer le thème immédiatement
        const root = document.documentElement;
        if (prefs.theme === 'dark') {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
        
        // Sauvegarder le thème dans localStorage pour éviter le flash au prochain chargement
        try {
          localStorage.setItem('theme', prefs.theme || 'light');
        } catch (e) {
          // Ignorer les erreurs de localStorage
        }
        // Changer la langue i18n quand les préférences sont chargées
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
        setPreferences({
          language: 'fr',
          timezone: 'Europe/Paris',
          date_format: 'EU',
          number_format: 'comma',
          theme: getInitialTheme(),
          font_size: 'medium',
        });
      }
    };
    
    window.addEventListener('preferences:updated', handlePreferencesUpdated);
    window.addEventListener('auth:login', handleAuthChange);
    window.addEventListener('auth:logout', handleAuthChange);
    
    return () => {
      window.removeEventListener('preferences:updated', handlePreferencesUpdated);
      window.removeEventListener('auth:login', handleAuthChange);
      window.removeEventListener('auth:logout', handleAuthChange);
    };
  }, []);

  // Écouter les changements de langue dans les préférences
  useEffect(() => {
    if (preferences.language) {
      changeLanguage(preferences.language);
    }
  }, [preferences.language]);

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
    return {
      preferences: {
        language: 'fr',
        timezone: 'Europe/Paris',
        date_format: 'EU',
        number_format: 'comma',
        theme: 'light',
        font_size: 'medium',
      },
      loading: false,
      refreshPreferences: async () => {},
    };
  }
  return context;
};

