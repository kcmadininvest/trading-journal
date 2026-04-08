import React from 'react';
import { PageShell } from '../layout';

/** Enveloppe alignée sur TradesPage (PageShell fluid). */
export const TradesPageSkeleton: React.FC = () => {
  return (
    <PageShell variant="fluid">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="h-10 w-full max-w-xs bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="h-10 flex-1 sm:w-28 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
            <div className="h-10 flex-1 sm:w-28 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
            <div className="h-10 flex-1 sm:w-28 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4 sm:mb-6 space-y-3">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-9 w-24 sm:w-28 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-800">
          <div className="h-11 bg-gray-100 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700" />
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 dark:border-gray-700/80"
            >
              <div className="h-4 flex-1 max-w-[40%] bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse hidden sm:block" />
            </div>
          ))}
        </div>

        <div className="mt-4 sm:mt-6 rounded-lg shadow bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 overflow-hidden p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="flex gap-2">
              <div className="h-9 w-24 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
              <div className="h-9 w-32 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
            </div>
          </div>
        </div>
    </PageShell>
  );
};
