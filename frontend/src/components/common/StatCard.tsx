import React from 'react'
import Card from './Card'

interface StatCardProps {
  label: string
  value: string | number
  icon?: string | React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'info'
}

function StatCard({ label, value, icon, trend, trendValue, variant = 'default' }: StatCardProps) {
  const variantClasses = {
    default: 'border-l-4 border-l-gray-300',
    success: 'border-l-4 border-l-emerald-500',
    danger: 'border-l-4 border-l-rose-500',
    warning: 'border-l-4 border-l-amber-500',
    info: 'border-l-4 border-l-blue-500'
  }

  const trendIcons = {
    up: '↗',
    down: '↘',
    neutral: '→'
  }

  const trendColors = {
    up: 'text-emerald-600',
    down: 'text-rose-600',
    neutral: 'text-gray-500'
  }

  return (
    <Card className={`relative overflow-hidden hover:shadow-lg hover:scale-[1.02] transition-all duration-200 h-full flex flex-col bg-gradient-to-br from-white to-gray-50 ${variantClasses[variant]}`} padding="small">
      <div className="flex items-center gap-3 mb-4">
        {icon && (
          <div className="text-2xl md:text-3xl opacity-80">
            {typeof icon === 'string' ? (
              <span>{icon}</span>
            ) : (
              icon
            )}
          </div>
        )}
        <span className="text-sm md:text-base text-gray-500 font-semibold uppercase tracking-widest">{label}</span>
      </div>
      <div className="flex-1 flex flex-col justify-center">
        <div className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">{value}</div>
        {trend && trendValue && (
          <div className={`flex items-center gap-2 text-sm md:text-base font-medium ${trendColors[trend]} bg-white/50 px-2 py-1 rounded-full`}>
            <span className="text-base md:text-lg">{trendIcons[trend]}</span>
            <span>{trendValue}</span>
          </div>
        )}
      </div>
    </Card>
  )
}

export default StatCard