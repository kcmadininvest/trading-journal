/**
 * Heuristiques d’échantillon pour l’UI « métriques trading » (pas un test statistique formel).
 * - ~30 : règle des 30 / ordre de grandeur courant pour des moyennes ou proportions interprétables.
 * - &lt; 10 : échantillon très petit, forte variabilité.
 */
export const SAMPLE_MODERATE_MIN = 30;
export const SAMPLE_STRONG_MAX = 10;

/** Fenêtre glissante pour le pic de win rate (trades consécutifs chronologiques). */
export const WIN_RATE_ROLLING_WINDOW = 20;
