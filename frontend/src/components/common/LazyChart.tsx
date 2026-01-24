import React, { Suspense } from 'react';
import { useLazyComponent } from '../../hooks/useLazyComponent';

interface LazyChartProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  rootMargin?: string;
}

export const LazyChart: React.FC<LazyChartProps> = ({ 
  children, 
  fallback = <ChartSkeleton />,
  rootMargin = '200px'
}) => {
  const { ref, hasBeenVisible } = useLazyComponent({ rootMargin });

  return (
    <div ref={ref} className="min-h-[300px]">
      {hasBeenVisible ? (
        <Suspense fallback={fallback}>
          {children}
        </Suspense>
      ) : (
        fallback
      )}
    </div>
  );
};

const ChartSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 animate-pulse">
    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
    <div className="h-80 bg-gray-100 dark:bg-gray-700/50 rounded"></div>
  </div>
);
