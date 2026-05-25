import { formatNumber, NumberFormatType } from './numberFormat';

/** Aligné sur le backend (market_quotes_config + DEFAULT_MIN_DISPLAY_DECIMALS). */
export const MARKET_QUOTE_PRICE_DECIMALS: Record<string, number> = {
  nasdaq: 2,
  sp500: 2,
  gold: 2,
  eurusd: 4,
  bitcoin: 2,
};

export function quotePriceDecimalPlaces(instrumentKey: string): number {
  return MARKET_QUOTE_PRICE_DECIMALS[instrumentKey] ?? 2;
}

export function formatMarketQuotePrice(
  price: number | null | undefined,
  instrumentKey: string,
  numberFormat: NumberFormatType,
): string {
  if (price === null || price === undefined || Number.isNaN(price)) {
    return '—';
  }
  return formatNumber(price, quotePriceDecimalPlaces(instrumentKey), numberFormat);
}

export function formatMarketQuoteChangePercent(
  value: number | null | undefined,
  numberFormat: NumberFormatType,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  const formatted = formatNumber(value, 2, numberFormat);
  if (formatted === '-') {
    return '—';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatted}%`;
}
