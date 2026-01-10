import React from 'react'

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



export interface SubMetric {
  label: string
  value: string | number
}

interface ModernStatCardProps {

  label: string

  value: string | number | React.ReactNode

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

}



function ModernStatCard({ 

  label, 

  value, 

  icon, 

  trend, 

  trendValue, 

  variant = 'default',

  size = 'medium',

  subMetrics,

  progressValue,

  progressMax,

  progressLabel,

  hideValue = false

}: ModernStatCardProps) {

  const variantConfig = {

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



  const trendColors = {

    up: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',

    down: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20',

    neutral: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700'

  }



  const config = variantConfig[variant]

  const sizeStyles = sizeConfig[size]



  return (

    <div className={`

      bg-white dark:bg-gray-800

      border ${config.border}

      rounded-lg 

      shadow-sm hover:shadow-md 

      transition-shadow duration-200

      ${sizeStyles.container}

      overflow-hidden

    `}>

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

            <span className={`

              ${sizeStyles.label}

              text-gray-700 dark:text-gray-300 font-medium 

              truncate min-w-0

            `}>

              {label}

            </span>

          </div>

        </div>

        

        {/* Contenu principal */}
        <div className="flex-1 flex flex-col justify-between">

          {/* Section principale : Valeur et progression */}
          <div className="min-w-0">
            <div className={`

              ${sizeStyles.value}

              font-semibold 

              text-gray-900 dark:text-gray-100

              mb-2

              break-words

            `}>

              {hideValue ? '***' : value}

            </div>

            {/* Barre de progression pour objectif */}
            {progressValue !== undefined && progressMax !== undefined && (
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {progressLabel || `${progressValue} / ${progressMax}`}
                  </span>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {Math.min(Math.round((progressValue / progressMax) * 100), 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden relative">
                  <div
                    className={`h-full rounded-full transition-all duration-500 relative overflow-hidden ${getProgressGradientClass(progressValue, progressMax, variant)}`}
                    style={{ 
                      '--progress-width': `${Math.min((progressValue / progressMax) * 100, 100)}%`,
                      width: 'var(--progress-width)'
                    } as React.CSSProperties}
                  />
                  {/* Effet de brillance animé pour encourager - positionné sur toute la largeur de la barre grise */}
                  {progressValue > 0 && progressValue < progressMax && (
                    <div className="absolute top-0 left-0 bottom-0 rounded-full pointer-events-none w-full h-full progress-shimmer" />
                  )}
                </div>
              </div>
            )}
            
            {/* Espace équivalent à la barre de progression pour aligner les métriques secondaires */}
            {progressValue === undefined && progressMax === undefined && subMetrics && subMetrics.length > 0 && (
              <div className="mb-2">
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
              </div>
            )}

            {/* Métriques secondaires */}
            {subMetrics && subMetrics.length > 0 && (
              <div className="pt-1.5 border-t border-gray-200 dark:border-gray-700">
                <div className="space-y-1">
                  {subMetrics.map((metric, index) => (
                    metric.label && metric.value ? (
                      <div key={index} className="flex items-center justify-between gap-2 min-w-0">
                        <span className="text-xs text-gray-600 dark:text-gray-400 truncate min-w-0 flex-1">{metric.label}</span>
                        <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap flex-shrink-0">{metric.value}</span>
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

                ${trend ? trendColors[trend] : 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700'}

                px-2 py-1 

                rounded-md

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

