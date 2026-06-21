import { useEffect } from 'react';
import { queryClient } from '../lib/queryClient';
import { queryKeys } from '../lib/queryKeys';
import { dashboardService } from '../services/dashboard';
import type { PnlDisplayMode } from '../utils/pnlDisplay';
import { computePeriodPresetRanges } from '../utils/periodPresetRanges';

interface PrefetchDashboardParams {
  accountId: number | null | undefined;
  positionStrategy?: number | null;
  pnlDisplay?: PnlDisplayMode;
  enabled?: boolean;
}

/** Précharge les presets fréquents pour un affichage instantané au changement de période. */
export function useDashboardPrefetch({
  accountId,
  positionStrategy,
  pnlDisplay = 'net',
  enabled = true,
}: PrefetchDashboardParams) {
  useEffect(() => {
    if (!enabled || accountId === undefined) return;

    const presets = computePeriodPresetRanges(new Date());
    const keysToPrefetch: Array<{ start?: string; end?: string }> = [
      presets.last3Months,
      presets.thisYear,
      presets.allTime,
    ];

    keysToPrefetch.forEach(({ start, end }) => {
      const params = {
        accountId,
        startDate: start,
        endDate: end,
        positionStrategy,
        pnlDisplay,
      };
      void queryClient.prefetchQuery({
        queryKey: queryKeys.dashboard.summary(params),
        queryFn: () =>
          dashboardService.getSummary({
            ...(accountId != null ? { trading_account: accountId } : {}),
            ...(start ? { start_date: start } : {}),
            ...(end ? { end_date: end } : {}),
            ...(positionStrategy ? { position_strategy: positionStrategy } : {}),
            pnl_display: pnlDisplay,
          }),
      });
    });
  }, [accountId, positionStrategy, pnlDisplay, enabled]);
}
