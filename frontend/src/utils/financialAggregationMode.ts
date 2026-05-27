export type FinancialAggregationMode =
  | 'single_account'
  | 'multi_same_currency'
  | 'multi_mixed_converted'
  | 'multi_mixed_no_money';

export interface ResolveFinancialAggregationModeInput {
  accountId: number | null | undefined;
  activeAccountCurrencyCodes: string[];
  fxAvailable: boolean;
}

export function resolveFinancialAggregationMode(
  input: ResolveFinancialAggregationModeInput,
): FinancialAggregationMode {
  const { accountId, activeAccountCurrencyCodes, fxAvailable } = input;

  if (accountId != null) {
    return 'single_account';
  }

  const codes = activeAccountCurrencyCodes.filter(Boolean);
  if (codes.length <= 1) {
    return codes.length === 1 ? 'multi_same_currency' : 'single_account';
  }

  return fxAvailable ? 'multi_mixed_converted' : 'multi_mixed_no_money';
}

export function isMonetaryNarrativeEnabled(mode: FinancialAggregationMode): boolean {
  return mode !== 'multi_mixed_no_money';
}

export function shouldMaskAggregatedMoney(mode: FinancialAggregationMode): boolean {
  return mode === 'multi_mixed_no_money';
}
