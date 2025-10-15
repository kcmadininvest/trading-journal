import React from 'react'
import Gauge from './Gauge'

interface TradingMetrics {
  riskRewardRatio: number
  profitFactor: number
  maxDrawdown: number
  winRate: number
  recoveryFactor: number
  expectancy: number
  sharpeRatio: number
}

interface TradingMetricsGaugesProps {
  metrics: TradingMetrics
}

function TradingMetricsGauges({ metrics }: TradingMetricsGaugesProps) {
  const { 
    riskRewardRatio, 
    profitFactor, 
    maxDrawdown, 
    winRate, 
    recoveryFactor, 
    expectancy, 
    sharpeRatio 
  } = metrics

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-indigo-50">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#6366f1" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17l10 5 10-5" stroke="#6366f1" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12l10 5 10-5" stroke="#6366f1" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Métriques de Trading</h3>
          <p className="text-sm text-gray-500">Indicateurs clés de performance et de risque</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7 gap-4">
        {/* Risk Reward Ratio */}
        <Gauge
          value={riskRewardRatio}
          min={0}
          max={3}
          label="Risk Reward Ratio"
          unit=":1"
          color="blue"
          size="sm"
          description="Ratio gain/risque moyen"
        />

        {/* Profit Factor */}
        <Gauge
          value={profitFactor}
          min={0}
          max={3}
          label="Profit Factor"
          unit=""
          color="green"
          size="sm"
          description="Ratio profits/pertes"
        />

        {/* Max Drawdown */}
        <Gauge
          value={Math.abs(maxDrawdown)}
          min={0}
          max={50}
          label="Max Drawdown"
          unit="%"
          color="red"
          size="sm"
          description="Perte maximale en %"
        />

        {/* Win Rate */}
        <Gauge
          value={winRate}
          min={0}
          max={100}
          label="Win Rate"
          unit="%"
          color="green"
          size="sm"
          description="Pourcentage de trades gagnants"
        />

        {/* Recovery Factor */}
        <Gauge
          value={Math.min(recoveryFactor, 1000)}
          min={0}
          max={1000}
          label="Recovery Factor"
          unit=""
          color="orange"
          size="sm"
          description="Capacité de récupération"
        />

        {/* Expectancy */}
        <Gauge
          value={expectancy}
          min={-200}
          max={200}
          label="Expectancy"
          unit="€"
          color="purple"
          size="sm"
          description="Gain moyen attendu par trade"
        />

        {/* Sharpe Ratio */}
        <Gauge
          value={sharpeRatio}
          min={-2}
          max={3}
          label="Sharpe Ratio"
          unit=""
          color="purple"
          size="sm"
          description="Rendement ajusté au risque"
        />
      </div>

      {/* Légende des seuils */}
      <div className="mt-4 pt-3 border-t border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-3 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-100 border border-blue-300"></div>
            <span><strong>Risk Reward:</strong> &gt;1.5 excellent, &gt;1.0 bon, &lt;1.0 à améliorer</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-100 border border-green-300"></div>
            <span><strong>Profit Factor:</strong> &gt;2.0 excellent, &gt;1.5 bon, &lt;1.0 déficitaire</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-100 border border-red-300"></div>
            <span><strong>Max Drawdown:</strong> &lt;10% excellent, &lt;20% acceptable, &gt;30% risqué</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-100 border border-green-300"></div>
            <span><strong>Win Rate:</strong> &gt;60% excellent, &gt;50% bon, &lt;40% à améliorer</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-100 border border-orange-300"></div>
            <span><strong>Recovery Factor:</strong> &gt;3.0 excellent, &gt;2.0 bon, &lt;1.0 à améliorer</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-100 border border-purple-300"></div>
            <span><strong>Expectancy:</strong> &gt;0 profitable, =0 neutre, &lt;0 déficitaire</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-100 border border-purple-300"></div>
            <span><strong>Sharpe Ratio:</strong> &gt;2.0 excellent, &gt;1.0 bon, &lt;0.5 à améliorer</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TradingMetricsGauges
