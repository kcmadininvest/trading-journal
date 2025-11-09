import { getApiBaseUrl } from '../utils/apiConfig';

export interface TradingGoal {
  id: number;
  user: number;
  user_username?: string;
  goal_type: 'pnl_total' | 'win_rate' | 'trades_count' | 'profit_factor' | 'max_drawdown' | 'strategy_respect' | 'winning_days';
  period_type: 'monthly' | 'quarterly' | 'yearly' | 'custom';
  target_value: string | number;
  current_value: string | number;
  start_date: string;
  end_date: string;
  status: 'active' | 'achieved' | 'failed' | 'cancelled';
  trading_account?: number | null;
  trading_account_name?: string | null;
  priority: number;
  notes?: string;
  progress_percentage?: number;
  remaining_days?: number;
  is_overdue?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface GoalProgress {
  current_value: string | number;
  percentage: number;
  status: string;
  remaining_days: number;
  remaining_amount: string | number;
}

export interface GoalStatistics {
  total_goals: number;
  active_goals: number;
  achieved_goals: number;
  failed_goals: number;
  goals_by_type: Record<string, number>;
  goals_by_period: Record<string, number>;
}

export interface GoalsFilters {
  status?: string;
  period_type?: string;
  trading_account?: number;
}

class GoalsService {
  private readonly BASE_URL = getApiBaseUrl();

  private getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    } as Record<string, string>;
  }

  private async refreshAccessToken(): Promise<boolean> {
    const refresh = localStorage.getItem('refresh_token');
    if (!refresh) return false;
    try {
      const res = await fetch(`${this.BASE_URL}/api/accounts/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh })
      });
      if (!res.ok) return false;
      const data = await res.json();
      const newAccess = data.access as string | undefined;
      if (newAccess) {
        localStorage.setItem('access_token', newAccess);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    let res = await fetch(url, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers,
      },
    });

    if (res.status === 401) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        res = await fetch(url, {
          ...options,
          headers: {
            ...this.getAuthHeaders(),
            ...options.headers,
          },
        });
      }
    }

    return res;
  }

  async list(filters?: GoalsFilters): Promise<TradingGoal[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.period_type) params.append('period_type', filters.period_type);
    if (filters?.trading_account) params.append('trading_account', filters.trading_account.toString());
    // Désactiver la pagination pour récupérer tous les objectifs
    params.append('page_size', '10000');

    const url = `${this.BASE_URL}/api/trades/goals/${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await this.fetchWithAuth(url);

    if (!res.ok) {
      throw new Error(`Failed to fetch goals: ${res.statusText}`);
    }

    const data = await res.json();
    // Gérer la réponse paginée (DRF retourne {results: [], count: ...}) ou un tableau direct
    return Array.isArray(data) ? data : (data.results || []);
  }

  async get(id: number): Promise<TradingGoal> {
    const url = `${this.BASE_URL}/api/trades/goals/${id}/`;
    const res = await this.fetchWithAuth(url);

    if (!res.ok) {
      throw new Error(`Failed to fetch goal: ${res.statusText}`);
    }

    return res.json();
  }

  async create(data: Partial<TradingGoal>): Promise<TradingGoal> {
    const url = `${this.BASE_URL}/api/trades/goals/`;
    const res = await this.fetchWithAuth(url, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || `Failed to create goal: ${res.statusText}`);
    }

    return res.json();
  }

  async update(id: number, data: Partial<TradingGoal>): Promise<TradingGoal> {
    const url = `${this.BASE_URL}/api/trades/goals/${id}/`;
    const res = await this.fetchWithAuth(url, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || `Failed to update goal: ${res.statusText}`);
    }

    return res.json();
  }

  async delete(id: number): Promise<void> {
    const url = `${this.BASE_URL}/api/trades/goals/${id}/`;
    const res = await this.fetchWithAuth(url, {
      method: 'DELETE',
    });

    if (!res.ok) {
      throw new Error(`Failed to delete goal: ${res.statusText}`);
    }
  }

  async getProgress(id: number): Promise<GoalProgress> {
    const url = `${this.BASE_URL}/api/trades/goals/${id}/progress/`;
    const res = await this.fetchWithAuth(url);

    if (!res.ok) {
      throw new Error(`Failed to fetch goal progress: ${res.statusText}`);
    }

    return res.json();
  }

  async updateAllProgress(): Promise<{ message: string; updated_count: number }> {
    const url = `${this.BASE_URL}/api/trades/goals/update_all_progress/`;
    const res = await this.fetchWithAuth(url, {
      method: 'POST',
    });

    if (!res.ok) {
      throw new Error(`Failed to update all goals progress: ${res.statusText}`);
    }

    return res.json();
  }

  async getStatistics(): Promise<GoalStatistics> {
    const url = `${this.BASE_URL}/api/trades/goals/statistics/`;
    const res = await this.fetchWithAuth(url);

    if (!res.ok) {
      throw new Error(`Failed to fetch goals statistics: ${res.statusText}`);
    }

    return res.json();
  }
}

export const goalsService = new GoalsService();

