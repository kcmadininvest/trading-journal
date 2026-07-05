import {
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useMemo,
} from 'react';
import { tradingAccountsService } from '../services/tradingAccounts';
import { authService } from '../services/auth';
import { useBootstrap } from '../hooks/useBootstrap';
import { useTradingAccounts } from '../hooks/useTradingAccounts';
import { queryClient } from '../lib/queryClient';
import { queryKeys } from '../lib/queryKeys';
import { TradingAccountContext } from './tradingAccountContext';

export function TradingAccountProvider({ children }: { children: ReactNode }) {
  const [selectedAccountId, setSelectedAccountIdState] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(() => authService.isAuthenticated());

  const { data: bootstrap, isLoading: bootstrapLoading, isError: bootstrapError, isFetched: bootstrapFetched } = useBootstrap(isAuthenticated);
  const { data: accounts = [], isLoading: accountsLoading } = useTradingAccounts({
    includeArchived: false,
    enabled: isAuthenticated,
  });

  const applyDefaultFromBootstrap = useCallback(() => {
    const defaultAccount = bootstrap?.default_account ?? null;
    if (defaultAccount && defaultAccount.status === 'active') {
      setSelectedAccountIdState(defaultAccount.id);
      localStorage.setItem('selectedTradingAccountId', String(defaultAccount.id));
    } else {
      setSelectedAccountIdState(null);
      localStorage.setItem('selectedTradingAccountId', 'null');
    }
    setLoading(false);
  }, [bootstrap?.default_account]);

  const initializeDefaultAccount = useCallback(async () => {
    if (!authService.isAuthenticated()) {
      setSelectedAccountIdState(null);
      localStorage.removeItem('selectedTradingAccountId');
      setLoading(false);
      return;
    }

    if (bootstrapLoading || !bootstrapFetched) {
      return;
    }

    if (bootstrapFetched && !bootstrapError) {
      applyDefaultFromBootstrap();
      return;
    }

    try {
      const defaultAccount = await tradingAccountsService.default();
      if (defaultAccount && defaultAccount.status === 'active') {
        setSelectedAccountIdState(defaultAccount.id);
        localStorage.setItem('selectedTradingAccountId', String(defaultAccount.id));
      } else {
        setSelectedAccountIdState(null);
        localStorage.setItem('selectedTradingAccountId', 'null');
      }
    } catch {
      setSelectedAccountIdState(null);
      localStorage.setItem('selectedTradingAccountId', 'null');
    } finally {
      setLoading(false);
    }
  }, [applyDefaultFromBootstrap, bootstrapError, bootstrapFetched, bootstrapLoading]);

  useEffect(() => {
    const syncAuth = () => setIsAuthenticated(authService.isAuthenticated());
    window.addEventListener('user:login', syncAuth);
    window.addEventListener('user:logout', syncAuth);
    return () => {
      window.removeEventListener('user:login', syncAuth);
      window.removeEventListener('user:logout', syncAuth);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      if (!isMounted) return;

      if (!authService.isAuthenticated()) {
        setSelectedAccountIdState(null);
        localStorage.removeItem('selectedTradingAccountId');
        setLoading(false);
        return;
      }

      const saved = localStorage.getItem('selectedTradingAccountId');

      if (saved === null) {
        await initializeDefaultAccount();
        return;
      }

      if (saved === 'null') {
        await initializeDefaultAccount();
        return;
      }

      const accountId = parseInt(saved, 10);
      if (isNaN(accountId)) {
        await initializeDefaultAccount();
        return;
      }

      const fromList = accounts.find((a) => a.id === accountId && a.status === 'active');
      if (fromList) {
        setSelectedAccountIdState(accountId);
        setLoading(false);
        return;
      }

      if (accountsLoading) {
        return;
      }

      if (accounts.length > 0) {
        await initializeDefaultAccount();
        return;
      }

      try {
        const account = await tradingAccountsService.get(accountId);
        if (account && account.status === 'active') {
          setSelectedAccountIdState(accountId);
          setLoading(false);
          return;
        }
      } catch {
        /* fallback default via bootstrap */
      }

      await initializeDefaultAccount();
    };

    void initialize();

    return () => {
      isMounted = false;
    };
  }, [initializeDefaultAccount, accounts, accountsLoading]);

  useEffect(() => {
    const handleLogin = () => {
      setIsAuthenticated(true);
      setLoading(true);
      localStorage.removeItem('selectedTradingAccountId');
      setSelectedAccountIdState(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.bootstrap() });
      void queryClient.invalidateQueries({ queryKey: ['tradingAccounts'] });
    };

    const handleLogout = () => {
      setIsAuthenticated(false);
      setSelectedAccountIdState(null);
      localStorage.removeItem('selectedTradingAccountId');
      setLoading(false);
      queryClient.removeQueries({ queryKey: queryKeys.bootstrap() });
      queryClient.removeQueries({ queryKey: ['tradingAccounts'] });
    };

    window.addEventListener('user:login', handleLogin);
    window.addEventListener('user:logout', handleLogout);

    return () => {
      window.removeEventListener('user:login', handleLogin);
      window.removeEventListener('user:logout', handleLogout);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || bootstrapLoading || !bootstrapFetched) {
      return;
    }
    if (!bootstrapError && localStorage.getItem('selectedTradingAccountId') === null) {
      applyDefaultFromBootstrap();
    }
  }, [
    isAuthenticated,
    bootstrapLoading,
    bootstrapFetched,
    bootstrapError,
    applyDefaultFromBootstrap,
  ]);

  const setSelectedAccountId = (accountId: number | null) => {
    setSelectedAccountIdState(accountId);
    if (accountId === null) {
      localStorage.setItem('selectedTradingAccountId', 'null');
    } else {
      localStorage.setItem('selectedTradingAccountId', String(accountId));
    }
  };

  const selectedAccount = useMemo(() => {
    if (selectedAccountId == null) return null;
    return accounts.find((a) => a.id === selectedAccountId) ?? bootstrap?.default_account ?? null;
  }, [selectedAccountId, accounts, bootstrap?.default_account]);

  const contextLoading =
    loading || (isAuthenticated && bootstrapLoading && !bootstrapFetched);

  return (
    <TradingAccountContext.Provider
      value={{
        selectedAccountId,
        setSelectedAccountId,
        selectedAccount,
        accounts,
        loading: contextLoading,
      }}
    >
      {children}
    </TradingAccountContext.Provider>
  );
}
