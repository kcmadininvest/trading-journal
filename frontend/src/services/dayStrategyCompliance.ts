import { getApiBaseUrl } from '../utils/apiConfig';

export interface DayStrategyCompliance {
  id: number;
  user: number;
  user_username: string;
  date: string;
  trading_account: number | null;
  trading_account_name: string | null;
  strategy_respected: boolean | null;
  dominant_emotions: string[];
  session_rating: number | null;
  emotion_details: string;
  possible_improvements: string;
  screenshot_url: string;
  video_url: string;
  emotions_display: string;
  created_at: string;
  updated_at: string;
}

class DayStrategyComplianceService {
  private readonly BASE_URL = getApiBaseUrl();
  private baseUrl = `${this.BASE_URL}/api/trades/day-strategy-compliances`;

  private getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
      'Authorization': `Bearer ${token}`,
    } as Record<string, string>;
  }

  private async refreshAccessToken(): Promise<boolean> {
    const refresh = localStorage.getItem('refresh_token');
    if (!refresh) return false;
    try {
      const res = await fetch(`${this.BASE_URL}/api/accounts/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' } as Record<string, string>,
        body: JSON.stringify({ refresh }),
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
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> || {}),
      ...this.getAuthHeaders(),
    };
    const res = await fetch(input, { ...init, headers });
    if (res.status === 401 && retry) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        const headers2: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(init.headers as Record<string, string> || {}),
          ...this.getAuthHeaders(),
        };
        return fetch(input, { ...init, headers: headers2 });
      }
    }
    return res;
  }

  /**
   * Récupère toutes les compliances de l'utilisateur connecté
   */
  async list(params?: {
    date?: string;
    strategy_respected?: boolean;
    trading_account?: number;
  }): Promise<DayStrategyCompliance[]> {
    const queryParams = new URLSearchParams();
    if (params?.date) queryParams.append('date', params.date);
    if (params?.strategy_respected !== undefined) {
      queryParams.append('strategy_respected', params.strategy_respected.toString());
    }
    if (params?.trading_account) {
      queryParams.append('trading_account', params.trading_account.toString());
    }

    const url = queryParams.toString() 
      ? `${this.baseUrl}/?${queryParams.toString()}`
      : `${this.baseUrl}/`;

    const response = await this.fetchWithAuth(url, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Erreur lors de la récupération des compliances: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Récupère une compliance pour une date spécifique
   */
  async byDate(date: string, tradingAccount?: number): Promise<DayStrategyCompliance | null> {
    const queryParams = new URLSearchParams();
    queryParams.append('date', date);
    if (tradingAccount) {
      queryParams.append('trading_account', tradingAccount.toString());
    }

    const url = `${this.baseUrl}/by_date/?${queryParams.toString()}`;

    const response = await this.fetchWithAuth(url, {
      method: 'GET',
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Erreur lors de la récupération de la compliance: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Crée une nouvelle compliance
   */
  async create(data: Omit<DayStrategyCompliance, 'id' | 'user' | 'user_username' | 'trading_account_name' | 'emotions_display' | 'created_at' | 'updated_at'>): Promise<DayStrategyCompliance> {
    const response = await this.fetchWithAuth(this.baseUrl + '/', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `Erreur lors de la création de la compliance: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Met à jour une compliance existante
   */
  async update(id: number, data: Partial<Omit<DayStrategyCompliance, 'id' | 'user' | 'user_username' | 'trading_account_name' | 'emotions_display' | 'created_at' | 'updated_at'>>): Promise<DayStrategyCompliance> {
    const response = await this.fetchWithAuth(`${this.baseUrl}/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `Erreur lors de la mise à jour de la compliance: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Supprime une compliance
   */
  async delete(id: number): Promise<void> {
    const response = await this.fetchWithAuth(`${this.baseUrl}/${id}/`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Erreur lors de la suppression de la compliance: ${response.statusText}`);
    }
  }
}

export const dayStrategyComplianceService = new DayStrategyComplianceService();

