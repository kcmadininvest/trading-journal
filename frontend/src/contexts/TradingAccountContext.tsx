import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
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
  const isHandlingLoginRef = useRef(false); // Ref partagé pour éviter les race conditions

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
    let isMounted = true;
    
    const initialize = async () => {
      // Si un login est en cours, attendre qu'il se termine
      // Vérifier plusieurs fois pour s'assurer qu'on ne rate pas le login
      for (let i = 0; i < 10; i++) {
        if (!isHandlingLoginRef.current) break;
        await new Promise(resolve => setTimeout(resolve, 50));
        if (!isMounted) return;
      }

      // Si un login est toujours en cours, laisser handleLogin gérer l'initialisation
      if (isHandlingLoginRef.current) {
        return;
      }

      if (!isMounted) return;

      if (authService.isAuthenticated()) {
        // Si l'utilisateur est déjà connecté, charger le compte sauvegardé ou le compte par défaut
        const saved = localStorage.getItem('selectedTradingAccountId');
        if (saved === null) {
          // Première connexion : charger le compte par défaut
          await initializeDefaultAccount();
        } else if (saved === 'null') {
          // L'utilisateur a choisi "tous les comptes", mais vérifier s'il y a un compte par défaut disponible
          // Si un compte par défaut existe, l'utiliser au lieu de null
          try {
            const defaultAccount = await tradingAccountsService.default();
            if (defaultAccount && defaultAccount.status === 'active') {
              setSelectedAccountIdState(defaultAccount.id);
              localStorage.setItem('selectedTradingAccountId', String(defaultAccount.id));
            } else {
              // Pas de compte par défaut, on reste à null (tous les comptes)
              setSelectedAccountIdState(null);
            }
          } catch {
            // Erreur ou pas de compte par défaut, on reste à null
            setSelectedAccountIdState(null);
          } finally {
            setLoading(false);
          }
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

    return () => {
      isMounted = false;
    };
  }, [initializeDefaultAccount]);

  // Écouter les événements de connexion/déconnexion
  useEffect(() => {
    const handleLogin = async () => {
      // Lors de la connexion, restaurer le compte sauvegardé s'il existe et appartient à l'utilisateur
      // Sinon, charger le compte par défaut
      isHandlingLoginRef.current = true;
      setLoading(true);
      
      try {
        // Vérifier s'il y a un compte sauvegardé dans le localStorage
        const saved = localStorage.getItem('selectedTradingAccountId');
        
        if (saved && saved !== 'null') {
          // Tenter de restaurer le compte sauvegardé
          const accountId = parseInt(saved, 10);
          if (!isNaN(accountId)) {
            try {
              // Vérifier que le compte existe et appartient à l'utilisateur
              const account = await tradingAccountsService.get(accountId);
              if (account && account.status === 'active') {
                // Le compte existe et est actif, le restaurer
                setSelectedAccountIdState(accountId);
                localStorage.setItem('selectedTradingAccountId', String(accountId));
                setLoading(false);
                isHandlingLoginRef.current = false;
                return;
              }
            } catch (error) {
              // Le compte n'existe pas ou n'appartient pas à l'utilisateur, continuer pour charger le compte par défaut
              console.warn('Le compte sauvegardé n\'existe plus ou n\'appartient pas à l\'utilisateur, chargement du compte par défaut', error);
            }
          }
        }
        
        // Si aucun compte sauvegardé valide, charger le compte par défaut
        localStorage.removeItem('selectedTradingAccountId');
        setSelectedAccountIdState(null);
        await initializeDefaultAccount();
      } catch (error) {
        console.error('Erreur lors de la restauration du compte après connexion', error);
        // En cas d'erreur, charger le compte par défaut
        localStorage.removeItem('selectedTradingAccountId');
        setSelectedAccountIdState(null);
        await initializeDefaultAccount();
      } finally {
        isHandlingLoginRef.current = false;
      }
    };

    const handleLogout = () => {
      // Lors de la déconnexion, réinitialiser
      setSelectedAccountIdState(null);
      localStorage.removeItem('selectedTradingAccountId');
      setLoading(false);
    };

    window.addEventListener('user:login', handleLogin);
    window.addEventListener('user:logout', handleLogout);

    return () => {
      window.removeEventListener('user:login', handleLogin);
      window.removeEventListener('user:logout', handleLogout);
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

