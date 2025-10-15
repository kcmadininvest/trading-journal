import React, { useState, useEffect } from 'react'
import { tradesService, TradeStatistics } from '../services/trades'
import { formatCurrency } from '../config/chartConfig'
import Tooltip from '../components/common/Tooltip'

interface AnalyticsData {
  daily_stats: {
    avg_gain_per_day: number;
    median_gain_per_day: number;
    avg_loss_per_day: number;
    median_loss_per_day: number;
    max_gain_per_day: number;
    max_loss_per_day: number;
    avg_trades_per_day: number;
    median_trades_per_day: number;
  };
  trade_stats: {
    max_gain_per_trade: number;
    max_loss_per_trade: number;
    avg_winning_trade: number;
    median_winning_trade: number;
    avg_losing_trade: number;
    median_losing_trade: number;
  };
  consecutive_stats: {
    max_consecutive_wins_per_day: number;
    max_consecutive_losses_per_day: number;
    max_consecutive_wins: number;
    max_consecutive_losses: number;
  };
}


function StatisticsPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [statisticsData, setStatisticsData] = useState<TradeStatistics | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true)
      const [analytics, statistics] = await Promise.all([
        tradesService.getAnalyticsData(),
        tradesService.getStatistics()
      ])
      setAnalyticsData(analytics)
      setStatisticsData(statistics)
    } catch (error) {
      // Erreur silencieuse lors du chargement des données d'analyses
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalyticsData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const formatNumber = (value: number) => {
    return value.toFixed(2)
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="w-full">
        {/* En-tête */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Statistiques Détaillées</h1>
          <p className="text-gray-600">Métriques avancées de performance et statistiques de trading</p>
        </div>

        {/* Section 1: Vue d'ensemble */}
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
                  <span className="text-blue-600 text-2xl">📊</span>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Statistiques Générales</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Total trades</span>
                  <span className="text-base font-semibold text-gray-900">
                    {statisticsData ? statisticsData.total_trades : 'N/A'}
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
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.total_pnl)) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Gains totaux vs Pertes totales */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <span className="text-emerald-600 text-2xl">💰</span>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Gains vs Pertes</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Gains totaux</span>
                  <span className="text-base font-semibold text-green-600">
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.total_gains)) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Pertes totales</span>
                  <span className="text-base font-semibold text-red-600">
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.total_losses)) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Net</span>
                  <span className={`text-base font-semibold ${statisticsData && parseFloat(statisticsData.total_pnl) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.total_pnl)) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Performance et coûts */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-purple-600 text-2xl">💰</span>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Performance & Coûts</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">P/L moyen</span>
                  <span className="text-base font-semibold text-gray-900">
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.average_pnl)) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Frais totaux</span>
                  <span className="text-base font-semibold text-orange-600">
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.total_fees)) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Volume et durée */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
                  <span className="text-cyan-600 text-2xl">⏱️</span>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Volume & Durée</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Volume total</span>
                  <span className="text-base font-semibold text-cyan-600">
                    {statisticsData ? statisticsData.total_volume : 'N/A'}
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

        {/* Section 2: Analyse des Trades */}
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
                  <span className="text-green-600 text-2xl">✅</span>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Trades Gagnants</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Nombre</span>
                  <span className="text-base font-semibold text-green-600">
                    {statisticsData ? statisticsData.winning_trades : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Meilleur trade</span>
                  <span className="text-base font-semibold text-green-600">
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.best_trade)) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Trades perdants */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <span className="text-red-600 text-2xl">❌</span>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Trades Perdants</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Nombre</span>
                  <span className="text-base font-semibold text-red-600">
                    {statisticsData ? statisticsData.losing_trades : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Pire trade</span>
                  <span className="text-base font-semibold text-red-600">
                    {statisticsData ? formatCurrency(parseFloat(statisticsData.worst_trade)) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Contrat le plus tradé */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <span className="text-yellow-600 text-2xl">📈</span>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Contrat Favori</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Le plus tradé</span>
                  <span className="text-base font-semibold text-yellow-600">
                    {statisticsData?.most_traded_contract || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Analyses Avancées */}
        <div className="mb-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Analyses Avancées</h2>
            <p className="text-gray-600">Métriques détaillées et analyses comportementales</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* Gains quotidiens */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-green-600 text-2xl">📈</span>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Gains Quotidiens</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Moyenne</span>
                  <span className="text-base font-semibold text-green-600">
                    {analyticsData?.daily_stats ? formatCurrency(analyticsData.daily_stats.avg_gain_per_day) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Médiane</span>
                  <span className="text-base font-semibold text-green-600">
                    {analyticsData?.daily_stats ? formatCurrency(analyticsData.daily_stats.median_gain_per_day) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Maximum</span>
                  <span className="text-base font-semibold text-green-600">
                    {analyticsData?.daily_stats ? formatCurrency(analyticsData.daily_stats.max_gain_per_day) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Pertes quotidiennes */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <span className="text-red-600 text-2xl">📉</span>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Pertes Quotidiennes</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Moyenne</span>
                  <span className="text-base font-semibold text-red-600">
                    {analyticsData?.daily_stats ? formatCurrency(analyticsData.daily_stats.avg_loss_per_day) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Médiane</span>
                  <span className="text-base font-semibold text-red-600">
                    {analyticsData?.daily_stats ? formatCurrency(analyticsData.daily_stats.median_loss_per_day) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Maximum</span>
                  <span className="text-base font-semibold text-red-600">
                    {analyticsData?.daily_stats ? formatCurrency(analyticsData.daily_stats.max_loss_per_day) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Trades gagnants détaillés */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 text-2xl">✅</span>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Trades Gagnants</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Moyenne</span>
                  <span className="text-base font-semibold text-blue-600">
                    {analyticsData?.trade_stats ? formatCurrency(analyticsData.trade_stats.avg_winning_trade) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Médiane</span>
                  <span className="text-base font-semibold text-blue-600">
                    {analyticsData?.trade_stats ? formatCurrency(analyticsData.trade_stats.median_winning_trade) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Maximum</span>
                  <span className="text-base font-semibold text-blue-600">
                    {analyticsData?.trade_stats ? formatCurrency(analyticsData.trade_stats.max_gain_per_trade) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Trades perdants détaillés */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <span className="text-gray-600 text-2xl">❌</span>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Trades Perdants</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Moyenne</span>
                  <span className="text-base font-semibold text-gray-600">
                    {analyticsData?.trade_stats ? formatCurrency(analyticsData.trade_stats.avg_losing_trade) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Médiane</span>
                  <span className="text-base font-semibold text-gray-600">
                    {analyticsData?.trade_stats ? formatCurrency(analyticsData.trade_stats.median_losing_trade) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Maximum</span>
                  <span className="text-base font-semibold text-gray-600">
                    {analyticsData?.trade_stats ? formatCurrency(analyticsData.trade_stats.max_loss_per_trade) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Trades par jour */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-purple-600 text-2xl">📊</span>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Trades par Jour</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Moyenne</span>
                  <span className="text-base font-semibold text-purple-600">
                    {analyticsData?.daily_stats ? formatNumber(analyticsData.daily_stats.avg_trades_per_day) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Médiane</span>
                  <span className="text-base font-semibold text-purple-600">
                    {analyticsData?.daily_stats ? formatNumber(analyticsData.daily_stats.median_trades_per_day) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Trades individuels */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <span className="text-indigo-600 text-2xl">🎯</span>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Trades Individuels</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Gain max</span>
                  <span className="text-base font-semibold text-green-600">
                    {analyticsData?.trade_stats ? formatCurrency(analyticsData.trade_stats.max_gain_per_trade) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Perte max</span>
                  <span className="text-base font-semibold text-red-600">
                    {analyticsData?.trade_stats ? formatCurrency(analyticsData.trade_stats.max_loss_per_trade) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Séquences consécutives */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <span className="text-orange-600 text-2xl">🔄</span>
                </div>
                <div>
                  <h3 className="text-base font-medium text-gray-500">Séquences</h3>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Gains/jour</span>
                  <span className="text-base font-semibold text-green-600">
                    {analyticsData?.consecutive_stats ? analyticsData.consecutive_stats.max_consecutive_wins_per_day : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Pertes/jour</span>
                  <span className="text-base font-semibold text-red-600">
                    {analyticsData?.consecutive_stats ? analyticsData.consecutive_stats.max_consecutive_losses_per_day : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Gains globaux</span>
                  <span className="text-base font-semibold text-green-600">
                    {analyticsData?.consecutive_stats ? analyticsData.consecutive_stats.max_consecutive_wins : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Pertes globales</span>
                  <span className="text-base font-semibold text-red-600">
                    {analyticsData?.consecutive_stats ? analyticsData.consecutive_stats.max_consecutive_losses : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Ratios de Performance */}
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
                    <span className="text-emerald-600 text-2xl">📈</span>
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
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-500">Consistance</span>
                      <Tooltip 
                        content="Pourcentage de trades gagnants. > 50% = plus de la moitié des trades sont gagnants"
                        placement="top"
                      >
                        <svg className="w-4 h-4 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                      </Tooltip>
                    </div>
                    <span className={`text-base font-semibold ${statisticsData.consistency_ratio >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                      {statisticsData.consistency_ratio.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Ratios de Récupération */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 text-2xl">🛡️</span>
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
                      {formatCurrency(statisticsData.pnl_per_trade)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ratios Financiers */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <span className="text-purple-600 text-2xl">💰</span>
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
                      {statisticsData.volume_pnl_ratio.toFixed(6)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ratios Temporels */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
                    <span className="text-cyan-600 text-2xl">⏱️</span>
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
      </div>
    </div>
  )
}

export default StatisticsPage
