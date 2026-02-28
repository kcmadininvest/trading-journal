/**
 * Service API pour les analyses statistiques des trades.
 */
import { getApiBaseUrl } from '../utils/apiConfig';
import {
  TradeContext,
  TradeSetup,
  SessionContext,
  TradeExecution,
  TradeTag,
  TradeTagAssignment,
  TradeStatistics,
  ConditionalProbability,
  CalculateStatisticsRequest,
  ConditionalProbabilityRequest,
  CompareConditionsRequest,
  BulkCreateAnalyticsRequest,
  BestSetup,
  WorstPattern,
  RecurringPattern,
  BehavioralBias,
  SimilarTrade,
  EdgeAnalysis,
  ConditionComparison,
} from '../types/analytics';

class AnalyticsService {
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
      const res = await fetch(`${this.BASE_URL}/api/auth/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      localStorage.setItem('access_token', data.access);
      return true;
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

  // TradeContext CRUD
  async listContexts(): Promise<TradeContext[]> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/contexts/`);
    if (!res.ok) throw new Error('Erreur lors du chargement des contextes');
    return res.json();
  }

  async getContext(id: number): Promise<TradeContext> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/contexts/${id}/`);
    if (!res.ok) throw new Error('Erreur lors de la récupération du contexte');
    return res.json();
  }

  async createContext(data: Partial<TradeContext>): Promise<TradeContext> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/contexts/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Erreur lors de la création du contexte');
    }
    return res.json();
  }

  async updateContext(id: number, data: Partial<TradeContext>): Promise<TradeContext> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/contexts/${id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Erreur lors de la mise à jour du contexte');
    }
    return res.json();
  }

  async deleteContext(id: number): Promise<void> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/contexts/${id}/`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Erreur lors de la suppression du contexte');
  }

  // TradeSetup CRUD
  async listSetups(): Promise<TradeSetup[]> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/setups/`);
    if (!res.ok) throw new Error('Erreur lors du chargement des setups');
    return res.json();
  }

  async getSetup(id: number): Promise<TradeSetup> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/setups/${id}/`);
    if (!res.ok) throw new Error('Erreur lors de la récupération du setup');
    return res.json();
  }

  async createSetup(data: Partial<TradeSetup>): Promise<TradeSetup> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/setups/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Erreur lors de la création du setup');
    }
    return res.json();
  }

  async updateSetup(id: number, data: Partial<TradeSetup>): Promise<TradeSetup> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/setups/${id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Erreur lors de la mise à jour du setup');
    }
    return res.json();
  }

  async deleteSetup(id: number): Promise<void> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/setups/${id}/`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Erreur lors de la suppression du setup');
  }

  // SessionContext CRUD
  async listSessionContexts(): Promise<SessionContext[]> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/session-contexts/`);
    if (!res.ok) throw new Error('Erreur lors du chargement des contextes de session');
    return res.json();
  }

  async getSessionContext(id: number): Promise<SessionContext> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/session-contexts/${id}/`);
    if (!res.ok) throw new Error('Erreur lors de la récupération du contexte de session');
    return res.json();
  }

  async createSessionContext(data: Partial<SessionContext>): Promise<SessionContext> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/session-contexts/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Erreur lors de la création du contexte de session');
    }
    return res.json();
  }

  async updateSessionContext(id: number, data: Partial<SessionContext>): Promise<SessionContext> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/session-contexts/${id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Erreur lors de la mise à jour du contexte de session');
    }
    return res.json();
  }

  async deleteSessionContext(id: number): Promise<void> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/session-contexts/${id}/`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Erreur lors de la suppression du contexte de session');
  }

  // TradeExecution CRUD
  async listExecutions(): Promise<TradeExecution[]> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/executions/`);
    if (!res.ok) throw new Error('Erreur lors du chargement des exécutions');
    return res.json();
  }

  async getExecution(id: number): Promise<TradeExecution> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/executions/${id}/`);
    if (!res.ok) throw new Error('Erreur lors de la récupération de l\'exécution');
    return res.json();
  }

  async createExecution(data: Partial<TradeExecution>): Promise<TradeExecution> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/executions/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Erreur lors de la création de l\'exécution');
    }
    return res.json();
  }

  async updateExecution(id: number, data: Partial<TradeExecution>): Promise<TradeExecution> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/executions/${id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Erreur lors de la mise à jour de l\'exécution');
    }
    return res.json();
  }

  async deleteExecution(id: number): Promise<void> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/executions/${id}/`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Erreur lors de la suppression de l\'exécution');
  }

  // TradeTag CRUD
  async listTags(): Promise<TradeTag[]> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/tags/`);
    if (!res.ok) throw new Error('Erreur lors du chargement des tags');
    return res.json();
  }

  async getTag(id: number): Promise<TradeTag> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/tags/${id}/`);
    if (!res.ok) throw new Error('Erreur lors de la récupération du tag');
    return res.json();
  }

  async createTag(data: Partial<TradeTag>): Promise<TradeTag> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/tags/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Erreur lors de la création du tag');
    }
    return res.json();
  }

  async updateTag(id: number, data: Partial<TradeTag>): Promise<TradeTag> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/tags/${id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Erreur lors de la mise à jour du tag');
    }
    return res.json();
  }

  async deleteTag(id: number): Promise<void> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/tags/${id}/`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Erreur lors de la suppression du tag');
  }

  // Analyses statistiques
  async calculateStatistics(request: CalculateStatisticsRequest): Promise<TradeStatistics> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/analytics/calculate_statistics/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!res.ok) throw new Error('Erreur lors du calcul des statistiques');
    return res.json();
  }

  async calculateConditionalProbability(request: ConditionalProbabilityRequest): Promise<ConditionalProbability> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/analytics/conditional_probability/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!res.ok) throw new Error('Erreur lors du calcul de la probabilité conditionnelle');
    return res.json();
  }

  async getBestSetups(minSampleSize: number = 30): Promise<BestSetup[]> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/trades/analytics/analytics/best_setups/?min_sample_size=${minSampleSize}`
    );
    if (!res.ok) throw new Error('Erreur lors de la récupération des meilleurs setups');
    const data = await res.json();
    return data.best_setups;
  }

  async getWorstPatterns(): Promise<WorstPattern[]> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/analytics/worst_patterns/`);
    if (!res.ok) throw new Error('Erreur lors de la récupération des pires patterns');
    const data = await res.json();
    return data.worst_patterns;
  }

  async compareConditions(request: CompareConditionsRequest): Promise<ConditionComparison> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/analytics/compare_conditions/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!res.ok) throw new Error('Erreur lors de la comparaison des conditions');
    return res.json();
  }

  async getEdgeAnalysis(): Promise<EdgeAnalysis> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/analytics/edge_analysis/`);
    if (!res.ok) throw new Error('Erreur lors de la récupération de l\'analyse de l\'edge');
    return res.json();
  }

  async getRecurringPatterns(): Promise<RecurringPattern[]> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/analytics/recurring_patterns/`);
    if (!res.ok) throw new Error('Erreur lors de la récupération des patterns récurrents');
    const data = await res.json();
    return data.patterns;
  }

  async getSimilarTrades(tradeId: number, maxResults: number = 10): Promise<SimilarTrade[]> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/trades/analytics/analytics/${tradeId}/similar_trades/?max_results=${maxResults}`
    );
    if (!res.ok) throw new Error('Erreur lors de la récupération des trades similaires');
    const data = await res.json();
    return data.similar_trades;
  }

  async getBehavioralBiases(): Promise<BehavioralBias[]> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/analytics/behavioral_biases/`);
    if (!res.ok) throw new Error('Erreur lors de la récupération des biais comportementaux');
    const data = await res.json();
    return data.biases;
  }

  async getTradeAnalytics(tradeId: number): Promise<{
    context: TradeContext | null;
    setup: TradeSetup | null;
    session_context: SessionContext | null;
    execution: TradeExecution | null;
    tags: TradeTag[];
  }> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/analytics/get_trade_analytics/?trade_id=${tradeId}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Erreur lors du chargement des données analytiques');
    }
    return res.json();
  }

  async bulkCreateAnalytics(request: BulkCreateAnalyticsRequest): Promise<{
    message: string;
    created: {
      context?: TradeContext;
      setup?: TradeSetup;
      session_context?: SessionContext;
      execution?: TradeExecution;
      tags?: TradeTagAssignment[];
    };
  }> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/analytics/bulk_create_analytics/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Erreur lors de la création en masse des données analytiques');
    }
    return res.json();
  }

  // Statistiques et probabilités (lecture seule)
  async listStatistics(): Promise<TradeStatistics[]> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/statistics/`);
    if (!res.ok) throw new Error('Erreur lors du chargement des statistiques');
    return res.json();
  }

  async listProbabilities(): Promise<ConditionalProbability[]> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/analytics/probabilities/`);
    if (!res.ok) throw new Error('Erreur lors du chargement des probabilités');
    return res.json();
  }
}

const analyticsServiceInstance = new AnalyticsService();
export default analyticsServiceInstance;
