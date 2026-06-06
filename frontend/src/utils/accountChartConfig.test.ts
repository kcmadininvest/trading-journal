import { resolveAccountChartConfig } from './accountChartConfig';
import type { TradingAccount } from '../services/tradingAccounts';

const baseAccount: TradingAccount = {
  id: 1,
  user: 1,
  name: 'Test',
  account_type: 'topstep',
  currency: 'USD',
  status: 'active',
  is_default: false,
};

describe('resolveAccountChartConfig', () => {
  it('capital fixe sans balance_context', () => {
    const cfg = resolveAccountChartConfig({
      ...baseAccount,
      initial_capital: '50000',
      mll_enabled: true,
      maximum_loss_limit: '2000',
      profit_target_enabled: false,
    });
    expect(cfg.initialCapital).toBe(50000);
    expect(cfg.openingBalance).toBe(50000);
    expect(cfg.showMll).toBe(true);
    expect(cfg.profitTargetAbsolute).toBeNull();
  });

  it('capital 0 explicite', () => {
    const cfg = resolveAccountChartConfig({
      ...baseAccount,
      initial_capital: 0,
      profit_target_enabled: true,
      profit_target: '3000',
    });
    expect(cfg.initialCapital).toBe(0);
    expect(cfg.profitTargetAbsolute).toBe(3000);
  });

  it('mll_enabled sans valeur', () => {
    const cfg = resolveAccountChartConfig({
      ...baseAccount,
      initial_capital: '50000',
      mll_enabled: true,
      maximum_loss_limit: undefined,
    });
    expect(cfg.showMll).toBe(false);
    expect(cfg.mllInitial).toBeNull();
  });

  it('mll désactivé', () => {
    const cfg = resolveAccountChartConfig({
      ...baseAccount,
      initial_capital: '50000',
      mll_enabled: false,
      maximum_loss_limit: '2000',
    });
    expect(cfg.showMll).toBe(false);
  });

  it('opening_balance depuis balance_context', () => {
    const cfg = resolveAccountChartConfig(
      { ...baseAccount, initial_capital: '50000' },
      {
        initial_capital: '50000',
        opening_balance: '53000',
        opening_balance_gross: '53000',
        current_balance: '54000',
        current_balance_gross: '54000',
        profit_target_absolute: '53000',
        mll_configured: true,
      },
    );
    expect(cfg.openingBalance).toBe(53000);
    expect(cfg.referenceBalance).toBe(53000);
    expect(cfg.profitTargetAbsolute).toBe(53000);
  });

  it('profit_target avec capital 50K', () => {
    const cfg = resolveAccountChartConfig({
      ...baseAccount,
      initial_capital: '50000',
      profit_target_enabled: true,
      profit_target: '3000',
    });
    expect(cfg.profitTargetAbsolute).toBe(53000);
  });

  it('capital null traité comme 0', () => {
    const cfg = resolveAccountChartConfig({
      ...baseAccount,
      initial_capital: null,
      profit_target_enabled: true,
      profit_target: '3000',
    });
    expect(cfg.initialCapital).toBe(0);
    expect(cfg.profitTargetAbsolute).toBe(3000);
  });

  it('profit_target désactivé masque la ligne', () => {
    const cfg = resolveAccountChartConfig({
      ...baseAccount,
      initial_capital: '50000',
      profit_target_enabled: false,
      profit_target: '3000',
    });
    expect(cfg.profitTargetAbsolute).toBeNull();
  });

  it('mll avec capital 0', () => {
    const cfg = resolveAccountChartConfig({
      ...baseAccount,
      initial_capital: 0,
      mll_enabled: true,
      maximum_loss_limit: '2000',
    });
    expect(cfg.showMll).toBe(true);
    expect(cfg.mllInitial).toBe(2000);
  });
});
