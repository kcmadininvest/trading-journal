import { useMemo } from 'react';
import { usePreferences } from './usePreferences';

/**
 * Hook pour récupérer le paramètre de masquage du numéro de compte
 * depuis les préférences globales (tous contextes confondus)
 * Utilisé dans les pages qui n'ont pas de PrivacyDropdown
 * @returns boolean - true si le numéro de compte doit être masqué
 */
export function useAccountNumberVisibility(): boolean {
  const { preferences } = usePreferences();

  return useMemo(() => {
    // Vérifier dans tous les contextes de page si hide_account_number est activé
    const privacyOverrides = preferences.privacy_overrides || {};
    
    // Chercher dans tous les contextes (dashboard, statistics, trades)
    for (const context of Object.values(privacyOverrides)) {
      if (context?.hide_account_number === true) {
        return true;
      }
    }
    
    return false;
  }, [preferences]);
}
