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
      gradient: 'from-slate-50 to-slate-100',
      iconBg: 'from-slate-500 to-slate-600',
      glow: 'shadow-slate-500/25',
      border: 'border-slate-200'
    },
    success: {
      gradient: 'from-emerald-50 to-emerald-100',
      iconBg: 'from-emerald-500 to-emerald-600',
      glow: 'shadow-emerald-500/25',
      border: 'border-emerald-200'
    },
    danger: {
      gradient: 'from-rose-50 to-rose-100',
      iconBg: 'from-rose-500 to-rose-600',
      glow: 'shadow-rose-500/25',
      border: 'border-rose-200'
    },
    warning: {
      gradient: 'from-amber-50 to-amber-100',
      iconBg: 'from-amber-500 to-amber-600',
      glow: 'shadow-amber-500/25',
      border: 'border-amber-200'
    },
    info: {
      gradient: 'from-blue-50 to-blue-100',
      iconBg: 'from-blue-500 to-blue-600',
      glow: 'shadow-blue-500/25',
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
      relative overflow-hidden 
      bg-white/80 backdrop-blur-sm 
      border ${config.border}
      rounded-2xl 
      shadow-lg hover:shadow-2xl 
      transition-all duration-300 
      hover:scale-[1.02] 
      group
      ${sizeStyles.container}
    `}>
      {/* Gradient animé en arrière-plan */}
      <div className={`
        absolute inset-0 
        bg-gradient-to-br ${config.gradient} 
        opacity-0 group-hover:opacity-100 
        transition-opacity duration-500
      `} />
      
      {/* Contenu principal */}
      <div className="relative z-10 flex flex-col h-full">
        {/* En-tête avec icône et label */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {icon && (
              <div className={`
                relative ${sizeStyles.iconContainer}
                rounded-xl 
                bg-gradient-to-br ${config.iconBg}
                shadow-lg group-hover:${config.glow}
                transition-all duration-300
                group-hover:scale-110
              `}>
                <div className={sizeStyles.icon}>
                  {icon}
                </div>
              </div>
            )}
            <span className={`
              ${sizeStyles.label}
              text-gray-600 font-semibold 
              uppercase tracking-wide
            `}>
              {label}
            </span>
          </div>
        </div>
        
        {/* Valeur principale */}
        <div className="flex-1 flex flex-col justify-center">
          <div className={`
            ${sizeStyles.value}
            font-bold 
            bg-gradient-to-r from-gray-900 to-gray-700 
            bg-clip-text text-transparent
            mb-3
            tracking-tight
          `}>
            {value}
          </div>
          
          {/* Trend indicator - toujours présent pour maintenir la hauteur */}
          <div className="min-h-[32px] flex items-center">
            {trend && trendValue ? (
              <div className={`
                flex items-center gap-2 
                ${sizeStyles.trend}
                font-medium 
                ${trendColors[trend]}
                px-3 py-1.5 
                rounded-full
                backdrop-blur-sm
                transition-all duration-200
                group-hover:scale-105
              `}>
                {trendIcons[trend]}
                <span>{trendValue}</span>
              </div>
            ) : (
              <div className="h-6"></div>
            )}
          </div>
        </div>
      </div>
      
      {/* Effet de brillance au hover */}
      <div className="
        absolute inset-0 
        bg-gradient-to-r from-transparent via-white/20 to-transparent 
        -translate-x-full group-hover:translate-x-full 
        transition-transform duration-1000 ease-out
      " />
    </div>
  )
}

export default ModernStatCard
