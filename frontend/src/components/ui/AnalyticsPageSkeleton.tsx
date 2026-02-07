import React from 'react';

const SkeletonPulse: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`} />
);

const SkeletonChartCard: React.FC<{ height?: string }> = ({ height = 'h-[320px]' }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
    <div className="flex items-center gap-2 mb-6">
      <SkeletonPulse className="w-1 h-6 rounded-full" />
      <SkeletonPulse className="h-6 w-48" />
    </div>
    <SkeletonPulse className={`w-full ${height} rounded-lg`} />
  </div>
);

export const AnalyticsPageSkeleton: React.FC = () => {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Filtres skeleton */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex-shrink-0 max-w-sm">
            <SkeletonPulse className="h-4 w-32 mb-2" />
            <SkeletonPulse className="h-10 w-64" />
          </div>
          <div className="flex-shrink-0 lg:w-80">
            <SkeletonPulse className="h-4 w-20 mb-2" />
            <SkeletonPulse className="h-10 w-full" />
          </div>
        </div>
      </div>

      {/* Indicateurs du compte skeleton */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="text-center">
              <SkeletonPulse className="h-3 w-20 mx-auto mb-2" />
              <SkeletonPulse className="h-6 w-24 mx-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* Row 1: Radar, Equity Curve, Drawdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <SkeletonChartCard />
        <SkeletonChartCard />
        <SkeletonChartCard />
      </div>

      {/* Row 2: Monthly Performance, Trading Volume, Trades Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <SkeletonChartCard />
        <SkeletonChartCard />
        <SkeletonChartCard />
      </div>

      {/* Row 3: Remaining charts (2 columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonChartCard />
        <SkeletonChartCard />
        <SkeletonChartCard />
        <SkeletonChartCard />
        <SkeletonChartCard />
        <SkeletonChartCard />
      </div>
    </div>
  );
};
