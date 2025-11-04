import React from 'react';
import Tooltip from '../ui/Tooltip';

interface HeroMetricCardProps {
  label: string;
  value: React.ReactNode;
  tooltip?: string;
  variant?: 'success' | 'warning' | 'danger' | 'info';
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
}

export const HeroMetricCard: React.FC<HeroMetricCardProps> = ({
  label,
  value,
  tooltip,
  variant = 'info',
  icon,
  trend,
  trendLabel,
}) => {
  const variantStyles = {
    success: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      valueColor: 'text-blue-600 dark:text-blue-400',
    },
    warning: {
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      border: 'border-orange-200 dark:border-orange-800',
      iconBg: 'bg-orange-100 dark:bg-orange-900/30',
      iconColor: 'text-orange-600 dark:text-orange-400',
      valueColor: 'text-orange-600 dark:text-orange-400',
    },
    danger: {
      bg: 'bg-pink-50 dark:bg-pink-900/20',
      border: 'border-pink-200 dark:border-pink-800',
      iconBg: 'bg-pink-100 dark:bg-pink-900/30',
      iconColor: 'text-pink-600 dark:text-pink-400',
      valueColor: 'text-pink-600 dark:text-pink-400',
    },
    info: {
      bg: 'bg-gray-50 dark:bg-gray-800/50',
      border: 'border-gray-200 dark:border-gray-700',
      iconBg: 'bg-gray-100 dark:bg-gray-700',
      iconColor: 'text-gray-600 dark:text-gray-400',
      valueColor: 'text-gray-900 dark:text-gray-100',
    },
  };

  const style = variantStyles[variant];

  return (
    <div className={`${style.bg} ${style.border} rounded-xl border-2 p-4 transition-all hover:shadow-lg`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {icon && (
            <div className={`${style.iconBg} ${style.iconColor} w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0`}>
              <div className="w-5 h-5">
                {icon}
              </div>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">
                {label}
              </h3>
              {tooltip && (
                <Tooltip content={tooltip}>
                  <svg className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 cursor-help flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <div className={`text-2xl font-bold ${style.valueColor}`}>
          {value}
        </div>
        {trend && trendLabel && (
          <div className="flex items-center gap-1 text-sm">
            {trend === 'up' && (
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            )}
            {trend === 'down' && (
              <svg className="w-4 h-4 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6 6" />
              </svg>
            )}
            <span className="text-gray-600 dark:text-gray-400">{trendLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
};

