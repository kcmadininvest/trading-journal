import React from 'react'
import Tooltip from '../ui/Tooltip'
import { DASHBOARD_STAT_CARD_SHELL_CLASS } from '../dashboard/tickerShell'

// Helper function to get gradient class based on progress and variant
const getProgressGradientClass = (progressValue: number, progressMax: number, variant: string): string => {
  const progress = progressValue / progressMax;
  
  if (progressValue >= progressMax) {
    return 'progress-gradient-success';
  }
  
  if (variant === 'info' || variant === 'default') {
    if (progress >= 0.8) return 'progress-gradient-info-high';
    if (progress >= 0.6) return 'progress-gradient-info-medium-high';
    if (progress >= 0.4) return 'progress-gradient-info-medium';
    return 'progress-gradient-info-low';
  }
  
  if (variant === 'success') return 'progress-gradient-success';
  if (variant === 'warning') return 'progress-gradient-warning';
  if (variant === 'danger') return 'progress-gradient-danger';
  
  return 'progress-gradient-default';
};

function getBandProgressFillClass(
  progressValue: number,
  progressMax: number,
  variant: ModernStatCardProps['variant'],
): string {
  const progress = progressMax > 0 ? progressValue / progressMax : 0;
  if (progressValue >= progressMax) return 'bg-blue-400';
  if (variant === 'danger') return 'bg-pink-400';
  if (variant === 'warning') return 'bg-orange-400';
  if (variant === 'success') return 'bg-blue-400';
  if (progress >= 0.8) return 'bg-blue-400';
  if (progress >= 0.5) return 'bg-orange-400';
  return 'bg-pink-400';
}



export interface SubMetric {
  label: string
  value: string | number
}

interface ModernStatCardProps {

  label: string

  /** Info-bulle sur l’icône à côté du libellé (pattern PerformanceEdgeKpiStrip). */
  labelTooltip?: string

  value: string | number | React.ReactNode

  valueSubtext?: string

  icon?: React.ReactNode

  trend?: 'up' | 'down' | 'neutral'

  trendValue?: string

  variant?: 'default' | 'success' | 'danger' | 'warning' | 'info'

  size?: 'small' | 'medium' | 'large'

  subMetrics?: SubMetric[]

  progressValue?: number

  progressMax?: number

  progressLabel?: string

  hideValue?: boolean

  /** `band` = thème bandeau cotations (dashboard) */
  theme?: 'default' | 'band'

}



