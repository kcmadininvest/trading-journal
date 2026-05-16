import { getApiBaseUrl } from '../utils/apiConfig';
import type { PnlDisplayMode } from '../utils/pnlDisplay';

export interface DailyAggregate {
  date: string;
  pnl: number;
  trade_count: number;
  winning_count: number;
  losing_count: number;
}

export interface ComplianceStats {
  current_streak: number;
  best_streak: number;
  current_streak_start: string | null;
  next_badge: any;
}

export interface PeriodPerformanceEntry {
  pnl: number;
  previous_pnl: number;
  change_pct: number | null;
  return_on_capital_pct: number | null;
}

export interface PeriodPerformance {
  day: PeriodPerformanceEntry;
  week: PeriodPerformanceEntry;
  month: PeriodPerformanceEntry;
}

export interface DashboardSummary {
  daily_aggregates: DailyAggregate[];
  trades: any[];
  strategies: any[];
  compliance_stats: ComplianceStats | null;
  active_days?: number;
  count: number;
  period_performance?: PeriodPerformance;
}

export interface DashboardActivitySummary {
  total_positions: number;
  active_days: number;
}

export interface DashboardFilters {
  trading_account?: number;
  start_date?: string;
  end_date?: string;
  position_strategy?: number;
  pnl_display?: PnlDisplayMode;
}

class DashboardService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getApiBaseUrl();
  }

  private async fetchWithAuth(url: string): Promise<Response> {
    const token = localStorage.getItem('access_token');
    const response = await fetch(url, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
  }

  async getSummary(filters: DashboardFilters = {}): Promise<DashboardSummary> {
    const params = new URLSearchParams();
    
    if (filters.trading_account) {
      params.append('trading_account', filters.trading_account.toString());
    }
    if (filters.start_date) {
      params.append('start_date', filters.start_date);
    }
    if (filters.end_date) {
      params.append('end_date', filters.end_date);
    }
    if (filters.position_strategy) {
      params.append('position_strategy', filters.position_strategy.toString());
    }
    if (filters.pnl_display) {
      params.append('pnl_display', filters.pnl_display);
    }

    const url = `${this.baseUrl}/api/trades/dashboard-summary/?${params.toString()}`;
    const response = await this.fetchWithAuth(url);
    return response.json();
  }

  async getActivitySummary(filters: DashboardFilters = {}): Promise<DashboardActivitySummary> {
    const params = new URLSearchParams();

    if (filters.trading_account) {
      params.append('trading_account', filters.trading_account.toString());
    }
    if (filters.start_date) {
      params.append('start_date', filters.start_date);
    }
    if (filters.end_date) {
      params.append('end_date', filters.end_date);
    }
    if (filters.position_strategy) {
      params.append('position_strategy', filters.position_strategy.toString());
    }
    if (filters.pnl_display) {
      params.append('pnl_display', filters.pnl_display);
    }

    const url = `${this.baseUrl}/api/trades/dashboard-activity-summary/?${params.toString()}`;

    try {
      const response = await this.fetchWithAuth(url);
      return response.json();
    } catch {
      // Fallback de compatibilité : si l'endpoint léger n'est pas disponible,
      // reconstruire les compteurs à partir de dashboard-summary.
      const summary = await this.getSummary(filters);
      const totalPositions = (summary.daily_aggregates || []).reduce(
        (sum, day) => sum + (day.trade_count || 0),
        0
      );
      return {
        total_positions: totalPositions,
        active_days: summary.active_days ?? 0,
      };
    }
  }
}

export const dashboardService = new DashboardService();
