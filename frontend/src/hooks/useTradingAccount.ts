import { useState, useEffect, useCallback } from 'react';
import { TradingAccount } from '../types';
import { tradingAccountService } from '../services/tradingAccountService';
import { toast } from 'react-hot-toast';

export const useTradingAccount = () => {
  const [selectedAccount, setSelectedAccount] = useState<TradingAccount | null>(null);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const fetchedAccounts = await tradingAccountService.getAccounts();
      setAccounts(fetchedAccounts);

      if (selectedAccount) {
        const foundAccount = fetchedAccounts.find(acc => acc.id === selectedAccount.id);
        if (foundAccount) {
          setSelectedAccount(foundAccount);
        } else {
          // Si le compte sélectionné n'existe plus, utiliser le défaut
          const defaultAccount = fetchedAccounts.find(acc => acc.is_default);
          setSelectedAccount(defaultAccount || null);
        }
      } else {
        // Si aucun compte sélectionné, utiliser le défaut
        const defaultAccount = fetchedAccounts.find(acc => acc.is_default);
        setSelectedAccount(defaultAccount || null);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des comptes de trading:', error);
      toast.error('Impossible de charger les comptes de trading.');
    } finally {
      setLoading(false);
    }
  }, [selectedAccount]);

  const handleAccountChange = useCallback((account: TradingAccount | null) => {
    setSelectedAccount(account);
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  return {
    selectedAccount,
    accounts,
    loading,
    handleAccountChange,
    refetchAccounts: fetchAccounts
  };
};
