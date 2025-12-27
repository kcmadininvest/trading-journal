import { useMemo } from 'react';
import { usePreferences } from './usePreferences';

export interface PrivacySettings {
  hideInitialBalance: boolean;
  hideCurrentBalance: boolean;
  hideMll: boolean;
  hideProfitLoss: boolean;
}

/**
 * Hook personnalisé pour récupérer les paramètres de confidentialité par page
 * @param pageContext Le contexte de la page (dashboard, statistics, trades, etc.)
 * @returns Les paramètres de confidentialité de l'utilisateur pour cette page
 */
export function usePrivacySettings(pageContext: string): PrivacySettings {
  const { preferences } = usePreferences();

  return useMemo(() => {
    // Récupérer les overrides pour le contexte de page
    const overrides = preferences.privacy_overrides?.[pageContext] || {};

    // Retourner les valeurs avec false par défaut
    return {
      hideInitialBalance: overrides.hide_initial_balance ?? false,
      hideCurrentBalance: overrides.hide_current_balance ?? false,
      hideMll: overrides.hide_mll ?? false,
      hideProfitLoss: overrides.hide_profit_loss ?? false,
    };
  }, [preferences, pageContext]);
}

/**
 * Fonction helper pour déterminer si une valeur doit être masquée
 * @param value La valeur à afficher
 * @param isHidden Si la valeur doit être masquée
 * @returns La valeur originale ou masquée
 */
export function shouldHideValue(value: any, isHidden: boolean): boolean {
  return isHidden;
}

/**
 * Fonction pour masquer une valeur avec des astérisques
 * @param value La valeur à masquer
 * @param currencySymbol Le symbole de devise (optionnel)
 * @returns La valeur masquée
 */
export function maskValue(value: any, currencySymbol?: string): string {
  if (currencySymbol) {
    return `${currencySymbol}***`;
  }
  return '***';
}

