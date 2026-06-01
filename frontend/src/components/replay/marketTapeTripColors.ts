/** Palettes de teintes distinctes par trade (replay bandeau marché). */

const TRIP_PALETTE_LONG_DARK = ['#4ade80', '#2dd4bf', '#22d3ee', '#60a5fa', '#34d399', '#a3e635', '#38bdf8', '#4ade80'];
const TRIP_PALETTE_SHORT_DARK = ['#fb923c', '#fbbf24', '#f87171', '#f472b6', '#fb7185', '#fdba74', '#f97316', '#ea580c'];

const TRIP_PALETTE_LONG_LIGHT = ['#16a34a', '#0d9488', '#0891b2', '#2563eb', '#059669', '#65a30d', '#0284c7', '#15803d'];
const TRIP_PALETTE_SHORT_LIGHT = ['#ea580c', '#d97706', '#dc2626', '#db2777', '#e11d48', '#f59e0b', '#c2410c', '#b45309'];

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
