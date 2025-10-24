import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../lib/queryKeys'
import { tradingAccountService } from '../services/tradingAccountService'
import { TradingAccountCreate, TradingAccountUpdate } from '../types'
import { authService } from '../services/auth'

// Hook pour récupérer tous les comptes de trading
export const useTradingAccounts = () => {
  return useQuery({
    queryKey: queryKeys.tradingAccounts,
    queryFn: () => tradingAccountService.getAccounts(),
    // Permettre les appels même sans authentification pour permettre la connexion
    // Les erreurs 401 seront gérées par l'apiClient
    staleTime: 5 * 60 * 1000, // 5 minutes
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
