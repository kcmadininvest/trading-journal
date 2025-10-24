import React, { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import ChartCard from '../common/ChartCard'
import { formatCurrency, globalTooltipConfig } from '../../config/chartConfig'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
)

interface WaterfallDataPoint {
  date: string
  pnl: number
  cumulative: number
  is_positive: boolean
}

interface WaterfallChartProps {
  data: WaterfallDataPoint[]
  currency?: string
}

function WaterfallChart({ data, currency = 'USD' }: WaterfallChartProps) {
  const hasData = Array.isArray(data) && data.length > 0

  // Préparer les données pour le graphique waterfall avec barres flottantes
  const chartData = useMemo(() => {
    if (!hasData) return null

    const labels = data.map(d => d.date)
    
    // Pour un graphique waterfall, nous créons des barres flottantes
    // Chaque barre va de la valeur précédente à la valeur actuelle
    const waterfallData = data.map((d, index) => {
      const previousCumulative = index === 0 ? 0 : data[index - 1].cumulative
      const currentCumulative = d.cumulative
      
      return {
        start: previousCumulative,
        end: currentCumulative,
        value: d.pnl,
        isPositive: d.pnl >= 0,
        cumulative: currentCumulative
      }
    })

    // Transformer les données en format [min, max] pour les barres flottantes
    const floatingBars = waterfallData.map(d => [d.start, d.end])

    return {
      labels,
      datasets: [
        {
          label: 'Évolution du Capital',
          data: floatingBars,
          backgroundColor: waterfallData.map(d => 
            d.isPositive ? '#3b82f6' : '#6b7280'
          ),
          borderColor: waterfallData.map(d => 
            d.isPositive ? '#3b82f6' : '#6b7280'
          ),
          borderWidth: 0,
          borderRadius: 0,
          borderSkipped: false,
          _waterfallData: waterfallData
        }
      ]
    }
  }, [data, hasData])

  // Configuration du graphique waterfall
  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        ...globalTooltipConfig,
        callbacks: {
          label: function(context: any) {
            const index = context.dataIndex
            const waterfallData = context.dataset._waterfallData[index]
            const pnl = waterfallData.value
            const cumulative = waterfallData.cumulative
            const start = waterfallData.start
            
            return [
              `PnL du jour: ${formatCurrency(pnl, currency)}`,
              `Capital cumulé: ${formatCurrency(cumulative, currency)}`,
              `Variation: ${formatCurrency(cumulative - start, currency)}`
            ]
          }
        }
      },
      datalabels: {
        display: false
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          maxRotation: 45,
          minRotation: 0,
          font: {
            size: 11
          }
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: '#f3f4f6',
          drawBorder: false
        },
        ticks: {
          callback: function(value: any) {
            return formatCurrency(value, currency)
          },
          font: {
            size: 11
          }
        }
      }
    },
    elements: {
      bar: {
        borderRadius: 0,
        borderSkipped: false
      }
    },
    animation: {
      duration: 1000,
      easing: 'easeInOutQuart' as const
    },
    // Configuration pour les barres flottantes
    barPercentage: 0.7,
    categoryPercentage: 0.8
  }), [currency])

  // Calculer les statistiques
  const stats = useMemo(() => {
    if (!hasData) return null

    const totalPnl = data[data.length - 1]?.cumulative || 0
    const bestDay = Math.max(...data.map(d => d.pnl))
    const worstDay = Math.min(...data.map(d => d.pnl))
    const positiveDays = data.filter(d => d.pnl > 0).length
    const negativeDays = data.filter(d => d.pnl < 0).length
    const winRate = data.length > 0 ? (positiveDays / data.length) * 100 : 0

    return {
      totalPnl,
      bestDay,
      worstDay,
      positiveDays,
      negativeDays,
      winRate
    }
  }, [data, hasData])

  return (
    <ChartCard
      title={(
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 3v18h18" stroke="#3b82f6" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7 7l3-3 3 3 3-3" stroke="#3b82f6" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7 13l3 3 3-3 3 3" stroke="#ef4444" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-semibold text-gray-900">Évolution des Gains et Pertes Journalière</h3>
                {stats && (
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <span>Capital total :</span>
                      <span className={`font-medium ${stats.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(stats.totalPnl, currency)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>Meilleur jour :</span>
                      <span className="font-medium text-green-600">{formatCurrency(stats.bestDay, currency)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>Pire jour :</span>
                      <span className="font-medium text-red-600">{formatCurrency(stats.worstDay, currency)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>Jours gagnants :</span>
                      <span className="font-medium text-gray-700">{stats.positiveDays}/{data.length} ({stats.winRate.toFixed(1)}%)</span>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-500">Graphique waterfall montrant l'évolution cumulative du capital</p>
            </div>
          </div>
        </div>
      )}
      height={420}
    >
      <div className="relative h-full w-full p-2">
        {!hasData ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            Pas assez de données pour afficher le graphique
          </div>
        ) : (
          <div className="h-full w-full">
            <Bar data={chartData!} options={options} />
          </div>
        )}
      </div>
    </ChartCard>
  )
}

export default WaterfallChart
