import type { AnalyticsData, StatisticsData } from '../../hooks/useStatistics';
import type { TradeListItem } from '../../services/trades';
import type { PnlDisplayMode } from '../../utils/pnlDisplay';
import type { DateFormatType } from '../../utils/dateFormat';
import type { NumberFormatType } from '../../utils/numberFormat';

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
  filteredTrades?: TradeListItem[];
  pnlDisplayMode?: PnlDisplayMode;
  dateFormat?: DateFormatType;
  timezone?: string;
  numberFormat?: NumberFormatType;
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
