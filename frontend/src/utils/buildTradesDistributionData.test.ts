import { describe, expect, it } from 'vitest';
import { buildTradesDistributionData } from './buildTradesDistributionData';
import type { StatisticsData } from '../hooks/useStatistics';

const t = ((key: string) => key) as never;

const baseStats: StatisticsData = {
  total_trades: 10,
  winning_trades: 6,
  losing_trades: 3,
  win_rate: 60,
  total_pnl: '100',
  total_gains: '200',
  total_losses: '-100',
  average_pnl: '10',
  best_trade: '50',
  worst_trade: '-30',
  total_fees: '0',
  total_volume: '10',
  average_duration: '00:30:00',
  most_traded_contract: 'ES',
  profit_factor: 2,
  win_loss_ratio: 2,
  consistency_ratio: 60,
  recovery_ratio: 1,
  pnl_per_trade: 10,
  fees_ratio: 0,
  volume_pnl_ratio: 0,
  frequency_ratio: 1,
  duration_ratio: 1,
  avg_time_between_trades: '01:00:00',
  avg_daily_exposure_time: '02:00:00',
  recovery_time: 0,
  max_drawdown: 0,
  max_drawdown_pct: 0,
  max_drawdown_global: 0,
  max_drawdown_global_pct: 0,
  max_runup: 0,
  max_runup_pct: 0,
  max_runup_global: 0,
  max_runup_global_pct: 0,
  expectancy: 0,
  break_even_trades: 1,
  break_even_zero_trades: 1,
  break_even_positive_trades: 0,
  sharpe_ratio: 0,
  sharpe_ratio_annualized: 0,
  sortino_ratio: 0,
  calmar_ratio: 0,
  trade_efficiency: 0,
  current_winning_streak_days: 0,
  avg_planned_rr: 0,
  avg_actual_rr: 0,
  trades_with_planned_rr: 0,
  trades_with_actual_rr: 0,
  trades_with_both_rr: 0,
  plan_respect_rate: 0,
};

describe('buildTradesDistributionData', () => {
  it('builds chart data from statistics alone when trades list is empty (all accounts)', () => {
    const result = buildTradesDistributionData([], baseStats, t, 'net');
    expect(result).not.toBeNull();
    expect(result?.total).toBe(10);
    expect(result?.data).toEqual([6, 3, 1]);
  });
});
