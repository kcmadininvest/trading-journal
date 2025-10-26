import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { queryKeys } from '../lib/queryKeys'
import { tradingAccountService } from '../services/tradingAccountService'
import { TradingAccountCreate, TradingAccountUpdate } from '../types'
import { authService } from '../services/auth'

// Hook pour récupérer tous les comptes de trading
export const useTradingAccounts = () => {
  const queryClient = useQueryClient()

  // Écouter les événements de changement d'utilisateur pour invalider le cache
  useEffect(() => {
    const handleUserChange = (event: any) => {
      console.log('🔄 [USE_TRADING_ACCOUNTS] Événement de changement d\'utilisateur:', event.type);
      console.log('🗑️ [USE_TRADING_ACCOUNTS] Invalidation du cache React Query');
      queryClient.invalidateQueries({ queryKey: queryKeys.tradingAccounts })
    }

    console.log('👂 [USE_TRADING_ACCOUNTS] Ajout des écouteurs d\'événements');
    window.addEventListener('user:login', handleUserChange)
    window.addEventListener('user:logout', handleUserChange)

    return () => {
      console.log('🧹 [USE_TRADING_ACCOUNTS] Suppression des écouteurs d\'événements');
      window.removeEventListener('user:login', handleUserChange)
      window.removeEventListener('user:logout', handleUserChange)
    }
  }, [queryClient])

  return useQuery({
    queryKey: queryKeys.tradingAccounts,
    queryFn: async () => {
      console.log('🏦 [USE_TRADING_ACCOUNTS] Exécution de la queryFn');
      try {
        const result = await tradingAccountService.getAccounts();
        console.log('✅ [USE_TRADING_ACCOUNTS] QueryFn réussie:', result.length, 'comptes');
        return result;
      } catch (error: any) {
        console.log('❌ [USE_TRADING_ACCOUNTS] Erreur dans queryFn:', error.response?.status, error.message);
        // Si l'utilisateur n'est pas authentifié ou n'a pas de comptes, retourner un tableau vide
        if (error.response?.status === 401 || error.response?.status === 403) {
          console.log('ℹ️ [USE_TRADING_ACCOUNTS] Utilisateur non authentifié ou sans comptes, retour tableau vide');
          return [];
        }
        // Pour les autres erreurs, les relancer
        throw error;
      }
    },
    enabled: authService.isAuthenticated(), // Ne s'exécute que si l'utilisateur est authentifié
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error: any) => {
      console.log('🔄 [USE_TRADING_ACCOUNTS] Retry attempt:', failureCount, 'Error:', error?.response?.status);
      // Ne pas retry sur les erreurs d'authentification
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false;
      }
      // Retry jusqu'à 3 fois pour les autres erreurs
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// Hook pour récupérer un compte spécifique
export const useTradingAccount = (id: number) => {
  return useQuery({
    queryKey: queryKeys.tradingAccount(id),
    queryFn: () => tradingAccountService.getAccount(id),
    enabled: !!id && authService.isAuthenticated(), // Ne s'exécute que si l'utilisateur est authentifié et l'ID est fourni
  })
}

// Hook pour créer un compte
export const useCreateTradingAccount = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (data: TradingAccountCreate) => tradingAccountService.createAccount(data),
    onSuccess: () => {
      // Invalider et refetch les comptes
      queryClient.invalidateQueries({ queryKey: queryKeys.tradingAccounts })
    },
  })
}

// Hook pour mettre à jour un compte
export const useUpdateTradingAccount = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: TradingAccountUpdate }) => 
      tradingAccountService.updateAccount(id, data),
    onSuccess: (_, { id }) => {
      // Invalider les comptes et le compte spécifique
      queryClient.invalidateQueries({ queryKey: queryKeys.tradingAccounts })
      queryClient.invalidateQueries({ queryKey: queryKeys.tradingAccount(id) })
    },
  })
}

// Hook pour supprimer un compte
export const useDeleteTradingAccount = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id: number) => tradingAccountService.deleteAccount(id),
    onSuccess: (_, id) => {
      // Invalider les comptes et supprimer le compte du cache
      queryClient.invalidateQueries({ queryKey: queryKeys.tradingAccounts })
      queryClient.removeQueries({ queryKey: queryKeys.tradingAccount(id) })
    },
  })
}