import { getApiBaseUrl } from '../utils/apiConfig';

export interface TradeListItem {
  id: number;
  topstep_id: string;
  trading_account: number;
  trading_account_name: string;
  contract_name: string;
  trade_type: 'Long' | 'Short';
  entered_at: string; // ISO
  exited_at: string | null;
  entry_price: string;
  exit_price: string | null;
  size: string;
  point_value: string | null;
  fees: string;
  commissions: string;
  pnl: string | null;
  net_pnl: string | null;
  pnl_percentage: string | null;
  is_profitable: boolean | null;
  trade_duration: string | null;
  duration_str: string | null;
  trade_day: string | null; // YYYY-MM-DD
  position_strategy: number | null;
  position_strategy_title: string | null;
  planned_stop_loss: string | null;
  planned_take_profit: string | null;
  planned_risk_reward_ratio: string | null;
  actual_risk_reward_ratio: string | null;
}

export interface TradeDetail extends TradeListItem {
  user: number;
  user_username: string;
  trading_account_type: string;
  notes: string;
  strategy: string;
  position_strategy: number | null;
  position_strategy_title: string | null;
  formatted_entry_date: string;
  formatted_exit_date: string | null;
  imported_at: string;
  updated_at: string;
}

export interface TradesFilters {
  trading_account?: number;
  contract?: string;
  type?: 'Long' | 'Short';
  start_date?: string; // YYYY-MM-DD
  end_date?: string;   // YYYY-MM-DD
  profitable?: 'true' | 'false';
  has_strategy?: 'true' | 'false';
  trade_day?: string;  // YYYY-MM-DD
  page?: number;
  page_size?: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

class TradesService {
  private readonly BASE_URL = getApiBaseUrl();

  private getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
      'Authorization': `Bearer ${token}`,
      // Content-Type is set per-request (JSON vs multipart)
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

