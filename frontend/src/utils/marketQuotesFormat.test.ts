import { getPriceFlashDirection } from './marketQuoteFlash';
import {
  formatMarketQuoteChangePercent,
  formatMarketQuotePrice,
  quotePriceDecimalPlaces,
} from './marketQuotesFormat';

describe('marketQuotesFormat', () => {
  it('uses four decimals for eurusd', () => {
    expect(quotePriceDecimalPlaces('eurusd')).toBe(4);
    expect(formatMarketQuotePrice(1.165, 'eurusd', 'comma')).toBe('1,1650');
    expect(formatMarketQuotePrice(1.165, 'eurusd', 'point')).toBe('1.1650');
  });

  it('uses two decimals for other instruments', () => {
    expect(formatMarketQuotePrice(29975.25, 'nasdaq', 'comma')).toBe('29 975,25');
    expect(formatMarketQuotePrice(29975.25, 'nasdaq', 'point')).toBe('29,975.25');
    expect(formatMarketQuotePrice(77405, 'bitcoin', 'comma')).toBe('77 405,00');
  });

  it('formats change percent with user number format', () => {
    expect(formatMarketQuoteChangePercent(1.37, 'comma')).toBe('+1,37%');
    expect(formatMarketQuoteChangePercent(1.37, 'point')).toBe('+1.37%');
    expect(formatMarketQuoteChangePercent(-0.92, 'comma')).toBe('-0,92%');
  });

  it('returns dash for null price or percent', () => {
    expect(formatMarketQuotePrice(null, 'nasdaq', 'comma')).toBe('—');
    expect(formatMarketQuoteChangePercent(null, 'comma')).toBe('—');
  });
});

describe('marketQuote flash', () => {
  it('detects price increase', () => {
    expect(getPriceFlashDirection(100, 101)).toBe('up');
  });

  it('detects price decrease', () => {
    expect(getPriceFlashDirection(100, 99)).toBe('down');
  });

  it('ignores first render', () => {
    expect(getPriceFlashDirection(undefined, 100)).toBe(null);
  });
});
