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
import { useBarChartConfig } from '../../hooks/useChartConfig'
import { chartColors } from '../../config/chartConfig'
import ChartCard from '../common/ChartCard'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
)

interface DurationBin {
  label: string
  successful: number
  unsuccessful: number
}

interface DurationDistributionChartProps {
  bins: DurationBin[]
}

function DurationDistributionChart({ bins }: DurationDistributionChartProps) {
  // Prepare chart data
  const chartData = useMemo(() => {
    const labels = bins.map(bin => bin.label)
    const successfulData = bins.map(bin => bin.successful)
    const unsuccessfulData = bins.map(bin => bin.unsuccessful)

    return {
      labels,
      datasets: [
        {
          label: 'Gagnants',
          data: successfulData,
          backgroundColor: '#3b82f6',
          borderColor: '#3b82f6',
          borderWidth: 0,
          borderRadius: 0,
          borderSkipped: false,
        },
        {
          label: 'Perdants',
          data: unsuccessfulData,
          backgroundColor: chartColors.gray[300],
          borderColor: chartColors.gray[300],
          borderWidth: 0,
          borderRadius: 0,
          borderSkipped: false,
        }
      ]
    }
  }, [bins])

  // Use global chart configuration
  const { options } = useBarChartConfig({
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12
          }
        }
      },
      datalabels: {
        display: false
      }
    },
    scales: {
      x: {
        stacked: true,
        grid: {
          display: false
        }
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: {
          color: chartColors.gray[200]
        }
      }
    },
    elements: {
      bar: {
        borderRadius: 0
      }
    },
    animation: {
      duration: 1000,
      easing: 'easeInOutQuart' as const
    }
  })

  return (
    <ChartCard
      title={(
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50">
            <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">RÉPARTITION DES TRADES PAR DURÉE</h3>
        </div>
      )}
      height={420}
    >
      {bins.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-500">
          Pas de données disponibles
        </div>
      ) : (
        <Bar data={chartData} options={options} />
      )}
    </ChartCard>
  )
}

export default DurationDistributionChart