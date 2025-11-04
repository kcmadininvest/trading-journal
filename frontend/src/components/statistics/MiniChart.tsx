import React from 'react';

interface MiniChartProps {
  data: Array<{ label: string; value: number }>;
  type?: 'bar' | 'line';
  color?: 'blue' | 'green' | 'pink' | 'orange';
  height?: number;
  showLabels?: boolean;
}

export const MiniChart: React.FC<MiniChartProps> = ({
  data,
  type = 'bar',
  color = 'blue',
  height = 60,
  showLabels = false,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-600 text-sm">
        Pas de données
      </div>
    );
  }

  const colorClasses = {
    blue: {
      bg: 'bg-blue-500',
      line: 'stroke-blue-500',
      text: 'text-blue-600 dark:text-blue-400',
    },
    green: {
      bg: 'bg-green-500',
      line: 'stroke-green-500',
      text: 'text-green-600 dark:text-green-400',
    },
    pink: {
      bg: 'bg-pink-500',
      line: 'stroke-pink-500',
      text: 'text-pink-600 dark:text-pink-400',
    },
    orange: {
      bg: 'bg-orange-500',
      line: 'stroke-orange-500',
      text: 'text-orange-600 dark:text-orange-400',
    },
  };

  const colors = colorClasses[color];
  const maxValue = Math.max(...data.map(d => Math.abs(d.value)));
  const minValue = Math.min(...data.map(d => Math.abs(d.value)));
  const range = maxValue - minValue || 1;

  // Normaliser les valeurs pour l'affichage (0-100%)
  const normalizedData = data.map(d => ({
    ...d,
    normalized: range > 0 ? ((Math.abs(d.value) - minValue) / range) * 100 : 50,
  }));

  if (type === 'bar') {
    return (
      <div className="w-full" style={{ height: `${height}px` }}>
        <div className="flex items-end justify-between h-full gap-1">
          {normalizedData.map((item, index) => (
            <div key={index} className="flex-1 flex flex-col items-center justify-end h-full">
              <div
                className={`${colors.bg} rounded-t w-full transition-all hover:opacity-80`}
                style={{
                  height: `${item.normalized}%`,
                  minHeight: item.normalized > 0 ? '2px' : '0',
                }}
                title={`${item.label}: ${item.value.toFixed(2)}`}
                aria-label={`${item.label}: ${item.value.toFixed(2)}`}
              />
              {showLabels && (
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate w-full text-center">
                  {item.label}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Line chart
  const points = normalizedData.map((item, index) => {
    const x = (index / (normalizedData.length - 1 || 1)) * 100;
    const y = 100 - item.normalized;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="w-full" style={{ height: `${height}px` }}>
      <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          strokeWidth="2"
          className={colors.line}
          vectorEffect="non-scaling-stroke"
        />
        {normalizedData.map((item, index) => {
          const x = (index / (normalizedData.length - 1 || 1)) * 100;
          const y = 100 - item.normalized;
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r="2"
              className={colors.bg}
            >
              <title>{`${item.label}: ${item.value.toFixed(2)}`}</title>
            </circle>
          );
        })}
      </svg>
      {showLabels && (
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
          {normalizedData.map((item, index) => (
            <span key={index} className="truncate">
              {item.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

