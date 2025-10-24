import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { queryKeys } from '../lib/queryKeys'
import { tradesService } from '../services/trades'
import { authService } from '../services/auth'

// Hook pour récupérer les statistiques
export const useStatistics = (accountId?: number) => {
  return useQuery({
    queryKey: queryKeys.statistics(accountId),
    queryFn: () => tradesService.getStatistics(accountId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: authService.isAuthenticated(), // Ne s'exécute que si l'utilisateur est authentifié
  })
}

// Hook pour récupérer les données d'analytics
export const useAnalytics = (accountId?: number) => {
  return useQuery({
    queryKey: queryKeys.analytics(accountId),
    queryFn: () => tradesService.getAnalyticsData(accountId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: authService.isAuthenticated(), // Ne s'exécute que si l'utilisateur est authentifié
  })
}

// Hook pour récupérer les données de stratégies globales
export const useGlobalStrategyData = () => {
  return useQuery({
    queryKey: queryKeys.tradeStrategies,
    queryFn: () => tradesService.getTradeStrategies(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: authService.isAuthenticated(), // Ne s'exécute que si l'utilisateur est authentifié
    select: (data) => {
      // Calculer les données globales de stratégie
      const totalStrategies = data.length
      const respectedStrategies = data.filter((s: any) => s.strategy_respected === true).length
      
      return {
        total: totalStrategies,
        respected: respectedStrategies,
        notRespected: totalStrategies - respectedStrategies,
        percentage: totalStrategies > 0 ? (respectedStrategies / totalStrategies) * 100 : 0
      }
    }
  })
}

// Hook pour gérer l'invalidation des queries quand les trades sont mis à jour
export const useTradesUpdateInvalidation = () => {
  const queryClient = useQueryClient()

  useEffect(() => {
    const handleTradesUpdated = () => {
      // Invalider les queries liées aux stratégies
      queryClient.invalidateQueries({ queryKey: queryKeys.tradeStrategies })
      queryClient.invalidateQueries({ queryKey: queryKeys.statistics() })
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics() })
    }

    window.addEventListener('trades:updated', handleTradesUpdated)
    return () => {
      window.removeEventListener('trades:updated', handleTradesUpdated)
    }
  }, [queryClient])
}
