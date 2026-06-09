/** Aligné sur le seuil drawdownHigh / drawdownModerate de buildBehaviorNarrative. */
export const RISK_DRAWDOWN_MODERATE_MAX_PCT = 15;
export const RISK_DRAWDOWN_ELEVATED_MAX_PCT = 30;

export const RISK_RECOVERY_GOOD_MIN = 1;
export const RISK_RECOVERY_STRONG_MIN = 1.5;
export const RISK_RECOVERY_LOW_MAX = 0.8;

export type RiskSectionTitleVariant = 'celebrate' | 'excellent' | 'positive' | 'mixed' | 'challenging';

/**
 * Titre de la section risque basé uniquement sur drawdown et facteur de récupération.
 * Indépendant du ton global de la synthèse.
 */
export function resolveRiskSectionTitle(
  maxDrawdownPct: number | null,
  recoveryRatio: number | null,
): string {
  if (maxDrawdownPct == null) {
    return 'behaviorNarrative.risk.title.positive';
  }

  if (maxDrawdownPct > RISK_DRAWDOWN_ELEVATED_MAX_PCT) {
    return 'behaviorNarrative.risk.title.challenging';
  }

  if (maxDrawdownPct > RISK_DRAWDOWN_MODERATE_MAX_PCT) {
    if (recoveryRatio != null && recoveryRatio >= RISK_RECOVERY_STRONG_MIN) {
      return 'behaviorNarrative.risk.title.excellent';
    }
    return 'behaviorNarrative.risk.title.mixed';
  }

  if (recoveryRatio != null && recoveryRatio >= RISK_RECOVERY_GOOD_MIN) {
    return 'behaviorNarrative.risk.title.celebrate';
  }

  if (recoveryRatio != null && recoveryRatio < RISK_RECOVERY_LOW_MAX) {
    return 'behaviorNarrative.risk.title.mixed';
  }

  return 'behaviorNarrative.risk.title.positive';
}
