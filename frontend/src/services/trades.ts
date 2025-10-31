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
  fees: string;
  commissions: string;
  pnl: string | null;
  net_pnl: string | null;
  pnl_percentage: string | null;
  is_profitable: boolean | null;
  trade_duration: string | null;
  duration_str: string | null;
  trade_day: string | null; // YYYY-MM-DD
}

export interface TradeDetail extends TradeListItem {
  user: number;
  user_username: string;
  trading_account_type: string;
  notes: string;
  strategy: string;
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
  private readonly BASE_URL = 'http://localhost:8000';

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
      if (v !== undefined && v !== null && v !== '') search.append(k, String(v));
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

  async instruments(): Promise<string[]> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/topstep/instruments/`);
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
}

export const tradesService = new TradesService();


