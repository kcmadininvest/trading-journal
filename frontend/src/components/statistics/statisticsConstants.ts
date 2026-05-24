export const STATS_GRID =
  'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4';

export const STATS_PERFORMANCE_GRID =
  'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-3 sm:gap-4';

export const STATISTICS_TAB_IDS = ['overview', 'performance', 'trades', 'advanced'] as const;

export type StatisticsTabId = (typeof STATISTICS_TAB_IDS)[number];

export const STATISTICS_ACTIVE_TAB_KEY = 'statistics-active-tab';

export function isStatisticsTabId(value: string | null): value is StatisticsTabId {
  return STATISTICS_TAB_IDS.includes(value as StatisticsTabId);
}
