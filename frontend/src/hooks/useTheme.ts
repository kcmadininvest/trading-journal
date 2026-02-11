import { useEffect } from 'react';
import { usePreferences } from './usePreferences';
import userService from '../services/userService';

/**
 * Hook pour gérer le thème (dark/light mode)
 * Applique le thème au document HTML et synchronise avec les préférences utilisateur
 */
export const useTheme = () => {
  const { preferences, refreshPreferences } = usePreferences();

  // Appliquer le thème au document HTML au chargement et lors des changements
  useEffect(() => {
    const root = document.documentElement;
    const theme = preferences.theme || 'light';

    // Appliquer ou retirer la classe 'dark' sur l'élément HTML
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [preferences.theme]);

  /**
   * Basculer entre les modes dark et light
   */
  const toggleTheme = async () => {
    const newTheme = preferences.theme === 'dark' ? 'light' : 'dark';
    
    // Appliquer immédiatement le thème pour un feedback instantané
    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Sauvegarder dans localStorage pour éviter le flash au prochain chargement
    try {
      localStorage.setItem('theme', newTheme);
    } catch {
      // Ignorer les erreurs de localStorage
    }
    
    try {
      // Sauvegarder les préférences sur le serveur
      await userService.updatePreferences({ theme: newTheme });
      
      // Rafraîchir les préférences depuis le serveur
      await refreshPreferences();
      
      // Déclencher un événement pour notifier les autres composants
      window.dispatchEvent(new CustomEvent('preferences:updated'));
    } catch (error) {
      console.error('Erreur lors de la mise à jour du thème:', error);
    }
  };

  /**
   * Définir un thème spécifique
   */
  const setTheme = async (theme: 'light' | 'dark') => {
    if (preferences.theme === theme) {
      return; // Déjà sur ce thème
    }

    // Appliquer immédiatement le thème pour un feedback instantané
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Sauvegarder dans localStorage pour éviter le flash au prochain chargement
    try {
      localStorage.setItem('theme', theme);
    } catch {
      // Ignorer les erreurs de localStorage
    }

    try {
      await userService.updatePreferences({ theme });
      await refreshPreferences();
      window.dispatchEvent(new CustomEvent('preferences:updated'));
    } catch (error) {
      console.error('Erreur lors de la mise à jour du thème:', error);
      // Revenir au thème précédent en cas d'erreur
      const previousTheme = preferences.theme || 'light';
      if (previousTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  };

  return {
    theme: preferences.theme || 'light',
    toggleTheme,
    setTheme,
    isDark: preferences.theme === 'dark',
  };
};

