import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'react-hot-toast'
import { tradesService, TradeStatistics } from '../services/trades'
import ModernStatCard from '../components/common/ModernStatCard'
// Import déplacé vers le menu: l'UI d'import n'est plus ici
import PerformanceChart from '../components/charts/PerformanceChart'
import DurationDistributionChart from '../components/charts/DurationDistributionChart'
import ModernTradingMetricsDashboard from '../components/charts/ModernTradingMetricsDashboard'
import WaterfallChart from '../components/charts/WaterfallChart'
import WeekdayPerformanceChart from '../components/charts/WeekdayPerformanceChart'
import TradesTablePage from './TradesTablePage'

interface Trade {
  id: number
  topstep_id: string
  contract_name: string
  trade_type: string
  entered_at: string
  exited_at: string | null
  entry_price: string
  exit_price: string | null
  pnl: string | null
  net_pnl: string
  fees: string
  commissions: string
  size: string
  trade_duration: string | null
}

function TradesPage() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [hash, setHash] = useState<string>(typeof window !== 'undefined' ? window.location.hash : '')
  const [statistics, setStatistics] = useState<TradeStatistics | null>(null)
  const [cascadeData, setCascadeData] = useState<any[]>([])
  const [weekdayData, setWeekdayData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  // Import CSV via modal dans le menu

  // Filtres (table déplacée dans le menu)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [tradesData, statsData, cascadeResponse, weekdayResponse] = await Promise.all([
        tradesService.getTrades(),
        tradesService.getStatistics(),
        tradesService.getCapitalEvolution(),
        tradesService.getWeekdayPerformance()
      ])
      setTrades(tradesData)
      setStatistics(statsData)
      setCascadeData(cascadeResponse)
      setWeekdayData(weekdayResponse)
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error)
      toast.error('Impossible de charger les données')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    function onTradesUpdated() {
      loadData()
    }
    window.addEventListener('trades:updated', onTradesUpdated)
    return () => window.removeEventListener('trades:updated', onTradesUpdated)
  }, [loadData])

  useEffect(() => {
    function onHashChange() {
      setHash(window.location.hash)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // L'import est géré dans ImportCSVModal

  function formatCurrency(value: string | number | null) {
    if (!value) return '-'
    const num = typeof value === 'string' ? parseFloat(value) : value
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD'
    }).format(num)
  }

  // Calculer les métriques de trading
  const tradingMetrics = useMemo(() => {
    if (!trades || trades.length === 0) {
      return {
        winRate: 0,
        avgWinningTrade: 0,
        avgLosingTrade: 0
      }
    }

    const winningTrades = trades.filter(t => parseFloat(t.net_pnl) > 0)
    const losingTrades = trades.filter(t => parseFloat(t.net_pnl) < 0)
    
    const winRate = (winningTrades.length / trades.length) * 100
    const avgWinningTrade = winningTrades.length > 0 
      ? winningTrades.reduce((sum, t) => sum + parseFloat(t.net_pnl), 0) / winningTrades.length
      : 0
    const avgLosingTrade = losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => sum + parseFloat(t.net_pnl), 0) / losingTrades.length
      : 0

    return {
      winRate: Math.round(winRate),
      avgWinningTrade: Math.round(avgWinningTrade),
      avgLosingTrade: Math.round(avgLosingTrade)
    }
  }, [trades])

  // Préparer les données pour le graphique (agrégation par jour)
  const chartData = useMemo(() => {
    if (!trades || trades.length === 0) return [] as { date: string; pnl: number; cumulative: number }[]

    // 1) Agréger les PnL par jour (JJ/MM)
    const pnlByDay = new Map<string, number>()
    for (const t of trades) {
      const d = new Date(t.entered_at)
      const key = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
      const pnl = parseFloat(t.net_pnl)
      pnlByDay.set(key, (pnlByDay.get(key) || 0) + pnl)
    }

    // 2) Ordonner les jours chronologiquement
    const uniqueDates = Array.from(new Set(
      trades
        .map(t => new Date(t.entered_at))
        .sort((a, b) => a.getTime() - b.getTime())
        .map(d => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }))
    ))

    // 3) Construire la série cumulée par jour
    let cumulative = 0
    const series = uniqueDates.map(dateKey => {
      const dayPnl = pnlByDay.get(dateKey) || 0
      cumulative += dayPnl
      return { date: dateKey, pnl: dayPnl, cumulative }
    })

    return series
  }, [trades])

  const durationBins = useMemo(() => {
    const bins = [
      { label: '0-5m', min: 0, max: 5 },
      { label: '5-10m', min: 5, max: 10 },
      { label: '10-20m', min: 10, max: 20 },
      { label: '20-30m', min: 20, max: 30 },
      { label: '30-45m', min: 30, max: 45 },
      { label: '45-60m', min: 45, max: 60 },
      { label: '60m+', min: 60, max: Infinity },
    ]

    const result = bins.map(b => ({ label: b.label, successful: 0, unsuccessful: 0 }))

    trades.forEach(trade => {
      if (!trade.trade_duration) return
      // trade_duration est au format ISO 8601 (ex: '00:07:34.99' ou '0:07:34')
      const parts = trade.trade_duration.split(':')
      if (parts.length < 2) return
      const hours = parseInt(parts[0] || '0', 10)
      const minutes = parseInt(parts[1] || '0', 10)
      const totalMinutes = hours * 60 + minutes

      const isSuccessful = parseFloat(trade.net_pnl) > 0
      const idx = bins.findIndex(b => totalMinutes >= b.min && totalMinutes < b.max)
      if (idx >= 0) {
        if (isSuccessful) result[idx].successful += 1
        else result[idx].unsuccessful += 1
      }
    })

    return result
  }, [trades])

  if (hash === '#trades-table') {
    return (
      <TradesTablePage />
    )
  }

  return (
    <div className="w-full flex flex-col gap-6">
      {/* En-tête */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1 flex items-center gap-2">
            <svg className="w-7 h-7 md:w-8 md:h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" fill="currentColor"/>
            </svg>
            Journal de Trading
          </h1>
          <p className="text-sm md:text-base text-gray-600">Analysez vos performances et optimisez votre stratégie</p>
        </div>
      </div>

      {/* Zone d'import déplacée dans le menu (ImportCSVModal) */}

      {/* Layout réorganisé : graphiques en haut, tableau de bord et cartes en bas */}
      <div className="space-y-6">
        {/* Ligne du haut : Graphiques */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Graphique SOLDE DU COMPTE DANS LE TEMPS - Haut gauche (2/3 de la largeur) */}
          <div className="lg:col-span-2">
            {!loading && trades.length > 0 && (
              <PerformanceChart data={chartData} />
            )}
          </div>
          
          {/* Graphique Répartition des trades par durée - Haut droite (1/3 de la largeur) */}
          <div className="lg:col-span-1">
            {!loading && trades.length > 0 && (
              <DurationDistributionChart bins={durationBins} />
            )}
          </div>
        </div>

        {/* Ligne du milieu : Graphiques d'évolution et performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Graphique Évolution des Gains et Pertes Journalière */}
          <div>
            {!loading && cascadeData.length > 0 && (
              <WaterfallChart data={cascadeData} />
            )}
          </div>
          
          {/* Graphique Performance par Jour de la Semaine */}
          <div>
            {!loading && weekdayData.length > 0 && (
              <WeekdayPerformanceChart data={weekdayData} />
            )}
          </div>
        </div>

        {/* Ligne du bas : Tableau de bord et cartes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Tableau de bord TOPSTEP TRADER PERFORMANCE TRACKER - Bas gauche */}
          <div>
            {!loading && trades.length > 0 && (
              <ModernTradingMetricsDashboard metrics={tradingMetrics} />
            )}
          </div>

          {/* Cartes - Bas droite - Grid uniforme */}
          <div className="h-full">
            {statistics && !loading && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 h-full">
                <ModernStatCard
                  label="Total Trades"
                  value={statistics.total_trades}
                  icon={
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  }
                  variant="info"
                  size="small"
                />
                
                <ModernStatCard
                  label="Taux de réussite"
                  value={`${parseFloat(statistics.win_rate.toString()).toFixed(1)}%`}
                  icon={
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                  variant={parseFloat(statistics.win_rate.toString()) >= 50 ? 'success' : 'danger'}
                  trend={parseFloat(statistics.win_rate.toString()) >= 50 ? 'up' : 'down'}
                  trendValue={`${statistics.winning_trades}W / ${statistics.losing_trades}L`}
                  size="small"
                />
                
                <ModernStatCard
                  label="PnL Total"
                  value={formatCurrency(statistics.total_pnl)}
                  icon={
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                  variant={typeof statistics.total_pnl === 'string' ? (parseFloat(statistics.total_pnl) >= 0 ? 'success' : 'danger') : (statistics.total_pnl >= 0 ? 'success' : 'danger')}
                  trend={typeof statistics.total_pnl === 'string' ? (parseFloat(statistics.total_pnl) >= 0 ? 'up' : 'down') : (statistics.total_pnl >= 0 ? 'up' : 'down')}
                  trendValue={formatCurrency(statistics.average_pnl) + ' moy'}
                  size="small"
                />
                
                <ModernStatCard
                  label="Frais Totaux"
                  value={formatCurrency(statistics.total_fees)}
                  icon={
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  }
                  variant="warning"
                  size="small"
                />
                
                <ModernStatCard
                  label="Meilleur Trade"
                  value={formatCurrency(statistics.best_trade)}
                  icon={
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  }
                  variant="success"
                  size="small"
                />
                
                <ModernStatCard
                  label="Pire Trade"
                  value={formatCurrency(statistics.worst_trade)}
                  icon={
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                    </svg>
                  }
                  variant="danger"
                  size="small"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tableau déplacé dans le menu Mes Trades (modal) */}
    </div>
  )
}

export default TradesPage