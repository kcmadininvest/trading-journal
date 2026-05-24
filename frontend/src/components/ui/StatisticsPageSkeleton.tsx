import React from 'react';
import { PageShell } from '../layout';

export const StatisticsPageSkeleton: React.FC = () => {
  return (
    <PageShell>
      <div className="w-full">
        <div className="mb-4 rounded-lg bg-white p-3 shadow dark:bg-gray-800 sm:mb-6 sm:p-4">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end">
            <div className="h-10 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700 lg:w-48" />
            <div className="h-10 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700 lg:w-40" />
            <div className="h-10 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700 lg:max-w-sm lg:flex-1" />
          </div>
        </div>

        <div className="mb-4 h-24 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700 sm:mb-6" />

        <div className="mb-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-3 sm:mb-6 sm:gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
          ))}
        </div>

        <div className="mb-4 flex gap-4 overflow-hidden sm:mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 w-28 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          ))}
        </div>

        <div className="mb-4 min-h-[340px] animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700 sm:mb-6" />

        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 sm:p-6"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
                <div className="h-5 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              </div>
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="flex justify-between gap-3">
                    <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="h-5 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
};