  private async fetchWithAuth(input: string, init: RequestInit = {}, retry = true): Promise<Response> {
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string> || {}),
      ...this.getAuthHeaders(),
    };
    const res = await fetch(input, { ...init, headers });
    if (res.status === 401 && retry) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        const headers2: Record<string, string> = {
          ...(init.headers as Record<string, string> || {}),
          ...this.getAuthHeaders(),
        };
        return fetch(input, { ...init, headers: headers2 });
      }
    }
    return res;
  }

  private toQuery(params: Record<string, any>) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      // Exclure les valeurs undefined, null, '' et 0 pour trading_account (0 signifie "tous les comptes")
      if (v !== undefined && v !== null && v !== '') {
        // Pour trading_account, ne pas inclure si c'est 0 (tous les comptes)
        if (k === 'trading_account' && v === 0) {
          return; // Ne pas ajouter ce paramètre
        }
        search.append(k, String(v));
      }
    });
    return search.toString();
  }

  async list(filters: TradesFilters = {}): Promise<PaginatedResponse<TradeListItem>> {
    const qs = this.toQuery(filters as any);
    const url = `${this.BASE_URL}/api/trades/topstep/${qs ? `?${qs}` : ''}`;
    const res = await this.fetchWithAuth(url);
    if (!res.ok) throw new Error('Erreur lors du chargement des trades');
    return res.json();
  }

  async dailyAggregates(filters: { trading_account?: number; start_date?: string; end_date?: string }): Promise<{
    results: Array<{
      date: string;
      pnl: number;
      trade_count: number;
      winning_count: number;
      losing_count: number;
    }>;
    count: number;
  }> {
    const qs = this.toQuery(filters as any);
    const url = `${this.BASE_URL}/api/trades/topstep/daily_aggregates/${qs ? `?${qs}` : ''}`;
    const res = await this.fetchWithAuth(url);
    if (!res.ok) throw new Error('Erreur lors du chargement des données agrégées');
    return res.json();
  }

  async instruments(tradingAccount?: number | null): Promise<string[]> {
    const qs = tradingAccount ? `?trading_account=${tradingAccount}` : '';
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/topstep/instruments/${qs}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.instruments || [];
  }

  async retrieve(id: number): Promise<TradeDetail> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/topstep/${id}/`);
    if (!res.ok) throw new Error('Erreur lors de la récupération du trade');
    return res.json();
  }

  async create(payload: Partial<TradeDetail>): Promise<TradeDetail> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/topstep/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Erreur lors de la création du trade');
    }
    return res.json();
  }

  async update(id: number, payload: Partial<TradeDetail>): Promise<TradeDetail> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/topstep/${id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Erreur lors de la mise à jour du trade');
    }
    return res.json();
  }

  async remove(id: number): Promise<void> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/topstep/${id}/`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Erreur lors de la suppression du trade');
  }

  async statistics(filters: TradesFilters = {}): Promise<{
    total_trades: number;
    total_pnl: number; // net
    total_raw_pnl?: number;
    total_fees: number;
  }> {
    const qs = this.toQuery(filters as any);
    const url = `${this.BASE_URL}/api/trades/topstep/statistics/${qs ? `?${qs}` : ''}`;
    const res = await this.fetchWithAuth(url);
    if (!res.ok) throw new Error('Erreur lors du chargement des statistiques');
    const data = await res.json();
    return {
      total_trades: data.total_trades ?? 0,
      total_pnl: typeof data.total_pnl === 'number' ? data.total_pnl : parseFloat(String(data.total_pnl || 0)),
      total_raw_pnl: typeof data.total_raw_pnl === 'number' ? data.total_raw_pnl : parseFloat(String(data.total_raw_pnl || 0)),
      total_fees: typeof data.total_fees === 'number' ? data.total_fees : parseFloat(String(data.total_fees || 0)),
    };
  }

  async uploadCSV(file: File, trading_account?: number, dryRun = false): Promise<{
    success: boolean;
    message?: string;
    error?: string;
    total_rows?: number;
    success_count?: number;
    error_count?: number;
    skipped_count?: number;
    errors?: Array<{ row?: number; error: string }>;
    missing_columns?: string[];
    total_pnl?: number;
    total_fees?: number;
  }> {
    const form = new FormData();
    form.append('file', file);
    if (trading_account !== undefined && trading_account !== null) {
      form.append('trading_account', String(trading_account));
    }
    if (dryRun) {
      form.append('dry_run', 'true');
    }
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/topstep/upload_csv/`, {
      method: 'POST',
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || 'Erreur lors de l\'upload du fichier');
    }
    return data;
  }

  async detailedStatistics(
    tradingAccountId?: number, 
    year?: number | null, 
    month?: number | null,
    startDate?: string | null,
    endDate?: string | null
  ): Promise<{
    total_trades: number;
    winning_trades: number;
    losing_trades: number;
    win_rate: number;
    total_pnl: string;
    total_gains: string;
    total_losses: string;
    average_pnl: string;
    best_trade: string;
    worst_trade: string;
    total_fees: string;
    total_volume: string;
    average_duration: string;
    most_traded_contract: string | null;
    profit_factor: number;
    win_loss_ratio: number;
    consistency_ratio: number;
    max_runup?: number;
    max_runup_pct?: number;
    max_runup_global?: number;
    max_runup_global_pct?: number;
    recovery_ratio: number;
    pnl_per_trade: number;
    fees_ratio: number;
    volume_pnl_ratio: number;
    frequency_ratio: number;
    duration_ratio: number;
    recovery_time: number;
    max_drawdown: number;
    max_drawdown_pct: number;
    max_drawdown_global: number;
    max_drawdown_global_pct: number;
    expectancy: number;
    break_even_trades: number;
    sharpe_ratio: number;
    sortino_ratio: number;
    calmar_ratio: number;
    trade_efficiency: number;
    current_winning_streak_days: number;
    avg_planned_rr: number;
    avg_actual_rr: number;
    trades_with_planned_rr: number;
    trades_with_actual_rr: number;
    trades_with_both_rr: number;
    plan_respect_rate: number;
  }> {
    const queryParams = new URLSearchParams();
    if (tradingAccountId) {
      queryParams.append('trading_account', String(tradingAccountId));
    }
    
    // Ajouter les filtres de date si fournis (priorité à startDate/endDate)
    if (startDate && endDate) {
      queryParams.append('start_date', startDate);
      queryParams.append('end_date', endDate);
    } else if (year) {
      const calculatedStartDate = month 
        ? `${year}-${month.toString().padStart(2, '0')}-01`
        : `${year}-01-01`;
      
      let calculatedEndDate: string;
      if (month) {
        // Calculer le dernier jour du mois sélectionné
        const lastDay = new Date(year, month, 0);
        const yearStr = lastDay.getFullYear();
        const monthStr = String(lastDay.getMonth() + 1).padStart(2, '0');
        const dayStr = String(lastDay.getDate()).padStart(2, '0');
        calculatedEndDate = `${yearStr}-${monthStr}-${dayStr}`;
      } else {
        calculatedEndDate = `${year}-12-31`;
      }
      
      queryParams.append('start_date', calculatedStartDate);
      queryParams.append('end_date', calculatedEndDate);
    }
    
    const qs = queryParams.toString();
    const url = `${this.BASE_URL}/api/trades/topstep/statistics/${qs ? `?${qs}` : ''}`;
    const res = await this.fetchWithAuth(url);
    if (!res.ok) throw new Error('Erreur lors du chargement des statistiques détaillées');
    return res.json();
  }

  async analytics(
    tradingAccountId?: number, 
    year?: number | null, 
    month?: number | null,
    startDate?: string | null,
    endDate?: string | null
  ): Promise<{
    daily_stats: {
      avg_gain_per_day: number;
      median_gain_per_day: number;
      avg_loss_per_day: number;
      median_loss_per_day: number;
      max_gain_per_day: number;
      max_loss_per_day: number;
      avg_trades_per_day: number;
      median_trades_per_day: number;
      days_with_profit: number;
      days_with_loss: number;
      days_break_even: number;
      best_day: string | null;
      best_day_pnl: number;
      worst_day: string | null;
      worst_day_pnl: number;
    };
    trade_stats: {
      max_gain_per_trade: number;
      max_loss_per_trade: number;
      avg_winning_trade: number;
      median_winning_trade: number;
      avg_losing_trade: number;
      median_losing_trade: number;
      avg_duration_winning_trade: string;
      avg_duration_losing_trade: string;
    };
    consecutive_stats: {
      max_consecutive_wins_per_day: number;
      max_consecutive_losses_per_day: number;
      max_consecutive_wins: number;
      max_consecutive_losses: number;
    };
    trade_type_stats: {
      long_percentage: number;
      short_percentage: number;
      long_count: number;
      short_count: number;
    };
    monthly_performance: Array<{
      month: string;
      pnl: number;
    }>;
  }> {
    const queryParams = new URLSearchParams();
    if (tradingAccountId) {
      queryParams.append('trading_account', String(tradingAccountId));
    }
    
    // Ajouter les filtres de date si fournis (priorité à startDate/endDate)
    if (startDate && endDate) {
      queryParams.append('start_date', startDate);
      queryParams.append('end_date', endDate);
    } else if (year) {
      const calculatedStartDate = month 
        ? `${year}-${month.toString().padStart(2, '0')}-01`
        : `${year}-01-01`;
      
      let calculatedEndDate: string;
      if (month) {
        // Calculer le dernier jour du mois sélectionné
        const lastDay = new Date(year, month, 0);
        const yearStr = lastDay.getFullYear();
        const monthStr = String(lastDay.getMonth() + 1).padStart(2, '0');
        const dayStr = String(lastDay.getDate()).padStart(2, '0');
        calculatedEndDate = `${yearStr}-${monthStr}-${dayStr}`;
      } else {
        calculatedEndDate = `${year}-12-31`;
      }
      
      queryParams.append('start_date', calculatedStartDate);
      queryParams.append('end_date', calculatedEndDate);
    }
    
    const qs = queryParams.toString();
    const url = `${this.BASE_URL}/api/trades/topstep/analytics/${qs ? `?${qs}` : ''}`;
    const res = await this.fetchWithAuth(url);
    if (!res.ok) throw new Error('Erreur lors du chargement des analytics');
    return res.json();
  }

  async bulkAssignStrategy(tradeIds: number[], positionStrategyId: number | null): Promise<{
    success: boolean;
    updated_count: number;
    message: string;
  }> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/topstep/bulk_assign_strategy/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trade_ids: tradeIds,
        position_strategy_id: positionStrategyId,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de l\'assignation de la stratégie');
    }
    return res.json();
  }

  async getAllIds(filters: TradesFilters): Promise<number[]> {
    const query = this.toQuery({
      ...filters,
      page_size: 10000, // Récupérer tous les trades
    });
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/topstep/?${query}`);
    if (!res.ok) throw new Error('Erreur lors de la récupération des IDs');
    const data = await res.json();
    return data.results.map((trade: TradeListItem) => trade.id);
  }
}

export const tradesService = new TradesService();


