/**
 * Décide si le recalcul auto du PnL brut doit tourner.
 * En édition : après hydrate API, on conserve trade.pnl tant que l’utilisateur
 * n’a pas modifié entry/exit/size/point_value/trade_type.
 */
export function shouldAutoCalculatePnl(options: {
  isPnlManuallyEdited: boolean;
  isEditMode: boolean;
  priceFieldsDirtySinceHydrate: boolean;
}): boolean {
  if (options.isPnlManuallyEdited) {
    return false;
  }
  if (options.isEditMode && !options.priceFieldsDirtySinceHydrate) {
    return false;
  }
  return true;
}

export function computeGrossPnl(options: {
  tradeType: 'Long' | 'Short';
  entryPrice: number;
  exitPrice: number;
  size: number;
  pointValue: number;
}): number {
  const priceDiff =
    options.tradeType === 'Long'
      ? options.exitPrice - options.entryPrice
      : options.entryPrice - options.exitPrice;
  return priceDiff * options.pointValue * options.size;
}

/** True si blur NumberInput / format API ne change que la représentation, pas la valeur. */
export function isSameNumericInput(a: string, b: string): boolean {
  if (a === b) return true;
  if (a === '' || b === '') return a === b;
  const na = parseFloat(a);
  const nb = parseFloat(b);
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
}
