/**
 * Rattachement d'un trade à un jour calendaire :
 * - `trade_day` : champ stocké à l'import (comportement historique) ;
 * - `entered_at` : date d'entrée dans le fuseau de l'utilisateur (aligné sur le calendrier PnL).
 */
export type TradeDayBasis = 'trade_day' | 'entered_at';

/** Filtres de liste de trades pour un jour donné (YYYY-MM-DD) selon la base choisie. */
export function tradeDayFilters(
  date: string,
  basis: TradeDayBasis
): { trade_day: string } | { start_date: string; end_date: string } {
  return basis === 'entered_at' ? { start_date: date, end_date: date } : { trade_day: date };
}