function ModernStatCard({ 

  label,

  labelTooltip,

  value, 

  valueSubtext,

  icon, 

  trend, 

  trendValue, 

  variant = 'default',

  size = 'medium',

  subMetrics,

  progressValue,

  progressMax,

  progressLabel,

  hideValue = false,

  theme = 'default',

}: ModernStatCardProps) {

  const isBand = theme === 'band'

  const variantConfig = isBand
    ? {
        default: {
          iconBg: 'bg-white/10',
          iconColor: 'text-white/70',
          border: 'border-white/15',
        },
        success: {
          iconBg: 'bg-emerald-500/15',
          iconColor: 'text-emerald-400',
          border: 'border-emerald-400/30',
        },
        danger: {
          iconBg: 'bg-red-500/15',
          iconColor: 'text-red-400',
          border: 'border-red-400/30',
        },
        warning: {
          iconBg: 'bg-amber-500/15',
          iconColor: 'text-amber-400',
          border: 'border-amber-400/30',
        },
        info: {
          iconBg: 'bg-white/10',
          iconColor: 'text-blue-300',
          border: 'border-blue-400/30',
        },
      }
    : {

    default: {

      iconBg: 'bg-slate-100 dark:bg-gray-700',

      iconColor: 'text-slate-600 dark:text-slate-300',

      border: 'border-gray-200 dark:border-gray-700'

    },

    success: {

      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',

      iconColor: 'text-emerald-600 dark:text-emerald-400',

      border: 'border-emerald-200 dark:border-emerald-800'

    },

    danger: {

      iconBg: 'bg-rose-100 dark:bg-rose-900/30',

      iconColor: 'text-rose-600 dark:text-rose-400',

      border: 'border-rose-200 dark:border-rose-800'

    },

    warning: {

      iconBg: 'bg-amber-100 dark:bg-amber-900/30',

      iconColor: 'text-amber-600 dark:text-amber-400',

      border: 'border-amber-200 dark:border-amber-800'

    },

    info: {

      iconBg: 'bg-blue-100 dark:bg-blue-900/30',

      iconColor: 'text-blue-600 dark:text-blue-400',

      border: 'border-blue-200 dark:border-blue-800'

    }

  }



  const sizeConfig = {

    small: {

      container: 'p-4 h-full',

      icon: 'w-8 h-8',

      iconContainer: 'p-2',

      value: 'text-2xl',

      label: 'text-base',

      trend: 'text-xs'

    },

    medium: {

      container: 'p-6 h-full',

      icon: 'w-10 h-10',

      iconContainer: 'p-3',

      value: 'text-3xl',

      label: 'text-sm',

      trend: 'text-sm'

    },

    large: {

      container: 'p-8 h-full',

      icon: 'w-12 h-12',

      iconContainer: 'p-4',

      value: 'text-4xl',

      label: 'text-base',

      trend: 'text-base'

    }

  }



  const trendIcons = {

    up: (

      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />

      </svg>

    ),

    down: (

      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />

      </svg>

    ),

    neutral: (

      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />

      </svg>

    )

  }



  const trendColors = isBand
    ? {
        up: 'text-emerald-400 bg-emerald-500/15',
        down: 'text-red-400 bg-red-500/15',
        neutral: 'text-white/60 bg-white/10',
      }
    : {
        up: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
        down: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20',
        neutral: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700',
      }



  const config = variantConfig[variant]

  const sizeStyles = sizeConfig[size]



  return (

    <div
      className={
        isBand
          ? `${DASHBOARD_STAT_CARD_SHELL_CLASS} border ${config.border} shadow-lg shadow-blue-950/30 hover:shadow-xl hover:shadow-blue-950/40 ${sizeStyles.container} overflow-hidden transition-shadow duration-200`
          : `bg-white dark:bg-gray-800 border ${config.border} rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 ${sizeStyles.container} overflow-hidden`
      }
    >

      {/* Contenu principal */}

      <div className="flex flex-col h-full min-w-0">

        {/* En-tête avec icône et label */}

        <div className="flex items-center justify-between mb-3 min-w-0">

          <div className="flex items-center gap-2 min-w-0 flex-1">

            {icon && (

              <div className={`

                ${sizeStyles.iconContainer}

                rounded-lg 

                ${config.iconBg}

                ${config.iconColor}

                flex-shrink-0

              `}>

                <div className={sizeStyles.icon}>

                  {icon}

                </div>

              </div>

            )}

            <div className="inline-flex min-w-0 items-center gap-1">
              <span className={`

                ${sizeStyles.label}

                ${isBand ? 'text-white/70' : 'text-gray-700 dark:text-gray-300'} font-medium 

                truncate min-w-0

              `}>

                {label}

              </span>
              {labelTooltip ? (
                <Tooltip
                  content={labelTooltip}
                  position="bottom"
                  className="shrink-0 items-center leading-none"
                  contentClassName="whitespace-pre-line block"
                >
                  <svg
                    className={`block h-3.5 w-3.5 shrink-0 cursor-help sm:h-4 sm:w-4 ${isBand ? 'text-white/40' : 'text-gray-400 dark:text-gray-500'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-hidden
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                </Tooltip>
              ) : null}
            </div>

          </div>

        </div>

        

        {/* Contenu principal */}
        <div className="flex-1 flex flex-col justify-between">

          {/* Section principale : Valeur et progression */}
          <div className="min-w-0">
            <div className={`

              ${sizeStyles.value}

              font-semibold 

              ${isBand ? 'text-white/90' : 'text-gray-900 dark:text-gray-100'}

              mb-2

              break-words

            `}>

              {hideValue ? '***' : value}

            </div>

            {/* Barre de progression pour objectif */}
            {progressValue !== undefined && progressMax !== undefined && (
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-medium ${isBand ? 'text-white/50' : 'text-gray-600 dark:text-gray-400'}`}>
                    {progressLabel || `${progressValue} / ${progressMax}`}
                  </span>
                  <span className={`text-xs font-semibold ${isBand ? 'text-white/80' : 'text-gray-700 dark:text-gray-300'}`}>
                    {Math.min(Math.round((progressValue / progressMax) * 100), 100)}%
                  </span>
                </div>
                <div className={`h-2 w-full overflow-hidden rounded-full relative ${isBand ? 'bg-white/15' : 'bg-gray-200 dark:bg-gray-700'}`}>
                  <div
                    className={`relative h-full overflow-hidden rounded-full transition-all duration-500 ${
                      isBand
                        ? getBandProgressFillClass(progressValue, progressMax, variant)
                        : getProgressGradientClass(progressValue, progressMax, variant)
                    }`}
                    style={{ width: `${Math.min((progressValue / progressMax) * 100, 100)}%` }}
                  />
                  {progressValue > 0 && progressValue < progressMax && (
                    <div className="absolute top-0 left-0 bottom-0 rounded-full pointer-events-none w-full h-full progress-shimmer" />
                  )}
                </div>
              </div>
            )}
            
            {/* Espace équivalent à la barre de progression pour aligner les métriques secondaires */}
            {progressValue === undefined && progressMax === undefined && subMetrics && subMetrics.length > 0 && (
              <div className="mb-2">
                {valueSubtext ? (
                  <>
                    <div className={`mb-1 text-xs ${isBand ? 'text-white/50' : 'text-gray-500 dark:text-gray-400'}`}>
                      {valueSubtext}
                    </div>
                    <div className="w-full h-2">
                      {/* Espace invisible pour correspondre à la hauteur de la barre */}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400 opacity-0">
                        {/* Espace invisible pour correspondre à la hauteur du label */}
                        &nbsp;
                      </span>
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 opacity-0">
                        {/* Espace invisible pour correspondre à la hauteur du pourcentage */}
                        &nbsp;
                      </span>
                    </div>
                    <div className="w-full h-2">
                      {/* Espace invisible pour correspondre à la hauteur de la barre */}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Métriques secondaires */}
            {subMetrics && subMetrics.length > 0 && (
              <div className={`pt-1.5 border-t ${isBand ? 'border-white/15' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className="space-y-1">
                  {subMetrics.map((metric, index) => (
                    metric.label && metric.value ? (
                      <div key={index} className="flex items-center justify-between gap-2 min-w-0">
                        <span className={`text-xs truncate min-w-0 flex-1 ${isBand ? 'text-white/50' : 'text-gray-600 dark:text-gray-400'}`}>{metric.label}</span>
                        <span className={`text-xs font-semibold whitespace-nowrap flex-shrink-0 ${isBand ? 'text-white/85' : 'text-gray-900 dark:text-gray-100'}`}>{metric.value}</span>
                      </div>
                    ) : null
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section footer : Badge de statut */}
          <div className="mt-auto">
            {trendValue ? (

              <div className={`

                flex items-center justify-center gap-1.5

                ${sizeStyles.trend}

                font-medium 

                ${trend ? trendColors[trend] : isBand ? 'text-white/70 bg-white/10' : 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700'}

                px-2 py-1 

                ${isBand ? 'rounded-full' : 'rounded-md'}

                w-full

              `}>

                {trend && trendIcons[trend]}

                <span>{trendValue}</span>

              </div>

            ) : null}
          </div>

        </div>

      </div>

    </div>

  )

}



export default ModernStatCard

