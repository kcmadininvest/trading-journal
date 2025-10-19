import { ChartOptions } from 'chart.js'

// Configuration globale des couleurs
export const chartColors = {
  primary: '#3b82f6', // blue-500
  secondary: '#f472b6', // pink-400
  success: '#22c55e', // green-500
  warning: '#f59e0b', // amber-500
  danger: '#ef4444', // red-500
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827'
  }
}

// Configuration globale des tooltips
export const globalTooltipConfig = {
  enabled: true,
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(8px)',
  titleColor: '#1f2937',
  bodyColor: '#374151',
  borderColor: 'rgba(229, 231, 235, 0.5)',
  borderWidth: 1,
  cornerRadius: 12,
  displayColors: false,
  titleFont: {
    family: 'system-ui, -apple-system, sans-serif',
    size: 14,
    weight: 'bold' as const
  },
  bodyFont: {
    family: 'system-ui, -apple-system, sans-serif',
    size: 13,
    weight: 'normal' as const
  },
  padding: 12
}

// Configuration globale des grilles
export const globalGridConfig = {
  color: '#f1f5f9',
  drawBorder: false
}

// Configuration globale des axes
export const globalAxisConfig = {
  ticks: {
    color: chartColors.gray[500],
    font: {
      size: 12
    }
  },
  grid: globalGridConfig
}

// Configuration de base pour tous les graphiques
export const baseChartOptions: Partial<ChartOptions> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    intersect: false,
    mode: 'index' as const,
  },
  plugins: {
    legend: {
      display: false
    },
    tooltip: globalTooltipConfig
  },
  layout: {
    padding: {
      top: 10,
      bottom: 10,
      left: 10,
      right: 10
    }
  },
  scales: {
    x: {
      type: 'category' as const,
      ...globalAxisConfig,
      display: true
    },
    y: {
      ...globalAxisConfig,
      display: true
    }
  }
}

// Types pour les callbacks de tooltip
export interface TooltipCallbackData {
  label: string
  value: number
  formattedValue?: string
  additionalInfo?: string[]
}

export type TooltipCallback = (data: TooltipCallbackData, context: any) => string[]

// Fonction utilitaire pour créer des options de graphique avec tooltip personnalisé
export const createChartOptions = (
  customTooltipCallback?: TooltipCallback,
  customOptions: any = {}
): any => {
  const tooltipConfig = {
    ...globalTooltipConfig,
    callbacks: customTooltipCallback ? {
      title: (context: any) => {
        return context[0]?.label || ''
      },
      label: (context: any) => {
        const data: TooltipCallbackData = {
          label: context.label || '',
          value: context.parsed.y || 0,
          formattedValue: context.formattedValue
        }
        return customTooltipCallback(data, context)
      }
    } : undefined
  }

  return {
    ...baseChartOptions,
    ...customOptions,
    plugins: {
      ...baseChartOptions.plugins,
      ...customOptions.plugins,
      tooltip: {
        ...tooltipConfig,
        ...customOptions.plugins?.tooltip
      }
    }
  }
}

// Fonction utilitaire pour formater les valeurs monétaires
export const formatCurrency = (value: number, currency: string = 'USD'): string => {
  const nf = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency
  })
  return nf.format(value)
}

// Fonction utilitaire pour formater les pourcentages
export const formatPercentage = (value: number, decimals: number = 2): string => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
}