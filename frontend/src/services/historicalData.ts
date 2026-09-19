import { getApiBaseUrl } from '../utils/apiConfig';
import { authService } from './auth';

export interface MarketInstrument {
  instrument: string;
  symbol_id: string;
  broker_symbol: string;
  name: string;
  tick_size: number | null;
  tick_value: number | null;
}

export interface MarketContract {
  contract_id: string;
  instrument: string;
  symbol: string;
  symbol_id: string;
  broker_symbol: string;
  expiry_month: number | null;
  expiry_year: number | null;
  expiry_date: string | null;
}

export interface CoverageEntry {
  instrument: string;
  contract_id: string;
  timeframe: string;
  start_utc: string;
  end_utc: string;
  bars_stored: number;
  bars_expected: number;
  unexpected_missing_count: number;
  status: 'complete' | 'partial' | 'empty';
  ranges: Array<{
    start_utc: string;
    end_utc: string;
    status: string;
    bars_stored: number;
    bars_expected: number;
  }>;
}

export interface DownloadJob {
  id: number;
  instrument: string;
  contract_id: string;
  timeframe: string;
  trigger?: string;
  start_utc: string;
  end_utc: string;
  status: string;
  progress_pct: number;
  bars_fetched: number;
  chunks_done: number;
  last_chunk_end: string | null;
  error: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface SyncTarget {
  instrument: string;
  timeframe: string;
  contract_id: string;
  ordering?: number;
}

export type SyncRunStatus = 'running' | 'success' | 'partial' | 'error' | 'up_to_date';

export interface SyncSettings {
  enabled: boolean;
  hour: number;
  minute: number;
  targets: SyncTarget[];
  last_run_local_date: string | null;
  last_run_at: string | null;
  last_finished_at: string | null;
  last_status: SyncRunStatus | '';
  last_error: string;
}

export interface SyncRunJob {
  id: number;
  instrument: string;
  timeframe: string;
  status: string;
  bars_fetched: number;
  error: string;
}

export interface SyncRun {
  id: number;
  trigger: string;
  status: SyncRunStatus;
  started_at: string;
  finished_at: string | null;
  job_ids: number[];
  bars_fetched_total: number;
  error: string;
  jobs: SyncRunJob[];
}

export interface SyncHealth {
  scheduler_last_tick_at: string | null;
  scheduler_ok: boolean;
  scheduler_stale_after_minutes: number;
  celery_workers_available: boolean;
  download_dispatch_mode: 'celery' | 'inline';
}

export interface QualityIssue {
  id: number;
  issue_type: string;
  severity: string;
  instrument: string;
  contract_id: string;
  timeframe: string;
  timestamp_utc: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

class HistoricalDataService {
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

  async listInstruments(q?: string): Promise<MarketInstrument[]> {
    const params = q ? `?q=${encodeURIComponent(q)}` : '';
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/market-data/instruments/${params}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || 'Erreur chargement instruments');
    }
    return res.json();
  }

  async listContracts(instrument: string, start?: string, end?: string): Promise<MarketContract[]> {
    const qs = new URLSearchParams({ instrument });
    if (start) qs.set('start', start);
    if (end) qs.set('end', end);
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/market-data/contracts/?${qs}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || 'Erreur chargement contrats');
    }
    return res.json();
  }

  async getCoverage(instrument?: string): Promise<CoverageEntry[]> {
    const qs = instrument ? `?instrument=${encodeURIComponent(instrument)}` : '';
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/market-data/coverage/${qs}`);
    if (!res.ok) throw new Error('Erreur chargement couverture');
    return res.json();
  }

  async listJobs(): Promise<DownloadJob[]> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/market-data/downloads/`);
    if (!res.ok) throw new Error('Erreur chargement jobs');
    return res.json();
  }

  async startDownload(payload: {
    instrument: string;
    contract_id?: string;
    timeframes: string[];
    start: string;
    end: string;
  }): Promise<{ jobs: DownloadJob[] }> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/market-data/downloads/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 429) {
        throw new Error(
          typeof body.detail === 'string'
            ? body.detail
            : 'Trop de téléchargements. Réessayez dans quelques minutes.',
        );
      }
      throw new Error(body.detail || 'Erreur lancement téléchargement');
    }
    const jobs = Array.isArray(body?.jobs) ? (body.jobs as DownloadJob[]) : [];
    if (jobs.length === 0) {
      throw new Error('Aucun job créé');
    }
    return { jobs };
  }

  async getJob(id: number): Promise<DownloadJob> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/market-data/downloads/${id}/`);
    if (res.status === 401) {
      throw new Error('AUTH_REQUIRED');
    }
    if (!res.ok) throw new Error('Job introuvable');
    return res.json();
  }

  async getJobIssues(id: number): Promise<QualityIssue[]> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/market-data/downloads/${id}/issues/`);
    if (!res.ok) throw new Error('Erreur issues');
    return res.json();
  }

  async exportBarsCsv(params: {
    instrument: string;
    timeframe: string;
    start: string;
    end: string;
    contract_id?: string;
  }): Promise<Blob> {
    const qs = new URLSearchParams({
      instrument: params.instrument,
      timeframe: params.timeframe,
      start: params.start,
      end: params.end,
    });
    if (params.contract_id) qs.set('contract_id', params.contract_id);
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/market-data/bars/export/?${qs}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || 'Erreur export CSV');
    }
    return res.blob();
  }

  async getSyncSettings(): Promise<SyncSettings> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/market-data/sync-settings/`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || 'Erreur chargement sync');
    }
    return res.json();
  }

  async updateSyncSettings(payload: {
    enabled: boolean;
    hour: number;
    minute: number;
    targets: SyncTarget[];
  }): Promise<SyncSettings> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/market-data/sync-settings/`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.detail || JSON.stringify(body) || 'Erreur sauvegarde sync');
    }
    return body;
  }

  async listSyncRuns(limit = 20): Promise<SyncRun[]> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/market-data/sync-runs/?limit=${limit}`,
    );
    if (!res.ok) throw new Error('Erreur chargement historique sync');
    return res.json();
  }

  async getSyncHealth(): Promise<SyncHealth> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/market-data/sync-health/`);
    if (!res.ok) throw new Error('Erreur chargement santé sync');
    return res.json();
  }

  async runSyncNow(): Promise<{ settings: SyncSettings; jobs: DownloadJob[] }> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/market-data/sync-settings/run-now/`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 429) {
        throw new Error(
          typeof body.detail === 'string'
            ? body.detail
            : 'Trop de téléchargements. Réessayez dans quelques minutes.',
        );
      }
      throw new Error(body.detail || 'Erreur lancement sync');
    }
    return body;
  }
}

export const historicalDataService = new HistoricalDataService();
export default historicalDataService;
