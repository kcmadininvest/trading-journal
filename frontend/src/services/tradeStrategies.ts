import { getApiBaseUrl } from '../utils/apiConfig';

export interface TradeStrategy {
  id: number;
  user: number;
  user_username: string;
  trade: number;
  trade_info: {
    topstep_id: string;
    contract_name: string;
    trade_type: 'Long' | 'Short';
    size: string;
    net_pnl: string | null;
    entered_at: string;
    exited_at: string | null;
  };
  strategy_respected: boolean | null;
  dominant_emotions: string[];
  gain_if_strategy_respected: boolean | null;
  tp1_reached: boolean;
  tp2_plus_reached: boolean;
  session_rating: number | null;
  emotion_details: string;
  possible_improvements: string;
  screenshot_url: string;
  video_url: string;
  emotions_display: string;
  created_at: string;
  updated_at: string;
}

export interface BulkStrategyData {
  trade_id: string;
  strategy_respected?: boolean | null;
  dominant_emotions?: string[];
  gain_if_strategy_respected?: boolean | null;
  tp1_reached?: boolean;
  tp2_plus_reached?: boolean;
  session_rating?: number | null;
  emotion_details?: string;
  possible_improvements?: string;
  screenshot_url?: string;
  video_url?: string;
}

class TradeStrategiesService {
  private readonly BASE_URL = getApiBaseUrl();

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

  /**
   * Récupère les stratégies pour les trades d'une date spécifique
   */
  async byDate(date: string, tradingAccount?: number): Promise<TradeStrategy[]> {
    const params = new URLSearchParams({ date });
    if (tradingAccount) {
      params.append('trading_account', String(tradingAccount));
    }
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/trades/trade-strategies/by_date/?${params}`
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la récupération des stratégies');
    }
    return res.json();
  }

  /**
   * Récupère la stratégie pour un trade spécifique
   */
  async byTrade(tradeId: string): Promise<TradeStrategy | null> {
    const params = new URLSearchParams({ trade_id: tradeId });
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/trades/trade-strategies/by_trade/?${params}`
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la récupération de la stratégie');
    }
    return res.json();
  }

  /**
   * Récupère une stratégie par son ID
   */
  async retrieve(id: number): Promise<TradeStrategy> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/trades/trade-strategies/${id}/`
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la récupération de la stratégie');
    }
    return res.json();
  }

  /**
   * Crée ou met à jour une stratégie pour un trade
   */
  async createOrUpdate(tradeId: string, data: Partial<BulkStrategyData>): Promise<TradeStrategy> {
    const payload = {
      trade_id: tradeId,
      ...data,
    };
    const existing = await this.byTrade(tradeId);
    
    if (existing) {
      // Mise à jour
      const res = await this.fetchWithAuth(
        `${this.BASE_URL}/api/trades/trade-strategies/${existing.id}/`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' } as Record<string, string>,
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erreur lors de la mise à jour de la stratégie');
      }
      return res.json();
    } else {
      // Création
      const res = await this.fetchWithAuth(
        `${this.BASE_URL}/api/trades/trade-strategies/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' } as Record<string, string>,
          body: JSON.stringify({ trade: tradeId, ...data }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erreur lors de la création de la stratégie');
      }
      return res.json();
    }
  }

  /**
   * Crée ou met à jour plusieurs stratégies en une fois
   */
  async bulkCreateOrUpdate(strategies: BulkStrategyData[]): Promise<TradeStrategy[]> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/trades/trade-strategies/bulk_create/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' } as Record<string, string>,
        body: JSON.stringify({ strategies }),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la sauvegarde des stratégies');
    }
    return res.json();
  }

  /**
   * Récupère les données de stratégie agrégées par date pour un mois donné
   */
  async strategyData(year: number, month: number): Promise<Array<{
    date: string;
    strategies: Array<{
      id: number;
      strategy_respected: boolean | null;
      dominant_emotions: string[];
      tp1_reached: boolean;
      tp2_plus_reached: boolean;
      trade_info: {
        net_pnl: string;
      };
    }>;
  }>> {
    const params = new URLSearchParams({
      year: String(year),
      month: String(month),
    });
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/trades/trade-strategies/strategy_data/?${params}`
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la récupération des données de stratégie');
    }
    return res.json();
  }

  /**
   * Récupère les statistiques de stratégies pour une période donnée
   */
  async statistics(params?: {
    year?: number;
    month?: number;
    tradingAccount?: number;
  }): Promise<{
    period: {
      year: number;
      month: number | null;
      start_date: string;
      end_date: string;
    };
    statistics: {
      total_strategies: number;
      respect_percentage: number;
      not_respect_percentage: number;
      respected_count: number;
      not_respected_count: number;
      success_rate_if_respected: number;
      success_rate_if_not_respected: number;
      winning_sessions_distribution: {
        tp1_only: number;
        tp2_plus: number;
        no_tp: number;
        total_winning: number;
      };
      emotions_distribution: Array<{
        emotion: string;
        count: number;
      }>;
      period_data: Array<{
        period: string;
        date: string;
        respect_percentage: number;
        not_respect_percentage: number;
        total: number;
      }>;
    };
    all_time: {
      total_strategies: number;
      respect_percentage: number;
      not_respect_percentage: number;
    };
  }> {
    const queryParams = new URLSearchParams();
    if (params?.year) {
      queryParams.append('year', String(params.year));
    }
    if (params?.month) {
      queryParams.append('month', String(params.month));
    }
    if (params?.tradingAccount) {
      queryParams.append('trading_account', String(params.tradingAccount));
    }
    
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/trades/trade-strategies/statistics/?${queryParams}`
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la récupération des statistiques');
    }
    return res.json();
  }
}

export const tradeStrategiesService = new TradeStrategiesService();

