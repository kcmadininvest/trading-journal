import React from 'react'

interface GaugeProps {
  value: number
  min: number
  max: number
  label: string
  unit?: string
  color?: 'blue' | 'green' | 'red' | 'purple' | 'orange'
  size?: 'sm' | 'md' | 'lg'
  description?: string
}

function Gauge({ 
  value, 
  min, 
  max, 
  label, 
  unit = '', 
  color = 'blue',
  size = 'md',
  description 
}: GaugeProps) {
  // Calculer le pourcentage pour la jauge
  const percentage = Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100)
  
  // Définir les couleurs selon le type
  const colorClasses = {
    blue: {
      bg: 'bg-blue-50',
      ring: 'text-blue-600',
      fill: '#3b82f6',
      text: 'text-blue-600'
    },
    green: {
      bg: 'bg-green-50',
      ring: 'text-green-600',
      fill: '#10b981',
      text: 'text-green-600'
    },
    red: {
      bg: 'bg-red-50',
      ring: 'text-red-600',
      fill: '#ef4444',
      text: 'text-red-600'
    },
    purple: {
      bg: 'bg-purple-50',
      ring: 'text-purple-600',
      fill: '#8b5cf6',
      text: 'text-purple-600'
    },
    orange: {
      bg: 'bg-orange-50',
      ring: 'text-orange-600',
      fill: '#f97316',
      text: 'text-orange-600'
    }
  }

  const colors = colorClasses[color]
  
  // Tailles
  const sizeClasses = {
    sm: {
      container: 'w-32 h-32',
      text: 'text-sm',
      value: 'text-lg',
      label: 'text-xs'
    },
    md: {
      container: 'w-40 h-40',
      text: 'text-base',
      value: 'text-xl',
      label: 'text-sm'
    },
    lg: {
      container: 'w-48 h-48',
      text: 'text-lg',
      value: 'text-2xl',
      label: 'text-base'
    }
  }

  const sizes = sizeClasses[size]

  // Créer le SVG de la jauge
  const radius = 60
  const strokeWidth = 8
  const normalizedRadius = radius - strokeWidth * 2
  const circumference = normalizedRadius * 2 * Math.PI
  const strokeDasharray = `${circumference} ${circumference}`
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className={`flex flex-col items-center ${colors.bg} rounded-xl p-4`}>
      <div className={`relative ${sizes.container} flex items-center justify-center`}>
        <svg
          className="absolute inset-0 w-full h-full transform -rotate-90"
          viewBox={`0 0 ${radius * 2} ${radius * 2}`}
        >
          {/* Cercle de fond */}
          <circle
            cx={radius}
            cy={radius}
            r={normalizedRadius}
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Cercle de progression */}
          <circle
            cx={radius}
            cy={radius}
            r={normalizedRadius}
            stroke={colors.fill}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        
        {/* Valeur au centre */}
        <div className="text-center">
          <div className={`font-bold ${colors.text} ${sizes.value}`}>
            {value.toFixed(2)}{unit}
          </div>
        </div>
      </div>
      
      {/* Label et description */}
      <div className="text-center mt-2">
        <div className={`font-semibold ${colors.text} ${sizes.label}`}>
          {label}
        </div>
        {description && (
          <div className={`text-gray-500 ${sizes.text} mt-1`}>
            {description}
          </div>
        )}
      </div>
    </div>
  )
}

export default Gauge
