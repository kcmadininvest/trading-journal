import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { tradingAccountsService } from '../services/tradingAccounts';
import { authService } from '../services/auth';

interface TradingAccountContextType {
  selectedAccountId: number | null;
  setSelectedAccountId: (accountId: number | null) => void;
  loading: boolean;
}

const TradingAccountContext = createContext<TradingAccountContextType | null>(null);

export const TradingAccountProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedAccountId, setSelectedAccountIdState] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Fonction pour initialiser le compte par défaut (mémorisée avec useCallback)
  const initializeDefaultAccount = useCallback(async () => {
    if (!authService.isAuthenticated()) {
      // Si l'utilisateur n'est pas connecté, réinitialiser
      setSelectedAccountIdState(null);
      localStorage.removeItem('selectedTradingAccountId');
      setLoading(false);
      return;
    }

    try {
      const defaultAccount = await tradingAccountsService.default();
      if (defaultAccount && defaultAccount.status === 'active') {
        setSelectedAccountIdState(defaultAccount.id);
        localStorage.setItem('selectedTradingAccountId', String(defaultAccount.id));
      } else {
        // Pas de compte par défaut, on reste à null (tous les comptes)
        setSelectedAccountIdState(null);
        localStorage.setItem('selectedTradingAccountId', 'null');
      }
    } catch {
      // Erreur ou pas de compte par défaut
      setSelectedAccountIdState(null);
      localStorage.setItem('selectedTradingAccountId', 'null');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialisation au montage
  useEffect(() => {
    const initialize = async () => {
      if (authService.isAuthenticated()) {
        // Si l'utilisateur est déjà connecté, charger le compte sauvegardé ou le compte par défaut
        const saved = localStorage.getItem('selectedTradingAccountId');
        if (saved === null) {
          // Première connexion : charger le compte par défaut
          await initializeDefaultAccount();
        } else if (saved === 'null') {
          // L'utilisateur a choisi "tous les comptes"
          setSelectedAccountIdState(null);
          setLoading(false);
        } else {
          // Restaurer le compte sauvegardé mais vérifier qu'il existe et appartient à l'utilisateur
          const accountId = parseInt(saved, 10);
          if (!isNaN(accountId)) {
            try {
              // Vérifier que le compte existe et appartient à l'utilisateur
              const account = await tradingAccountsService.get(accountId);
              if (account && account.status === 'active') {
                setSelectedAccountIdState(accountId);
                setLoading(false);
              } else {
                // Le compte n'est plus actif, charger le compte par défaut
                await initializeDefaultAccount();
              }
            } catch (error) {
              // Le compte n'existe pas ou n'appartient pas à l'utilisateur (404), réinitialiser
              console.warn('Le compte sauvegardé n\'existe plus, chargement du compte par défaut', error);
              localStorage.removeItem('selectedTradingAccountId');
              await initializeDefaultAccount();
            }
          } else {
            await initializeDefaultAccount();
          }
        }
      } else {
        // Pas connecté, réinitialiser
        setSelectedAccountIdState(null);
        localStorage.removeItem('selectedTradingAccountId');
        setLoading(false);
      }
    };
    
    initialize();
  }, [initializeDefaultAccount]);

  // Écouter les événements de connexion/déconnexion
  useEffect(() => {
    const handleLogin = async () => {
      // Lors de la connexion, nettoyer le localStorage et charger le compte par défaut du nouvel utilisateur
      setLoading(true);
      // Nettoyer le localStorage pour éviter d'utiliser le compte de l'ancien utilisateur
      localStorage.removeItem('selectedTradingAccountId');
      setSelectedAccountIdState(null);
      await initializeDefaultAccount();
    };

    const handleLogout = () => {
      // Lors de la déconnexion, réinitialiser
      setSelectedAccountIdState(null);
      localStorage.removeItem('selectedTradingAccountId');
      setLoading(false);
    };

    window.addEventListener('user:login', handleLogin);
    window.addEventListener('auth:logout', handleLogout);

    return () => {
      window.removeEventListener('user:login', handleLogin);
      window.removeEventListener('auth:logout', handleLogout);
    };
  }, [initializeDefaultAccount]);

  // Sauvegarder dans localStorage à chaque changement
  const setSelectedAccountId = (accountId: number | null) => {
    setSelectedAccountIdState(accountId);
    if (accountId === null) {
      localStorage.setItem('selectedTradingAccountId', 'null');
    } else {
      localStorage.setItem('selectedTradingAccountId', String(accountId));
    }
  };

  return (
    <TradingAccountContext.Provider value={{ selectedAccountId, setSelectedAccountId, loading }}>
      {children}
    </TradingAccountContext.Provider>
  );
};

export const useTradingAccount = (): TradingAccountContextType => {
  const context = useContext(TradingAccountContext);
  if (!context) {
    throw new Error('useTradingAccount must be used within TradingAccountProvider');
  }
  return context;
};

