import apiClient from '../lib/apiClient';
import { TradingAccount, TradingAccountCreate, TradingAccountUpdate } from '../types';

export const tradingAccountService = {
  // Récupérer tous les comptes de trading
  getAccounts: async (): Promise<TradingAccount[]> => {
    const response = await apiClient.get('/trades/trading-accounts/');
    return response.data.results || response.data;
  },

  // Récupérer un compte par ID
  getAccount: async (id: number): Promise<TradingAccount> => {
    const response = await apiClient.get(`/trades/trading-accounts/${id}/`);
    return response.data;
  },

  // Récupérer le compte par défaut
  getDefaultAccount: async (): Promise<TradingAccount> => {
    const response = await apiClient.get('/trades/trading-accounts/default/');
    return response.data;
  },

  // Créer un nouveau compte
  createAccount: async (data: TradingAccountCreate): Promise<TradingAccount> => {
    const response = await apiClient.post('/trades/trading-accounts/', data);
    return response.data;
  },

  // Mettre à jour un compte
  updateAccount: async (id: number, data: TradingAccountUpdate): Promise<TradingAccount> => {
    const response = await apiClient.put(`/trades/trading-accounts/${id}/`, data);
    return response.data;
  },

  // Supprimer un compte
  deleteAccount: async (id: number): Promise<void> => {
    await apiClient.delete(`/trades/trading-accounts/${id}/`);
  },

  // Définir un compte comme défaut
  setDefaultAccount: async (id: number): Promise<TradingAccount> => {
    const response = await apiClient.post(`/trades/trading-accounts/${id}/set_default/`);
    return response.data;
  },

  // Récupérer les statistiques d'un compte
  getAccountStatistics: async (id: number): Promise<any> => {
    const response = await apiClient.get(`/trades/trading-accounts/${id}/statistics/`);
    return response.data;
  },
};

export default tradingAccountService;
