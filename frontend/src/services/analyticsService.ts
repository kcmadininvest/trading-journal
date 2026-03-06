/**
 * Service API pour les analyses statistiques des trades.
 */
import { getApiBaseUrl } from '../utils/apiConfig';
import {
  TradeTag,
  TradeStatistics,
  ConditionalProbability,
  CalculateStatisticsRequest,
  ConditionalProbabilityRequest,
  CompareConditionsRequest,
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
