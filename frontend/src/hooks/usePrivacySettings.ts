import { useMemo } from 'react';
import { usePreferences } from './usePreferences';

export interface PrivacySettings {
  hideAccountNumber: boolean;
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
    // Certains réglages ne sont exposés que sur le dashboard : les appliquer partout
    const dashboardOverrides = preferences.privacy_overrides?.dashboard || {};

    // Retourner les valeurs avec false par défaut
    return {
      hideAccountNumber: overrides.hide_account_number ?? false,
      hideInitialBalance:
        Boolean(overrides.hide_initial_balance) ||
        dashboardOverrides.hide_initial_balance === true,
      hideCurrentBalance:
        Boolean(overrides.hide_current_balance) ||
        dashboardOverrides.hide_current_balance === true,
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

