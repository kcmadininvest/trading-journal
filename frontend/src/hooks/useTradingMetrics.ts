import { useMemo } from 'react';

interface Trade {
  id: number;
  net_pnl: string | null;
  is_profitable: boolean | null;
  trade_duration?: string | null;
  entered_at?: string;
}

export function useTradingMetrics(trades: Trade[]) {
  return useMemo(() => {
    if (trades.length === 0) return null;

    const winningTrades = trades.filter(t => t.is_profitable === true && t.net_pnl);
    const losingTrades = trades.filter(t => t.is_profitable === false && t.net_pnl);
    
    const totalTrades = trades.filter(t => t.is_profitable !== null).length;
    const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;
    
    const avgWinningTrade = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + parseFloat(t.net_pnl!), 0) / winningTrades.length
      : 0;
    
    const avgLosingTrade = losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => sum + parseFloat(t.net_pnl!), 0) / losingTrades.length
      : 0;

    return {
      winRate,
      avgWinningTrade,
      avgLosingTrade,
      totalTrades,
      winningCount: winningTrades.length,
      losingCount: losingTrades.length,
    };
  }, [trades]);
}
