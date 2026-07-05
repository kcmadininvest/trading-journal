import type { PnlDisplayMode } from '../utils/pnlDisplay';
import type { DashboardFilters } from '../services/dashboard';

export interface DashboardQueryParams {
  accountId: number | null | undefined;
  startDate?: string;
  endDate?: string;
  positionStrategy?: number | null;
  pnlDisplay?: PnlDisplayMode;
}

function dashboardFiltersFromParams(params: DashboardQueryParams): DashboardFilters {
  const filters: DashboardFilters = {};
  if (params.accountId != null) {
    filters.trading_account = params.accountId;
  }
  if (params.startDate) filters.start_date = params.startDate;
  if (params.endDate) filters.end_date = params.endDate;
  if (params.positionStrategy) filters.position_strategy = params.positionStrategy;
  if (params.pnlDisplay) filters.pnl_display = params.pnlDisplay;
  return filters;
}

export const queryKeys = {
  dashboard: {
    summary: (params: DashboardQueryParams) =>
      ['dashboard', 'summary', dashboardFiltersFromParams(params)] as const,
    activity: (params: DashboardQueryParams) =>
      ['dashboard', 'activity', dashboardFiltersFromParams(params)] as const,
  },
  bootstrap: () => ['bootstrap'] as const,
  tradingAccounts: (includeArchived: boolean) => ['tradingAccounts', { includeArchived }] as const,
  statistics: (params: {
    tradingAccountId?: number | null;
    year?: number | null;
    month?: number | null;
    startDate?: string | null;
    endDate?: string | null;
    positionStrategy?: number | null;
    convertTo?: string | null;
  }) => ['statistics', params] as const,
  analytics: (params: {
    tradingAccountId?: number | null;
    year?: number | null;
    month?: number | null;
    startDate?: string | null;
    endDate?: string | null;
    positionStrategy?: number | null;
    convertTo?: string | null;
  }) => ['analytics', params] as const,
  statsBundle: (params: {
    tradingAccountId?: number | null;
    year?: number | null;
    month?: number | null;
    startDate?: string | null;
    endDate?: string | null;
    positionStrategy?: number | null;
    convertTo?: string | null;
    pnlDisplay?: PnlDisplayMode;
  }) => ['statsBundle', params] as const,
};
