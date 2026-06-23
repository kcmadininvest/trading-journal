import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { tradeStrategiesService } from '../services/tradeStrategies';
import type { DashboardSummary } from '../services/dashboard';
import type { PnlDisplayMode } from '../utils/pnlDisplay';
import { getRollingTwelveMonthDateRange } from '../utils/complianceStreakPeriod';

interface UseDashboardComplianceRefreshParams {
  accountId: number | null | undefined;
  pnlDisplay?: PnlDisplayMode;
}

export function useDashboardComplianceRefresh({
  accountId,
  pnlDisplay = 'net',
}: UseDashboardComplianceRefreshParams) {
  const queryClient = useQueryClient();

  const refreshCompliance = useCallback(
    async (eventAccount?: number) => {
      if (eventAccount && accountId != null && eventAccount !== accountId) {
        return;
      }
      if (accountId === undefined) {
        return;
      }

      const streakPeriod = getRollingTwelveMonthDateRange();

      try {
        const stats = await tradeStrategiesService.strategyComplianceStats(
          accountId ?? undefined,
          {
            start_date: streakPeriod.start_date,
            end_date: streakPeriod.end_date,
            pnlDisplay,
          }
        );

        const patchComplianceStats = (old: DashboardSummary | undefined) => {
          if (!old) return old;
          return {
            ...old,
            compliance_stats: {
              current_streak: stats.current_streak,
              best_streak: stats.best_streak,
              current_streak_start: stats.current_streak_start,
              next_badge: stats.next_badge,
            },
          };
        };

        queryClient.setQueriesData<DashboardSummary>(
          { queryKey: ['dashboard', 'summary'] },
          patchComplianceStats
        );
      } catch (err) {
        console.error('Erreur lors du rafraîchissement des streaks compliance', err);
      }
    },
    [accountId, pnlDisplay, queryClient]
  );

  useEffect(() => {
    const handleComplianceUpdate = (event: CustomEvent<{ tradingAccount?: number }>) => {
      void refreshCompliance(event.detail?.tradingAccount);
    };

    window.addEventListener('strategy-compliance-updated', handleComplianceUpdate as EventListener);
    return () => {
      window.removeEventListener('strategy-compliance-updated', handleComplianceUpdate as EventListener);
    };
  }, [refreshCompliance]);
}
