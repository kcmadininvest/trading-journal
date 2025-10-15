import React from 'react'
import TradingMetricsGauges from './TradingMetricsGauges'

// Composant de démonstration avec des données d'exemple
function TradingMetricsGaugesDemo() {
  // Données d'exemple pour démonstration
  const demoMetrics = {
    riskRewardRatio: 1.8,        // Ratio gain/risque de 1.8:1
    profitFactor: 2.3,           // Profit factor de 2.3 (excellent)
    maxDrawdown: -12.5,          // Drawdown maximum de 12.5%
    winRate: 65.0,               // Taux de réussite de 65%
    recoveryFactor: 4.2,         // Facteur de récupération
    expectancy: 125.0,           // Expectancy positive
    sharpeRatio: 1.5             // Sharpe ratio bon
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Démonstration des Jauges de Métriques</h2>
      <TradingMetricsGauges metrics={demoMetrics} />
    </div>
  )
}

export default TradingMetricsGaugesDemo
