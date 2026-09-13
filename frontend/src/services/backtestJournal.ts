import { getApiBaseUrl } from '../utils/apiConfig';
import { authService } from './auth';

export interface BacktestVersion {
  id: number;
  strategy: number;
  version: number;
  context_rules: string;
  setup_rules: string;
  entry_rules: string;
  stop_rules: string;
  exit_rules: string;
  invalidation_rules: string;
  notes: string;
  locked_at: string | null;
  is_locked: boolean;
  observation_count?: number;
  created_at: string;
  updated_at: string;
}

export interface BacktestStrategy {
  id: number;
  name: string;
  description: string;
  default_instrument: string;
  status: 'active' | 'archived';
  versions?: BacktestVersion[];
  latest_version?: BacktestVersion | null;
  latest_version_id?: number | null;
  latest_version_number?: number | null;
  is_latest_locked?: boolean;
  campaign_count?: number;
  position_strategy?: number | null;
  position_strategy_title?: string;
  created_at: string;
  updated_at: string;
}

export interface BacktestCampaign {
  id: number;
  strategy_version: number;
  strategy_id: number;
  strategy_name: string;
  version_number: number;
  name: string;
  instrument: string;
  period_start: string;
  period_end: string;
  session_start: string | null;
  session_end: string | null;
  timezone: string;
  observation_goal: number | null;
  commission: string | null;
  slippage: string | null;
  require_refusal_reason: boolean;
  notes: string;
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';
  observation_count?: number;
  is_version_locked: boolean;
  created_at: string;
  updated_at: string;
}

export type ResultStatus =
  | 'WIN'
  | 'LOSS'
  | 'BREAKEVEN'
  | 'PARTIAL'
  | 'OPEN'
  | 'NOT_TAKEN';

export interface BacktestObservation {
  id: number;
  campaign: number;
  market_datetime: string;
  direction: 'LONG' | 'SHORT';
  setup_valid: boolean;
  trade_taken: boolean;
  refusal_reason: string;
  entry_price: string | null;
  initial_stop_price: string | null;
  target_price: string | null;
  exit_price: string | null;
  quantity: string | null;
  fees: string | null;
  slippage: string | null;
  result_status: ResultStatus;
  result_r: string | null;
  result_r_source: 'calculated' | 'manual';
  result_points: string | null;
  mfe: string | null;
  mae: string | null;
  context: string;
  structure: string;
  notes: string;
  screenshot_before_url: string;
  screenshot_after_url: string;
  sort_index: number;
  warnings: string[];
  created_at: string;
  updated_at: string;
  client_key?: string;
}

export interface BacktestMetrics {
  sample_size: number;
  sample_label: 'insufficient' | 'preliminary' | 'extended' | 'important';
  wins: number;
  losses: number;
  breakevens: number;
  win_rate: number | null;
  avg_win_r: number | null;
  avg_loss_r_abs: number | null;
  expectancy_r: number | null;
  profit_factor: number | null;
  profit_factor_not_applicable: boolean;
  total_r: number | null;
  best_r: number | null;
  worst_r: number | null;
  max_drawdown_r: number | null;
  max_win_streak: number;
  max_loss_streak: number;
  observations?: number;
  trades_taken?: number;
  setups_refused?: number;
  acceptance_rate?: number | null;
  excluded_open?: number;
  excluded_missing_r?: number;
  refused_with_result?: BacktestMetrics;
  goal?: number | null;
  group?: string;
}

export interface EquityPoint {
  id: number;
  market_datetime: string | null;
  result_r: number | null;
  cumulative_r: number | null;
  drawdown_r: number | null;
  trade_taken: boolean;
}

export interface AnalysisResponse {
  global: BacktestMetrics;
  filtered: BacktestMetrics;
  groups: BacktestMetrics[];
  scope: string;
  group_by: string;
  sample_size: number;
  exclusions: {
    open: number;
    missing_r: number;
    refused: number;
  };
}

export interface AnalysisFilters {
  direction?: string;
  trade_taken?: string;
  result?: string;
  setup_valid?: string;
  start?: string;
  end?: string;
  group_by?: string;
  scope?: string;
  selection?: boolean;
}

class BacktestJournalService {
  private readonly BASE_URL = getApiBaseUrl();

