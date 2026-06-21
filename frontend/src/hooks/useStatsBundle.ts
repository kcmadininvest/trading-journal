import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { tradesService } from '../services/trades';
import type { PnlDisplayMode } from '../utils/pnlDisplay';
import { queryKeys } from '../lib/queryKeys';
import type { AnalyticsData, StatisticsData } from './useStatistics';

export interface DashboardSlice {
  daily_aggregates: Array<{
    date: string;
    pnl: number;
    pnl_net?: number;
    pnl_gross?: number;
    trade_count: number;
    winning_count: number;
    losing_count: number;
  }>;
  active_days: number;
  period_performance?: Record<string, unknown> | null;
  compliance_stats?: Record<string, unknown> | null;
}

export interface StatsBundleData {
  statistics: StatisticsData;
  analytics: AnalyticsData;
  dashboard_slice: DashboardSlice;
}

function normalizeStatistics(result: Partial<StatisticsData>): StatisticsData {
  return {
    ...result,
    avg_time_between_trades: result.avg_time_between_trades ?? '00:00:00',
    avg_daily_exposure_time: result.avg_daily_exposure_time ?? '00:00:00',
    max_runup: result.max_runup ?? 0,
    max_runup_pct: result.max_runup_pct ?? 0,
    max_runup_global: result.max_runup_global ?? 0,
    max_runup_global_pct: result.max_runup_global_pct ?? 0,
    avg_planned_rr: result.avg_planned_rr ?? 0,
    avg_actual_rr: result.avg_actual_rr ?? 0,
    trades_with_planned_rr: result.trades_with_planned_rr ?? 0,
    trades_with_actual_rr: result.trades_with_actual_rr ?? 0,
    trades_with_both_rr: result.trades_with_both_rr ?? 0,
    plan_respect_rate: result.plan_respect_rate ?? 0,
    break_even_zero_trades: result.break_even_zero_trades ?? 0,
    break_even_positive_trades: result.break_even_positive_trades ?? 0,
    sharpe_ratio_annualized: result.sharpe_ratio_annualized ?? 0,
  } as StatisticsData;
}

export interface StatsBundleParams {
  tradingAccountId?: number | null;
  year?: number | null;
  month?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  positionStrategy?: number | null;
  convertTo?: string | null;
  pnlDisplay?: PnlDisplayMode;
}

export function useStatsBundle({
  tradingAccountId,
  year,
  month,
  startDate,
  endDate,
  positionStrategy,
  convertTo,
  pnlDisplay = 'net',
  enabled = true,
}: StatsBundleParams & { enabled?: boolean }) {
  const params = {
    tradingAccountId,
    year,
    month,
    startDate,
    endDate,
    positionStrategy,
    convertTo,
    pnlDisplay,
  };

  const query = useQuery<StatsBundleData>({
    queryKey: queryKeys.statsBundle(params),
    queryFn: async () => {
      const raw = await tradesService.statsBundle(
        tradingAccountId || undefined,
        startDate && endDate ? undefined : (year || undefined),
        startDate && endDate ? undefined : (month || undefined),
        startDate || undefined,
        endDate || undefined,
        positionStrategy || undefined,
        convertTo || undefined,
        pnlDisplay,
      );
      return {
        ...raw,
        statistics: normalizeStatistics(raw.statistics),
        analytics: raw.analytics as unknown as AnalyticsData,
        dashboard_slice: raw.dashboard_slice as unknown as DashboardSlice,
      };
    },
    enabled: enabled && tradingAccountId !== undefined,
    placeholderData: keepPreviousData,
  });

  return {
    data: query.data ?? null,
    statistics: query.data?.statistics ?? null,
    analytics: query.data?.analytics ?? null,
    dashboardSlice: query.data?.dashboard_slice ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error instanceof Error ? query.error : null,
  };
}
