import React, { useState, useEffect } from 'react'
import { adaptiveGoalsService, AdaptiveGoals } from '../../services/adaptiveGoals'

interface TradingMetrics {
  winRate: number
  avgWinningTrade: number
  avgLosingTrade: number
}

interface ModernTradingMetricsDashboardProps {
  metrics: TradingMetrics
  currency?: string
}

interface CircularGaugeProps {
  title: string
  value: number
  max: number
  unit: string
  goal: string
  color: string
  size?: number
  currency?: string
}

function CircularGauge({ 
  title, 
  value, 
  max, 
  unit, 
  goal, 
  color,
  size = 120,
  currency = 'USD'
}: CircularGaugeProps) {
  const radius = (size - 20) / 2
  const strokeWidth = 8
  const centerX = size / 2
  const centerY = size / 2
  
  // Calculate the percentage and arc length
  const percentage = Math.min(value / max, 1)
  const circumference = 2 * Math.PI * radius
  const strokeDasharray = circumference
  const strokeDashoffset = circumference - (percentage * circumference)
  
  // Format the value for display
  const formatValue = (val: number) => {
    if (unit === '$') {
      // Utiliser le symbole de la devise au lieu du formatage complet pour garder la même taille
      const currencySymbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$'
      return `${currencySymbol}${val.toLocaleString()}`
    }
    return `${val}${unit}`
  }

  // Determine color based on performance
  const getColor = () => {
    if (title.includes('Win Rate')) {
      if (percentage >= 0.6) return '#10b981' // emerald-500
      if (percentage >= 0.4) return '#f59e0b' // amber-500
      return '#ef4444' // rose-500
    }
    return color
  }

  const gaugeColor = getColor()

  return (
    <div className="relative group">
      <div className="
        bg-white/80 backdrop-blur-sm 
        border border-gray-200 
        rounded-2xl 
        p-6 
        shadow-lg hover:shadow-2xl 
        transition-all duration-300 
        hover:scale-105
        group-hover:bg-gradient-to-br group-hover:from-white group-hover:to-gray-50
      ">
        {/* Title */}
        <h3 className="text-sm font-semibold text-gray-700 mb-4 text-center uppercase tracking-wide">
          {title}
        </h3>
        
        {/* Circular Gauge */}
        <div className="relative flex items-center justify-center mb-4">
          <svg width={size} height={size} className="transform -rotate-90">
            {/* Background circle */}
            <circle
              cx={centerX}
              cy={centerY}
              r={radius}
              stroke="#e5e7eb"
              strokeWidth={strokeWidth}
              fill="none"
              className="opacity-30"
            />
            
            {/* Progress circle */}
            <circle
              cx={centerX}
              cy={centerY}
              r={radius}
              stroke={gaugeColor}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out drop-shadow-sm"
              style={{
                filter: `drop-shadow(0 0 8px ${gaugeColor}40)`
              }}
            />
          </svg>
          
          {/* Center value */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-2xl font-bold text-gray-900">
              {formatValue(value)}
            </div>
          </div>
        </div>
        
        {/* Goal text */}
        <div className="text-xs text-gray-600 text-center leading-relaxed">
          {goal}
        </div>
        
        {/* Performance indicator */}
        <div className="mt-3 flex justify-center">
          <div className={`
            px-2 py-1 rounded-full text-xs font-medium
            ${percentage >= 0.6 ? 'bg-emerald-100 text-emerald-700' : 
              percentage >= 0.4 ? 'bg-amber-100 text-amber-700' : 
              'bg-rose-100 text-rose-700'}
          `}>
            {percentage >= 0.6 ? 'Excellent' : 
             percentage >= 0.4 ? 'Bon' : 'À améliorer'}
          </div>
        </div>
      </div>
      
      {/* Hover effect overlay */}
      <div className="
        absolute inset-0 
        bg-gradient-to-r from-transparent via-white/10 to-transparent 
        -translate-x-full group-hover:translate-x-full 
        transition-transform duration-1000 ease-out
        rounded-2xl
        pointer-events-none
      " />
    </div>
  )
}

function ModernTradingMetricsDashboard({ metrics, currency = 'USD' }: ModernTradingMetricsDashboardProps) {
  const [adaptiveGoals, setAdaptiveGoals] = useState<AdaptiveGoals | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadAdaptiveGoals = async () => {
      try {
        setLoading(true)
        const goals = await adaptiveGoalsService.calculateAdaptiveGoals(currency)
        setAdaptiveGoals(goals)
      } catch (error) {
        console.error('Error loading adaptive goals:', error)
      } finally {
        setLoading(false)
      }
    }

    loadAdaptiveGoals()
  }, [metrics, currency])

  if (loading) {
    return (
      <div className="
        bg-white/80 backdrop-blur-sm 
        border border-gray-200 
        rounded-2xl 
        p-6 
        shadow-lg 
        h-full
        flex items-center justify-center
      ">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Calcul des objectifs personnalisés...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="
      bg-white/80 backdrop-blur-sm 
      border border-gray-200 
      rounded-2xl 
      p-6 
      shadow-lg hover:shadow-2xl 
      transition-all duration-300 
      group
      h-full
    ">
      {/* Title */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2 uppercase tracking-wide">
          Trader Performance Tracker
        </h2>
        <div className="w-20 h-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mx-auto"></div>
        <p className="text-xs text-gray-500 mt-2">Objectifs basés sur vos performances historiques</p>
      </div>
      
      {/* Gauges Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
        <CircularGauge
          title="Win Rate Percent"
          value={metrics.winRate}
          max={100}
          unit="%"
          goal={adaptiveGoals?.winRate.goal || "Calcul en cours..."}
          color="#3b82f6"
          currency={currency}
        />
        
        <CircularGauge
          title="Avg Winning Trade"
          value={metrics.avgWinningTrade}
          max={1200}
          unit="$"
          goal={adaptiveGoals?.avgWinningTrade.goal || "Calcul en cours..."}
          color="#10b981"
          currency={currency}
        />
        
        <CircularGauge
          title="Avg Losing Trade"
          value={Math.abs(metrics.avgLosingTrade)}
          max={850}
          unit="$"
          goal={adaptiveGoals?.avgLosingTrade.goal || "Calcul en cours..."}
          color="#ef4444"
          currency={currency}
        />
      </div>
      
      {/* Hover effect overlay */}
      <div className="
        absolute inset-0 
        bg-gradient-to-r from-transparent via-white/5 to-transparent 
        -translate-x-full group-hover:translate-x-full 
        transition-transform duration-1000 ease-out
        rounded-2xl
        pointer-events-none
      " />
    </div>
  )
}

export default ModernTradingMetricsDashboard