import React from 'react';

interface ChartSkeletonProps {
  height?: string;
  title?: string;
  className?: string;
  fillHeight?: boolean;
}

export const ChartSkeleton: React.FC<ChartSkeletonProps> = React.memo(({ 
  height = 'h-64 sm:h-72 md:h-80', 
  title,
  className = '',
  fillHeight = false,
}) => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 md:p-6 ${className}`}>
    <div className={`animate-pulse ${fillHeight ? 'flex h-full min-h-0 flex-col' : ''}`}>
      {title && (
        <div className="flex shrink-0 items-center gap-2 mb-3 sm:mb-4">
          <div className="h-5 sm:h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0"></div>
        </div>
      )}
      <div
        className={`${height} bg-gray-100 dark:bg-gray-700/50 rounded flex items-center justify-center ${
          fillHeight ? 'min-h-0 flex-1' : ''
        }`}
      >
        <div className="space-y-3 w-full px-4">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/6"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
        </div>
      </div>
    </div>
  </div>
));

ChartSkeleton.displayName = 'ChartSkeleton';
