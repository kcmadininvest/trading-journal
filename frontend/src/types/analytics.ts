/**
 * Types TypeScript pour les modèles d'analyse statistique des trades.
 */

// Enums et types de base

export type TrendType = 'bullish' | 'bearish' | 'ranging' | 'unclear';

export type FibonacciLevel = '23.6' | '38.2' | '50' | '61.8' | '78.6' | 'none';

export type MarketStructure = 'higher_highs' | 'lower_lows' | 'consolidation';

export type RangePosition = 'top_third' | 'middle_third' | 'bottom_third';

export type VolumeProfile = 'high' | 'medium' | 'low';

export type MacdSignal = 'bullish' | 'bearish' | 'neutral';

export type SetupCategory = 
  | 'pullback' 
  | 'breakout' 
  | 'reversal' 
  | 'continuation' 
  | 'range_bound' 
  | 'news_driven' 
  | 'scalp' 
  | 'other';

export type ChartPattern = 
  | 'double_top' 
  | 'double_bottom' 
  | 'head_shoulders' 
  | 'triangle' 
  | 'flag' 
  | 'wedge' 
  | 'channel' 
  | 'none';

export type SetupQuality = 'A' | 'B' | 'C' | 'D' | 'F';

export type EntryTiming = 'early' | 'optimal' | 'late' | 'missed';

export type TradingSession = 
  | 'asian' 
  | 'london' 
  | 'new_york' 
  | 'overlap_london_ny' 
  | 'after_hours';

export type NewsImpact = 'high' | 'medium' | 'low' | 'none';

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';

export type PhysicalState = 'rested' | 'tired' | 'sick' | 'optimal';

export type MentalState = 'focused' | 'distracted' | 'stressed' | 'confident';

export type StopLossDirection = 'tighter' | 'wider' | 'none';

export type ExitReason = 
  | 'take_profit_hit' 
  | 'stop_loss_hit' 
  | 'manual_exit' 
  | 'time_based' 
  | 'target_reached' 
  | 'setup_invalidated' 
  | 'emotional' 
  | 'news_event';

export type PreviousTradeResult = 'win' | 'loss' | 'breakeven' | 'first_trade_of_session';

export type TradeMotivation = 'setup_signal' | 'fomo' | 'revenge' | 'boredom' | 'recovery_attempt' | 'planned';

export type TimeInPosition = 'much_shorter' | 'shorter' | 'as_planned' | 'longer' | 'much_longer';

export type ExitEmotionalContext = 'neutral' | 'fear' | 'greed' | 'fomo' | 'discipline';

export type TagCategory = 'setup' | 'mistake' | 'market_condition' | 'strategy' | 'other';

export type FactorType = 'boolean' | 'categorical' | 'numerical';

// Interfaces pour les modèles

export interface TradeContext {
  id: number;
  trade: number;
  trend_m15: TrendType | null;
  trend_m5: TrendType | null;
  trend_h1: TrendType | null;
  trend_alignment: boolean | null;
  fibonacci_level: FibonacciLevel;
  at_support_resistance: boolean;
  distance_from_key_level: string | null;
  market_structure: MarketStructure | null;
  break_of_structure: boolean;
  within_previous_day_range: boolean;
  range_position: RangePosition | null;
  atr_percentile: number | null;
  volume_profile: VolumeProfile | null;
  at_volume_node: boolean;
  rsi_value: number | null;
  macd_signal: MacdSignal | null;
  created_at: string;
  updated_at: string;
}

export interface TradeSetup {
  id: number;
  trade: number;
  setup_category: SetupCategory;
  setup_subcategory: string;
  chart_pattern: ChartPattern;
  confluence_factors: string[];
  confluence_count: number;
  setup_quality: SetupQuality;
  setup_confidence: number | null;
  entry_timing: EntryTiming | null;
  created_at: string;
  updated_at: string;
}

export interface SessionContext {
  id: number;
  trade: number;
  trading_session: TradingSession;
  session_time_slot: string;
  news_event: boolean;
  news_impact: NewsImpact;
  news_description: string;
  day_of_week: DayOfWeek;
  is_first_trade_of_day: boolean;
  is_last_trade_of_day: boolean;
  physical_state: PhysicalState | null;
  mental_state: MentalState | null;
  hours_of_sleep: number | null;
  created_at: string;
  updated_at: string;
}

