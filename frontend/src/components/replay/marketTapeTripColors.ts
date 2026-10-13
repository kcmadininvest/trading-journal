/** Palettes de teintes distinctes par trade (replay bandeau marché). */

const TRIP_PALETTE_LONG_DARK = ['#16a34a', '#4e6d06', '#067247', '#0868a0', '#5044f5', '#75a309', '#139cec', '#8b85e5'];
const TRIP_PALETTE_SHORT_DARK = ['#fb923c', '#9219e8', '#be1377', '#c2410c', '#b96af0', '#ee4fab', '#0f7000', '#249c11'];

const TRIP_PALETTE_LONG_LIGHT = ['#16a34a', '#0891b2', '#1d4ed8', '#166534', '#65a30d', '#3f6212', '#172554', '#1a2e05'];
const TRIP_PALETTE_SHORT_LIGHT = ['#ea580c', '#4c1d95', '#be185d', '#451a03', '#7e22ce', '#881337', '#92400e', '#d946ef'];

const TRIP_PALETTE_NEUTRAL_DARK = ['#fbbf24', '#c084fc'];
const TRIP_PALETTE_NEUTRAL_LIGHT = ['#ea580c', '#7c3aed'];

export function normalizeTradeSide(side: string | undefined): 'long' | 'short' | null {
  const s = (side || '').toLowerCase();
  if (s === 'long') return 'long';
  if (s === 'short') return 'short';
  return null;
}

export function getTripColor(
  tripIndex: number | undefined,
  side: string | undefined,
  isDark: boolean,
): string | null {
  if (tripIndex == null || tripIndex < 0) return null;
  const normalized = normalizeTradeSide(side);
  const palettes = isDark
    ? {
        long: TRIP_PALETTE_LONG_DARK,
        short: TRIP_PALETTE_SHORT_DARK,
        neutral: TRIP_PALETTE_NEUTRAL_DARK,
      }
    : {
        long: TRIP_PALETTE_LONG_LIGHT,
        short: TRIP_PALETTE_SHORT_LIGHT,
        neutral: TRIP_PALETTE_NEUTRAL_LIGHT,
      };
  const palette = normalized ? palettes[normalized] : palettes.neutral;
  return palette[tripIndex % palette.length];
}

/** Index trip utilisé comme exemple fixe dans la légende (trade #1). */
export const LEGEND_SAMPLE_TRIP_INDEX = 0;

/** Teinte représentative pour un glyphe de légende (palette index 0). */
export function getLegendTripColor(side: 'long' | 'short', isDark: boolean): string {
  return getTripColor(LEGEND_SAMPLE_TRIP_INDEX, side, isDark)!;
}

/** Échantillon de teintes pour la légende (long + short mélangés). */
export function getTripLegendSampleColors(isDark: boolean, count = 4): string[] {
  const long = isDark ? TRIP_PALETTE_LONG_DARK : TRIP_PALETTE_LONG_LIGHT;
  const short = isDark ? TRIP_PALETTE_SHORT_DARK : TRIP_PALETTE_SHORT_LIGHT;
  const sample: string[] = [];
  for (let i = 0; i < count; i++) {
    sample.push(i % 2 === 0 ? long[i % long.length] : short[i % short.length]);
  }
  return sample;
}

/** Numéro affiché à l'utilisateur (1-based). */
export function formatTripLabel(tripIndex: number | undefined): string | null {
  if (tripIndex == null || tripIndex < 0) return null;
  return `#${tripIndex + 1}`;
}
