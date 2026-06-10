import React from 'react';
import Tooltip from '../ui/Tooltip';

export type MetricCardVariant = 'hero' | 'standard' | 'compact';

interface MetricCardProps {
  title: string;
  icon?: React.ReactNode;
  variant?: MetricCardVariant;
  className?: string;
  titleAddon?: React.ReactNode;
  headerAction?: React.ReactNode;
  fillHeight?: boolean;
  children: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  icon,
  variant = 'standard',
  className = '',
  titleAddon,
  headerAction,
  fillHeight = false,
  children,
}) => {
  const baseClasses = 'bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700';

  const variantClasses = {
    hero: 'p-6 sm:p-8',
    standard: 'p-4 sm:p-6',
    compact: 'p-3 sm:p-4',
  };

  const iconSizeClasses = {
    hero: 'w-12 h-12',
    standard: 'w-10 h-10',
    compact: 'w-8 h-8',
  };

  const titleSizeClasses = {
    hero: 'text-base sm:text-lg font-semibold',
    standard: 'text-sm sm:text-base font-medium',
    compact: 'text-sm font-medium',
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${fillHeight ? 'flex h-full flex-col' : ''} ${className}`}
    >
      {(title || icon || titleAddon || headerAction) && (
        <div className="mb-3 flex items-center justify-between gap-2 sm:mb-4 sm:gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {icon && (
              <div
                className={`${iconSizeClasses[variant]} flex flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30`}
              >
                <div className="h-6 w-6 text-blue-600 dark:text-blue-400">{icon}</div>
              </div>
            )}
            {title && (
              <h3 className={`${titleSizeClasses[variant]} text-gray-500 dark:text-gray-400`}>{title}</h3>
            )}
            {titleAddon ? <div className="shrink-0">{titleAddon}</div> : null}
          </div>
          {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
        </div>
      )}
      <div
        className={`${variant === 'hero' ? 'space-y-3' : 'space-y-2'} ${fillHeight ? 'flex min-h-0 flex-1 flex-col justify-center' : ''}`}
      >
        {children}
      </div>
    </div>
  );
};

interface MetricItemProps {
  label: string;
  value: React.ReactNode;
  subValue?: React.ReactNode;
  tooltip?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg';
}

export const MetricItem: React.FC<MetricItemProps> = ({
  label,
  value,
  subValue,
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
    <div className="flex flex-row items-center justify-between gap-3">
      <div className="inline-flex min-w-0 flex-1 items-center gap-1 leading-tight">
        <span className="break-words text-sm text-gray-500 dark:text-gray-400">{label}</span>
        {tooltip && (
          <Tooltip
            content={tooltip}
            className="shrink-0 items-center leading-none"
            contentClassName="whitespace-pre-line block"
          >
            <svg
              className="block h-4 w-4 shrink-0 cursor-help text-gray-400 dark:text-gray-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
          </Tooltip>
        )}
      </div>
      <div className={`flex shrink-0 flex-col items-end ${variantColors[variant]}`}>
        <div className={`${sizeClasses[size]} flex items-center font-semibold tabular-nums`}>{value}</div>
        {subValue && (
          <div className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{subValue}</div>
        )}
      </div>
    </div>
  );
};
