import { useState, useEffect, useCallback } from 'react';
import { dashboardService, DashboardActivitySummary, DashboardSummary } from '../services/dashboard';

interface DashboardDataParams {
  accountId: number | null;
  startDate?: string;
  endDate?: string;
  loading?: boolean;
  positionStrategy?: number | null;
}

export function useDashboardData({ accountId, startDate, endDate, loading, positionStrategy }: DashboardDataParams) {
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
      if (positionStrategy) filters.position_strategy = positionStrategy;

      const result = await dashboardService.getSummary(filters);
      setData(result);
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err?.message || 'Failed to load dashboard data');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [accountId, startDate, endDate, loading, positionStrategy]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}

export function useDashboardActivitySummary({ accountId, startDate, endDate, loading, positionStrategy }: DashboardDataParams) {
  const [data, setData] = useState<DashboardActivitySummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (loading) {
      return;
    }

    if (accountId === undefined) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const filters: any = {};
      if (accountId !== null) {
        filters.trading_account = accountId;
      }
      if (startDate) filters.start_date = startDate;
      if (endDate) filters.end_date = endDate;
      if (positionStrategy) filters.position_strategy = positionStrategy;

      const result = await dashboardService.getActivitySummary(filters);
      setData(result);
    } catch (err: any) {
      console.error('Error fetching dashboard activity summary:', err);
      setError(err?.message || 'Failed to load dashboard activity summary');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [accountId, startDate, endDate, loading, positionStrategy]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
