// Web Worker for heavy dashboard calculations
// This offloads CPU-intensive tasks from the main thread

self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'CALCULATE_SEQUENCES':
      calculateSequences(data);
      break;
    case 'CALCULATE_DURATION_DISTRIBUTION':
      calculateDurationDistribution(data);
      break;
    case 'CALCULATE_WEEKDAY_PERFORMANCE':
      calculateWeekdayPerformance(data);
      break;
    default:
      self.postMessage({ type: 'ERROR', error: 'Unknown calculation type' });
  }
});

function calculateSequences(data) {
  const { trades, strategies } = data;
  
  let maxConsecutiveTradesRespected = 0;
  let maxConsecutiveTradesNotRespected = 0;
  let currentConsecutiveTradesRespected = 0;
  let currentConsecutiveTradesNotRespected = 0;
  let maxConsecutiveDaysRespected = 0;
  let maxConsecutiveDaysNotRespected = 0;
  let currentConsecutiveDaysRespected = 0;
  let currentConsecutiveDaysNotRespected = 0;

  const sortedTrades = [...trades].sort((a, b) => {
    const dateA = a.entered_at ? new Date(a.entered_at).getTime() : 0;
    const dateB = b.entered_at ? new Date(b.entered_at).getTime() : 0;
    return dateA - dateB;
  });

  // Calculate trade sequences
  sortedTrades.forEach(trade => {
    const strategy = strategies[trade.id];
    const isRespected = strategy?.strategy_respected;

    if (isRespected === true) {
      currentConsecutiveTradesRespected++;
      currentConsecutiveTradesNotRespected = 0;
      maxConsecutiveTradesRespected = Math.max(maxConsecutiveTradesRespected, currentConsecutiveTradesRespected);
    } else if (isRespected === false) {
      currentConsecutiveTradesNotRespected++;
      currentConsecutiveTradesRespected = 0;
      maxConsecutiveTradesNotRespected = Math.max(maxConsecutiveTradesNotRespected, currentConsecutiveTradesNotRespected);
    } else {
      currentConsecutiveTradesRespected = 0;
      currentConsecutiveTradesNotRespected = 0;
    }
  });

  // Calculate day sequences
  const tradesByDay = new Map();
  sortedTrades.forEach(trade => {
    if (trade.trade_day || trade.entered_at) {
      const dateStr = trade.trade_day || trade.entered_at;
      if (dateStr) {
        const date = new Date(dateStr);
        const dayKey = date.toISOString().split('T')[0];
        if (!tradesByDay.has(dayKey)) {
          tradesByDay.set(dayKey, []);
        }
        tradesByDay.get(dayKey).push(trade);
      }
    }
  });

  const sortedDays = Array.from(tradesByDay.keys()).sort();
  
  sortedDays.forEach((dayKey) => {
    const dayTrades = tradesByDay.get(dayKey);
    
    const tradesWithStrategy = dayTrades.filter(trade => {
      const strategy = strategies[trade.id];
      return strategy?.strategy_respected !== null && strategy?.strategy_respected !== undefined;
    });

    if (tradesWithStrategy.length === 0) {
      currentConsecutiveDaysRespected = 0;
      currentConsecutiveDaysNotRespected = 0;
      return;
    }

    const allRespected = tradesWithStrategy.every(trade => {
      const strategy = strategies[trade.id];
      return strategy?.strategy_respected === true;
    });

    const hasNotRespected = tradesWithStrategy.some(trade => {
      const strategy = strategies[trade.id];
      return strategy?.strategy_respected === false;
    });

    if (allRespected && tradesWithStrategy.length === dayTrades.length) {
      currentConsecutiveDaysRespected++;
      currentConsecutiveDaysNotRespected = 0;
      maxConsecutiveDaysRespected = Math.max(maxConsecutiveDaysRespected, currentConsecutiveDaysRespected);
    } else if (hasNotRespected && tradesWithStrategy.length === dayTrades.length) {
      currentConsecutiveDaysNotRespected++;
      currentConsecutiveDaysRespected = 0;
      maxConsecutiveDaysNotRespected = Math.max(maxConsecutiveDaysNotRespected, currentConsecutiveDaysNotRespected);
    } else {
      currentConsecutiveDaysRespected = 0;
      currentConsecutiveDaysNotRespected = 0;
    }
  });

  // Calculate current winning streak
  let currentWinningStreakDays = 0;
  if (sortedDays.length > 0) {
    const sortedDaysReverse = [...sortedDays].sort().reverse();
    
    for (const dayKey of sortedDaysReverse) {
      const dayTrades = tradesByDay.get(dayKey);
      const dayPnl = dayTrades.reduce((sum, t) => sum + (t.net_pnl ? parseFloat(t.net_pnl) : 0), 0);
      
      if (dayPnl > 0) {
        currentWinningStreakDays++;
      } else {
        break;
      }
    }
  }

  self.postMessage({
    type: 'SEQUENCES_RESULT',
    result: {
      maxConsecutiveTradesRespected,
      maxConsecutiveTradesNotRespected,
      maxConsecutiveDaysRespected,
      maxConsecutiveDaysNotRespected,
      currentConsecutiveTradesRespected,
      currentConsecutiveTradesNotRespected,
      currentConsecutiveDaysRespected,
      currentConsecutiveDaysNotRespected,
      currentWinningStreakDays,
    }
  });
}

