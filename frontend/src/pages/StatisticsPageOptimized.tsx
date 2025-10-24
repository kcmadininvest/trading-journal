import React, { useState } from 'react'
import { useStatistics, useAnalytics, useGlobalStrategyData, useTradesUpdateInvalidation } from '../hooks/useStatistics'
import { useTradingAccounts } from '../hooks/useTradingAccounts'
import { formatCurrency } from '../config/chartConfig'
import Tooltip from '../components/common/Tooltip'
import StrategyProgressBar from '../components/Strategy/StrategyProgressBar'
import TradingAccountSelector from '../components/TradingAccount/TradingAccountSelector'
import { TradingAccount } from '../types'
import { useSelectedAccountCurrency } from '../hooks/useSelectedAccountCurrency'
import { StatisticsPageSkeleton } from '../components/ui/Skeleton'

function StatisticsPageOptimized() {
  const [selectedAccount, setSelectedAccount] = useState<TradingAccount | null>(null)
  const selectedCurrency = useSelectedAccountCurrency(selectedAccount)
  
  // Hooks React Query pour les données
  const { data: accounts, isLoading: accountsLoading } = useTradingAccounts()
  const { data: statisticsData, isLoading: statisticsLoading, error: statisticsError } = useStatistics(selectedAccount?.id)
  const { isLoading: analyticsLoading, error: analyticsError } = useAnalytics(selectedAccount?.id)
  const { data: globalStrategyData, isLoading: globalStrategyLoading } = useGlobalStrategyData()
  
  // Gérer l'invalidation des queries quand les trades sont mis à jour
  useTradesUpdateInvalidation()
  
  // États de chargement
  const isLoading = accountsLoading || statisticsLoading || analyticsLoading || globalStrategyLoading
  const hasError = statisticsError || analyticsError
  
  // Sélection automatique du compte par défaut
  React.useEffect(() => {
    if (accounts && accounts.length > 0 && !selectedAccount) {
      const defaultAccount = accounts.find(acc => acc.is_default) || accounts[0]
      setSelectedAccount(defaultAccount)
    }
  }, [accounts, selectedAccount])
  
  // Gestion des erreurs
  if (hasError) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="text-center py-12">
          <div className="text-red-500 text-lg mb-4">Erreur lors du chargement des données</div>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Réessayer
          </button>
        </div>
      </div>
    )
  }
  
  // Skeleton pendant le chargement
  if (isLoading) {
    return <StatisticsPageSkeleton />
  }
  
  // Fonctions utilitaires
  
  const formatVolume = (volume: string) => {
    if (!volume) return 'N/A'
    const num = parseFloat(volume)
    
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    } else if (num >= 1) {
      return num.toFixed(0)
    } else {
      return num.toFixed(2)
    }
  }
  
  const formatRatio = (ratio: number) => {
    const absRatio = Math.abs(ratio)
    
    if (absRatio >= 1) {
      return ratio.toFixed(2)
    } else if (absRatio >= 0.01) {
      return ratio.toFixed(4)
    } else {
      return ratio.toFixed(6)
    }
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="w-full">
        {/* En-tête */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Statistiques Détaillées</h1>
            <p className="text-gray-600">Métriques avancées de performance et statistiques de trading</p>
          </div>
          
          {/* Barre de progression du respect global de la stratégie */}
          <div className="flex-shrink-0">
            <StrategyProgressBar
              respectPercentage={globalStrategyData?.percentage || 0}
              totalTrades={globalStrategyData?.total || 0}
              respectedTrades={globalStrategyData?.respected || 0}
              isLoading={globalStrategyLoading}
            />
          </div>
        </div>

        {/* Sélecteur de compte de trading */}
        <div className="flex justify-between items-center mb-6">
          <TradingAccountSelector
            selectedAccountId={selectedAccount?.id}
            onAccountChange={setSelectedAccount}
            className="flex items-center space-x-2"
          />
          {selectedAccount && (
            <div className="text-sm text-gray-600">
              Statistiques pour le compte "{selectedAccount.name}"
            </div>
          )}
        </div>

        {/* Section 1: Vue d'overview */}
        <div className="mb-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Vue d'ensemble</h2>
            <p className="text-gray-600">Statistiques générales et performance globale</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* Statistiques générales */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Statistiques Générales</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Total trades</span>
                  <span className="text-base font-semibold text-gray-900">
                    {statisticsData?.total_trades || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Taux de réussite</span>
                  <span className="text-base font-semibold text-green-600">
                    {statisticsData ? `${statisticsData.win_rate.toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">P/L total</span>
                  <span className="text-base font-semibold text-gray-900">
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.total_pnl), selectedCurrency) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Gains totaux vs Pertes totales */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Gains vs Pertes</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Gains totaux</span>
                  <span className="text-base font-semibold text-green-600">
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.total_gains), selectedCurrency) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Pertes totales</span>
                  <span className="text-base font-semibold text-red-600">
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.total_losses), selectedCurrency) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Net</span>
                  <span className={`text-base font-semibold ${statisticsData && parseFloat(statisticsData.total_pnl) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.total_pnl), selectedCurrency) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Performance et coûts */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Performance & Coûts</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">P/L moyen</span>
                  <span className="text-base font-semibold text-gray-900">
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.average_pnl), selectedCurrency) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Frais totaux</span>
                  <span className="text-base font-semibold text-orange-600">
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.total_fees), selectedCurrency) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Volume et durée */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Volume & Durée</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Volume total</span>
                  <span className="text-base font-semibold text-cyan-600">
                    {statisticsData ? formatVolume(statisticsData.total_volume) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Durée moyenne</span>
                  <span className="text-base font-semibold text-cyan-600">
                    {statisticsData ? statisticsData.average_duration : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Ratios de Performance */}
        {statisticsData && (
          <div className="mb-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Ratios de Performance</h2>
              <p className="text-gray-600">Métriques avancées pour analyser votre stratégie de trading</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-6">
              {/* Ratios de Performance Principaux */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-gray-500">Performance Principale</h3>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500">Profit Factor</span>
                      <Tooltip 
                        content="Ratio entre les gains totaux et les pertes totales. > 1.0 = profitable, > 2.0 = excellent"
                        placement="top"
                      >
                        <svg className="w-4 h-4 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </Tooltip>
                    </div>
                    <span className={`text-base font-semibold ${statisticsData.profit_factor >= 1.0 ? 'text-green-600' : 'text-red-600'}`}>
                      {statisticsData.profit_factor.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500">Win/Loss Ratio</span>
                      <Tooltip 
                        content="Ratio entre le nombre de trades gagnants et perdants. > 1.0 = plus de gains que de pertes"
                        placement="top"
                      >
                        <svg className="w-4 h-4 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </Tooltip>
                    </div>
                    <span className={`text-base font-semibold ${statisticsData.win_loss_ratio >= 1.0 ? 'text-green-600' : 'text-red-600'}`}>
                      {statisticsData.win_loss_ratio.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ratios de Récupération */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-gray-500">Récupération</h3>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500">Ratio Récupération</span>
                      <Tooltip 
                        content="Ratio entre le meilleur trade et la pire perte. > 1.0 = le meilleur gain couvre la pire perte"
                        placement="top"
                      >
                        <svg className="w-4 h-4 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </Tooltip>
                    </div>
                    <span className={`text-base font-semibold ${statisticsData.recovery_ratio >= 1.0 ? 'text-green-600' : 'text-orange-600'}`}>
                      {statisticsData.recovery_ratio.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500">P/L par Trade</span>
                      <Tooltip 
                        content="Gain ou perte moyen par trade. Indique la rentabilité moyenne de chaque opération"
                        placement="top"
                      >
                        <svg className="w-4 h-4 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </Tooltip>
                    </div>
                    <span className={`text-base font-semibold ${statisticsData.pnl_per_trade >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(statisticsData.pnl_per_trade, selectedCurrency)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ratios Financiers */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-gray-500">Efficacité Financière</h3>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500">Ratio Frais</span>
                      <Tooltip 
                        content="Pourcentage des frais par rapport au P/L total. < 10% = frais raisonnables, > 20% = frais élevés"
                        placement="top"
                      >
                        <svg className="w-4 h-4 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </Tooltip>
                    </div>
                    <span className={`text-base font-semibold ${statisticsData.fees_ratio <= 0.1 ? 'text-green-600' : 'text-orange-600'}`}>
                      {(statisticsData.fees_ratio * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500">Volume/P/L</span>
                      <Tooltip 
                        content="Efficacité du trading par unité de volume. Plus élevé = meilleure efficacité de capital"
                        placement="top"
                      >
                        <svg className="w-4 h-4 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </Tooltip>
                    </div>
                    <span className="text-base font-semibold text-gray-900">
                      {formatRatio(statisticsData.volume_pnl_ratio)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ratios Temporels */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-gray-500">Analyse Temporelle</h3>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500">Fréquence</span>
                      <Tooltip 
                        content="Nombre moyen de trades par jour de trading. Indique l'activité et le style de trading"
                        placement="top"
                      >
                        <svg className="w-4 h-4 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </Tooltip>
                    </div>
                    <span className="text-base font-semibold text-cyan-600">
                      {statisticsData.frequency_ratio.toFixed(1)} trades/jour
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500">Ratio Durée</span>
                      <Tooltip 
                        content="Ratio entre la durée moyenne des trades gagnants et perdants. > 1.0 = les trades gagnants durent plus longtemps que les perdants"
                        placement="top"
                      >
                        <svg className="w-4 h-4 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </Tooltip>
                    </div>
                    <span className={`text-base font-semibold ${statisticsData.duration_ratio >= 1.0 ? 'text-green-600' : 'text-orange-600'}`}>
                      {statisticsData.duration_ratio.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Analyse des Trades */}
        <div className="mb-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Analyse des Trades</h2>
            <p className="text-gray-600">Détail des trades gagnants et perdants</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* Trades gagnants */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Trades Gagnants</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Nombre</span>
                  <span className="text-base font-semibold text-green-600">
                    {statisticsData?.winning_trades || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Meilleur trade</span>
                  <span className="text-base font-semibold text-green-600">
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.best_trade), selectedCurrency) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Trades perdants */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Trades Perdants</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Nombre</span>
                  <span className="text-base font-semibold text-red-600">
                    {statisticsData?.losing_trades || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Pire trade</span>
                  <span className="text-base font-semibold text-red-600">
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.worst_trade), selectedCurrency) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StatisticsPageOptimized
