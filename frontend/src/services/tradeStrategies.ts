import { getApiBaseUrl } from '../utils/apiConfig';
import type { PnlDisplayMode } from '../utils/pnlDisplay';
import type { TradeDayBasis } from '../utils/tradeDayFilters';
import { STRATEGY_DRILL_DOWN_PAGE_SIZE } from '../utils/strategyDrillDown';
import { fetchWithAuth } from './apiClient';

export interface TradeStrategy {
  id: number;
  user: number;
  user_username: string;
  trade: number;
  trade_info: {
    external_trade_id: string;
    contract_name: string;
    trade_type: 'Long' | 'Short';
    size: string;
    net_pnl: string | null;
    trade_day: string | null;
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

export type StrategyEdgeStatusValue =
  | 'insufficient'
  | 'present'
  | 'fading'
  | 'lost';

export type StrategyEdgeConfidence = 'low' | 'medium' | 'high';

export type StrategyEdgeBasis = 'respected' | 'all' | null;

export interface StrategyEdgeWindowSnapshot {
  sample_size: number;
  expectancy: number;
  profit_factor: number | null;
  profit_factor_infinite: boolean;
}

export interface StrategyEdgeUncertaintyBand {
  low: number;
  high: number;
}

export interface StrategyEdgeStatus {
  status: StrategyEdgeStatusValue;
  sample_size: number;
  trailing_window: number;
  basis: StrategyEdgeBasis;
  baseline_expectancy: number | null;
  trailing_expectancy: number | null;
  trailing_profit_factor: number | null;
  trailing_profit_factor_infinite: boolean;
  hysteresis_band: number | null;
  confidence?: StrategyEdgeConfidence | null;
  trailing_uncertainty?: StrategyEdgeUncertaintyBand | null;
  trailing_sign_uncertain?: boolean;
  windows?: {
    '20': StrategyEdgeWindowSnapshot | null;
    '30': StrategyEdgeWindowSnapshot | null;
  };
  period_independent?: boolean;
  family_scope?: boolean;
  fallback_warning?: boolean;
  respected_sample_size?: number;
  all_sample_size?: number;
  reason?: string;
}

export interface StrategyEdgeOverviewItem extends StrategyEdgeStatus {
  root_id: number;
  display_strategy_id: number;
  title: string;
  version_count: number;
}

export interface StrategyEdgeOverviewResponse {
  items: StrategyEdgeOverviewItem[];
  period_independent: boolean;
  account_scoped?: boolean;
}

export interface StrategyComplianceStats {
  current_streak: number;
  current_streak_start: string | null;
  current_streak_trades: number;
  best_streak: number;
  best_streak_trades: number;
  best_not_respect_streak: number;
  best_not_respect_streak_trades: number;
  current_not_respect_streak: number;
  current_not_respect_streak_start: string | null;
  current_not_respect_streak_trades: number;
  overall_compliance_rate: number;
  /** Statut d'edge all-time (hors filtre période), famille + compte. */
  edge_status?: StrategyEdgeStatus | null;
  compliance_7d: number | null;
  compliance_30d: number | null;
  compliance_90d: number | null;
  compliance_7d_respected: number;
  compliance_7d_not_respected: number;
  compliance_7d_total: number;
  compliance_30d_respected: number;
  compliance_30d_not_respected: number;
  compliance_30d_total: number;
  compliance_90d_respected: number;
  compliance_90d_not_respected: number;
  compliance_90d_total: number;
  total_trades: number;
  total_respected: number;
  total_not_respected: number;
  badges: Badge[];
  next_badge: Badge | null;
  next_record_milestone?: Badge | null;
  performance_comparison: {
    respected: {
      count: number;
      avg_pnl: string;
      total_pnl: string;
      win_rate: number;
      winning_trades: number;
      gross_wins?: string;
      gross_losses?: string;
      profit_factor?: number | null;
      profit_factor_infinite?: boolean;
    };
    not_respected: {
      count: number;
      avg_pnl: string;
      total_pnl: string;
      win_rate: number;
      winning_trades: number;
      gross_wins?: string;
      gross_losses?: string;
      profit_factor?: number | null;
      profit_factor_infinite?: boolean;
    };
  };
  daily_compliance: DailyCompliance[];
}

export interface Badge {
  id: string;
  name: string;
  days: number;
  earned: boolean;
  earned_date?: string | null;
  progress?: number;
  locked?: boolean;
}

export interface DailyCompliance {
  date: string;
  total: number;
  respected: number;
  not_respected: number;
  compliance_rate: number;
}

export interface BulkStrategyData {
  trade_id: string;
  /** Résout l’ambiguïté si le même external_trade_id existe sur plusieurs comptes */
  trading_account_id?: number;
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

  /**
   * Liste les stratégies de trade avec filtres (drill-down page Stratégies).
   */
  async listFiltered(
    params: Record<string, string>,
    options: {
      page?: number;
      pageSize?: number;
      ordering?: 'trade_day' | '-trade_day';
    } = {}
  ): Promise<{ results: TradeStrategy[]; count: number; next: string | null; page: number }> {
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? STRATEGY_DRILL_DOWN_PAGE_SIZE;
    const ordering = options.ordering ?? 'trade_day';
    const search = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
      ordering,
      ...params,
    });
    const res = await fetchWithAuth(
      `${this.BASE_URL}/api/trades/trade-strategies/?${search}`
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.detail || 'Erreur lors du chargement des trades');
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      return { results: data, count: data.length, next: null, page };
    }
    return {
      results: data.results ?? [],
      count: data.count ?? 0,
      next: data.next ?? null,
      page,
    };
  }

  /**
   * Récupère les stratégies pour les trades d'une date spécifique
   */
  async byDate(
    date: string,
    tradingAccount?: number,
    dayBasis: TradeDayBasis = 'trade_day'
  ): Promise<TradeStrategy[]> {
    const params = new URLSearchParams({ date });
    if (tradingAccount) {
      params.append('trading_account', String(tradingAccount));
    }
    if (dayBasis === 'entered_at') {
      params.append('day_basis', 'entered_at');
    }
    const res = await fetchWithAuth(
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
  async byTrade(tradeId: string, tradingAccountId?: number): Promise<TradeStrategy | null> {
    const params = new URLSearchParams({ trade_id: tradeId });
    if (tradingAccountId != null) {
      params.append('trading_account', String(tradingAccountId));
    }
    const res = await fetchWithAuth(
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
    const res = await fetchWithAuth(
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
    const existing = await this.byTrade(tradeId, payload.trading_account_id);
    
    if (existing) {
      // Mise à jour
      const res = await fetchWithAuth(
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
      const res = await fetchWithAuth(
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
    const res = await fetchWithAuth(
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
    const res = await fetchWithAuth(
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
    start_date?: string;
    end_date?: string;
    tradingAccount?: number;
    positionStrategy?: number;
    pnlDisplay?: PnlDisplayMode;
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
      gain_if_strategy_stats?: {
        total_not_respected: number;
        total_answered: number;
        unanswered: number;
        would_have_won: number;
        would_have_lost: number;
        would_have_won_pct: number | null;
        would_have_lost_pct: number | null;
      };
      emotions_by_respect?: {
        respected: Array<{ emotion: string; count: number }>;
        not_respected: Array<{ emotion: string; count: number }>;
      };
      compliance_completion_stats?: {
        total_trades: number;
        evaluated_trades: number;
        unevaluated_trades: number;
        trade_completion_rate_pct: number | null;
        total_trading_days: number;
        days_fully_evaluated: number;
        days_partially_unevaluated: number;
        day_completion_rate_pct: number | null;
      };
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
    
    // Si start_date/end_date sont fournis, les utiliser (priorité)
    if (params?.start_date && params?.end_date) {
      queryParams.append('start_date', params.start_date);
      queryParams.append('end_date', params.end_date);
    } else if (params?.year) {
      // Sinon, utiliser year/month (rétrocompatibilité)
      queryParams.append('year', String(params.year));
      if (params?.month) {
        queryParams.append('month', String(params.month));
      }
    }
    
    if (params?.tradingAccount) {
      queryParams.append('trading_account', String(params.tradingAccount));
    }
    
    if (params?.positionStrategy) {
      queryParams.append('position_strategy', String(params.positionStrategy));
    }
    if (params?.pnlDisplay) {
      queryParams.append('pnl_display', params.pnlDisplay);
    }

    const res = await fetchWithAuth(
      `${this.BASE_URL}/api/trades/trade-strategies/statistics/?${queryParams}`
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la récupération des statistiques');
    }
    return res.json();
  }

  /**
   * Récupère les statistiques de respect de stratégie avec streaks et badges
   */
  async strategyComplianceStats(
    tradingAccount?: number,
    filters?: {
      year?: number;
      month?: number;
      start_date?: string;
      end_date?: string;
      positionStrategy?: number;
      pnlDisplay?: PnlDisplayMode;
    }
  ): Promise<StrategyComplianceStats> {
    const queryParams = new URLSearchParams();
    if (tradingAccount) {
      queryParams.append('trading_account', String(tradingAccount));
    }
    if (filters) {
      if (filters.start_date) {
        queryParams.append('start_date', filters.start_date);
      }
      if (filters.end_date) {
        queryParams.append('end_date', filters.end_date);
      }
      if (filters.year) {
        queryParams.append('year', String(filters.year));
      }
      if (filters.month) {
        queryParams.append('month', String(filters.month));
      }
      if (filters.positionStrategy) {
        queryParams.append('position_strategy', String(filters.positionStrategy));
      }
      if (filters.pnlDisplay) {
        queryParams.append('pnl_display', filters.pnlDisplay);
      }
    }
    const res = await fetchWithAuth(
      `${this.BASE_URL}/api/trades/trade-strategies/strategy_compliance_stats/?${queryParams}`
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la récupération des statistiques de compliance');
    }
    return res.json();
  }

  /**
   * Vue d'ensemble edge all-time par famille (hors filtre période / stratégie).
   */
  async strategyEdgeOverview(params?: {
    tradingAccount?: number;
    pnlDisplay?: PnlDisplayMode;
  }): Promise<StrategyEdgeOverviewResponse> {
    const queryParams = new URLSearchParams();
    if (params?.tradingAccount) {
      queryParams.append('trading_account', String(params.tradingAccount));
    }
    if (params?.pnlDisplay) {
      queryParams.append('pnl_display', params.pnlDisplay);
    }
    const qs = queryParams.toString();
    const res = await fetchWithAuth(
      `${this.BASE_URL}/api/trades/trade-strategies/strategy_edge_overview/${qs ? `?${qs}` : ''}`
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erreur lors de la récupération de l’overview edge');
    }
    return res.json();
  }
}

export const tradeStrategiesService = new TradeStrategiesService();