export interface TradeExecution {
  id: number;
  trade: number;
  followed_trading_plan: boolean | null;
  entry_as_planned: boolean;
  exit_as_planned: boolean;
  position_size_as_planned: boolean;
  moved_stop_loss: boolean;
  stop_loss_direction: StopLossDirection;
  partial_exit_taken: boolean;
  partial_exit_percentage: string | null;
  exit_reason: ExitReason | null;
  execution_errors: string[];
  slippage_points: string | null;
  would_take_again: boolean | null;
  lesson_learned: string;
  created_at: string;
  updated_at: string;
}

export interface TradeProbabilityFactor {
  id: number;
  factor_category: string;
  factor_name: string;
  factor_type: FactorType;
  possible_values: string[];
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TradeTag {
  id: number;
  user: number;
  name: string;
  color: string;
  category: TagCategory;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface TradeTagAssignment {
  id: number;
  trade: number;
  tag: number;
  tag_details?: TradeTag;
  created_at: string;
}

export interface TradeStatistics {
  id: number;
  user: number;
  trading_account: number | null;
  filter_criteria: Record<string, any>;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: string;
  average_win: string;
  average_loss: string;
  profit_factor: string | null;
  expectancy: string;
  largest_win: string;
  largest_loss: string;
  average_duration: string | null;
  calculated_at: string;
  created_at: string;
}

export interface ConditionalProbability {
  id: number;
  user: number;
  condition_set: Record<string, any>;
  sample_size: number;
  win_rate: string;
  average_rr: string | null;
  expectancy: string;
  confidence_interval: string | null;
  is_statistically_significant: boolean;
  calculated_at: string;
  created_at: string;
}

// Types pour les requêtes et réponses API

export interface CalculateStatisticsRequest {
  filters?: Record<string, any>;
  trading_account_id?: number;
}

export interface ConditionalProbabilityRequest {
  conditions: Record<string, any>;
  min_sample_size?: number;
}

export interface CompareConditionsRequest {
  condition_a: Record<string, any>;
  condition_b: Record<string, any>;
}

export interface BulkCreateAnalyticsRequest {
  trade_id: number;
  context?: Partial<Omit<TradeContext, 'id' | 'trade' | 'created_at' | 'updated_at'>>;
  setup?: Partial<Omit<TradeSetup, 'id' | 'trade' | 'created_at' | 'updated_at'>>;
  session_context?: Partial<Omit<SessionContext, 'id' | 'trade' | 'created_at' | 'updated_at'>>;
  execution?: Partial<Omit<TradeExecution, 'id' | 'trade' | 'created_at' | 'updated_at'>>;
  tag_ids?: number[];
}

export interface BestSetup {
  setup_category: SetupCategory;
  setup_quality: SetupQuality;
  sample_size: number;
  expectancy: string;
  total_pnl: string;
  win_rate: number;
}

export interface WorstPattern {
  error: string;
  count: number;
  average_pnl: string;
}

export interface RecurringPattern {
  pattern: string;
  count: number;
  win_rate: string;
  expectancy: string;
}

export interface BehavioralBias {
  bias: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  recommendation: string;
}

export interface SimilarTrade {
  id: number;
  contract_name: string;
  entered_at: string;
  net_pnl: string;
  similarity_score: number;
}

export interface EdgeAnalysis {
  global_statistics: {
    total_trades: number;
    win_rate: string;
    expectancy: string;
    profit_factor: string | null;
  };
  best_setups: BestSetup[];
  worst_patterns: WorstPattern[];
  trend_analysis: Array<{
    trend: TrendType;
    sample_size: number;
    win_rate: string;
    expectancy: string;
  }>;
  session_analysis: Array<{
    session: TradingSession;
    sample_size: number;
    win_rate: string;
    expectancy: string;
  }>;
}

export interface ConditionComparison {
  condition_a: {
    conditions: Record<string, any>;
    sample_size: number;
    win_rate: string;
    expectancy: string;
    is_significant: boolean;
  };
  condition_b: {
    conditions: Record<string, any>;
    sample_size: number;
    win_rate: string;
    expectancy: string;
    is_significant: boolean;
  };
  comparison: {
    win_rate_diff: string;
    expectancy_diff: string;
    better_condition: 'A' | 'B';
  };
}

// Types pour les formulaires

export interface TradeContextFormData {
  trend_m1?: TrendType;
  trend_m2?: TrendType;
  trend_m5?: TrendType;
  trend_m15?: TrendType;
  trend_m30?: TrendType;
  trend_h1?: TrendType;
  trend_h4?: TrendType;
  trend_daily?: TrendType;
  trend_weekly?: TrendType;
  fibonacci_level?: FibonacciLevel;
  at_support_resistance?: boolean;
  distance_from_key_level?: number;
  market_structure?: MarketStructure;
  break_of_structure?: boolean;
  within_previous_day_range?: boolean;
  range_position?: RangePosition;
  atr_percentile?: number;
  volume_profile?: VolumeProfile;
  at_volume_node?: boolean;
  rsi_value?: number;
  macd_signal?: MacdSignal;
}

export interface TradeSetupFormData {
  setup_category: SetupCategory;
  setup_subcategory?: string;
  chart_pattern?: ChartPattern;
  confluence_factors?: string[];
  setup_quality: SetupQuality;
  setup_confidence?: number;
  entry_timing?: EntryTiming;
  // Nouveaux champs pour biais comportementaux
  entry_in_range_percentage?: number;
  missed_better_entry?: boolean;
  planned_hold_duration?: number;
}

export interface NewsEvent {
  impact: NewsImpact;
  description: string;
}

export interface SessionContextFormData {
  trading_session: TradingSession;
  session_time_slot?: string;
  news_events?: NewsEvent[];
  day_of_week: DayOfWeek;
  is_first_trade_of_day?: boolean;
  is_last_trade_of_day?: boolean;
  physical_state?: PhysicalState;
  mental_state?: MentalState;
  hours_of_sleep?: number;
  // Nouveaux champs pour biais comportementaux
  previous_trade_result?: PreviousTradeResult;
  minutes_since_last_trade?: number;
  trade_motivation?: TradeMotivation;
}

export interface TradeExecutionFormData {
  entry_as_planned?: boolean;
  exit_as_planned?: boolean;
  position_size_as_planned?: boolean;
  moved_stop_loss?: boolean;
  stop_loss_direction?: StopLossDirection;
  partial_exit_taken?: boolean;
  partial_exit_percentage?: number;
  exit_reason?: ExitReason;
  execution_errors?: string[];
  slippage_points?: number;
  would_take_again?: boolean;
  lesson_learned?: string;
  // Nouveaux champs pour biais comportementaux
  time_in_position_vs_planned?: TimeInPosition;
  exit_emotional_context?: ExitEmotionalContext;
  position_size_change_reason?: string;
}

// Types pour les seuils de détection des biais comportementaux

export interface OvertradingThresholds {
  min_days: number;
  min_trades_per_day: number;
  high_severity_threshold: number;
}

export interface RevengeTradingThresholds {
  min_occurrences: number;
  quick_trade_minutes: number;
}

export interface FomoThresholds {
  min_occurrences: number;
  entry_range_threshold: number;
}

export interface LossAversionThresholds {
  min_occurrences: number;
}

export interface PrematureExitThresholds {
  min_occurrences: number;
  rr_threshold: number;
}

export interface StopLossWideningThresholds {
  min_occurrences: number;
}

export interface BiasThresholds {
  overtrading: OvertradingThresholds;
  revenge_trading: RevengeTradingThresholds;
  fomo: FomoThresholds;
  loss_aversion: LossAversionThresholds;
  premature_exit: PrematureExitThresholds;
  stop_loss_widening: StopLossWideningThresholds;
}

export interface BiasThresholdsResponse {
  thresholds: BiasThresholds;
  defaults: BiasThresholds;
  custom: Partial<BiasThresholds>;
}
