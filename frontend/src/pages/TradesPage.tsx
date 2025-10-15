import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'react-hot-toast'
import { tradesService, TradeStatistics } from '../services/trades'
import StatCard from '../components/common/StatCard'
// Import déplacé vers le menu: l'UI d'import n'est plus ici
import PerformanceChart from '../components/charts/PerformanceChart'
import DurationDistributionChart from '../components/charts/DurationDistributionChart'
import TradingMetricsDashboard from '../components/charts/TradingMetricsDashboard'
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
              <TradingMetricsDashboard metrics={tradingMetrics} />
            )}
          </div>

          {/* Cartes - Bas droite - 2 lignes de 3 cartes */}
          <div style={{ height: '350px' }}>
            {statistics && !loading && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
                {/* Première colonne */}
                <div className="flex flex-col justify-between h-full gap-4">
                  <StatCard
                    label="Total Trades"
                    value={statistics.total_trades}
                    icon="📊"
                    variant="info"
                  />
                  <StatCard
                    label="Taux de réussite"
                    value={`${parseFloat(statistics.win_rate.toString()).toFixed(1)}%`}
                    icon="🎯"
                    variant={parseFloat(statistics.win_rate.toString()) >= 50 ? 'success' : 'danger'}
                    trend={parseFloat(statistics.win_rate.toString()) >= 50 ? 'up' : 'down'}
                    trendValue={`${statistics.winning_trades}W / ${statistics.losing_trades}L`}
                  />
                </div>
                
                {/* Deuxième colonne */}
                <div className="flex flex-col justify-between h-full gap-4">
                  <StatCard
                    label="PnL Total"
                    value={formatCurrency(statistics.total_pnl)}
                    icon="💰"
                    variant={typeof statistics.total_pnl === 'string' ? (parseFloat(statistics.total_pnl) >= 0 ? 'success' : 'danger') : (statistics.total_pnl >= 0 ? 'success' : 'danger')}
                    trend={typeof statistics.total_pnl === 'string' ? (parseFloat(statistics.total_pnl) >= 0 ? 'up' : 'down') : (statistics.total_pnl >= 0 ? 'up' : 'down')}
                    trendValue={formatCurrency(statistics.average_pnl) + ' moy'}
                  />
                  <StatCard
                    label="Frais Totaux"
                    value={formatCurrency(statistics.total_fees)}
                    icon="💳"
                    variant="warning"
                  />
                </div>
                
                {/* Troisième colonne */}
                <div className="flex flex-col justify-between h-full gap-4">
                  <StatCard
                    label="Meilleur Trade"
                    value={formatCurrency(statistics.best_trade)}
                    icon="🚀"
                    variant="success"
                  />
                  <StatCard
                    label="Pire Trade"
                    value={formatCurrency(statistics.worst_trade)}
                    icon="📉"
                    variant="danger"
                  />
                </div>
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

