import apiClient from '../lib/apiClient';

export interface TopStepTrade {
  id: number;
  topstep_id: string;
  contract_name: string;
  trade_type: 'Long' | 'Short';
  entered_at: string;
  exited_at: string | null;
  entry_price: string;
  exit_price: string | null;
  size: string;
  fees: string;
  commissions: string;
  pnl: string | null;
  net_pnl: string;
  pnl_percentage: string | null;
  is_profitable: boolean | null;
  trade_duration: string | null;
  duration_str: string | null;
  trade_day: string | null;
  // Champs optionnels qui peuvent ne pas être présents dans toutes les réponses
  user_username?: string;
  notes?: string;
  strategy?: string;
  formatted_entry_date?: string;
  formatted_exit_date?: string | null;
  imported_at?: string;
  updated_at?: string;
}

export interface TradeStrategy {
  id?: string;
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
  created_at?: string;
  updated_at?: string;
}

export interface TradeStatistics {
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
  // Ratios de Performance
  profit_factor: number;
  win_loss_ratio: number;
  consistency_ratio: number;
  recovery_ratio: number;
  pnl_per_trade: number;
  fees_ratio: number;
  volume_pnl_ratio: number;
  frequency_ratio: number;
  duration_ratio: number;
}

export interface ImportLog {
  id: number;
  user_username: string;
  filename: string;
  total_rows: number;
  success_count: number;
  error_count: number;
  success_rate: number;
  errors: any[];
  imported_at: string;
}

export interface PaginatedTradesResponse {
  results: TopStepTrade[];
  count: number;
  next: string | null;
  previous: string | null;
}

