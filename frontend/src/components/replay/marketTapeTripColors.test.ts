import {
  formatTripLabel,
  getLegendTripColor,
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

  it('has unique colors in each palette', () => {
    for (const isDark of [true, false]) {
      for (const side of ['long', 'short'] as const) {
        const colors = Array.from({ length: 8 }, (_, i) => getTripColor(i, side, isDark));
        expect(new Set(colors).size).toBe(8);
      }
    }
  });

  it('returns fixed legend trip color matching trip index 0', () => {
    expect(getLegendTripColor('long', true)).toBe(getTripColor(0, 'long', true));
    expect(getLegendTripColor('short', false)).toBe(getTripColor(0, 'short', false));
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

  it('keeps every long pair apart by hue or luminance', () => {
    const forbidden = new Set(['#a3e635', '#86efac', '#4ade80', '#2dd4bf', '#22d3ee', '#34d399', '#38bdf8']);
    for (const isDark of [true, false]) {
      const longs = Array.from({ length: 8 }, (_, i) => getTripColor(i, 'long', isDark)!);
      const shorts = Array.from({ length: 8 }, (_, i) => getTripColor(i, 'short', isDark)!);
      const background = isDark ? '#0B1020' : '#ffffff';
      expect(longs[0]).toBe('#16a34a');
      longs.forEach((color) => {
        expect(contrastRatio(color, background)).toBeGreaterThanOrEqual(3);
        expect(isDark ? contrastRatio(color, '#ffffff') : 2.2).toBeGreaterThanOrEqual(2.2);
        expect(!isDark || !forbidden.has(color)).toBe(true);
      });
      for (let i = 0; i < longs.length; i += 1) {
        for (let j = i + 1; j < longs.length; j += 1) {
          expect(separatedByHueOrLuminance(longs[i], longs[j], 40)).toBe(true);
        }
        shorts.forEach((shortColor) => {
          expect(separatedByHueOrLuminance(longs[i], shortColor, 30)).toBe(true);
        });
      }
    }
  });

  it('keeps every short pair apart by hue or luminance', () => {
    const reserved = new Set(['#7c3aed', '#c084fc', '#fbbf24']);
    for (const isDark of [true, false]) {
      const colors = Array.from({ length: 8 }, (_, i) => getTripColor(i, 'short', isDark)!);
      const background = isDark ? '#0B1020' : '#ffffff';
      colors.forEach((color, index) => {
        expect(contrastRatio(color, background)).toBeGreaterThanOrEqual(3);
        expect(isDark ? contrastRatio(color, '#ffffff') : 2.2).toBeGreaterThanOrEqual(2.2);
        expect(index === 0 || !reserved.has(color)).toBe(true);
      });
      for (let i = 0; i < colors.length; i += 1) {
        for (let j = i + 1; j < colors.length; j += 1) {
          expect(separatedByHueOrLuminance(colors[i], colors[j], 40)).toBe(true);
        }
      }
    }
  });
});

function separatedByHueOrLuminance(left: string, right: string, hueGap: number): boolean {
  const lighter = Math.max(relativeLuminance(left), relativeLuminance(right));
  const darker = Math.min(relativeLuminance(left), relativeLuminance(right));
  return hueDistance(left, right) >= hueGap || lighter / darker >= 2;
}

function relativeLuminance(hex: string): number {
  const channel = (value: number) => {
    const srgb = value / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  const [red, green, blue] = rgb(hex);
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function hueDistance(left: string, right: string): number {
  const gap = Math.abs(hslHue(left) - hslHue(right)) % 360;
  return Math.min(gap, 360 - gap);
}

function hslHue(hex: string): number {
  const [red, green, blue] = rgb(hex).map((channel) => channel / 255);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  if (delta < 1e-9) return 0;
  let hue: number;
  if (max === red) hue = ((green - blue) / delta) % 6;
  else if (max === green) hue = (blue - red) / delta + 2;
  else hue = (red - green) / delta + 4;
  return (hue * 60 + 360) % 360;
}

function rgb(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}
