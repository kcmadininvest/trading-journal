import React, { useState, useEffect, useCallback } from 'react';
import { TradingAccount } from '../../types';
import { tradingAccountService } from '../../services/tradingAccountService';

interface TradingAccountSelectorProps {
  selectedAccountId?: number;
  onAccountChange: (account: TradingAccount | null) => void;
  className?: string;
}

const TradingAccountSelector: React.FC<TradingAccountSelectorProps> = ({
  selectedAccountId,
  onAccountChange,
  className = ''
}) => {
  
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Guards pour prévenir les rechargements inutiles
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [isLoadingInProgress, setIsLoadingInProgress] = useState(false);

  const loadAccounts = useCallback(async (forceReload = false) => {
    // Note: On permet le chargement même sans authentification pour permettre la connexion
    // Les erreurs 401 seront gérées par l'apiClient
    
    // Guard: éviter les rechargements inutiles
    if (!forceReload && accountsLoaded && accounts.length > 0) {
      return
    }
    
    if (!forceReload && isLoadingInProgress) {
      return
    }
    
    
    try {
      setIsLoadingInProgress(true);
      setLoading(true);
      setError(null);
      
      const accountsData = await tradingAccountService.getAccounts();
      
      const accountsArray = Array.isArray(accountsData) ? accountsData : [];
      setAccounts(accountsArray);
      setAccountsLoaded(true);
      
      // Si aucun compte sélectionné, utiliser le compte par défaut
      if (!selectedAccountId && accountsArray.length > 0) {
        const defaultAccount = accountsArray.find(acc => acc.is_default);
        if (defaultAccount) {
          onAccountChange(defaultAccount);
        }
      }
    } catch (err: any) {
      // Gérer les erreurs d'authentification de manière plus élégante
      if (err.response?.status === 401) {
        setError('Veuillez vous connecter pour accéder aux comptes de trading');
      } else {
        setError('Erreur lors du chargement des comptes');
      }
      console.error('❌ [TradingAccountSelector] Error loading accounts:', err);
    } finally {
      setLoading(false);
      setIsLoadingInProgress(false);
    }
  }, [selectedAccountId, onAccountChange, accountsLoaded, accounts.length, isLoadingInProgress]);

  useEffect(() => {
    loadAccounts(false); // Ne pas forcer le rechargement
  }, [loadAccounts]);

  const handleAccountChange = (accountId: string) => {
    
    const account = accounts.find(acc => acc.id === parseInt(accountId));
    
    onAccountChange(account || null);
  };

  const getAccountTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'topstep': 'TopStep',
      'ibkr': 'Interactive Brokers',
      'ninjatrader': 'NinjaTrader',
      'tradovate': 'Tradovate',
      'other': 'Autre'
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        <span className="text-sm text-gray-600">Chargement des comptes...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-red-600 text-sm ${className}`}>
        {error}
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className={`text-yellow-600 text-sm ${className}`}>
        Aucun compte de trading trouvé. Créez-en un d'abord.
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <label htmlFor="account-selector" className="text-sm font-medium text-gray-700">
        Compte:
      </label>
      <select
        id="account-selector"
        value={selectedAccountId || ''}
        onChange={(e) => handleAccountChange(e.target.value)}
        className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name} ({getAccountTypeLabel(account.account_type)})
            {account.is_default && ' - Défaut'}
          </option>
        ))}
      </select>
    </div>
  );
};

export default TradingAccountSelector;
