import userService from '../services/userService';

// Constantes pour les options de confidentialité
export const PRIVACY_OPTIONS = {
  HIDE_INITIAL_BALANCE: 'hide_initial_balance',
  HIDE_CURRENT_BALANCE: 'hide_current_balance',
  HIDE_MLL: 'hide_mll',
  HIDE_PROFIT_LOSS: 'hide_profit_loss',
} as const;

// Constantes pour les contextes de page
export const PAGE_CONTEXTS = {
  DASHBOARD: 'dashboard',
  STATISTICS: 'statistics',
  TRADES: 'trades',
} as const;

// Interface pour les options de confidentialité
export interface PrivacyOption {
  key: string;
  label: string;
  icon?: React.ReactNode;
}

// Configuration des options disponibles par page
export const PAGE_PRIVACY_OPTIONS: Record<string, PrivacyOption[]> = {
  [PAGE_CONTEXTS.DASHBOARD]: [
    { key: PRIVACY_OPTIONS.HIDE_INITIAL_BALANCE, label: 'settings:hideInitialBalance' },
    { key: PRIVACY_OPTIONS.HIDE_CURRENT_BALANCE, label: 'settings:hideCurrentBalance' },
    { key: PRIVACY_OPTIONS.HIDE_MLL, label: 'settings:hideMll' },
    { key: PRIVACY_OPTIONS.HIDE_PROFIT_LOSS, label: 'settings:hideProfitLoss' },
  ],
  [PAGE_CONTEXTS.STATISTICS]: [
    { key: PRIVACY_OPTIONS.HIDE_PROFIT_LOSS, label: 'settings:hideProfitLoss' },
  ],
  [PAGE_CONTEXTS.TRADES]: [
    { key: PRIVACY_OPTIONS.HIDE_PROFIT_LOSS, label: 'settings:hideProfitLoss' },
  ],
};

/**
 * Helper pour mettre à jour les overrides de confidentialité pour une page spécifique
 * @param pageContext Le contexte de la page (dashboard, statistics, trades, etc.)
 * @param updates Les mises à jour à appliquer (clé: valeur)
 */
export async function updatePrivacyOverrides(
  pageContext: string,
  updates: Record<string, boolean | null>
): Promise<void> {
  try {
    // Récupérer les préférences actuelles
    const prefs = await userService.getPreferences();
    const currentOverrides = prefs.privacy_overrides || {};
    
    // Créer les nouveaux overrides en fusionnant avec les existants
    const newOverrides = {
      ...currentOverrides,
      [pageContext]: {
        ...(currentOverrides[pageContext] || {}),
        ...updates,
      },
    };
    
    // Nettoyer les valeurs null et false pour économiser de l'espace
    // On garde uniquement les valeurs true (masqué)
    Object.keys(newOverrides[pageContext]).forEach(key => {
      if (newOverrides[pageContext][key] === null || newOverrides[pageContext][key] === false) {
        delete newOverrides[pageContext][key];
      }
    });
    
    // Si le contexte de page est vide, le supprimer
    if (Object.keys(newOverrides[pageContext]).length === 0) {
      delete newOverrides[pageContext];
    }
    
    // Sauvegarder les nouvelles préférences
    await userService.updatePreferences({
      privacy_overrides: newOverrides,
    });
  } catch (error) {
    console.error('Error updating privacy overrides:', error);
    throw error;
  }
}

/**
 * Helper pour réinitialiser tous les overrides d'une page
 * @param pageContext Le contexte de la page
 */
export async function resetPrivacyOverrides(pageContext: string): Promise<void> {
  try {
    const prefs = await userService.getPreferences();
    const currentOverrides = prefs.privacy_overrides || {};
    
    // Supprimer le contexte de page
    const newOverrides = { ...currentOverrides };
    delete newOverrides[pageContext];
    
    await userService.updatePreferences({
      privacy_overrides: newOverrides,
    });
  } catch (error) {
    console.error('Error resetting privacy overrides:', error);
    throw error;
  }
}

/**
 * Helper pour activer tous les overrides d'une page (tout masquer)
 * @param pageContext Le contexte de la page
 * @param options Les options disponibles pour cette page
 */
export async function hideAllPrivacyOptions(
  pageContext: string,
  options: PrivacyOption[]
): Promise<void> {
  const updates: Record<string, boolean> = {};
  options.forEach(option => {
    updates[option.key] = true;
  });
  
  await updatePrivacyOverrides(pageContext, updates);
}

/**
 * Helper pour compter le nombre d'overrides actifs pour une page
 * @param pageContext Le contexte de la page
 * @param privacyOverrides Les overrides actuels
 * @returns Le nombre d'overrides actifs (masqués = true)
 */
export function countActiveOverrides(
  pageContext: string,
  privacyOverrides?: Record<string, Record<string, boolean | null>>
): number {
  if (!privacyOverrides || !privacyOverrides[pageContext]) {
    return 0;
  }
  
  // Compter uniquement les valeurs true (masqué)
  return Object.values(privacyOverrides[pageContext]).filter(
    value => value === true
  ).length;
}

