import apiClient from '../lib/apiClient';
import { TradingAccount, TradingAccountCreate, TradingAccountUpdate } from '../types';
import cacheManager from './cacheManager';

export const tradingAccountService = {
  // Récupérer tous les comptes de trading
  getAccounts: async (): Promise<TradingAccount[]> => {
    const cacheKey = 'trading_accounts';
    
    // Vérifier le cache d'abord
    const cachedData = cacheManager.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    try {
      const response = await apiClient.get('/trades/trading-accounts/');
      const result = response.data.results || response.data || [];
      
      // Mettre en cache pour 10 minutes seulement si on a des données
      if (result.length > 0) {
        cacheManager.set(cacheKey, result, 10 * 60 * 1000);
      }
      
      return result;
    } catch (error: any) {
      // Si l'utilisateur n'a pas de comptes (404), n'est pas autorisé (403), ou token expiré (401), retourner un tableau vide
      if (error.response?.status === 404 || error.response?.status === 403 || error.response?.status === 401) {
        return [];
      }
      // Relancer les autres erreurs
      throw error;
    }
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