function parseDuration(durationStr) {
  if (!durationStr) return 0;
  
  if (durationStr.includes(':')) {
    const parts = durationStr.split(':');
    if (parts.length === 3) {
      const hours = parseInt(parts[0]) || 0;
      const minutes = parseInt(parts[1]) || 0;
      const seconds = parseFloat(parts[2]) || 0;
      return hours * 60 + minutes + seconds / 60;
    }
  }
  
  const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/);
  if (match) {
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseFloat(match[3] || '0');
    return hours * 60 + minutes + seconds / 60;
  }
  
  return 0;
}

function categorizeDuration(minutes) {
  if (minutes < 5) return '5m';
  if (minutes < 10) return '5-10m';
  if (minutes < 20) return '10-20m';
  if (minutes < 30) return '20-30m';
  if (minutes < 45) return '30-45m';
  if (minutes < 60) return '45-60m';
  return '60m+';
}

function calculateDurationDistribution(data) {
  const { trades } = data;
  
  const categories = {
    '5m': { winning: 0, losing: 0 },
    '5-10m': { winning: 0, losing: 0 },
    '10-20m': { winning: 0, losing: 0 },
    '20-30m': { winning: 0, losing: 0 },
    '30-45m': { winning: 0, losing: 0 },
    '45-60m': { winning: 0, losing: 0 },
    '60m+': { winning: 0, losing: 0 },
  };

  trades.forEach(trade => {
    if (trade.trade_duration) {
      const minutes = parseDuration(trade.trade_duration);
      const category = categorizeDuration(minutes);
      const isWinning = trade.is_profitable === true;
      if (isWinning) {
        categories[category].winning++;
      } else if (trade.is_profitable === false) {
        categories[category].losing++;
      }
    }
  });

  const result = Object.entries(categories)
    .map(([label, data]) => ({
      label,
      winning: data.winning,
      losing: data.losing,
      total: data.winning + data.losing,
    }))
    .filter(item => item.total > 0);

  self.postMessage({
    type: 'DURATION_DISTRIBUTION_RESULT',
    result
  });
}

function calculateWeekdayPerformance(data) {
  const { trades, dayNames } = data;
  
  const dayStats = {};
  dayNames.forEach(day => {
    dayStats[day] = { total_pnl: 0, trade_count: 0, winning_trades: 0 };
  });

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

  const result = Object.entries(dayStats)
    .map(([day, stats]) => ({
      day,
      total_pnl: stats.total_pnl,
      trade_count: stats.trade_count,
      win_rate: stats.trade_count > 0 ? (stats.winning_trades / stats.trade_count) * 100 : 0,
      average_pnl: stats.trade_count > 0 ? stats.total_pnl / stats.trade_count : 0,
    }));

  self.postMessage({
    type: 'WEEKDAY_PERFORMANCE_RESULT',
    result
  });
}
