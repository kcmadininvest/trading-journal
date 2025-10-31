import React from 'react'



interface ModernStatCardProps {

  label: string

  value: string | number

  icon?: React.ReactNode

  trend?: 'up' | 'down' | 'neutral'

  trendValue?: string

  variant?: 'default' | 'success' | 'danger' | 'warning' | 'info'

  size?: 'small' | 'medium' | 'large'

}



function ModernStatCard({ 

  label, 

  value, 

  icon, 

  trend, 

  trendValue, 

  variant = 'default',

  size = 'medium'

}: ModernStatCardProps) {

  const variantConfig = {

    default: {

      iconBg: 'bg-slate-100',

      iconColor: 'text-slate-600',

      border: 'border-gray-200'

    },

    success: {

      iconBg: 'bg-emerald-100',

      iconColor: 'text-emerald-600',

      border: 'border-emerald-200'

    },

    danger: {

      iconBg: 'bg-rose-100',

      iconColor: 'text-rose-600',

      border: 'border-rose-200'

    },

    warning: {

      iconBg: 'bg-amber-100',

      iconColor: 'text-amber-600',

      border: 'border-amber-200'

    },

    info: {

      iconBg: 'bg-blue-100',

      iconColor: 'text-blue-600',

      border: 'border-blue-200'

    }

  }



  const sizeConfig = {

    small: {

      container: 'p-4 h-full',

      icon: 'w-8 h-8',

      iconContainer: 'p-2',

      value: 'text-2xl',

      label: 'text-xs',

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

    up: 'text-emerald-600 bg-emerald-50',

    down: 'text-rose-600 bg-rose-50',

    neutral: 'text-gray-600 bg-gray-50'

  }



  const config = variantConfig[variant]

  const sizeStyles = sizeConfig[size]



  return (

    <div className={`

      bg-white 

      border ${config.border}

      rounded-lg 

      shadow-sm hover:shadow-md 

      transition-shadow duration-200

      ${sizeStyles.container}

    `}>

      {/* Contenu principal */}

      <div className="flex flex-col h-full">

        {/* En-tête avec icône et label */}

        <div className="flex items-center justify-between mb-3">

          <div className="flex items-center gap-2">

            {icon && (

              <div className={`

                ${sizeStyles.iconContainer}

                rounded-lg 

                ${config.iconBg}

                ${config.iconColor}

              `}>

                <div className={sizeStyles.icon}>

                  {icon}

                </div>

              </div>

            )}

            <span className={`

              ${sizeStyles.label}

              text-gray-700 font-medium 

            `}>

              {label}

            </span>

          </div>

        </div>

        

        {/* Valeur principale */}

        <div className="flex-1 flex flex-col justify-center">

          <div className={`

            ${sizeStyles.value}

            font-semibold 

            text-gray-900

            mb-2

          `}>

            {value}

          </div>

          

          {/* Trend indicator */}

          <div className="min-h-[24px] flex items-center">

            {trendValue ? (

              <div className={`

                flex items-center gap-1.5

                ${sizeStyles.trend}

                font-medium 

                ${trend ? trendColors[trend] : 'text-gray-600 bg-gray-50'}

                px-2 py-1 

                rounded-md

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

