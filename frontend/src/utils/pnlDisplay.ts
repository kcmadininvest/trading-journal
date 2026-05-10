/** Aligné sur UserPreferences.pnl_display côté API (net | gross). */
export type PnlDisplayMode = 'net' | 'gross';

export interface TradePnlFields {
  pnl?: string | null;
  net_pnl?: string | null;
}

export function getTradeDisplayPnlValue(trade: TradePnlFields, mode: PnlDisplayMode): number | null {
  if (mode === 'gross') {
    if (trade.pnl != null && trade.pnl !== '') {
      const n = parseFloat(trade.pnl);
      return Number.isFinite(n) ? n : null;
    }
    if (trade.net_pnl != null && trade.net_pnl !== '') {
      const n = parseFloat(trade.net_pnl);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }
  if (trade.net_pnl != null && trade.net_pnl !== '') {
    const n = parseFloat(trade.net_pnl);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function parsePnlDisplayMode(raw: string | undefined | null): PnlDisplayMode {
  return raw === 'gross' ? 'gross' : 'net';
}
