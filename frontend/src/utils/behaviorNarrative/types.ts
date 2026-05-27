import type { DurationBucketPerformanceRow } from '../tradeDurationBuckets';

export type NarrativeTone = 'excellent' | 'positive' | 'mixed' | 'challenging';

export type NarrativeSectionId =
  | 'intro'
  | 'strengths'
  | 'alerts'
  | 'timeWindows'
  | 'duration'
  | 'trajectory';

export interface NarrativeSection {
  id: NarrativeSectionId;
  titleKey?: string;
  paragraphs: string[];
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

export interface BehaviorNarrativeContext {
  tradeCount: number;
  profitFactor: number | null;
  sharpeAnnualized: number | null;
  expectancy: number;
  winRate: number;
  tone: NarrativeTone;
  trajectoryProgression: boolean;
  trajectoryVolatile: boolean;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
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
  currencySymbol: string;
}

export const BEHAVIOR_NARRATIVE_MIN_TRADES = 10;
export const BEHAVIOR_NARRATIVE_MIN_TRADES_PER_HOUR = 3;
export const BEHAVIOR_NARRATIVE_MIN_STREAK_WINS = 5;
export const BEHAVIOR_NARRATIVE_SWEET_SPOT_MIN_TRADES = 5;
export const BEHAVIOR_NARRATIVE_LOW_VOLUME_BUCKET = 10;
