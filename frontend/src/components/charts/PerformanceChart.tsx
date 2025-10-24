import React, { useMemo, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import ChartCard from '../common/ChartCard'
import { usePerformanceChartConfig, usePerformanceColors } from '../../hooks/useChartConfig'
import { formatCurrency } from '../../config/chartConfig'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
)

interface PerformanceChartProps {
  data: Array<{
    date: string
    pnl: number
    cumulative: number
  }>
  currency?: string
}

function PerformanceChart({ data, currency = 'USD' }: PerformanceChartProps) {
  const hasData = Array.isArray(data) && data.length > 0

  // Get default date range from data
  const { defaultStartDate, defaultEndDate } = useMemo(() => {
    if (!hasData) return { defaultStartDate: '', defaultEndDate: '' }
    
    const dates = data.map(d => d.date).sort()
    
    // Convert dates to YYYY-MM-DD format for input type="date"
    const formatDateForInput = (dateStr: string) => {
      if (!dateStr) return ''
      
      // If date is already in YYYY-MM-DD format, return as is
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr
      
      // If date is in DD/MM/YYYY format, convert to YYYY-MM-DD
      if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        const [day, month, year] = dateStr.split('/')
        return `${year}-${month}-${day}`
      }
      
      // If date is in DD/MM/YY format, convert to YYYY-MM-DD
      if (dateStr.match(/^\d{2}\/\d{2}\/\d{2}$/)) {
        const [day, month, year] = dateStr.split('/')
        const fullYear = `20${year}`
        return `${fullYear}-${month}-${day}`
      }
      
      // If date is in DD/MM format (without year), assume current year
      if (dateStr.match(/^\d{2}\/\d{2}$/)) {
        const [day, month] = dateStr.split('/')
        const currentYear = new Date().getFullYear()
        return `${currentYear}-${month}-${day}`
      }
      
      return dateStr
    }
    
    // Sort dates to ensure proper order
    const sortedDates = dates.sort((a, b) => {
      const dateA = formatDateForInput(a)
      const dateB = formatDateForInput(b)
      return dateA.localeCompare(dateB)
    })
    
    return {
      defaultStartDate: formatDateForInput(sortedDates[0] || ''),
      defaultEndDate: formatDateForInput(sortedDates[sortedDates.length - 1] || '')
    }
  }, [data, hasData])

  // Date filter state - pre-filled with first and last available dates
  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(defaultEndDate)

  // Initialize and update state when default dates change
  React.useEffect(() => {
    if (defaultStartDate && defaultEndDate) {
      // Ensure startDate is before endDate
      if (defaultStartDate <= defaultEndDate) {
        setStartDate(defaultStartDate)
        setEndDate(defaultEndDate)
      } else {
        setStartDate(defaultEndDate)
        setEndDate(defaultStartDate)
      }
    }
  }, [defaultStartDate, defaultEndDate])

  // Filter data by date range first
  const filteredData = useMemo(() => {
    if (!hasData) return []
    
    return data.filter(d => {
      const dataDate = d.date
      // Convert data date to YYYY-MM-DD format for comparison
      const formatDataDate = (dateStr: string) => {
        if (!dateStr) return ''
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr
        if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
          const [day, month, year] = dateStr.split('/')
          return `${year}-${month}-${day}`
        }
        if (dateStr.match(/^\d{2}\/\d{2}\/\d{2}$/)) {
          const [day, month, year] = dateStr.split('/')
          const fullYear = `20${year}`
          return `${fullYear}-${month}-${day}`
        }
        if (dateStr.match(/^\d{2}\/\d{2}$/)) {
          const [day, month] = dateStr.split('/')
          const currentYear = new Date().getFullYear()
          return `${currentYear}-${month}-${day}`
        }
        return dateStr
      }
      
      const formattedDataDate = formatDataDate(dataDate)
      return formattedDataDate >= startDate && formattedDataDate <= endDate
    })
  }, [data, hasData, startDate, endDate])

  // Calculate performance statistics from filtered data
  const performanceStats = useMemo(() => {
    if (filteredData.length === 0) {
      return { totalReturn: 0, isPositive: false, maxDrawdown: 0, highestValue: 0, lowestValue: 0 }
    }

    const totalReturn = filteredData[filteredData.length - 1]?.cumulative || 0
    const isPositive = totalReturn >= 0
    const maxDrawdown = Math.min(...filteredData.map(d => d.cumulative))
    const highestValue = Math.max(...filteredData.map(d => d.cumulative))
    const lowestValue = Math.min(...filteredData.map(d => d.cumulative))

    return { totalReturn, isPositive, maxDrawdown, highestValue, lowestValue }
  }, [filteredData])

  // Use global color configuration
  const colors = usePerformanceColors(performanceStats.isPositive)

  // Prepare chart data
  const chartData = useMemo(() => {
    if (filteredData.length === 0) return null

    const labels = filteredData.map(d => d.date)
    const cumulativeValues = filteredData.map(d => d.cumulative)
    const pnlValues = filteredData.map(d => d.pnl)

    return {
      labels,
      datasets: [
        {
          label: 'Performance',
          data: cumulativeValues,
          borderColor: colors.line,
          backgroundColor: `${colors.area}20`, // 20% opacity
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: (context: any) => {
            const index = context.dataIndex
            return pnlValues[index] >= 0 ? 4 : 4
          },
          pointBackgroundColor: (context: any) => {
            const index = context.dataIndex
            return colors.point(pnlValues[index])
          },
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: (context: any) => {
            const index = context.dataIndex
            return colors.pointHover(pnlValues[index])
          },
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 3,
        }
      ]
    }
  }, [filteredData, colors])

  // Use global chart configuration
  const { options } = usePerformanceChartConfig(filteredData, {
    elements: {
      point: {
        radius: 0,
        hoverRadius: 6
      }
    },
    animation: {
      duration: 1000,
      easing: 'easeInOutQuart' as const
    },
    plugins: {
      datalabels: {
        display: false
      }
    }
  }, currency)

  return (
    <ChartCard
      title={(
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${colors.background}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 16l4-5 3 3 5-7 4 6" stroke={colors.line} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">SOLDE DU COMPTE DANS LE TEMPS</h3>
            </div>
          </div>
          <div className="text-right ml-8">
            <div className="flex items-center gap-2 justify-end mb-1">
              <span className="text-sm text-gray-500">
                {performanceStats.isPositive ? 'Gain' : 'Perte'} total :
              </span>
              <span className={`text-lg font-bold ${colors.text}`}>
                {formatCurrency(performanceStats.totalReturn, currency)}
          </span>
            </div>
            <div className="flex items-center gap-4 justify-end text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <span>Plus haut :</span>
                <span className="font-medium text-gray-700">{formatCurrency(performanceStats.highestValue || 0, currency)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span>Plus bas :</span>
                <span className="font-medium text-gray-700">{formatCurrency(performanceStats.lowestValue || 0, currency)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
      right={(
        <div className="flex items-center gap-3">
          {/* Start Date Picker with border-integrated text */}
          <div className="relative">
            <div className="absolute -top-2 left-3 bg-white px-1 text-xs font-medium text-gray-600 z-10">
              Date début
            </div>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value || defaultStartDate)}
              onBlur={(e) => {
                if (!e.target.value) {
                  setStartDate(defaultStartDate)
                }
              }}
              className="px-4 py-2.5 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min={defaultStartDate}
              max={defaultEndDate}
            />
          </div>
          
          {/* Hyphen */}
          <span className="text-gray-500 text-xl font-medium">-</span>

          {/* End Date Picker with border-integrated text */}
          <div className="relative">
            <div className="absolute -top-2 left-3 bg-white px-1 text-xs font-medium text-gray-600 z-10">
              Date fin
            </div>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value || defaultEndDate)}
              onBlur={(e) => {
                if (!e.target.value) {
                  setEndDate(defaultEndDate)
                }
              }}
              className="px-4 py-2.5 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min={defaultStartDate}
              max={defaultEndDate}
            />
          </div>
        </div>
      )}
      height={420}
    >
      <div className="relative h-full w-full p-2">
        {!hasData || filteredData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            {!hasData ? 'Pas assez de données pour afficher le graphique' : 'Aucune donnée dans la période sélectionnée'}
          </div>
        ) : (
          <div className="h-full w-full">
            <Line data={chartData!} options={options} />
          </div>
        )}
      </div>
    </ChartCard>
  )
}

export default PerformanceChart