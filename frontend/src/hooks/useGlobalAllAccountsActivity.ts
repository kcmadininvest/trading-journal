import { useMemo } from 'react';
import { useDashboardActivitySummary } from './useDashboardData';

interface UseGlobalAllAccountsActivityParams {
  loading?: boolean;
  positionStrategy?: number | null;
}

export interface GlobalAllAccountsActivityData {
  totalPositions: number;
  globalActiveDays: number;
}

export function useGlobalAllAccountsActivity({
  loading,
  positionStrategy = null,
}: UseGlobalAllAccountsActivityParams = {}) {
  const { data, isLoading, error, refetch } = useDashboardActivitySummary({
    accountId: null,
    startDate: undefined,
    endDate: undefined,
    loading,
    positionStrategy,
  });

  const globalAllAccountsActivity = useMemo<GlobalAllAccountsActivityData | null>(() => {
    if (!data) return null;
    return {
      totalPositions: data.total_positions ?? 0,
      globalActiveDays: data.active_days ?? 0,
    };
  }, [data]);

  return { globalAllAccountsActivity, isLoading, error, refetch };
}
