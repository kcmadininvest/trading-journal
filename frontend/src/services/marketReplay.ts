import { getApiBaseUrl } from '../utils/apiConfig';
import { authService } from './auth';
import type { MarketInstrument } from './historicalData';
import { historicalDataService } from './historicalData';

export interface AvailableTimeframe {
  value: string;
  label: string;
  durationSeconds: number;
}

export interface ReplayCandle {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface ReplayBarsResponse {
  instrument: string;
  contract_mode: string;
  start: string;
  end: string;
  series: Record<string, ReplayCandle[]>;
}

export interface InstrumentTimeframesResponse {
  symbol: string;
  timeframes: Array<{
    value: string;
    label: string;
    duration_seconds: number;
  }>;
  last_bar_at?: string | null;
  latest_session_date?: string | null;
}

export interface AvailableSessionsResponse {
  symbol: string;
  timeframe: string | null;
  contract: string;
  sessions: string[];
  earliest: string | null;
  latest: string | null;
}

export interface InstrumentReplayMeta {
  timeframes: AvailableTimeframe[];
  lastBarAt: string | null;
  latestSessionDate: string | null;
}

function mapTimeframe(row: {
  value: string;
  label: string;
  duration_seconds: number;
}): AvailableTimeframe {
  return {
    value: row.value,
    label: row.label,
    durationSeconds: row.duration_seconds,
  };
}

class MarketReplayService {
  private readonly BASE_URL = getApiBaseUrl();

  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('access_token');
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private async refreshAccessToken(): Promise<boolean> {
    const access = await authService.refreshAccessToken();
    return !!access;
  }

  private async fetchWithAuth(input: string, init: RequestInit = {}, retry = true): Promise<Response> {
    const headers: Record<string, string> = {
      ...((init.headers as Record<string, string>) || {}),
      ...this.getAuthHeaders(),
    };
    const res = await fetch(input, { ...init, headers });
    if (res.status === 401 && retry) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        const headers2: Record<string, string> = {
          ...((init.headers as Record<string, string>) || {}),
          ...this.getAuthHeaders(),
        };
        return fetch(input, { ...init, headers: headers2 });
      }
    }
    return res;
  }

  async listInstrumentsWithBars(): Promise<MarketInstrument[]> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/market-data/instruments/?with_bars=1`,
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || 'Erreur chargement instruments');
    }
    return res.json();
  }

  /** Fallback catalogue complet (TopStep) si besoin. */
  async listInstruments(q?: string): Promise<MarketInstrument[]> {
    return historicalDataService.listInstruments(q);
  }

  async getInstrumentReplayMeta(instrument: string): Promise<InstrumentReplayMeta> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/market-data/instruments/${encodeURIComponent(instrument)}/timeframes/`,
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || 'Erreur chargement timeframes');
    }
    const body: InstrumentTimeframesResponse = await res.json();
    return {
      timeframes: (body.timeframes || []).map(mapTimeframe),
      lastBarAt: body.last_bar_at ?? null,
      latestSessionDate: body.latest_session_date ?? null,
    };
  }

  async getAvailableTimeframes(instrument: string): Promise<AvailableTimeframe[]> {
    const meta = await this.getInstrumentReplayMeta(instrument);
    return meta.timeframes;
  }

  async getAvailableSessions(
    instrument: string,
    opts?: { timeframe?: string; contract?: string },
  ): Promise<AvailableSessionsResponse> {
    const qs = new URLSearchParams();
    if (opts?.timeframe) qs.set('timeframe', opts.timeframe);
    if (opts?.contract) qs.set('contract', opts.contract);
    const query = qs.toString();
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/market-data/instruments/${encodeURIComponent(instrument)}/available-sessions/${query ? `?${query}` : ''}`,
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || 'Erreur chargement séances disponibles');
    }
    return res.json();
  }

  async getBars(params: {
    instrument: string;
    timeframes: string[];
    start: string;
    end: string;
    contract?: string;
  }): Promise<ReplayBarsResponse> {
    const qs = new URLSearchParams({
      instrument: params.instrument,
      timeframes: params.timeframes.join(','),
      start: params.start,
      end: params.end,
      contract: params.contract || 'front',
    });
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/market-data/bars/?${qs}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || 'Erreur chargement bougies');
    }
    return res.json();
  }
}

export const marketReplayService = new MarketReplayService();
export default marketReplayService;
