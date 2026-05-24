import type { TFunction } from 'i18next';
import type { TradeListItem } from '../services/trades';
import type { StatisticsData } from '../hooks/useStatistics';
import { getTradeDisplayPnlValue, type PnlDisplayMode } from './pnlDisplay';

export interface TradesDistributionChartData {
  labels: string[];
  data: number[];
  percentages: string[];
  total: number;
}

export function buildTradesDistributionData(
  trades: TradeListItem[],
  statisticsData: StatisticsData,
  t: TFunction,
  pnlDisplayMode: PnlDisplayMode
): TradesDistributionChartData | null {
  if (!trades.length || !statisticsData) return null;

  const tradesWithZeroPnl = trades.filter((trade) => {
    const pnl = getTradeDisplayPnlValue(trade, pnlDisplayMode);
    if (pnl === null) return false;
    return Math.abs(pnl) < 0.001;
  }).length;

  const winningTradesWithoutTp = Math.max(0, (statisticsData.break_even_trades || 0) - tradesWithZeroPnl);
  const winners = Math.max(0, (statisticsData.winning_trades || 0) - winningTradesWithoutTp);
  const losers = statisticsData.losing_trades || 0;
  const neutral = statisticsData.break_even_trades || 0;
  const total = winners + losers + neutral;

  if (total === 0) return null;

  return {
    labels: [
      t('analytics:charts.tradesDistribution.winners', { defaultValue: 'Gagnants' }),
      t('analytics:charts.tradesDistribution.losers', { defaultValue: 'Perdants' }),
      t('analytics:charts.tradesDistribution.neutral', { defaultValue: 'Break-even' }),
    ],
    data: [winners, losers, neutral],
    percentages: [
      ((winners / total) * 100).toFixed(1),
      ((losers / total) * 100).toFixed(1),
      ((neutral / total) * 100).toFixed(1),
    ],
    total,
  };
}
