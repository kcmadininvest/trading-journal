import { useState, useEffect } from 'react';
import { tradesService } from '../services/trades';
import { tradingAccountsService, TradingAccount } from '../services/tradingAccounts';
import { tradeStrategiesService } from '../services/tradeStrategies';

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
  recovery_time: number;
  max_drawdown: number;
  expectancy: number;
  break_even_trades: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  calmar_ratio: number;
  trade_efficiency: number;
  current_winning_streak_days: number;
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
  };
  consecutive_stats: {
    max_consecutive_wins_per_day: number;
    max_consecutive_losses_per_day: number;
    max_consecutive_wins: number;
    max_consecutive_losses: number;
  };
  monthly_performance: Array<{
    month: string;
    pnl: number;
  }>;
}

export interface GlobalStrategyData {
  total: number;
  respected: number;
  percentage: number;
}

export function useStatistics(tradingAccountId?: number | null, year?: number | null, month?: number | null) {
  const [data, setData] = useState<StatisticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await tradesService.detailedStatistics(
          tradingAccountId || undefined,
          year || undefined,
          month || undefined
        );
        setData(result);
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
  }, [tradingAccountId, year, month]);

  return { data, isLoading, error };
}

export function useAnalytics(tradingAccountId?: number | null, year?: number | null, month?: number | null) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await tradesService.analytics(
          tradingAccountId || undefined,
          year || undefined,
          month || undefined
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
  }, [tradingAccountId, year, month]);

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

