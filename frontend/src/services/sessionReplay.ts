import { getApiBaseUrl } from '../utils/apiConfig';

export interface TradingSessionReplay {
  id: number;
  trading_account: number;
  trading_account_name: string;
  session_date: string;
  status: 'pending' | 'built' | 'failed';
  started_at: string | null;
  ended_at: string | null;
  trade_count: number;
  net_pnl: string | null;
  max_drawdown_intraday: string | null;
  build_error: string;
  built_at: string | null;
  event_count: number;
  insight_count: number;
  /** true si le build a conservé une session existante (API vide / indisponible). */
  preserved?: boolean;
  preserve_reason?: string;
  journal_draft?: {
    content: string;
    applied_at: string | null;
    applied_entry_id: number | null;
  };
}

export interface SessionEventItem {
  id: number;
  event_type: string;
  source: string;
  external_id: string;
  sequence: number;
  occurred_at: string;
  payload: Record<string, unknown>;
  trade_id: number | null;
}

/** Levée lorsque apply-journal renvoie 409 (entrée existante). */
export class JournalConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JournalConflictError';
  }
}

export class ReplayApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ReplayApiError';
    this.status = status;
  }
}

type ReplayRequestOptions = { signal?: AbortSignal };

export interface SessionInsightItem {
  id: number;
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  occurred_at: string;
  context: Record<string, unknown>;
}

class SessionReplayService {
  private readonly BASE_URL = getApiBaseUrl();

  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('access_token');
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const res = await fetch(url, {
      ...options,
      headers: { ...this.getAuthHeaders(), ...(options.headers || {}) },
    });
    if (res.status === 401) {
      throw new ReplayApiError('Non authentifié', 401);
    }
    return res;
  }

  private async parseErrorResponse(res: Response, fallback: string): Promise<string> {
    const err = await res.json().catch(() => ({}));
    const detail = (err as { detail?: string }).detail;
    return detail || fallback;
  }

  private ensureOk(res: Response, fallback: string): void {
    if (res.ok) return;
    if (res.status === 403) {
      throw new ReplayApiError(
        'Cette fonctionnalité nécessite un abonnement Premium.',
        403,
      );
    }
    throw new ReplayApiError(fallback, res.status);
  }

  async getActiveDates(
    tradingAccountId: number,
    options: ReplayRequestOptions = {},
  ): Promise<string[]> {
    const qs = new URLSearchParams({ trading_account: String(tradingAccountId) });
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/trades/replay/sessions/active-dates/?${qs}`,
      { signal: options.signal },
    );
    this.ensureOk(res, 'Impossible de charger les dates actives');
    const data = await res.json();
    return Array.isArray(data.dates) ? data.dates : [];
  }

  async list(
    params?: {
      trading_account?: number;
      date_from?: string;
      date_to?: string;
    },
    options: ReplayRequestOptions = {},
  ): Promise<TradingSessionReplay[]> {
    const qs = new URLSearchParams();
    if (params?.trading_account) qs.set('trading_account', String(params.trading_account));
    if (params?.date_from) qs.set('date_from', params.date_from);
    if (params?.date_to) qs.set('date_to', params.date_to);
    const url = `${this.BASE_URL}/api/trades/replay/sessions/${qs.toString() ? `?${qs}` : ''}`;
    const res = await this.fetchWithAuth(url, { signal: options.signal });
    this.ensureOk(res, 'Impossible de charger les sessions');
    const data = await res.json();
    return Array.isArray(data) ? data : data.results ?? [];
  }

  async get(id: number, options: ReplayRequestOptions = {}): Promise<TradingSessionReplay> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/trades/replay/sessions/${id}/`,
      { signal: options.signal },
    );
    this.ensureOk(res, 'Session introuvable');
    return res.json();
  }

  async build(
    tradingAccountId: number,
    sessionDate: string,
    options: ReplayRequestOptions = {},
  ): Promise<TradingSessionReplay> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/trades/replay/sessions/build/`,
      {
        method: 'POST',
        body: JSON.stringify({
          trading_account: tradingAccountId,
          session_date: sessionDate,
        }),
        signal: options.signal,
      },
    );
    if (!res.ok) {
      const msg = await this.parseErrorResponse(res, 'Échec de la construction de la session');
      if (res.status === 403) {
        throw new ReplayApiError(msg, 403);
      }
      throw new ReplayApiError(msg, res.status);
    }
    return res.json();
  }

  async getTimeline(
    sessionId: number,
    options: ReplayRequestOptions = {},
  ): Promise<SessionEventItem[]> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/trades/replay/sessions/${sessionId}/timeline/`,
      { signal: options.signal },
    );
    this.ensureOk(res, 'Timeline indisponible');
    return res.json();
  }

  async getInsights(
    sessionId: number,
    options: ReplayRequestOptions = {},
  ): Promise<SessionInsightItem[]> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/trades/replay/sessions/${sessionId}/insights/`,
      { signal: options.signal },
    );
    this.ensureOk(res, 'Insights indisponibles');
    return res.json();
  }

  async applyJournal(sessionId: number, overwrite = false): Promise<{ entry_id: number; created: boolean }> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/trades/replay/sessions/${sessionId}/apply-journal/`,
      {
        method: 'POST',
        body: JSON.stringify({ overwrite }),
      },
    );
    if (res.status === 409) {
      const err = await res.json();
      throw new JournalConflictError(err.detail || 'Journal existant');
    }
    if (!res.ok) throw new Error('Impossible d\'appliquer le journal');
    return res.json();
  }
}

export const sessionReplayService = new SessionReplayService();
