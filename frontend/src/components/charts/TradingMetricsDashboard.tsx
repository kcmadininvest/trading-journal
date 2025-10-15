import React from 'react'
import SemiCircularGauge from './SemiCircularGauge'

interface TradingMetrics {
  winRate: number
  avgWinningTrade: number
  avgLosingTrade: number
}

interface TradingMetricsDashboardProps {
  metrics: TradingMetrics
}

function TradingMetricsDashboard({ metrics }: TradingMetricsDashboardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-col" style={{ height: '350px' }}>
      {/* Title */}
      <div className="text-center mb-2">
        <h2 className="text-lg font-semibold text-gray-900 uppercase tracking-wide">
          TRADER PERFORMANCE TRACKER
        </h2>
        <div className="w-16 h-px bg-gray-300 mx-auto mt-1"></div>
      </div>
      
      {/* Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
        <SemiCircularGauge
          title="Win Rate Percent"
          value={metrics.winRate}
          max={100}
          unit="%"
          goal="Maintain the goal of 60% win rate."
          color="#6b7280"
        />
        
        <SemiCircularGauge
          title="Avg Winning Trade"
          value={metrics.avgWinningTrade}
          max={1200}
          unit="$"
          goal="Increase average to $400 (+$100)."
          color="#6b7280"
        />
        
        <SemiCircularGauge
          title="Avg Losing Trade"
          value={Math.abs(metrics.avgLosingTrade)}
          max={850}
          unit="$"
          goal="Decrease average to -$150 (+$50)."
          color="#6b7280"
        />
      </div>
    </div>
  )
}

export default TradingMetricsDashboard
