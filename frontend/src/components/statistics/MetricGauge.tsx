import React from 'react';
import Tooltip from '../ui/Tooltip';

export type GaugeType = 'ratio' | 'percentage' | 'inverted-percentage';

export interface GaugeThreshold {
  value: number;
  label: string;
  color: 'red' | 'orange' | 'green';
}

export interface MetricGaugeConfig {
  type: GaugeType;
  min: number;
  max: number;
  thresholds: GaugeThreshold[];
  unit?: string;
}

interface MetricGaugeProps {
  label: string;
  value: number;
  config: MetricGaugeConfig;
  tooltip?: string;
  formatValue?: (value: number) => string;
  showLabels?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const MetricGauge: React.FC<MetricGaugeProps> = ({
  label,
  value,
  config,
  tooltip,
  formatValue,
  showLabels = true,
  size = 'md',
}) => {
  const { min, max, thresholds, unit = '' } = config;

  // Calculer la position du curseur (0-100%)
  const clampedValue = Math.max(min, Math.min(max, value));
  const percentage = ((clampedValue - min) / (max - min)) * 100;

  // Déterminer la couleur actuelle basée sur les seuils
  const getCurrentColor = (): 'red' | 'orange' | 'green' => {
    const sortedThresholds = [...thresholds].sort((a, b) => a.value - b.value);
    
    for (let i = sortedThresholds.length - 1; i >= 0; i--) {
      if (value >= sortedThresholds[i].value) {
        return sortedThresholds[i].color;
      }
    }
    
    return sortedThresholds[0]?.color || 'red';
  };

  const currentColor = getCurrentColor();

  const colorClasses = {
    red: 'bg-pink-500 dark:bg-pink-400',
    orange: 'bg-orange-500 dark:bg-orange-400',
    green: 'bg-blue-500 dark:bg-blue-400',
  };

  const textColorClasses = {
    red: 'text-pink-600 dark:text-pink-400',
    orange: 'text-orange-600 dark:text-orange-400',
    green: 'text-blue-600 dark:text-blue-400',
  };

  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4',
  };

  // Calculer les zones de couleur pour l'arrière-plan
  const getBackgroundGradient = (): string => {
    const sortedThresholds = [...thresholds].sort((a, b) => a.value - b.value);
    const gradientStops: string[] = [];

    sortedThresholds.forEach((threshold, index) => {
      const thresholdPercentage = ((threshold.value - min) / (max - min)) * 100;
      
      if (index === 0) {
        // Première zone commence à 0%
        const color = threshold.color === 'red' ? 'rgb(251 207 232)' : 
                     threshold.color === 'orange' ? 'rgb(254 215 170)' : 
                     'rgb(191 219 254)';
        
        gradientStops.push(`${color} 0%`);
        gradientStops.push(`${color} ${thresholdPercentage}%`);
      } else {
        const color = threshold.color === 'red' ? 'rgb(251 207 232)' : 
                     threshold.color === 'orange' ? 'rgb(254 215 170)' : 
                     'rgb(191 219 254)';
        
        gradientStops.push(`${color} ${thresholdPercentage}%`);
      }
    });

    // Dernière zone jusqu'à 100%
    const lastColor = sortedThresholds[sortedThresholds.length - 1];
    const color = lastColor.color === 'red' ? 'rgb(251 207 232)' : 
                 lastColor.color === 'orange' ? 'rgb(254 215 170)' : 
                 'rgb(191 219 254)';
    gradientStops.push(`${color} 100%`);

    return `linear-gradient(to right, ${gradientStops.join(', ')})`;
  };

  const displayValue = formatValue ? formatValue(value) : `${value.toFixed(2)}${unit}`;

