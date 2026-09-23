import { describe, expect, it } from 'vitest';
import { calculateInitialRisk } from './tradeInitialRisk';
import type { TradeListItem } from '../services/trades';

function baseTrade(overrides: Partial<TradeListItem> = {}): TradeListItem {
  return {
    id: 1,
    external_trade_id: 'T1',
    trading_account: 1,
    trading_account_name: 'Compte 1',
    contract_name: 'ES',
    trade_type: 'Long',
    entered_at: '2024-01-01T10:00:00Z',
    exited_at: null,
    entry_price: '100.00',
    exit_price: null,
    size: '2',
    point_value: '5',
    fees: '0',
    commissions: '0',
    pnl: null,
    net_pnl: null,
    pnl_percentage: null,
    is_profitable: null,
    trade_duration: null,
    duration_str: null,
    trade_day: '2024-01-01',
    position_strategy: null,
    position_strategy_title: null,
    planned_stop_loss: null,
    planned_take_profit: null,
    planned_risk_reward_ratio: null,
    actual_risk_reward_ratio: null,
    ...overrides,
  };
}

describe('calculateInitialRisk', () => {
  it('calculates risk for a Long trade', () => {
    const trade = baseTrade({
      entry_price: '100.00',
      planned_stop_loss: '95.00',
      point_value: '5',
      size: '2',
    });
    expect(calculateInitialRisk(trade)).toEqual({
      riskPoints: 5,
      riskAmount: 50,
    });
  });

  it('calculates risk for a Short trade', () => {
    const trade = baseTrade({
      trade_type: 'Short',
      entry_price: '100.00',
      planned_stop_loss: '105.00',
      point_value: '2.5',
      size: '4',
    });
    expect(calculateInitialRisk(trade)).toEqual({
      riskPoints: 5,
      riskAmount: 50,
    });
  });

  it('returns null when planned stop loss is missing', () => {
    const trade = baseTrade({ entry_price: '100.00', planned_stop_loss: null });
    expect(calculateInitialRisk(trade)).toEqual({
      riskPoints: null,
      riskAmount: null,
    });
  });

  it('returns null when entry price is missing', () => {
    const trade = baseTrade({ entry_price: '', planned_stop_loss: '95.00' });
    expect(calculateInitialRisk(trade)).toEqual({
      riskPoints: null,
      riskAmount: null,
    });
  });

  it('keeps points but no amount when point_value is missing', () => {
    const trade = baseTrade({
      entry_price: '100.00',
      planned_stop_loss: '95.00',
      point_value: null,
      size: '2',
    });
    expect(calculateInitialRisk(trade)).toEqual({
      riskPoints: 5,
      riskAmount: null,
    });
  });

  it('returns null when the stop is on the wrong side', () => {
    const trade = baseTrade({
      trade_type: 'Long',
      entry_price: '100.00',
      planned_stop_loss: '105.00',
    });
    expect(calculateInitialRisk(trade)).toEqual({
      riskPoints: null,
      riskAmount: null,
    });
  });
});
