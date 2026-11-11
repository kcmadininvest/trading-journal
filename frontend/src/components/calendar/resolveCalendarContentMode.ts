export type CalendarViewType = 'daily' | 'monthly';

export type CalendarContentMode = 'daily' | 'monthly' | 'loading' | 'empty';

/**
 * Décide quel contenu afficher sur la page calendrier.
 *
 * Important anti-scintillement : dès qu’il y a des données pour la vue courante,
 * on les garde montées même si `isLoading` est true (reload PnL / sync / etc.).
 * Un spinner plein écran à la place démonterait DailyView et ferait disparaître
 * StrategyComplianceModal (état d’ouverture local).
 */
export function resolveCalendarContentMode(params: {
  viewType: CalendarViewType;
  hasDailyData: boolean;
  hasMonthlyData: boolean;
  isLoading: boolean;
}): CalendarContentMode {
  const { viewType, hasDailyData, hasMonthlyData, isLoading } = params;

  if (viewType === 'daily' && hasDailyData) {
    return 'daily';
  }
  if (viewType === 'monthly' && hasMonthlyData) {
    return 'monthly';
  }
  if (isLoading) {
    return 'loading';
  }
  return 'empty';
}