  return (
    <div className="space-y-2">
      {/* Label et valeur */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1">
          <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
          {tooltip && (
            <Tooltip content={tooltip}>
              <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </Tooltip>
          )}
        </div>
        <span className={`text-base font-semibold ${textColorClasses[currentColor]}`}>
          {displayValue}
        </span>
      </div>

      {/* Jauge */}
      <div className="relative">
        {/* Arrière-plan avec zones de couleur */}
        <div 
          className={`w-full ${sizeClasses[size]} rounded-full overflow-hidden`}
          style={{ 
            background: getBackgroundGradient(),
          }}
        >
          {/* Barre de progression */}
          <div
            className={`${sizeClasses[size]} ${colorClasses[currentColor]} rounded-full transition-all duration-700 ease-out relative`}
            style={{ width: `${percentage}%` }}
          >
            {/* Indicateur de position */}
            <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 ${colorClasses[currentColor]} rounded-full shadow-lg`} />
          </div>
        </div>

        {/* Marqueurs de seuils */}
        {thresholds.map((threshold, index) => {
          const thresholdPercentage = ((threshold.value - min) / (max - min)) * 100;
          if (thresholdPercentage <= 0 || thresholdPercentage >= 100) return null;
          
          return (
            <div
              key={index}
              className="absolute top-0 bottom-0 w-px bg-gray-400 dark:bg-gray-600"
              style={{ left: `${thresholdPercentage}%` }}
            >
              {showLabels && (
                <span className="absolute top-full mt-1 -translate-x-1/2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {threshold.value}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Labels des zones (optionnel) */}
      {showLabels && (
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 px-1">
          <span>{min}</span>
          <span>{max}+</span>
        </div>
      )}
    </div>
  );
};

// Configurations prédéfinies pour les métriques courantes
export const GAUGE_CONFIGS: Record<string, MetricGaugeConfig> = {
  profitFactor: {
    type: 'ratio',
    min: 0,
    max: 3,
    thresholds: [
      { value: 0, label: 'Poor', color: 'red' },
      { value: 1.0, label: 'Average', color: 'orange' },
      { value: 2.0, label: 'Good', color: 'green' },
    ],
  },
  winRate: {
    type: 'percentage',
    min: 0,
    max: 100,
    thresholds: [
      { value: 0, label: 'Poor', color: 'red' },
      { value: 40, label: 'Average', color: 'orange' },
      { value: 50, label: 'Good', color: 'green' },
    ],
    unit: '%',
  },
  sharpeRatio: {
    type: 'ratio',
    min: 0,
    max: 3,
    thresholds: [
      { value: 0, label: 'Poor', color: 'red' },
      { value: 0.5, label: 'Average', color: 'orange' },
      { value: 1.0, label: 'Good', color: 'green' },
    ],
  },
  tradeEfficiency: {
    type: 'percentage',
    min: 0,
    max: 100,
    thresholds: [
      { value: 0, label: 'Poor', color: 'red' },
      { value: 30, label: 'Average', color: 'orange' },
      { value: 50, label: 'Good', color: 'green' },
    ],
    unit: '%',
  },
  feesRatio: {
    type: 'inverted-percentage',
    min: 0,
    max: 30,
    thresholds: [
      { value: 0, label: 'Good', color: 'green' },
      { value: 10, label: 'Average', color: 'orange' },
      { value: 20, label: 'Poor', color: 'red' },
    ],
    unit: '%',
  },
  winLossRatio: {
    type: 'ratio',
    min: 0,
    max: 3,
    thresholds: [
      { value: 0, label: 'Poor', color: 'red' },
      { value: 1.0, label: 'Average', color: 'orange' },
      { value: 1.5, label: 'Good', color: 'green' },
    ],
  },
  recoveryRatio: {
    type: 'ratio',
    min: 0,
    max: 3,
    thresholds: [
      { value: 0, label: 'Poor', color: 'red' },
      { value: 1.0, label: 'Average', color: 'orange' },
      { value: 1.5, label: 'Good', color: 'green' },
    ],
  },
  planRespectRate: {
    type: 'percentage',
    min: 0,
    max: 100,
    thresholds: [
      { value: 0, label: 'Poor', color: 'red' },
      { value: 50, label: 'Average', color: 'orange' },
      { value: 70, label: 'Good', color: 'green' },
    ],
    unit: '%',
  },
};
