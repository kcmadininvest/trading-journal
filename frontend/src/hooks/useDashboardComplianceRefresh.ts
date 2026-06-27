import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { tradeStrategiesService } from '../services/tradeStrategies';
import type { DashboardSummary, DashboardFilters } from '../services/dashboard';
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
          const previous = old.compliance_stats;
          return {
            ...old,
            compliance_stats: {
              ...previous,
              current_streak: stats.current_streak,
              best_streak: stats.best_streak,
              best_streak_trades: stats.best_streak_trades ?? previous?.best_streak_trades ?? 0,
              current_streak_start: stats.current_streak_start,
              current_streak_trades: stats.current_streak_trades ?? previous?.current_streak_trades ?? 0,
              best_not_respect_streak:
                stats.best_not_respect_streak ?? previous?.best_not_respect_streak ?? 0,
              best_not_respect_streak_trades:
                stats.best_not_respect_streak_trades ?? previous?.best_not_respect_streak_trades ?? 0,
              current_not_respect_streak:
                stats.current_not_respect_streak ?? previous?.current_not_respect_streak ?? 0,
              current_not_respect_streak_start:
                stats.current_not_respect_streak_start ?? previous?.current_not_respect_streak_start ?? null,
              current_not_respect_streak_trades:
                stats.current_not_respect_streak_trades ?? previous?.current_not_respect_streak_trades ?? 0,
              next_badge: stats.next_badge ?? previous?.next_badge ?? null,
              next_record_milestone:
                stats.next_record_milestone ?? previous?.next_record_milestone ?? null,
            },
          };
        };

        queryClient.setQueriesData<DashboardSummary>(
          {
            queryKey: ['dashboard', 'summary'],
            predicate: (query) => {
              const filters = query.queryKey[2] as DashboardFilters | undefined;
              if (accountId != null) {
                return filters?.trading_account === accountId;
              }
              return filters?.trading_account === undefined;
            },
          },
          patchComplianceStats
        );
      } catch (err) {
        console.error('Erreur lors du rafraîchissement des streaks compliance', err);
      }
    },
    [accountId, pnlDisplay, queryClient]
  );

  useEffect(() => {
    void refreshCompliance();
  }, [refreshCompliance]);

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
