/** Évaluation du % « taille augmentée » après perte ou gain (plus bas = mieux). */

export type PostTradeSizingQuality = 'good' | 'neutral' | 'bad';

/** Seuils partagés post-perte / post-gain (comportement émotionnel de sizing). */
export const LARGER_PCT_THRESHOLDS = {
  goodMax: 20,
  neutralMax: 35,
} as const;

export function evaluateLargerPct(pct: number): PostTradeSizingQuality {
  if (pct <= LARGER_PCT_THRESHOLDS.goodMax) return 'good';
  if (pct <= LARGER_PCT_THRESHOLDS.neutralMax) return 'neutral';
  return 'bad';
}

export const LARGER_PCT_VALUE_CLASS: Record<PostTradeSizingQuality, string> = {
  good: 'text-blue-600 dark:text-blue-400',
  neutral: 'text-orange-600 dark:text-orange-400',
  bad: 'text-pink-600 dark:text-pink-400',
};

export const LARGER_PCT_BADGE_CLASS: Record<PostTradeSizingQuality, string> = {
  good: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  neutral: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
  bad: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-200',
};
