import { getApiBaseUrl } from '../utils/apiConfig';

export interface DailyJournalImage {
  id: number;
  image: string;
  image_url: string;
  caption: string;
  order: number;
  created_at: string;
}

export interface DailyJournalEntry {
  id: number;
  trading_account: number | null;
  trading_account_name?: string | null;
  date: string; // YYYY-MM-DD
  content: string;
  images: DailyJournalImage[];
  created_at: string;
  updated_at: string;
}

export interface DailyJournalFilters {
  date?: string;
  start_date?: string;
  end_date?: string;
  trading_account?: number;
  page?: number;
  page_size?: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface DailyJournalGroupedEntry {
  id: number;
  date: string;
  content_preview: string;
  images_count: number;
  updated_at: string;
  trading_account: number | null;
  trading_account_name?: string | null;
}

export interface DailyJournalGroupedMonth {
  month: number;
  entries: DailyJournalGroupedEntry[];
}

export interface DailyJournalGroupedYear {
  year: number;
  months: DailyJournalGroupedMonth[];
}

export interface DailyJournalGroupedResponse {
  years: DailyJournalGroupedYear[];
}

class DailyJournalService {
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh })
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

  private toQuery(params: Record<string, any>) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return;
      search.set(k, String(v));
    });
    return search.toString();
  }

  async listEntries(filters: DailyJournalFilters = {}): Promise<PaginatedResponse<DailyJournalEntry>> {
    const query = this.toQuery(filters);
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/daily-journal/entries/?${query}`);
    if (!res.ok) throw new Error('Erreur lors du chargement du journal');
    return res.json();
  }

  async listGrouped(filters: DailyJournalFilters = {}): Promise<DailyJournalGroupedResponse> {
    const query = this.toQuery(filters);
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/daily-journal/entries/grouped/?${query}`);
    if (!res.ok) throw new Error('Erreur lors du chargement du journal');
    return res.json();
  }

  async getEntry(entryId: number): Promise<DailyJournalEntry> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/daily-journal/entries/${entryId}/`);
    if (!res.ok) throw new Error('Erreur lors du chargement du journal');
    return res.json();
  }

  async getEntryByDate(date: string, tradingAccount?: number): Promise<DailyJournalEntry | null> {
    const response = await this.listEntries({
      date,
      trading_account: tradingAccount,
      page_size: 1,
    });
    return response.results[0] || null;
  }

  async createEntry(payload: Pick<DailyJournalEntry, 'date' | 'content'> & { trading_account?: number | null }): Promise<DailyJournalEntry> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/daily-journal/entries/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.detail || 'Erreur lors de la création du journal');
    }
    return res.json();
  }

  async updateEntry(entryId: number, payload: Partial<Pick<DailyJournalEntry, 'content' | 'trading_account' | 'date'>>): Promise<DailyJournalEntry> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/daily-journal/entries/${entryId}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.detail || 'Erreur lors de la mise à jour du journal');
    }
    return res.json();
  }

  async deleteEntry(entryId: number): Promise<void> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/daily-journal/entries/${entryId}/`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error('Erreur lors de la suppression du journal');
    }
  }

  async uploadImage(entryId: number, file: File, caption?: string): Promise<DailyJournalImage> {
    const formData = new FormData();
    formData.append('image', file);
    if (caption) {
      formData.append('caption', caption);
    }
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/daily-journal/entries/${entryId}/images/`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.detail || error.error || 'Erreur lors de l’upload de l’image');
    }
    return res.json();
  }

  async updateImage(entryId: number, imageId: number, payload: Partial<Pick<DailyJournalImage, 'caption' | 'order'>>): Promise<DailyJournalImage> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/daily-journal/entries/${entryId}/images/${imageId}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.detail || error.error || 'Erreur lors de la mise à jour de l’image');
    }
    return res.json();
  }

  async deleteImage(entryId: number, imageId: number): Promise<void> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/daily-journal/entries/${entryId}/images/${imageId}/`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error('Erreur lors de la suppression de l’image');
    }
  }
}

export const dailyJournalService = new DailyJournalService();