  private getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return { Authorization: `Bearer ${token}` } as Record<string, string>;
  }

  private async refreshAccessToken(): Promise<boolean> {
    const access = await authService.refreshAccessToken();
    return !!access;
  }

  private async fetchWithAuth(
    input: string,
    init: RequestInit = {},
    retry = true
  ): Promise<Response> {
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string> || {}),
      ...this.getAuthHeaders(),
    };
    const res = await fetch(input, { ...init, headers });
    if (res.status === 401 && retry) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        return this.fetchWithAuth(input, init, false);
      }
    }
    return res;
  }

  private async parse<T>(res: Response): Promise<T> {
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body.detail || 'backtest_journal_error') as Error & {
        fields?: Record<string, unknown>;
        status?: number;
      };
      err.fields = body;
      err.status = res.status;
      throw err;
    }
    return body as T;
  }

  private toQuery(params: Record<string, unknown>) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      search.set(key, String(value));
    });
    return search.toString();
  }

  async listStrategies(): Promise<BacktestStrategy[]> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/backtest-journal/strategies/`);
    const body = await this.parse<BacktestStrategy[] | { results: BacktestStrategy[] }>(res);
    return Array.isArray(body) ? body : body.results || [];
  }

  async getStrategy(id: number): Promise<BacktestStrategy> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/backtest-journal/strategies/${id}/`
    );
    return this.parse(res);
  }

  async createStrategy(payload: Partial<BacktestStrategy>): Promise<BacktestStrategy> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/backtest-journal/strategies/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return this.parse(res);
  }

  async updateStrategy(id: number, payload: Partial<BacktestStrategy>): Promise<BacktestStrategy> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/backtest-journal/strategies/${id}/`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    return this.parse(res);
  }

  async deleteStrategy(id: number): Promise<void> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/backtest-journal/strategies/${id}/`,
      { method: 'DELETE' }
    );
    if (!res.ok && res.status !== 204) {
      await this.parse(res);
    }
  }

  async updateVersion(id: number, payload: Partial<BacktestVersion>): Promise<BacktestVersion> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/backtest-journal/versions/${id}/`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    return this.parse(res);
  }

  async duplicateVersion(id: number): Promise<BacktestVersion> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/backtest-journal/versions/${id}/duplicate/`,
      { method: 'POST' }
    );
    return this.parse(res);
  }

  async listCampaigns(strategyId?: number): Promise<BacktestCampaign[]> {
    const query = this.toQuery({ strategy: strategyId });
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/backtest-journal/campaigns/${query ? `?${query}` : ''}`
    );
    const body = await this.parse<BacktestCampaign[] | { results: BacktestCampaign[] }>(res);
    return Array.isArray(body) ? body : body.results || [];
  }

  async getCampaign(id: number): Promise<BacktestCampaign> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/backtest-journal/campaigns/${id}/`
    );
    return this.parse(res);
  }

  async createCampaign(payload: Partial<BacktestCampaign>): Promise<BacktestCampaign> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/backtest-journal/campaigns/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return this.parse(res);
  }

  async updateCampaign(id: number, payload: Partial<BacktestCampaign>): Promise<BacktestCampaign> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/backtest-journal/campaigns/${id}/`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    return this.parse(res);
  }

  async deleteCampaign(id: number): Promise<void> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/backtest-journal/campaigns/${id}/`,
      { method: 'DELETE' }
    );
    if (!res.ok && res.status !== 204) {
      await this.parse(res);
    }
  }

  async listObservations(campaignId: number): Promise<BacktestObservation[]> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/backtest-journal/campaigns/${campaignId}/observations/`
    );
    return this.parse(res);
  }

  async saveObservationsBulk(
    campaignId: number,
    items: Array<Partial<BacktestObservation> & { client_key?: string; id?: number }>
  ): Promise<{ items: BacktestObservation[] }> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/backtest-journal/campaigns/${campaignId}/observations/bulk/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      }
    );
    return this.parse(res);
  }

  async deleteObservation(id: number): Promise<void> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/backtest-journal/observations/${id}/`,
      { method: 'DELETE' }
    );
    if (!res.ok && res.status !== 204) {
      await this.parse(res);
    }
  }

  async duplicateObservation(id: number): Promise<BacktestObservation> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/backtest-journal/observations/${id}/duplicate/`,
      { method: 'POST' }
    );
    return this.parse(res);
  }

  async uploadScreenshot(
    observationId: number,
    file: File,
    kind: 'before' | 'after'
  ): Promise<{ kind: string; screenshot_before_url?: string; screenshot_after_url?: string }> {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/backtest-journal/observations/${observationId}/screenshots/`,
      { method: 'POST', body: form }
    );
    return this.parse(res);
  }

  async deleteScreenshot(observationId: number, kind: 'before' | 'after'): Promise<void> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/backtest-journal/observations/${observationId}/screenshots/${kind}/`,
      { method: 'DELETE' }
    );
    if (!res.ok && res.status !== 204) {
      await this.parse(res);
    }
  }

  async getStatistics(campaignId: number): Promise<BacktestMetrics> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/backtest-journal/campaigns/${campaignId}/statistics/`
    );
    return this.parse(res);
  }

  async getEquity(
    campaignId: number
  ): Promise<{ taken: EquityPoint[]; refused_theoretical: EquityPoint[] }> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/backtest-journal/campaigns/${campaignId}/equity/`
    );
    return this.parse(res);
  }

  async getAnalysis(campaignId: number, filters: AnalysisFilters = {}): Promise<AnalysisResponse> {
    const params: Record<string, unknown> = {
      direction: filters.direction,
      trade_taken: filters.trade_taken,
      result: filters.result,
      setup_valid: filters.setup_valid,
      start: filters.start,
      end: filters.end,
      group_by: filters.group_by,
      scope: filters.scope,
    };
    const search = new URLSearchParams(this.toQuery(params));
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/backtest-journal/campaigns/${campaignId}/analysis/?${search}`
    );
    return this.parse(res);
  }

  async exportCsv(campaignId: number, filters: AnalysisFilters = {}): Promise<Blob> {
    const params: Record<string, unknown> = {
      direction: filters.direction,
      trade_taken: filters.trade_taken,
      result: filters.result,
      selection: filters.selection ? '1' : undefined,
    };
    const search = new URLSearchParams(this.toQuery(params));
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/backtest-journal/campaigns/${campaignId}/export/?${search}`
    );
    if (!res.ok) {
      throw new Error('export_failed');
    }
    return res.blob();
  }
}

export const backtestJournalService = new BacktestJournalService();
export default backtestJournalService;
