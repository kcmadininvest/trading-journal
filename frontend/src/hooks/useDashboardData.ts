import { useState, useEffect, useCallback } from 'react';
import { dashboardService, DashboardSummary } from '../services/dashboard';

interface DashboardDataParams {
  accountId: number | null;
  startDate?: string;
  endDate?: string;
  loading?: boolean;
}

export function useDashboardData({ accountId, startDate, endDate, loading }: DashboardDataParams) {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    // Don't fetch if the context is still loading (determining default account)
    if (loading) {
      return;
    }

    // Don't fetch if accountId is explicitly undefined (not yet loaded)
    if (accountId === undefined) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const filters: any = {};
      // Always include trading_account filter if we have an accountId
      if (accountId !== null) {
        filters.trading_account = accountId;
      }
      if (startDate) filters.start_date = startDate;
      if (endDate) filters.end_date = endDate;

      const result = await dashboardService.getSummary(filters);
      setData(result);
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err?.message || 'Failed to load dashboard data');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [accountId, startDate, endDate, loading]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
