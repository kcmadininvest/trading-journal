const BASE = '/api/trades/market-phases';

export interface MarketPhaseDefinition {
  id: number;
  code: string;
  label: string;
  color: string;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface MarketPhaseEventDefinition {
  id: number;
  code: string;
  label: string;
  category: string;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface MarketPhaseEvent {
  id?: number;
  occurred_at: string;
  event_type?: number;
  event_type_code?: string;
  event_type_label?: string;
  direction?: string;
  candle_part?: string;
  outcome?: string;
  parent_block?: number | null;
  attributes?: Record<string, unknown>;
  source?: string;
}

export interface MarketPhaseBlock {
  id?: number;
  instrument_key: string;
  range_start: string;
  range_end: string | null;
  phase?: number;
  phase_code?: string;
  phase_label?: string;
  phase_color?: string;
  preceding_context?: string;
  notes?: string;
  source?: string;
  events?: MarketPhaseEvent[];
}

export interface MarketPhaseCapture {
  session_date: string;
  trading_account: number;
  instrument_key: string;
  blocks: MarketPhaseBlock[];
  orphan_events: MarketPhaseEvent[];
}

export interface MarketPhaseSlotConfig {
  mode: 'fixed' | 'custom' | 'hour';
  duration_minutes: number;
  anchor: 'market_open' | 'clock_hour';
  market_code: string;
  custom_boundaries: unknown[];
  custom_analytical_periods: Array<{
    key?: string;
    label?: string;
    start: string;
    end: string;
  }>;
  default_instrument_key: string;
}

export interface AssetMarketProfile {
  instrument_key: string;
  instrument_label: string;
  period: { key: string; label: string };
  sample_sessions: number;
  regime_breakdown: Record<string, number>;
  dominant_regime: string | null;
  dominant_regime_pct: number;
  fakeout_rate: number | null;
  breakout_body_vs_wick?: { body: number; wick: number };
}

export interface PeriodProfile extends AssetMarketProfile {
  trade_count: number;
  win_rate: number;
  expectancy: number;
  win_rate_by_regime: Record<string, number>;
  verdict: 'favor' | 'avoid' | 'neutral' | 'insufficient_data';
  confidence: string;
}

export interface MarketInstrument {
  key: string;
  label: string;
  name: string;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('access_token');
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
}

class MarketPhasesService {
  async getInstruments(tradingAccountId?: number | null): Promise<{ instruments: MarketInstrument[] }> {
    const params = new URLSearchParams();
    if (tradingAccountId != null) {
      params.set('trading_account', String(tradingAccountId));
    }
    const qs = params.toString();
    return fetchJson(`${BASE}/instruments/${qs ? `?${qs}` : ''}`);
  }

  async getPhaseDefinitions(): Promise<MarketPhaseDefinition[]> {
    const data = await fetchJson<{ results?: MarketPhaseDefinition[] } | MarketPhaseDefinition[]>(
      `${BASE}/definitions/phases/`,
    );
    return Array.isArray(data) ? data : data.results || [];
  }

  async getEventDefinitions(): Promise<MarketPhaseEventDefinition[]> {
    const data = await fetchJson<{ results?: MarketPhaseEventDefinition[] } | MarketPhaseEventDefinition[]>(
      `${BASE}/definitions/events/`,
    );
    return Array.isArray(data) ? data : data.results || [];
  }

  async getSlotConfig(): Promise<MarketPhaseSlotConfig> {
    return fetchJson(`${BASE}/slot-config/`);
  }

  async updateSlotConfig(partial: Partial<MarketPhaseSlotConfig>): Promise<MarketPhaseSlotConfig> {
    return fetchJson(`${BASE}/slot-config/`, {
      method: 'PATCH',
      body: JSON.stringify(partial),
    });
  }

  async getCapture(params: {
    session_date: string;
    trading_account: number;
    instrument_key: string;
  }): Promise<MarketPhaseCapture> {
    const q = new URLSearchParams();
    q.set('session_date', params.session_date);
    q.set('trading_account', String(params.trading_account));
    q.set('instrument_key', params.instrument_key);
    return fetchJson(`${BASE}/capture/?${q}`);
  }

  async bulkCapture(payload: {
    session_date: string;
    trading_account: number;
    instrument_key: string;
    source?: 'live' | 'replay';
    trading_session?: number | null;
    blocks: MarketPhaseBlock[];
    events: MarketPhaseEvent[];
  }): Promise<{ blocks: MarketPhaseBlock[]; events_count: number }> {
    return fetchJson(`${BASE}/capture/`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async getAssetProfiles(params: {
    instrument_key: string;
    date_from?: string;
    date_to?: string;
    trading_account?: number;
    period_key?: string;
  }): Promise<{ profiles: AssetMarketProfile[] } | AssetMarketProfile> {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) q.set(k, String(v));
    });
    return fetchJson(`${BASE}/analytics/asset-profile/?${q}`);
  }

  async getPeriodProfile(params: {
    instrument_key: string;
    period_key: string;
    date_from?: string;
    date_to?: string;
    trading_account?: number;
  }): Promise<PeriodProfile> {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) q.set(k, String(v));
    });
    return fetchJson(`${BASE}/analytics/period-profile/?${q}`);
  }

  async getRanking(params: {
    instrument_key: string;
    date_from?: string;
    date_to?: string;
    trading_account?: number;
    sort_by?: string;
  }): Promise<{ ranking: PeriodProfile[] }> {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) q.set(k, String(v));
    });
    return fetchJson(`${BASE}/analytics/ranking/?${q}`);
  }
}

export const marketPhasesService = new MarketPhasesService();