export const tradesService = {
  // Récupérer tous les trades (pour compatibilité avec l'existant)
  getTrades: async (tradingAccountId?: number, filters?: {
    contract?: string;
    type?: string;
    start_date?: string;
    end_date?: string;
    profitable?: boolean;
    trade_day?: string;
  }) => {
    const params = new URLSearchParams();
    if (tradingAccountId) params.append('trading_account', tradingAccountId.toString());
    if (filters?.contract) params.append('contract', filters.contract);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    if (filters?.profitable !== undefined) params.append('profitable', String(filters.profitable));
    if (filters?.trade_day) params.append('trade_day', filters.trade_day);

    // Si on filtre par trade_day, on veut seulement les résultats de cette date
    if (filters?.trade_day) {
      const response = await apiClient.get<{ results: TopStepTrade[]; next: string | null }>(`/trades/topstep/?${params.toString()}`);
      return response.data.results;
    }

    // Sinon, récupérer tous les trades avec pagination
    let url: string | null = `/trades/topstep/?${params.toString()}`;
    const all: TopStepTrade[] = [] as any;
    type PaginatedResponse<T> = { results: T[]; next: string | null };
    while (url) {
      const response = await apiClient.get<PaginatedResponse<TopStepTrade> | TopStepTrade[]>(url);
      const data = response.data as PaginatedResponse<TopStepTrade> | TopStepTrade[];
      if (Array.isArray(data)) {
        all.push(...data);
        break;
      }
      const page = data as PaginatedResponse<TopStepTrade>;
      if (Array.isArray(page.results)) {
        all.push(...page.results);
      }
      url = page.next || null;
    }
    return all;
  },

  // Récupérer les trades avec pagination
  getTradesPaginated: async (page: number = 1, pageSize: number = 10, tradingAccountId?: number, filters?: {
    contract?: string;
    type?: string;
    start_date?: string;
    end_date?: string;
    profitable?: boolean;
  }): Promise<PaginatedTradesResponse> => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('page_size', pageSize.toString());
    
    if (tradingAccountId) params.append('trading_account', tradingAccountId.toString());
    if (filters?.contract) params.append('contract', filters.contract);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    if (filters?.profitable !== undefined) params.append('profitable', String(filters.profitable));

    const response = await apiClient.get<PaginatedTradesResponse>(`/trades/topstep/?${params.toString()}`);
    return response.data;
  },

  // Récupérer un trade spécifique
  getTrade: async (id: number) => {
    const response = await apiClient.get(`/trades/topstep/${id}/`);
    return response.data;
  },

  // Mettre à jour un trade (notes, strategy)
  updateTrade: async (id: number, data: Partial<TopStepTrade>) => {
    const response = await apiClient.patch(`/trades/topstep/${id}/`, data);
    return response.data;
  },

  // Supprimer un trade
  deleteTrade: async (id: number) => {
    const response = await apiClient.delete(`/trades/topstep/${id}/`);
    return response.data;
  },

  // Récupérer les statistiques
  getStatistics: async (tradingAccountId?: number): Promise<TradeStatistics> => {
    const params = new URLSearchParams();
    if (tradingAccountId) params.append('trading_account', tradingAccountId.toString());
    const response = await apiClient.get(`/trades/topstep/statistics/?${params.toString()}`);
    return response.data;
  },

  // Récupérer la liste des contrats
  getContracts: async (): Promise<string[]> => {
    const response = await apiClient.get('/trades/topstep/contracts/');
    return response.data.contracts;
  },

  // Upload CSV
  uploadCSV: async (file: File, tradingAccountId?: number) => {
    const formData = new FormData();
    formData.append('file', file);
    if (tradingAccountId) {
      formData.append('trading_account', tradingAccountId.toString());
    }
    
    const response = await apiClient.post('/trades/topstep/upload_csv/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Récupérer les logs d'import
  getImportLogs: async (): Promise<ImportLog[]> => {
    const response = await apiClient.get('/trades/import-logs/');
    return response.data;
  },

  // Effacer tout l'historique des trades
  clearAll: async () => {
    const response = await apiClient.delete('/trades/topstep/clear_all/');
    return response.data;
  },

  // Récupérer les données d'évolution du capital par jour
  getCapitalEvolution: async (tradingAccountId?: number) => {
    const params = new URLSearchParams();
    if (tradingAccountId) params.append('trading_account', tradingAccountId.toString());
    const response = await apiClient.get(`/trades/topstep/capital_evolution/?${params.toString()}`);
    return response.data;
  },

  // Récupérer les données de performance par jour de la semaine
  getWeekdayPerformance: async (tradingAccountId?: number) => {
    const params = new URLSearchParams();
    if (tradingAccountId) params.append('trading_account', tradingAccountId.toString());
    const response = await apiClient.get(`/trades/topstep/weekday_performance/?${params.toString()}`);
    return response.data;
  },

  // Récupérer les métriques de trading (risk reward ratio, profit factor, max drawdown)
  getTradingMetrics: async () => {
    const response = await apiClient.get('/trades/topstep/trading_metrics/');
    return response.data;
  },

  // Récupérer les données pour le calendrier mensuel
  getCalendarData: async (year?: number, month?: number, tradingAccountId?: number) => {
    const params = new URLSearchParams();
    if (year) params.append('year', year.toString());
    if (month) params.append('month', month.toString());
    if (tradingAccountId) params.append('trading_account', tradingAccountId.toString());
    
    const url = `/trades/topstep/calendar_data/${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await apiClient.get(url);
    return response.data;
  },

  // Récupérer les données d'analyses détaillées
  getAnalyticsData: async (tradingAccountId?: number) => {
    const params = new URLSearchParams();
    if (tradingAccountId) params.append('trading_account', tradingAccountId.toString());
    const response = await apiClient.get(`/trades/topstep/analytics/?${params.toString()}`);
    return response.data;
  },

  // Récupérer les performances par heure
  getHourlyPerformance: async (tradingAccountId?: number) => {
    const params = new URLSearchParams();
    if (tradingAccountId) params.append('trading_account', tradingAccountId.toString());
    const response = await apiClient.get(`/trades/topstep/hourly_performance/?${params.toString()}`);
    return response.data;
  },

  // Récupérer les données de corrélation P/L vs Nombre de trades
  getPnlTradesCorrelation: async (tradingAccountId?: number) => {
    const params = new URLSearchParams();
    if (tradingAccountId) params.append('trading_account', tradingAccountId.toString());
    const response = await apiClient.get(`/trades/topstep/pnl_trades_correlation/?${params.toString()}`);
    return response.data;
  },

  // Récupérer les données de drawdown
  getDrawdownData: async (tradingAccountId?: number) => {
    const params = new URLSearchParams();
    if (tradingAccountId) params.append('trading_account', tradingAccountId.toString());
    const response = await apiClient.get(`/trades/topstep/drawdown_data/?${params.toString()}`);
    return response.data;
  },

  // === STRATÉGIES DE TRADES ===
  
  // Récupérer toutes les stratégies de trades
  getTradeStrategies: async (filters?: {
    trade_id?: string;
    strategy_respected?: boolean;
    contract_name?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters?.trade_id) params.append('trade_id', filters.trade_id);
    if (filters?.strategy_respected !== undefined) params.append('strategy_respected', String(filters.strategy_respected));
    if (filters?.contract_name) params.append('contract_name', filters.contract_name);
    
    const url = `/trades/trade-strategies/${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await apiClient.get(url);
    
    // S'assurer de retourner un tableau
    const data = response.data;
    if (Array.isArray(data)) {
      return data;
    } else if (data && Array.isArray(data.results)) {
      return data.results;
    } else {
      return [];
    }
  },

  // Récupérer une stratégie de trade par ID
  getTradeStrategy: async (id: number) => {
    const response = await apiClient.get(`/trades/trade-strategies/${id}/`);
    return response.data;
  },

  // Créer une nouvelle stratégie de trade
  createTradeStrategy: async (strategyData: any) => {
    const response = await apiClient.post('/trades/trade-strategies/', strategyData);
    return response.data;
  },

  // Mettre à jour une stratégie de trade
  updateTradeStrategy: async (id: number, strategyData: any) => {
    const response = await apiClient.patch(`/trades/trade-strategies/${id}/`, strategyData);
    return response.data;
  },

  // Supprimer une stratégie de trade
  deleteTradeStrategy: async (id: number) => {
    await apiClient.delete(`/trades/trade-strategies/${id}/`);
  },

  // Récupérer la stratégie pour un trade spécifique
  getTradeStrategyByTrade: async (tradeId: string) => {
    const response = await apiClient.get(`/trades/trade-strategies/by_trade/?trade_id=${tradeId}`);
    return response.data;
  },

  // Récupérer les stratégies pour les trades d'une date spécifique
  getTradeStrategiesByDate: async (date: string, tradingAccountId?: number) => {
    const params = new URLSearchParams();
    params.append('date', date);
    if (tradingAccountId) params.append('trading_account', tradingAccountId.toString());
    const response = await apiClient.get(`/trades/trade-strategies/by_date/?${params.toString()}`);
    return response.data;
  },

  // Créer ou mettre à jour plusieurs stratégies de trades en une fois
  bulkCreateTradeStrategies: async (strategies: Array<{
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
  }>) => {
    const response = await apiClient.post('/trades/trade-strategies/bulk_create/', {
      strategies
    });
    return response.data;
  },
};

