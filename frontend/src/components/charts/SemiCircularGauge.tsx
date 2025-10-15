import React from 'react'

interface SemiCircularGaugeProps {
  title: string
  value: number
  max: number
  unit?: string
  goal?: string
  color?: string
  width?: number
  height?: number
}

function SemiCircularGauge({ 
  title, 
  value, 
  max, 
  unit = '', 
  goal, 
  color = '#6b7280',
  width = 380,
  height = 240
}: SemiCircularGaugeProps) {
  const radius = 110
  const strokeWidth = 20
  const centerX = width / 2
  const centerY = height - 65 // Remonte encore un peu plus la jauge
  
  // Calculate the percentage and arc length
  const percentage = Math.min(value / max, 1)
  const circumference = Math.PI * radius
  const strokeDasharray = circumference
  const strokeDashoffset = circumference - (percentage * circumference)
  
  // Format the value for display
  const formatValue = (val: number) => {
    if (unit === '$') {
      return `$${val.toLocaleString()}`
    }
    return `${val}${unit}`
  }

  return (
    <div className="flex flex-col items-center justify-center p-1 bg-white rounded-lg border border-gray-200 h-full overflow-hidden">
      <h3 className="text-lg font-medium text-gray-700 mb-1 text-center">{title}</h3>
      
      <div className="relative" style={{ width, height }}>
        <svg width={width} height={height} className="overflow-visible">
          {/* Background arc */}
          <path
            d={`M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}`}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          
          {/* Progress arc */}
          <path
            d={`M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}`}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            style={{
              transition: 'stroke-dashoffset 1s ease-in-out'
            }}
          />
          
          {/* Scale labels - positioned at foot of gauge and centered */}
          <text x={centerX - radius} y={centerY + 30} fontSize="18" fill="#6b7280" textAnchor="middle">
            {unit === '$' ? '$0' : '0'}
          </text>
          <text x={centerX + radius} y={centerY + 30} fontSize="18" fill="#6b7280" textAnchor="middle">
            {unit === '$' ? `$${max.toLocaleString()}` : max}
          </text>
        </svg>
        
        {/* Value display - positioned slightly above gauge */}
        <div className="absolute left-0 right-0 flex items-center justify-center" style={{ top: '20px' }}>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {formatValue(value)}
            </div>
          </div>
        </div>
      </div>
      
    </div>
  )
}

export default SemiCircularGauge
