import { useEffect, useMemo, useState } from 'react';
import { tradingAccountsService } from '../services/tradingAccounts';
import { fxRatesService } from '../services/fxRates';
import {
  resolveFinancialAggregationMode,
  type FinancialAggregationMode,
  isMonetaryNarrativeEnabled,
  shouldMaskAggregatedMoney,
} from '../utils/financialAggregationMode';

export interface FinancialAggregationState {
  mode: FinancialAggregationMode;
  monetaryNarrativesEnabled: boolean;
  maskAggregatedMoney: boolean;
  activeAccountCurrencyCodes: string[];
  baseCurrency: string;
  fxAvailable: boolean;
  fxLoading: boolean;
  fxRates: Record<string, number>;
  displayCurrencyCode: string;
  accountCurrencyById: Record<number, string>;
}

export function useFinancialAggregationMode(
  accountId: number | null | undefined,
  defaultCurrency: string,
  selectedAccountCurrency?: string | null,
): FinancialAggregationState {
  const [activeAccountCurrencyCodes, setActiveAccountCurrencyCodes] = useState<string[]>([]);
  const [accountCurrencyById, setAccountCurrencyById] = useState<Record<number, string>>({});
  const [fxAvailable, setFxAvailable] = useState(false);
  const [fxLoading, setFxLoading] = useState(false);
  const [fxRates, setFxRates] = useState<Record<string, number>>({});

  const baseCurrency = (defaultCurrency || 'USD').trim().toUpperCase();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (accountId != null) {
        setActiveAccountCurrencyCodes(
          selectedAccountCurrency ? [selectedAccountCurrency] : [],
        );
        setAccountCurrencyById({});
        return;
      }
      try {
        const list = await tradingAccountsService.list({ include_archived: false });
        if (cancelled) return;
        const active = list.filter((a) => a.status === 'active');
        const codes = Array.from(new Set(active.map((a) => a.currency).filter(Boolean))) as string[];
        const byId: Record<number, string> = {};
        active.forEach((a) => {
          if (a.currency) byId[a.id] = a.currency;
        });
        setActiveAccountCurrencyCodes(codes);
        setAccountCurrencyById(byId);
      } catch {
        if (!cancelled) {
          setActiveAccountCurrencyCodes([]);
          setAccountCurrencyById({});
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [accountId, selectedAccountCurrency]);

  useEffect(() => {
    let cancelled = false;
    const codes = activeAccountCurrencyCodes.filter(Boolean);
    if (accountId != null || codes.length <= 1) {
      setFxAvailable(false);
      setFxRates({});
      setFxLoading(false);
      return;
    }

    setFxLoading(true);
    void fxRatesService
      .getRates(baseCurrency, codes)
      .then((data) => {
        if (!cancelled) {
          const ok = data?.available === true;
          setFxAvailable(ok);
          setFxRates(ok && data?.rates ? data.rates : {});
          setFxLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFxAvailable(false);
          setFxRates({});
          setFxLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accountId, activeAccountCurrencyCodes, baseCurrency]);

  const mode = useMemo(
    () =>
      resolveFinancialAggregationMode({
        accountId,
        activeAccountCurrencyCodes,
        fxAvailable,
      }),
    [accountId, activeAccountCurrencyCodes, fxAvailable],
  );

  const displayCurrencyCode = useMemo(() => {
    if (accountId != null && selectedAccountCurrency) {
      return selectedAccountCurrency;
    }
    if (mode === 'multi_same_currency' && activeAccountCurrencyCodes.length === 1) {
      return activeAccountCurrencyCodes[0];
    }
    if (mode === 'multi_mixed_converted') {
      return baseCurrency;
    }
    return '';
  }, [accountId, selectedAccountCurrency, mode, activeAccountCurrencyCodes, baseCurrency]);

  return {
    mode,
    monetaryNarrativesEnabled: isMonetaryNarrativeEnabled(mode),
    maskAggregatedMoney: shouldMaskAggregatedMoney(mode),
    activeAccountCurrencyCodes,
    baseCurrency,
    fxAvailable,
    fxLoading,
    fxRates,
    displayCurrencyCode,
    accountCurrencyById,
  };
}
