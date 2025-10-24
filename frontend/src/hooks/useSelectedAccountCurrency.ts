import { TradingAccount } from '../types';

/**
 * Hook pour obtenir la devise du compte sélectionné
 * @param selectedAccount - Le compte de trading sélectionné
 * @returns La devise du compte ou 'USD' par défaut
 */
export const useSelectedAccountCurrency = (selectedAccount: TradingAccount | null): string => {
  return selectedAccount?.currency || 'USD';
};
