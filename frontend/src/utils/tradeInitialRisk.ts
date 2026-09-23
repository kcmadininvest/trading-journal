import type { TradeListItem } from '../services/trades';

export interface InitialRiskResult {
  /** Distance entrée → SL en points (toujours positive). */
  riskPoints: number | null;
  /** Risque initial monétaire : riskPoints * point_value * size. */
  riskAmount: number | null;
}

function parseNumeric(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Calcule le risque initial d'un trade à partir de son prix d'entrée,
 * de son stop loss prévu et de sa taille.
 *
 * Retourne `null` dès qu'une donnée requise est manquante ou incohérente
 * (par exemple SL du mauvais côté par rapport à l'entrée).
 */
export function calculateInitialRisk(trade: TradeListItem): InitialRiskResult {
  const entryPrice = parseNumeric(trade.entry_price);
  const stopLoss = parseNumeric(trade.planned_stop_loss);
  const size = parseNumeric(trade.size);

  if (entryPrice === null || stopLoss === null || size === null) {
    return { riskPoints: null, riskAmount: null };
  }

  const distance = trade.trade_type === 'Long'
    ? entryPrice - stopLoss
    : stopLoss - entryPrice;

  const riskPoints = Number(distance.toFixed(6));
  if (riskPoints <= 0) {
    return { riskPoints: null, riskAmount: null };
  }

  const pointValue = parseNumeric(trade.point_value);
  if (pointValue === null || pointValue <= 0) {
    return { riskPoints, riskAmount: null };
  }

  const riskAmount = Number((riskPoints * pointValue * size).toFixed(2));
  return { riskPoints, riskAmount };
}
