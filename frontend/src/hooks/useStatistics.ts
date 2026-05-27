import { useState, useEffect } from 'react';
import { tradesService } from '../services/trades';
import { tradingAccountsService, TradingAccount } from '../services/tradingAccounts';
import { tradeStrategiesService } from '../services/tradeStrategies';
import type { PnlDisplayMode } from '../utils/pnlDisplay';

export interface StatisticsData {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  total_pnl: string;
  total_gains: string;
  total_losses: string;
  average_pnl: string;
  best_trade: string;
  worst_trade: string;
  total_fees: string;
  total_volume: string;
  average_duration: string;
  most_traded_contract: string | null;
  profit_factor: number;
  win_loss_ratio: number;
  consistency_ratio: number;
  recovery_ratio: number;
  pnl_per_trade: number;
  fees_ratio: number;
  volume_pnl_ratio: number;
  frequency_ratio: number;
  duration_ratio: number;
  avg_time_between_trades: string;
  avg_daily_exposure_time: string;
  recovery_time: number;
  max_drawdown: number;
  max_drawdown_pct: number;
  max_drawdown_global: number;
  max_drawdown_global_pct: number;
  max_runup: number;
  max_runup_pct: number;
  max_runup_global: number;
  max_runup_global_pct: number;
  expectancy: number;
  break_even_trades: number;
  break_even_zero_trades: number;
  break_even_positive_trades: number;
  sharpe_ratio: number;
  sharpe_ratio_annualized: number;
  sortino_ratio: number;
  calmar_ratio: number;
  trade_efficiency: number;
  current_winning_streak_days: number;
  avg_planned_rr: number;
  avg_actual_rr: number;
  trades_with_planned_rr: number;
  trades_with_actual_rr: number;
  trades_with_both_rr: number;
  plan_respect_rate: number;
}

export interface PostLossSizingCategory {
  count: number;
  pct: number;
  total_pnl: number;
  avg_pnl: number;
  win_rate: number;
}

export interface PostLossSizingBaseline {
  larger: PostLossSizingCategory;
  equal: PostLossSizingCategory;
  smaller: PostLossSizingCategory;
}

export interface PostLossSizingData {
  sample_size: number;
  median_lookback: number;
  median_sample_size: number;
  skipped_cross_instrument?: number;
  skipped_unknown_contract?: number;
  comparison_basis?: string;
  vs_losing_trade: PostLossSizingBaseline;
  vs_median: PostLossSizingBaseline;
}

export interface PostWinSizingData {
  sample_size: number;
  median_lookback: number;
  median_sample_size: number;
  skipped_cross_instrument?: number;
  skipped_unknown_contract?: number;
  comparison_basis?: string;
  vs_winning_trade: PostLossSizingBaseline;
  vs_median: PostLossSizingBaseline;
}

export type PostTradeSizingI18nPrefix = 'postLossSizing' | 'postWinSizing';

export type PostTradeSizingData = PostLossSizingData | PostWinSizingData;

export type BehaviorAlertLevel = 'none' | 'warning';

export interface RevengeTradingData {
  avg_trades_after_negative_day: number;
  avg_trades_after_positive_day: number;
  pct_increase: number | null;
  days_after_negative: number;
  days_after_positive: number;
  has_sufficient_data: boolean;
  alert_level: BehaviorAlertLevel;
}

export interface SizingDisciplineData {
  avg_size_winning_trades: number;
  avg_size_losing_trades: number;
  pct_larger_on_losers: number | null;
  winning_trades_count: number;
  losing_trades_count: number;
  skipped_unknown_contract: number;
  comparison_basis: string;
  has_sufficient_data: boolean;
  alert_level: BehaviorAlertLevel;
}

export interface BehaviorDisciplineData {
  revenge_trading: RevengeTradingData;
  sizing_discipline: SizingDisciplineData;
}

export interface AnalyticsData {
  daily_stats: {
    avg_gain_per_day: number;
    median_gain_per_day: number;
    avg_loss_per_day: number;
    median_loss_per_day: number;
    max_gain_per_day: number;
    max_loss_per_day: number;
    avg_trades_per_day: number;
    median_trades_per_day: number;
    days_with_profit: number;
    days_with_loss: number;
    days_break_even: number;
    best_day: string | null;
    best_day_pnl: number;
    worst_day: string | null;
    worst_day_pnl: number;
  };
  trade_stats: {
    max_gain_per_trade: number;
    max_loss_per_trade: number;
    avg_winning_trade: number;
    median_winning_trade: number;
    avg_losing_trade: number;
    median_losing_trade: number;
    avg_duration_winning_trade: string;
    avg_duration_losing_trade: string;
  };
  consecutive_stats: {
    max_consecutive_wins_per_day: number;
    max_consecutive_losses_per_day: number;
    max_consecutive_wins: number;
    max_consecutive_losses: number;
  };
  trade_type_stats: {
    long_percentage: number;
    short_percentage: number;
    long_count: number;
    short_count: number;
  };
  monthly_performance: Array<{
    month: string;
    pnl: number;
  }>;
  post_loss_sizing?: PostLossSizingData;
  post_win_sizing?: PostWinSizingData;
  behavior_discipline?: BehaviorDisciplineData;
}

