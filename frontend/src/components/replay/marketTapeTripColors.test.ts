import {
  formatTripLabel,
  getTripColor,
  getTripLegendSampleColors,
  normalizeTradeSide,
} from './marketTapeTripColors';

describe('marketTapeTripColors', () => {
  it('normalizes trade side', () => {
    expect(normalizeTradeSide('Long')).toBe('long');
    expect(normalizeTradeSide('SHORT')).toBe('short');
    expect(normalizeTradeSide('')).toBeNull();
  });

  it('returns distinct colors for consecutive long trips', () => {
    const c0 = getTripColor(0, 'Long', true);
    const c1 = getTripColor(1, 'Long', true);
    const c2 = getTripColor(2, 'Long', true);
    expect(c0).not.toBe(c1);
    expect(c1).not.toBe(c2);
  });

  it('wraps palette with modulo', () => {
    const c0 = getTripColor(0, 'Short', false);
    const c8 = getTripColor(8, 'Short', false);
    expect(c0).toBe(c8);
  });

  it('formats trip label for tooltips', () => {
    expect(formatTripLabel(0)).toBe('#1');
    expect(formatTripLabel(2)).toBe('#3');
    expect(formatTripLabel(undefined)).toBeNull();
  });

  it('returns legend sample colors', () => {
    const sample = getTripLegendSampleColors(true, 4);
    expect(sample).toHaveLength(4);
    expect(new Set(sample).size).toBeGreaterThan(1);
  });
});
