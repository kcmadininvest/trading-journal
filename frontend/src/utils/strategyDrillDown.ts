export const STRATEGY_DRILL_DOWN_PAGE_SIZE = 10;

export interface StrategyPeriodContext {
  start_date?: string;
  end_date?: string;
  trading_account?: number | null;
  position_strategy?: number | null;
}

export interface StrategyDrillDownFilters {
  strategy_respected?: boolean;
  strategy_respected__isnull?: boolean;
  gain_if_strategy_respected?: boolean;
  gain_if_strategy_respected__isnull?: boolean;
  dominant_emotion?: string;
  trade_day?: string;
  start_date?: string;
  end_date?: string;
  trade_weekday?: number;
  winning_session?: 'tp1' | 'tp2_plus' | 'no_tp';
}

export type StrategyChartDrillDownPayload =
  | { type: 'compliance_day'; date: string }
  | {
      type: 'respect';
      respected: boolean;
      trade_day?: string;
      start_date?: string;
      end_date?: string;
    }
  | { type: 'emotion'; emotion: string }
  | { type: 'weekday'; dayIndex: number }
  | { type: 'winning_session'; bucket: 'tp1' | 'tp2_plus' | 'no_tp' }
  | { type: 'period_range'; start_date: string; end_date: string };

export interface StrategyDrillDownRequest {
  title: string;
  filters: StrategyDrillDownFilters;
}

export function resolveStrategiesPeriodDates(ctx: {
  selectedPeriod: { start: string; end: string } | null;
  selectedYear: number | null;
  selectedMonth: number | null;
}): Pick<StrategyPeriodContext, 'start_date' | 'end_date'> {
  if (ctx.selectedPeriod) {
    return { start_date: ctx.selectedPeriod.start, end_date: ctx.selectedPeriod.end };
  }
  if (ctx.selectedYear) {
    const year = ctx.selectedYear;
    if (ctx.selectedMonth) {
      const month = ctx.selectedMonth;
      const lastDay = new Date(year, month, 0);
      return {
        start_date: `${year}-${String(month).padStart(2, '0')}-01`,
        end_date: `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`,
      };
    }
    return { start_date: `${year}-01-01`, end_date: `${year}-12-31` };
  }
  return {};
}

export function mergeDrillDownQuery(
  period: StrategyPeriodContext,
  filters: StrategyDrillDownFilters
): Record<string, string> {
  const params: Record<string, string> = {};
  const startDate = filters.start_date ?? (filters.trade_day ? undefined : period.start_date);
  const endDate = filters.end_date ?? (filters.trade_day ? undefined : period.end_date);
  if (startDate && !filters.trade_day) {
    params.start_date = startDate;
  }
  if (endDate && !filters.trade_day) {
    params.end_date = endDate;
  }
  if (period.trading_account != null) {
    params.trading_account = String(period.trading_account);
  }
  if (period.position_strategy != null) {
    params.position_strategy = String(period.position_strategy);
  }
  if (filters.trade_day) {
    params.trade_day = filters.trade_day;
  }
  if (filters.strategy_respected != null) {
    params.strategy_respected = filters.strategy_respected ? 'true' : 'false';
  }
  if (filters.strategy_respected__isnull === true) {
    params.strategy_respected__isnull = 'true';
  } else if (filters.strategy_respected__isnull === false) {
    params.strategy_respected__isnull = 'false';
  }
  if (filters.gain_if_strategy_respected != null) {
    params.gain_if_strategy_respected = filters.gain_if_strategy_respected ? 'true' : 'false';
  }
  if (filters.gain_if_strategy_respected__isnull === true) {
    params.gain_if_strategy_respected__isnull = 'true';
  } else if (filters.gain_if_strategy_respected__isnull === false) {
    params.gain_if_strategy_respected__isnull = 'false';
  }
  if (filters.dominant_emotion) {
    params.dominant_emotion = filters.dominant_emotion;
  }
  if (filters.trade_weekday != null) {
    params.trade_weekday = String(filters.trade_weekday);
  }
  if (filters.winning_session) {
    params.winning_session = filters.winning_session;
  }
  return params;
}
