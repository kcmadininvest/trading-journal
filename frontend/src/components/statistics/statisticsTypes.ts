import type { AnalyticsData, StatisticsData } from '../../hooks/useStatistics';

export interface StatisticsFormatters {
  formatCurrency: (value: number, currencySymbol?: string) => string;
  formatNumber: (value: number, digits?: number) => string;
  formatVolume: (volume: string) => string;
  formatRatio: (ratio: number) => string;
}

export interface StatisticsTabBaseProps extends StatisticsFormatters {
  statisticsData: StatisticsData;
  analyticsData: AnalyticsData | null;
  currencySymbol: string;
  hideMoney?: boolean;
}

export interface PointsStats {
  avgPointsPerTrade: number;
  avgPointsWin: number;
  avgPointsLoss: number;
  maxPointsGain: number;
  maxPointsLoss: number;
  totalPoints: number;
  tradesWithPoints: number;
}
