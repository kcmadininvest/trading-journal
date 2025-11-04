import React from 'react';
import Tooltip from '../ui/Tooltip';

export type MetricCardVariant = 'hero' | 'standard' | 'compact';

interface MetricCardProps {
  title: string;
  icon?: React.ReactNode;
  variant?: MetricCardVariant;
  className?: string;
  children: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  icon,
  variant = 'standard',
  className = '',
  children,
}) => {
  const baseClasses = 'bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700';
  
  const variantClasses = {
    hero: 'p-8',
    standard: 'p-6',
    compact: 'p-4',
  };

  const iconSizeClasses = {
    hero: 'w-12 h-12',
    standard: 'w-10 h-10',
    compact: 'w-8 h-8',
  };

  const titleSizeClasses = {
    hero: 'text-lg font-semibold',
    standard: 'text-base font-medium',
    compact: 'text-sm font-medium',
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {(title || icon) && (
        <div className="flex items-center gap-3 mb-4">
          {icon && (
            <div className={`${iconSizeClasses[variant]} bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0`}>
              <div className="w-6 h-6 text-blue-600 dark:text-blue-400">
                {icon}
              </div>
            </div>
          )}
          {title && (
            <h3 className={`${titleSizeClasses[variant]} text-gray-500 dark:text-gray-400`}>
              {title}
            </h3>
          )}
        </div>
      )}
      <div className={variant === 'hero' ? 'space-y-3' : 'space-y-2'}>
        {children}
      </div>
    </div>
  );
};

interface MetricItemProps {
  label: string;
  value: React.ReactNode;
  tooltip?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg';
}

export const MetricItem: React.FC<MetricItemProps> = ({
  label,
  value,
  tooltip,
  variant = 'default',
  size = 'md',
}) => {
  const variantColors = {
    default: 'text-gray-900 dark:text-gray-100',
    success: 'text-blue-500 dark:text-blue-400',
    warning: 'text-orange-600 dark:text-orange-400',
    danger: 'text-pink-500 dark:text-pink-400',
    info: 'text-cyan-600 dark:text-cyan-400',
  };

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-1">
        <span className={`text-sm text-gray-500 dark:text-gray-400`}>{label}</span>
        {tooltip && (
          <Tooltip content={tooltip}>
            <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </Tooltip>
        )}
      </div>
      <span className={`${sizeClasses[size]} font-semibold ${variantColors[variant]}`}>
        {value}
      </span>
    </div>
  );
};

