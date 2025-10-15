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
          borderColor: '#1d4ed8',
          borderWidth: 1,
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="h-10 flex items-center justify-center mb-2">
        <span className="text-xl font-semibold text-gray-900 uppercase">Répartition des trades par durée</span>
      </div>
      <div className="relative" style={{ height: 420 }}>
        <div className="relative h-full w-full p-2">
          {bins.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              Pas de données disponibles
            </div>
          ) : (
            <Bar data={chartData} options={options} />
          )}
        </div>
      </div>
    </div>
  )
}

export default DurationDistributionChart


