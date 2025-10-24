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
import ChartDataLabels from 'chartjs-plugin-datalabels'
import ChartCard from '../common/ChartCard'
import { formatCurrency, globalTooltipConfig } from '../../config/chartConfig'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  ChartDataLabels
)

interface WeekdayPerformanceData {
  day: string
  total_pnl: number
  trade_count: number
  win_rate: number
  average_pnl: number
}

interface WeekdayPerformanceChartProps {
  data: WeekdayPerformanceData[]
  currency?: string
}

function WeekdayPerformanceChart({ data, currency = 'USD' }: WeekdayPerformanceChartProps) {
  const hasData = Array.isArray(data) && data.length > 0

  // Filtrer les données pour exclure samedi et dimanche
  const filteredData = useMemo(() => {
    if (!hasData) return []
    return data.filter(d => d.day !== 'Samedi' && d.day !== 'Dimanche')
  }, [data, hasData])

  const hasFilteredData = filteredData.length > 0

  // Préparer les données pour le graphique
  const chartData = useMemo(() => {
    if (!hasFilteredData) return null

    const labels = filteredData.map(d => d.day)
    const totalPnlValues = filteredData.map(d => d.total_pnl)

    return {
      labels,
      datasets: [
        {
          label: 'PnL Total',
          data: totalPnlValues,
          backgroundColor: totalPnlValues.map(value => 
            value >= 0 ? '#3b82f6' : '#6b7280'
          ),
          borderColor: totalPnlValues.map(value => 
            value >= 0 ? '#3b82f6' : '#6b7280'
          ),
          borderWidth: 0,
          borderRadius: 0,
          borderSkipped: false,
          yAxisID: 'y',
        }
      ]
    }
  }, [filteredData, hasFilteredData])

  // Configuration du graphique
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
            const value = context.parsed.y
            const dayData = filteredData[index]
            
            return [
              `PnL Total: ${formatCurrency(value, currency)}`,
              `Nombre de trades: ${dayData.trade_count}`,
              `Taux de réussite: ${dayData.win_rate.toFixed(1)}%`
            ]
          }
        }
      },
      datalabels: {
        display: true,
        anchor: 'end' as const,
        align: 'top' as const,
        color: function(context: any) {
          const value = context.parsed?.y || context.raw
          return value >= 0 ? '#3b82f6' : '#6b7280'
        },
        font: {
          size: 13,
          weight: 'bold' as const
        },
        formatter: function(value: any, context: any) {
          const actualValue = context.parsed?.y || value
          return formatCurrency(actualValue, currency)
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        }
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        beginAtZero: false,
        grid: {
          color: '#f3f4f6'
        },
        ticks: {
          callback: function(value: any) {
            return formatCurrency(value, currency)
          }
        }
      }
    },
    animation: {
      duration: 1000,
      easing: 'easeInOutQuart' as const
    }
  }), [filteredData, currency])

  // Calculer les statistiques
  const stats = useMemo(() => {
    if (!hasFilteredData) return null

    const bestDay = filteredData.reduce((max, day) => day.total_pnl > max.total_pnl ? day : max, filteredData[0])
    const worstDay = filteredData.reduce((min, day) => day.trade_count < min.trade_count ? day : min, filteredData[0])
    const mostActiveDay = filteredData.reduce((max, day) => day.trade_count > max.trade_count ? day : max, filteredData[0])
    const totalTrades = filteredData.reduce((sum, day) => sum + day.trade_count, 0)
    const totalPnl = filteredData.reduce((sum, day) => sum + day.total_pnl, 0)

    return {
      bestDay,
      worstDay,
      mostActiveDay,
      totalTrades,
      totalPnl
    }
  }, [filteredData, hasFilteredData])

  return (
    <ChartCard
      title={(
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke="#8b5cf6" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 16l2 2 4-4" stroke="#8b5cf6" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-semibold text-gray-900">Performance par Jour de la Semaine</h3>
                {stats && (
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <span>Plus actif :</span>
                      <span className="font-medium text-blue-600">{stats.mostActiveDay.day} ({stats.mostActiveDay.trade_count} trades)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>Moins actif :</span>
                      <span className="font-medium text-red-600">{stats.worstDay.day} ({stats.worstDay.trade_count} trades)</span>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-500">
                Analyse des performances et de l'activité selon les jours
              </p>
            </div>
          </div>
        </div>
      )}
      height={420}
    >
      <div className="relative h-full w-full p-2">
        {!hasFilteredData ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            Pas assez de données pour afficher le graphique
          </div>
        ) : (
          <div className="h-full w-full">
            <Bar key="weekday-performance-chart" data={chartData!} options={options} />
          </div>
        )}
      </div>
    </ChartCard>
  )
}

export default WeekdayPerformanceChart
