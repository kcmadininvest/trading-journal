import { useEffect, useState } from 'react';
import { usePreferences } from './usePreferences';
import userService from '../services/userService';
import {
  applyResolvedTheme,
  applyThemePreference,
  getNextThemePreference,
  resolveTheme,
  subscribeSystemTheme,
  ThemePreference,
  ResolvedTheme,
} from '../utils/theme';

/**
 * Hook pour gérer le thème (dark/light mode)
 * Applique le thème au document HTML et synchronise avec les préférences utilisateur
 */
export const useTheme = () => {
  const { preferences, mergePreferences } = usePreferences();
  const themePreference: ThemePreference = preferences.theme || 'light';
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(themePreference));

  // Appliquer le thème au document HTML au chargement et lors des changements
  useEffect(() => {
    applyThemePreference(themePreference);
    setResolvedTheme(resolveTheme(themePreference));
  }, [themePreference]);

  // Suivre les changements OS quand le mode système est actif
  useEffect(() => {
    if (themePreference !== 'system') {
      return undefined;
    }

    return subscribeSystemTheme((nextResolved) => {
      applyResolvedTheme(nextResolved);
      setResolvedTheme(nextResolved);
    });
  }, [themePreference]);

  const persistTheme = async (newPreference: ThemePreference) => {
    const previousPreference = themePreference;
    const resolved = applyThemePreference(newPreference);
    setResolvedTheme(resolved);
    mergePreferences({ theme: newPreference });

    try {
      localStorage.setItem('theme', newPreference);
    } catch {
      // Ignorer les erreurs de localStorage
    }

    try {
      await userService.updatePreferences({ theme: newPreference });
    } catch (error) {
      console.error('Erreur lors de la mise à jour du thème:', error);
      applyThemePreference(previousPreference);
      setResolvedTheme(resolveTheme(previousPreference));
      mergePreferences({ theme: previousPreference });
      try {
        localStorage.setItem('theme', previousPreference);
      } catch {
        // Ignorer les erreurs de localStorage
      }
    }
  };

  /**
   * Faire défiler light → dark → system → light
   */
  const toggleTheme = async () => {
    const newPreference = getNextThemePreference(themePreference);
    await persistTheme(newPreference);
  };

  /**
   * Définir une préférence de thème spécifique
   */
  const setTheme = async (preference: ThemePreference) => {
    if (themePreference === preference) {
      return;
    }
    await persistTheme(preference);
  };

  return {
    theme: resolvedTheme,
    themePreference,
    toggleTheme,
    setTheme,
    isDark: resolvedTheme === 'dark',
  };
};
