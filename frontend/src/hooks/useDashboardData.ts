import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { dashboardService, DashboardActivitySummary, DashboardSummary } from '../services/dashboard';
import type { PnlDisplayMode } from '../utils/pnlDisplay';
import { queryKeys } from '../lib/queryKeys';

interface DashboardDataParams {
  accountId: number | null | undefined;
  startDate?: string;
  endDate?: string;
  loading?: boolean;
  positionStrategy?: number | null;
  pnlDisplay?: PnlDisplayMode;
}

export function useDashboardData({
  accountId,
  startDate,
  endDate,
  loading,
  positionStrategy,
  pnlDisplay = 'net',
}: DashboardDataParams) {
  const enabled = !loading && accountId !== undefined;

  const query = useQuery<DashboardSummary>({
    queryKey: queryKeys.dashboard.summary({
      accountId,
      startDate,
      endDate,
      positionStrategy,
      pnlDisplay,
    }),
    queryFn: () =>
      dashboardService.getSummary({
        ...(accountId != null ? { trading_account: accountId } : {}),
        ...(startDate ? { start_date: startDate } : {}),
        ...(endDate ? { end_date: endDate } : {}),
        ...(positionStrategy ? { position_strategy: positionStrategy } : {}),
        pnl_display: pnlDisplay,
      }),
    enabled,
    placeholderData: keepPreviousData,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ? (query.error as Error).message : null,
    refetch: query.refetch,
  };
}

export function useDashboardActivitySummary({
  accountId,
  startDate,
  endDate,
  loading,
  positionStrategy,
  pnlDisplay = 'net',
}: DashboardDataParams) {
  const enabled = !loading && accountId !== undefined;

  const query = useQuery<DashboardActivitySummary>({
    queryKey: queryKeys.dashboard.activity({
      accountId,
      startDate,
      endDate,
      positionStrategy,
      pnlDisplay,
    }),
    queryFn: () =>
      dashboardService.getActivitySummary({
        ...(accountId != null ? { trading_account: accountId } : {}),
        ...(startDate ? { start_date: startDate } : {}),
        ...(endDate ? { end_date: endDate } : {}),
        ...(positionStrategy ? { position_strategy: positionStrategy } : {}),
        pnl_display: pnlDisplay,
      }),
    enabled,
    placeholderData: keepPreviousData,
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ? (query.error as Error).message : null,
    refetch: query.refetch,
  };
}
