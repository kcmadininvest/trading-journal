import { useMemo } from 'react'
import { 
  createChartOptions, 
  TooltipCallback, 
  formatCurrency,
  chartColors 
} from '../config/chartConfig'

// Types pour les données de performance
export interface PerformanceData {
  date: string
  pnl: number
  cumulative: number
}

// Types pour les données de distribution
export interface DistributionData {
  label: string
  value: number
  count?: number
}

// Hook pour la configuration des graphiques de performance
export const usePerformanceChartConfig = (
  data: PerformanceData[],
  customOptions: any = {}
) => {
  const tooltipCallback: TooltipCallback = (data, context) => {
    const pnl = data.value
    const cumulative = context.parsed.y
    
    return [
      `PnL du jour: ${pnl >= 0 ? '+' : ''}${formatCurrency(pnl)}`,
      `Total: ${formatCurrency(cumulative)}`
    ]
  }

  const options = useMemo(() => {
    return createChartOptions(tooltipCallback, {
      ...customOptions,
      scales: {
        ...customOptions.scales,
        y: {
          ...customOptions.scales?.y,
          ticks: {
            ...customOptions.scales?.y?.ticks,
            callback: function(value: any) {
              return formatCurrency(Number(value))
            }
          }
        }
      }
    })
  }, [customOptions])

  return { options }
}

// Hook pour la configuration des graphiques de distribution
export const useDistributionChartConfig = (
  data: DistributionData[],
  customOptions: any = {}
) => {
  const tooltipCallback: TooltipCallback = (data, context) => {
    const count = data.additionalInfo?.[0] || ''
    return [
      `Valeur: ${formatCurrency(data.value)}`,
      count ? `Occurrences: ${count}` : ''
    ].filter(Boolean)
  }

  const options = useMemo(() => {
    return createChartOptions(tooltipCallback, {
      ...customOptions,
      scales: {
        ...customOptions.scales,
        y: {
          ...customOptions.scales?.y,
          ticks: {
            ...customOptions.scales?.y?.ticks,
            callback: function(value: any) {
              return formatCurrency(Number(value))
            }
          }
        }
      }
    })
  }, [customOptions])

  return { options }
}

// Hook pour la configuration des graphiques en barres (durée)
export const useBarChartConfig = (
  customOptions: any = {}
) => {
  const tooltipCallback: TooltipCallback = (data, context) => {
    const datasetLabel = context.dataset.label || ''
    const value = data.value
    return [
      `${datasetLabel}: ${value} trades`
    ]
  }

  const options = useMemo(() => {
    return createChartOptions(tooltipCallback, {
      ...customOptions,
      scales: {
        ...customOptions.scales,
        y: {
          ...customOptions.scales?.y,
          ticks: {
            ...customOptions.scales?.y?.ticks,
            callback: function(value: any) {
              return Math.round(Number(value))
            }
          }
        }
      }
    })
  }, [customOptions])

  return { options }
}

// Hook pour la configuration des graphiques génériques
export const useGenericChartConfig = (
  tooltipCallback?: TooltipCallback,
  customOptions: any = {}
) => {
  const options = useMemo(() => {
    return createChartOptions(tooltipCallback, customOptions)
  }, [tooltipCallback, customOptions])

  return { options }
}

// Hook pour les couleurs dynamiques basées sur la performance
export const usePerformanceColors = (isPositive: boolean) => {
  return useMemo(() => ({
    line: isPositive ? chartColors.primary : chartColors.secondary,
    area: isPositive ? chartColors.primary : chartColors.secondary,
    point: (value: number) => value >= 0 ? '#2563eb' : '#ec4899',
    pointHover: (value: number) => value >= 0 ? '#1d4ed8' : '#db2777',
    background: isPositive ? 'bg-blue-100' : 'bg-pink-50',
    text: isPositive ? 'text-blue-600' : 'text-pink-500'
  }), [isPositive])
}
