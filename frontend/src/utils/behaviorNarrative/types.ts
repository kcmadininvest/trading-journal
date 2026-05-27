import type { DurationBucketPerformanceRow } from '../tradeDurationBuckets';
import type { FinancialAggregationMode } from '../financialAggregationMode';

export type NarrativeTone = 'excellent' | 'positive' | 'mixed' | 'challenging';

export type NarrativeSectionId =
  | 'intro'
  | 'strengths'
  | 'alerts'
  | 'timeWindows'
  | 'duration'
  | 'trajectory'
  | 'risk'
  | 'rhythm'
  | 'habits'
  | 'process';

export type NarrativeBlockKind = 'prose' | 'highlight' | 'alert';

export interface NarrativeHighlight {
  labelKey: string;
  value: string;
  tone?: 'positive' | 'negative' | 'neutral';
}

export interface NarrativeSection {
  id: NarrativeSectionId;
  titleKey?: string;
  kind?: NarrativeBlockKind;
  paragraphs: string[];
  highlights?: NarrativeHighlight[];
  toneVariant?: NarrativeTone;
}

export interface HourlyPerformanceRow {
  hour: number;
  totalPnl: number;
  tradeCount: number;
}

export interface WeekdayPerformanceRow {
  day: string;
  totalPnl: number;
  tradeCount: number;
  winRate: number;
}

export interface WeeklyPerformanceRow {
  isoYear: number;
  isoWeek: number;
  totalPnl: number;
  tradeCount: number;
  winRate: number;
}

export interface DailyRhythmContext {
  avgTradesPerDay: number;
  worstDay: string | null;
  worstDayPnl: number | null;
  bestDay: string | null;
  bestDayPnl: number | null;
}

export interface BehaviorNarrativeContext {
  tradeCount: number;
  profitFactor: number | null;
  sharpeAnnualized: number | null;
  expectancy: number;
  winRate: number;
  tone: NarrativeTone;
  monetaryNarrativesEnabled: boolean;
  aggregationMode: FinancialAggregationMode;
  trajectoryProgression: boolean;
  trajectoryVolatile: boolean;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  maxDrawdownPct: number | null;
  maxDrawdownGlobal: number | null;
  recoveryRatio: number | null;
  calmarRatio: number | null;
  revenge: {
    alertLevel: 'none' | 'warning';
    hasSufficientData: boolean;
    pctIncrease: number | null;
    avgAfterLoss: number;
    avgAfterWin: number;
  } | null;
  sizing: {
    alertLevel: 'none' | 'warning';
    hasSufficientData: boolean;
    pctLargerOnLosers: number | null;
  } | null;
  worstMonthLabel: string | null;
  dailyRhythm: DailyRhythmContext | null;
  postLossDominantCategory: 'larger' | 'equal' | 'smaller' | null;
  postLossSampleSize: number;
  postWinDominantCategory: 'larger' | 'equal' | 'smaller' | null;
  postWinSampleSize: number;
  planRespectRate: number | null;
  avgPlannedRr: number | null;
  avgActualRr: number | null;
  tradesWithPlannedRr: number;
  /** Trades avec R:R prévu et R:R réel — dénominateur du taux de respect */
  tradesWithBothRr: number;
  longPercentage: number | null;
  shortPercentage: number | null;
  hourly: HourlyPerformanceRow[];
  weekday: WeekdayPerformanceRow[];
  weekly: WeeklyPerformanceRow[];
  durationBuckets: DurationBucketPerformanceRow[];
  monthlyPerformance: Array<{ month: string; pnl: number }>;
  timezone: string;
}

export interface BuildBehaviorNarrativeInput {
  context: BehaviorNarrativeContext;
  t: (key: string, options?: Record<string, unknown>) => string;
  formatNumber: (value: number, digits?: number) => string;
  formatCurrency: (value: number, currencySymbol?: string) => string;
  formatDate: (isoDate: string) => string;
  currencySymbol: string;
}

export const BEHAVIOR_NARRATIVE_MIN_TRADES = 10;
export const BEHAVIOR_NARRATIVE_MIN_TRADES_PER_HOUR = 3;
export const BEHAVIOR_NARRATIVE_MIN_STREAK_WINS = 5;
export const BEHAVIOR_NARRATIVE_SWEET_SPOT_MIN_TRADES = 5;
export const BEHAVIOR_NARRATIVE_LOW_VOLUME_BUCKET = 10;
export const BEHAVIOR_NARRATIVE_MIN_PLANNED_RR_TRADES = 10;
export const BEHAVIOR_NARRATIVE_POST_SIZING_MIN_SAMPLE = 5;
export const OVERTRADING_TRADES_PER_DAY_THRESHOLD = 10;
export const HEALTHY_TRADES_PER_DAY_MIN = 3;
export const HEALTHY_TRADES_PER_DAY_MAX = 5;