export interface GlobalStrategyData {
  total: number;
  respected: number;
  percentage: number;
}

export function useStatistics(
  tradingAccountId?: number | null, 
  year?: number | null, 
  month?: number | null,
  startDate?: string | null,
  endDate?: string | null,
  positionStrategy?: number | null,
  _pnlDisplay: PnlDisplayMode = 'net',
  convertTo?: string | null,
) {
  const [data, setData] = useState<StatisticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Si startDate/endDate sont fournis, les utiliser (priorité)
        // Sinon, utiliser year/month (rétrocompatibilité)
        const result = await tradesService.detailedStatistics(
          tradingAccountId || undefined,
          startDate && endDate ? undefined : (year || undefined),
          startDate && endDate ? undefined : (month || undefined),
          startDate || undefined,
          endDate || undefined,
          positionStrategy || undefined,
          convertTo || undefined,
        );
        // S'assurer que toutes les propriétés requises sont présentes avec des valeurs par défaut
        setData({
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
        } as StatisticsData);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erreur lors du chargement des statistiques'));
      } finally {
        setIsLoading(false);
      }
    };

    if (tradingAccountId !== undefined) {
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [tradingAccountId, year, month, startDate, endDate, positionStrategy, _pnlDisplay, convertTo]);

  return { data, isLoading, error };
}

export function useAnalytics(
  tradingAccountId?: number | null, 
  year?: number | null, 
  month?: number | null,
  startDate?: string | null,
  endDate?: string | null,
  positionStrategy?: number | null,
  _pnlDisplay: PnlDisplayMode = 'net',
  convertTo?: string | null,
) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Si startDate/endDate sont fournis, les utiliser (priorité)
        // Sinon, utiliser year/month (rétrocompatibilité)
        const result = await tradesService.analytics(
          tradingAccountId || undefined,
          startDate && endDate ? undefined : (year || undefined),
          startDate && endDate ? undefined : (month || undefined),
          startDate || undefined,
          endDate || undefined,
          positionStrategy || undefined,
          convertTo || undefined,
        );
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erreur lors du chargement des analytics'));
      } finally {
        setIsLoading(false);
      }
    };

    if (tradingAccountId !== undefined) {
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [tradingAccountId, year, month, startDate, endDate, positionStrategy, _pnlDisplay, convertTo]);

  return { data, isLoading, error };
}

export function useGlobalStrategyData() {
  const [data, setData] = useState<GlobalStrategyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await tradeStrategiesService.statistics();
        const total = result.all_time.total_strategies;
        const respected = Math.round((total * result.all_time.respect_percentage) / 100);
        setData({
          total,
          respected,
          percentage: result.all_time.respect_percentage,
        });
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erreur lors du chargement des statistiques de stratégie'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, isLoading, error };
}

export function useTradingAccounts() {
  const [data, setData] = useState<TradingAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await tradingAccountsService.list();
        setData(result.filter(acc => acc.status === 'active'));
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erreur lors du chargement des comptes'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return { data, isLoading, error };
}

export function useTradesUpdateInvalidation() {
  // Hook pour invalider les caches quand les trades sont mis à jour
  // Pour l'instant, on utilise juste un effet qui écoute les événements de mise à jour
  useEffect(() => {
    const handleTradeUpdate = () => {
      // Les données seront rechargées automatiquement lors du prochain rendu
      // grâce aux dépendances des hooks useStatistics et useAnalytics
      window.dispatchEvent(new CustomEvent('trades:updated'));
    };

    window.addEventListener('trade:created', handleTradeUpdate);
    window.addEventListener('trade:updated', handleTradeUpdate);
    window.addEventListener('trade:deleted', handleTradeUpdate);

    return () => {
      window.removeEventListener('trade:created', handleTradeUpdate);
      window.removeEventListener('trade:updated', handleTradeUpdate);
      window.removeEventListener('trade:deleted', handleTradeUpdate);
    };
  }, []);
}

export function useSelectedAccountCurrency(account: TradingAccount | null): string {
  return account?.currency || '';
}

