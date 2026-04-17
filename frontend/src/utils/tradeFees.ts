import type { TradeListItem } from '../services/trades';

/** Coût transactionnel (frais + commissions), aligné sur TradesTable et le dashboard. */
export function feesPlusCommissions(trade: Pick<TradeListItem, 'fees' | 'commissions'>): number {
  const fees = trade.fees ? parseFloat(trade.fees) : 0;
  const commissions = trade.commissions ? parseFloat(trade.commissions) : 0;
  const sum = fees + commissions;
  return Number.isFinite(sum) ? sum : 0;
}
