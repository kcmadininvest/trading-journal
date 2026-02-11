import React, { Suspense } from 'react';
import { ChartSkeleton } from '../strategy/charts/ChartSkeleton';

interface ChartSectionProps {
  title: string;
  tooltip?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Composant wrapper pour les sections de graphiques avec Suspense boundary
 * Wrapper avec Suspense boundary pour le lazy loading
 */
export const ChartSection: React.FC<ChartSectionProps> = React.memo(({ 
  title, 
  tooltip, 
  children, 
  className = '' 
}) => {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 md:p-6 ${className}`}>
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
        {tooltip && (
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-help flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )}
      </div>
      <Suspense fallback={<ChartSkeleton />}>
        {children}
      </Suspense>
    </div>
  );
});
