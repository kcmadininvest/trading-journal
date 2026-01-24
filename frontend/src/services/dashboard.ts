import { getApiBaseUrl } from '../utils/apiConfig';

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

export interface DashboardSummary {
  daily_aggregates: DailyAggregate[];
  trades: any[];
  compliance_stats: ComplianceStats | null;
  count: number;
}

export interface DashboardFilters {
  trading_account?: number;
  start_date?: string;
  end_date?: string;
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

    const url = `${this.baseUrl}/api/trades/dashboard-summary/?${params.toString()}`;
    const response = await this.fetchWithAuth(url);
    return response.json();
  }
}

export const dashboardService = new DashboardService();
