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
    
    // Vérifier si l'utilisateur est authentifié avant de charger les comptes
    const token = localStorage.getItem('access_token');
    if (!token) {
      console.log('⚠️ [TradingAccountSelector] Pas de token d\'authentification');
      setAccountsLoaded(true);
      setAccounts([]);
      setError(null);
      return;
    }
    
    console.log('🔍 [TradingAccountSelector] Début du chargement des comptes, forceReload:', forceReload);

    // Guard: éviter les rechargements inutiles
    if (!forceReload && accountsLoaded) {
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
      console.log('📊 [TradingAccountSelector] Comptes chargés:', {
        count: accountsArray.length,
        accounts: accountsArray.map(acc => ({ id: acc.id, name: acc.name, is_default: acc.is_default }))
      });
      
      setAccounts(accountsArray);
      setAccountsLoaded(true);
      
      // Si aucun compte sélectionné, utiliser le compte par défaut
      if (!selectedAccountId && accountsArray.length > 0) {
        const defaultAccount = accountsArray.find(acc => acc.is_default);
        if (defaultAccount) {
          console.log('🔄 [TradingAccountSelector] Sélection automatique du compte par défaut:', defaultAccount.name);
          onAccountChange(defaultAccount);
        } else if (accountsArray.length === 1) {
          // Si un seul compte, le sélectionner automatiquement
          console.log('🔄 [TradingAccountSelector] Sélection automatique du seul compte disponible:', accountsArray[0].name);
          onAccountChange(accountsArray[0]);
        }
      }
    } catch (err: any) {
      // Gérer les erreurs d'authentification de manière plus élégante
      if (err.response?.status === 401) {
        // Token expiré ou invalide - nettoyer et ne pas afficher d'erreur
        setAccounts([]);
        setAccountsLoaded(true);
        setError(null);
        console.warn('⚠️ [TradingAccountSelector] Token expiré, nettoyage des comptes');
      } else if (err.response?.status === 404 || err.response?.status === 403) {
        // L'utilisateur n'a pas de comptes de trading
        setAccounts([]);
        setAccountsLoaded(true);
        setError(null); // Pas d'erreur, juste pas de comptes
      } else {
        setError('Erreur lors du chargement des comptes');
        console.error('❌ [TradingAccountSelector] Error loading accounts:', err);
      }
    } finally {
      setLoading(false);
      setIsLoadingInProgress(false);
    }
  }, [accountsLoaded, isLoadingInProgress, onAccountChange, selectedAccountId]);

  useEffect(() => {
    // Charger les comptes seulement une fois au montage
    if (!accountsLoaded && !isLoadingInProgress) {
      loadAccounts(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountsLoaded, isLoadingInProgress]);

  // Effet pour gérer la sélection automatique du compte par défaut
  useEffect(() => {
    console.log('🔄 [TradingAccountSelector] useEffect accounts change:', {
      accountsLength: accounts.length,
      selectedAccountId: selectedAccountId,
      accounts: accounts.map(acc => ({ id: acc.id, name: acc.name, is_default: acc.is_default }))
    });
    
    if (accounts.length > 0 && !selectedAccountId) {
      const defaultAccount = accounts.find(acc => acc.is_default);
      if (defaultAccount) {
        console.log('🔄 [TradingAccountSelector] Sélection automatique du compte par défaut (useEffect):', defaultAccount.name);
        onAccountChange(defaultAccount);
      } else if (accounts.length === 1) {
        console.log('🔄 [TradingAccountSelector] Sélection automatique du seul compte disponible (useEffect):', accounts[0].name);
        onAccountChange(accounts[0]);
      }
    }
  }, [accounts, selectedAccountId, onAccountChange]);

  // Écouter les événements de changement d'utilisateur pour recharger les comptes
  useEffect(() => {
    const handleUserChange = (event: any) => {
      if (event.type === 'user:logout') {
        // Lors de la déconnexion, nettoyer sans recharger
        setAccountsLoaded(false);
        setAccounts([]);
        return;
      }
      
      // Pour les connexions, recharger les comptes
      setAccountsLoaded(false);
      setAccounts([]);
      // Utiliser une fonction anonyme pour éviter la dépendance circulaire
      setTimeout(() => {
        loadAccounts(true);
      }, 100);
    };

    window.addEventListener('user:login', handleUserChange);
    window.addEventListener('user:logout', handleUserChange);

    return () => {
      window.removeEventListener('user:login', handleUserChange);
      window.removeEventListener('user:logout', handleUserChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <div className={`${className}`}>
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-amber-800 mb-1">
                Aucun compte de trading trouvé
              </h4>
              <p className="text-sm text-amber-700 mb-2">
                Vous devez créer au minimum un compte de trading pour pouvoir utiliser cette fonctionnalité.
              </p>
              <div className="text-xs text-amber-600">
                <p className="mb-1"><strong>Pour créer un compte :</strong></p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Allez dans le menu <strong>"Comptes de Trading"</strong> dans la barre latérale</li>
                  <li>Cliquez sur <strong>"Nouveau compte"</strong></li>
                  <li>Remplissez le formulaire et marquez-le comme <strong>"Compte par défaut"</strong></li>
                </ol>
              </div>
            </div>
          </div>
        </div>
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