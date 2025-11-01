/**
 * Hook pour accéder aux préférences utilisateur dans toute l'application
 */

import { useState, useEffect, useContext, createContext } from 'react';
import userService, { UserPreferences } from '../services/userService';
import { changeLanguage } from '../i18n/config';

interface PreferencesContextType {
  preferences: UserPreferences;
  loading: boolean;
  refreshPreferences: () => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextType | null>(null);

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<UserPreferences>({
    language: 'fr',
    timezone: 'Europe/Paris',
    date_format: 'EU',
    number_format: 'comma',
    theme: 'light',
    font_size: 'medium',
  });
  const [loading, setLoading] = useState(true);

  const refreshPreferences = async () => {
    try {
      const prefs = await userService.getPreferences();
      if (prefs && prefs.date_format) {
        setPreferences(prefs);
        // Changer la langue i18n quand les préférences sont chargées
        if (prefs.language) {
          changeLanguage(prefs.language);
        }
      }
    } catch (error) {
      // Utiliser les valeurs par défaut si erreur
      console.error('Erreur lors du chargement des préférences:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshPreferences();
    
    // Écouter les mises à jour des préférences
    const handlePreferencesUpdated = async () => {
      await refreshPreferences();
    };
    
    window.addEventListener('preferences:updated', handlePreferencesUpdated);
    
    return () => {
      window.removeEventListener('preferences:updated', handlePreferencesUpdated);
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

