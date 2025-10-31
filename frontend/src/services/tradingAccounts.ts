export interface TradingAccount {
  id: number;
  user: number;
  user_username?: string;
  name: string;
  account_type: 'topstep' | 'ibkr' | 'ninjatrader' | 'tradovate' | 'other';
  broker_account_id?: string;
  currency: string;
  status: 'active' | 'inactive' | 'archived';
  broker_config?: Record<string, any>;
  description?: string;
  is_default: boolean;
  trades_count?: number;
  is_topstep?: boolean;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

class TradingAccountsService {
  private readonly BASE_URL = 'http://localhost:8000';

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
}

export const tradingAccountsService = new TradingAccountsService();


