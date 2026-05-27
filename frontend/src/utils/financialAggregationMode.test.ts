import {
  isMonetaryNarrativeEnabled,
  resolveFinancialAggregationMode,
  shouldMaskAggregatedMoney,
} from './financialAggregationMode';

describe('financialAggregationMode', () => {
  it('single account allows monetary narratives', () => {
    const mode = resolveFinancialAggregationMode({
      accountId: 1,
      activeAccountCurrencyCodes: ['USD', 'EUR'],
      fxAvailable: false,
    });
    expect(mode).toBe('single_account');
    expect(isMonetaryNarrativeEnabled(mode)).toBe(true);
    expect(shouldMaskAggregatedMoney(mode)).toBe(false);
  });

  it('multi same currency allows monetary narratives', () => {
    const mode = resolveFinancialAggregationMode({
      accountId: null,
      activeAccountCurrencyCodes: ['EUR'],
      fxAvailable: false,
    });
    expect(mode).toBe('multi_same_currency');
    expect(isMonetaryNarrativeEnabled(mode)).toBe(true);
  });

  it('multi mixed without FX blocks monetary narratives', () => {
    const mode = resolveFinancialAggregationMode({
      accountId: null,
      activeAccountCurrencyCodes: ['USD', 'EUR'],
      fxAvailable: false,
    });
    expect(mode).toBe('multi_mixed_no_money');
    expect(isMonetaryNarrativeEnabled(mode)).toBe(false);
    expect(shouldMaskAggregatedMoney(mode)).toBe(true);
  });

  it('multi mixed with FX enables converted mode', () => {
    const mode = resolveFinancialAggregationMode({
      accountId: null,
      activeAccountCurrencyCodes: ['USD', 'EUR'],
      fxAvailable: true,
    });
    expect(mode).toBe('multi_mixed_converted');
    expect(isMonetaryNarrativeEnabled(mode)).toBe(true);
  });
});
