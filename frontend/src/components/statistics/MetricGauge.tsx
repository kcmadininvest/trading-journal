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
  compactBar?: boolean;
}

export const MetricGauge: React.FC<MetricGaugeProps> = ({
  label,
  value,
  config,
  tooltip,
  formatValue,
  showLabels = true,
  size = 'md',
  compactBar = false,
}) => {
  const labelRef = React.useRef<HTMLSpanElement>(null);
  const gaugeRef = React.useRef<HTMLDivElement>(null);
  const [isLabelTruncated, setIsLabelTruncated] = React.useState(false);
  const [showDetailedScale, setShowDetailedScale] = React.useState(true);
  const { min, max, thresholds, unit = '' } = config;

  React.useEffect(() => {
    const checkTruncation = () => {
      const el = labelRef.current;
      if (!el) return;
      setIsLabelTruncated(el.scrollWidth > el.clientWidth);
    };

    checkTruncation();
    window.addEventListener('resize', checkTruncation);

    return () => {
      window.removeEventListener('resize', checkTruncation);
    };
  }, [label]);

  React.useEffect(() => {
    const updateScaleVisibility = () => {
      const gaugeEl = gaugeRef.current;
      if (!gaugeEl) return;
      // En dessous de cette largeur, les labels intermédiaires se chevauchent.
      setShowDetailedScale(gaugeEl.clientWidth >= 180);
    };

    updateScaleVisibility();

    const gaugeEl = gaugeRef.current;
    if (!gaugeEl) return;

    const resizeObserver = new ResizeObserver(updateScaleVisibility);
    resizeObserver.observe(gaugeEl);
    window.addEventListener('resize', updateScaleVisibility);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateScaleVisibility);
    };
  }, []);

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

  // Déterminer la classe de gradient en fonction du label ou de la configuration
  const getGaugeBackgroundClass = (): string => {
    const labelLower = label.toLowerCase();
    
    // Détecter par label si disponible
    if (labelLower.includes('profit factor')) return 'gauge-bg-profit-factor';
    if (labelLower.includes('win rate') || labelLower.includes('taux de réussite')) return 'gauge-bg-win-rate';
    if (labelLower.includes('sharpe')) return 'gauge-bg-sharpe-ratio';
    if (labelLower.includes('efficiency') || labelLower.includes('efficacité')) return 'gauge-bg-trade-efficiency';
    if (labelLower.includes('fees') || labelLower.includes('frais')) return 'gauge-bg-fees-ratio';
    if (labelLower.includes('win/loss') || labelLower.includes('gain/perte')) return 'gauge-bg-win-loss-ratio';
    if (labelLower.includes('recovery') || labelLower.includes('récupération')) return 'gauge-bg-recovery-ratio';
    if (labelLower.includes('plan') || labelLower.includes('respect')) return 'gauge-bg-plan-respect-rate';
    
    // Si label vide, détecter par configuration (min, max, thresholds)
    if (!label || label === '') {
      // Profit Factor: min=0, max=3, thresholds=[0, 1.0, 2.0]
      if (min === 0 && max === 3 && thresholds.length === 3) {
        const sortedThresholds = [...thresholds].sort((a, b) => a.value - b.value);
        if (sortedThresholds[0].value === 0 && sortedThresholds[1].value === 1.0 && sortedThresholds[2].value === 2.0) {
          return 'gauge-bg-profit-factor';
        }
        // Win/Loss Ratio: min=0, max=3, thresholds=[0, 1.0, 1.5]
        if (sortedThresholds[0].value === 0 && sortedThresholds[1].value === 1.0 && sortedThresholds[2].value === 1.5) {
          return 'gauge-bg-win-loss-ratio';
        }
      }
      // Win Rate: min=0, max=100, thresholds=[0, 40, 50]
      if (min === 0 && max === 100 && thresholds.length === 3) {
        const sortedThresholds = [...thresholds].sort((a, b) => a.value - b.value);
        if (sortedThresholds[0].value === 0 && sortedThresholds[1].value === 40 && sortedThresholds[2].value === 50) {
          return 'gauge-bg-win-rate';
        }
      }
    }
    
    return 'gauge-bg-default';
  };

  const displayValue = formatValue ? formatValue(value) : `${value.toFixed(2)}${unit}`;

  const barContent = (
    <div ref={gaugeRef} className="relative">
      <div className={`w-full ${sizeClasses[size]} rounded-full overflow-hidden ${getGaugeBackgroundClass()}`}>
        <div
          className={`${sizeClasses[size]} ${colorClasses[currentColor]} rounded-full transition-all duration-700 ease-out relative`}
          style={{ width: `${percentage}%` }}
        >
          <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 ${colorClasses[currentColor]} rounded-full shadow-lg`} />
        </div>
      </div>

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
              <span
                className={`absolute top-full mt-1 -translate-x-1/2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap ${
                  showDetailedScale ? 'block' : 'hidden'
                }`}
              >
                {threshold.value}
              </span>
            )}
          </div>
        );
      })}

      {/* Labels des zones (positionnés en absolu pour ne pas affecter la hauteur) */}
      {showLabels && (
        <div className="absolute top-full mt-1 left-0 right-0 flex justify-between text-xs text-gray-500 dark:text-gray-400 px-1">
          <span>{min}</span>
          {showDetailedScale ? <span>{max}+</span> : <span>{max}</span>}
        </div>
      )}
    </div>
  );

  if (compactBar) {
    return <div className="w-full">{barContent}</div>;
  }

  return (
    <div className={showLabels ? 'mb-4' : ''}>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      {/* Label (côté gauche) */}
      <div className="w-full min-w-0 sm:w-[35%] sm:flex-shrink-0">
        <div className="flex items-center gap-1 min-w-0">
          <Tooltip content={label} delay={0} disabled={!isLabelTruncated} className="w-full">
            <span
              ref={labelRef}
              className={`block w-full text-sm text-gray-500 dark:text-gray-400 whitespace-normal break-words sm:truncate ${
                isLabelTruncated ? 'cursor-help' : ''
              }`}
            >
              {label}
            </span>
          </Tooltip>
          {tooltip && (
            <Tooltip content={tooltip}>
              <svg className="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-gray-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Valeur (avant la jauge) */}
      <span className={`text-base font-semibold ${textColorClasses[currentColor]} text-left min-w-[4rem] sm:flex-shrink-0 sm:text-right`}>
        {displayValue}
      </span>

      {/* Jauge (côté droit) */}
      <div className="flex-1 min-w-0 relative">
        {barContent}
      </div>
    </div>
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
