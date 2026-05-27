import type { PnlDisplayMode } from './pnlDisplay';
import { getTradeDisplayPnlValue } from './pnlDisplay';
import type { TradeForTimeAggregate } from './behaviorNarrative/aggregateBehaviorTimeContext';

export interface TradeWithConvertedPnl extends TradeForTimeAggregate {
  convertedPnl: number | null;
}

/**
 * Frankfurter (via backend) : rates[EUR] = combien d'EUR pour 1 unité de base.
 * Montant en EUR → base : amount_eur / rates[EUR]
 */
export function convertPnlToBase(
  amount: number,
  fromCurrency: string,
  baseCurrency: string,
  rates: Record<string, number>,
): number | null {
  const base = baseCurrency.trim().toUpperCase();
  const frm = fromCurrency.trim().toUpperCase();
  if (frm === base) return amount;
  const rate = rates[frm];
  if (rate == null || rate <= 0) return null;
  return amount / rate;
}

export function applyConvertedPnlToTrades(
  trades: TradeForTimeAggregate[],
  accountCurrencyById: Record<number, string>,
  baseCurrency: string,
  rates: Record<string, number>,
  pnlDisplayMode: PnlDisplayMode,
): TradeWithConvertedPnl[] {
  return trades.map((trade) => {
    const raw = getTradeDisplayPnlValue(trade, pnlDisplayMode);
    const accountId = trade.trading_account;
    const fromCurrency =
      accountId != null ? accountCurrencyById[accountId] : undefined;
    if (raw === null || !fromCurrency) {
      return { ...trade, convertedPnl: raw };
    }
    const converted =
      convertPnlToBase(raw, fromCurrency, baseCurrency, rates) ?? raw;
    return { ...trade, convertedPnl: converted };
  });
}

export function getNormalizedPnl(
  trade: TradeWithConvertedPnl,
  useConversion: boolean,
  pnlDisplayMode: PnlDisplayMode,
): number | null {
  if (useConversion && trade.convertedPnl != null) {
    return trade.convertedPnl;
  }
  return getTradeDisplayPnlValue(trade, pnlDisplayMode);
}
