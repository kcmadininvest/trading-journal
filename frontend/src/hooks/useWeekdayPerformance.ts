import { useMemo } from 'react';

interface Trade {
  entered_at?: string;
  net_pnl: string | null;
  is_profitable: boolean | null;
}

export function useWeekdayPerformance(trades: Trade[], t: (key: string) => string) {
  return useMemo(() => {
    const monday = t('dashboard:monday');
    const tuesday = t('dashboard:tuesday');
    const wednesday = t('dashboard:wednesday');
    const thursday = t('dashboard:thursday');
    const friday = t('dashboard:friday');
    const saturday = t('dashboard:saturday');
    const sunday = t('dashboard:sunday');
    
    const dayStats: { [day: string]: { total_pnl: number; trade_count: number; winning_trades: number } } = {
      [monday]: { total_pnl: 0, trade_count: 0, winning_trades: 0 },
      [tuesday]: { total_pnl: 0, trade_count: 0, winning_trades: 0 },
      [wednesday]: { total_pnl: 0, trade_count: 0, winning_trades: 0 },
      [thursday]: { total_pnl: 0, trade_count: 0, winning_trades: 0 },
      [friday]: { total_pnl: 0, trade_count: 0, winning_trades: 0 },
      [saturday]: { total_pnl: 0, trade_count: 0, winning_trades: 0 },
      [sunday]: { total_pnl: 0, trade_count: 0, winning_trades: 0 },
    };

    const dayNames = [sunday, monday, tuesday, wednesday, thursday, friday, saturday];

    trades.forEach(trade => {
      if (trade.entered_at && trade.net_pnl !== null) {
        const date = new Date(trade.entered_at);
        const dayName = dayNames[date.getDay()];
        const pnl = parseFloat(trade.net_pnl);
        
        if (dayStats[dayName]) {
          dayStats[dayName].total_pnl += pnl;
          dayStats[dayName].trade_count += 1;
          if (trade.is_profitable === true) {
            dayStats[dayName].winning_trades += 1;
          }
        }
      }
    });

    return Object.entries(dayStats)
      .map(([day, stats]) => ({
        day,
        total_pnl: stats.total_pnl,
        trade_count: stats.trade_count,
        win_rate: stats.trade_count > 0 ? (stats.winning_trades / stats.trade_count) * 100 : 0,
        average_pnl: stats.trade_count > 0 ? stats.total_pnl / stats.trade_count : 0,
      }))
      .filter(d => d.day !== saturday && d.day !== sunday);
  }, [trades, t]);
}
