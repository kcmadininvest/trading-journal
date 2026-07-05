import { getApiBaseUrl } from '../utils/apiConfig';
import { authService } from './auth';

export interface TradingAccount {
  id: number;
  user: number;
  user_username?: string;
  name: string;
  account_type: 'topstep' | 'ibkr' | 'ninjatrader' | 'tradovate' | 'other';
  broker_account_id?: string;
  currency: string;
  initial_capital?: string | number | null;
  maximum_loss_limit?: string | number;
  mll_enabled?: boolean;
  profit_target?: string | number;
  profit_target_enabled?: boolean;
  status: 'active' | 'inactive' | 'archived';
  broker_config?: Record<string, any>;
  description?: string;
  is_default: boolean;
  /** Compte dont les imports CSV sont dupliqués ici (copy trading) */
  copy_imports_from?: number | null;
  /** Comptes actifs qui copient les imports de ce compte (lecture seule, API) */
  accounts_copying_this_one?: Array<{
    id: number;
    name: string;
    status: string;
    account_type: string;
  }>;
  trades_count?: number;
  is_topstep?: boolean;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

class TradingAccountsService {
  private readonly BASE_URL = getApiBaseUrl();

  private getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    } as Record<string, string>;
  }

  private async refreshAccessToken(): Promise<boolean> {
    const access = await authService.refreshAccessToken();
    return !!access;
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

  async list(params?: { include_inactive?: boolean; include_archived?: boolean; }): Promise<TradingAccount[]> {
    const qs = new URLSearchParams();
    if (params?.include_inactive) qs.set('include_inactive', 'true');
    if (params?.include_archived) qs.set('include_archived', 'true');
    const url = `${this.BASE_URL}/api/trades/trading-accounts/${qs.toString() ? `?${qs.toString()}` : ''}`;
    const res = await this.fetchWithAuth(url);
    if (!res.ok) throw new Error('Erreur lors du chargement des comptes');
    const data = await res.json();
    return Array.isArray(data) ? data : (data?.results ?? []);
  }

  async get(id: number): Promise<TradingAccount> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/trading-accounts/${id}/`);
    if (!res.ok) {
      const error: any = new Error('Erreur lors du chargement du compte');
      error.status = res.status;
      error.message = res.status === 404 ? 'Compte introuvable' : 'Erreur lors du chargement du compte';
      throw error;
    }
    return res.json();
  }

  async default(): Promise<TradingAccount | null> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/trading-accounts/default/`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Erreur lors de la récupération du compte par défaut');
    return res.json();
  }

  async setDefault(id: number): Promise<void> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/trading-accounts/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify({ is_default: true }),
    });
    if (!res.ok) throw new Error('Impossible de définir le compte par défaut');
  }

  async create(payload: Partial<TradingAccount>): Promise<TradingAccount> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/trading-accounts/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Erreur lors de la création du compte');
    return res.json();
  }

  async update(id: number, payload: Partial<TradingAccount>): Promise<TradingAccount> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/trading-accounts/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Erreur lors de la mise à jour du compte');
    return res.json();
  }

  async remove(id: number): Promise<void> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/trading-accounts/${id}/`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Erreur lors de la suppression du compte');
  }

  async getDailyMetrics(id: number, params?: { start_date?: string; end_date?: string }): Promise<AccountDailyMetric[]> {
    const qs = new URLSearchParams();
    if (params?.start_date) qs.set('start_date', params.start_date);
    if (params?.end_date) qs.set('end_date', params.end_date);
    const url = `${this.BASE_URL}/api/trades/trading-accounts/${id}/daily_metrics/${qs.toString() ? `?${qs.toString()}` : ''}`;
    const res = await this.fetchWithAuth(url);
    if (!res.ok) throw new Error('Erreur lors du chargement des métriques');
    return res.json();
  }

  async archive(id: number): Promise<TradingAccount> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/trading-accounts/${id}/archive/`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Erreur lors de l\'archivage du compte');
    return res.json();
  }

  async unarchive(id: number): Promise<TradingAccount> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/trading-accounts/${id}/unarchive/`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Erreur lors de la désarchivage du compte');
    return res.json();
  }

  async sync(id: number, options?: { full_resync?: boolean }): Promise<TradeSyncResponse> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/trading-accounts/${id}/sync/`, {
      method: 'POST',
      body: JSON.stringify(options ?? {}),
    });
    const body = await res.json();
    if (res.status === 429) {
      throw new Error(body?.error || 'Trop de synchronisations. Réessayez dans une minute.');
    }
    if (!res.ok) {
      const err = new Error(body?.error || 'Erreur lors de la synchronisation.') as Error & {
        errorCode?: string;
      };
      if (body?.error_code) {
        err.errorCode = body.error_code;
      }
      throw err;
    }
    return body as TradeSyncResponse;
  }

  async getSyncStatus(id: number): Promise<TradeSyncStatus> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/trades/trading-accounts/${id}/sync-status/`,
    );
    if (!res.ok) {
      throw new Error('Erreur lors du chargement du statut de synchronisation.');
    }
    return res.json();
  }

  async repairTopStepBrokerIds(): Promise<RepairTopStepBrokerIdsResponse> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/trades/trading-accounts/repair-topstep-broker-ids/`,
      { method: 'POST', body: JSON.stringify({}) },
    );
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body?.error || 'Erreur lors de la correction des ID broker TopStepX.');
    }
    return body as RepairTopStepBrokerIdsResponse;
  }

  async getBalanceSeries(
    accountId: number,
    params: { start_date?: string; end_date?: string; timezone?: string },
  ): Promise<{ points: Array<{ date: string; net_transactions: string }> }> {
    const queryParams = new URLSearchParams();
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);
    if (params.timezone) queryParams.append('timezone', params.timezone);
    const qs = queryParams.toString();
    const url = `${this.BASE_URL}/api/trades/trading-accounts/${accountId}/balance-series${qs ? `?${qs}` : ''}`;
    const res = await this.fetchWithAuth(url);
    if (!res.ok) {
      throw new Error('Erreur lors du chargement de la série de solde');
    }
    return res.json();
  }
}

export interface RepairTopStepBrokerIdsResponse {
  repaired_count: number;
  repaired: Array<{
    trading_account_id: number;
    name: string;
    old_broker_account_id: string | null;
    broker_account_id: string;
  }>;
}

export interface TradeSyncResponse {
  message: string;
  created: number;
  skipped: number;
  total_fetched: number;
  last_sync_at: string;
  errors: string[];
  status: TradeSyncStatus;
}

export interface TradeSyncStatus {
  broker_account_id?: string;
  last_sync_at?: string | null;
  integration_configured: boolean;
  integration_connected: boolean;
  /** true si un POST sync est recommandé (dernière sync > sync_stale_minutes). */
  should_sync?: boolean;
  sync_stale_minutes?: number;
  last_log?: {
    synced_at: string;
    created_count: number;
    skipped_count: number;
    total_fetched: number;
  } | null;
}

export interface AccountDailyMetric {
  id: number;
  trading_account: number;
  trading_account_name?: string;
  date: string;
  account_balance: string;
  account_balance_high: string;
  maximum_loss_limit: string;
  mll_is_locked: boolean;
  created_at?: string;
  updated_at?: string;
}

export const tradingAccountsService = new TradingAccountsService();


