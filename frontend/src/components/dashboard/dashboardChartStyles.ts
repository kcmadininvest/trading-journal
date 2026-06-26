import { getChartColors } from '../../utils/chartConfig';

export function getDashboardChartAxisColors(isDark: boolean) {
  const colors = getChartColors(isDark);
  return {
    tick: colors.textSecondary,
    grid: colors.grid,
    border: colors.border,
  };
}

export function getDashboardPerformanceBadgeClasses(color?: string): string {
  switch (color) {
    case '#10b981':
      return 'rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-400';
    case '#f59e0b':
      return 'rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-400';
    case '#ef4444':
      return 'rounded-full border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 dark:border-red-400/30 dark:bg-red-500/15 dark:text-red-400';
    default:
      return 'rounded-full border border-gray-200 bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300';
  }
}
