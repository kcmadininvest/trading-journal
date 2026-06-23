import { getApiBaseUrl } from '../utils/apiConfig';
import { authService } from './auth';

export interface MarketQuoteItem {
  key: string;
  label: string;
  contract_id: string | null;
  last_price: number | null;
  last_price_display: string | null;
  change: number | null;
  change_percent: number | null;
  timestamp: string | null;
}

export interface MarketQuotesSnapshot {
  updated_at: string | null;
  connected: boolean;
  message: string | null;
  quotes: MarketQuoteItem[];
}

class MarketQuotesService {
  private readonly baseUrl = getApiBaseUrl();

  getWebSocketBaseUrl(): string {
    if (this.baseUrl.startsWith('http://') || this.baseUrl.startsWith('https://')) {
      const parsed = new URL(this.baseUrl);
      parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
      return parsed.origin;
    }
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}`;
    }
    return 'ws://127.0.0.1:8000';
  }

  private getAuthHeaders(): Record<string, string> {
    const token = authService.getAccessToken();
    return {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    };
  }

  async getSnapshot(): Promise<MarketQuotesSnapshot> {
    let response = await fetch(`${this.baseUrl}/api/trades/market-quotes/`, {
      headers: this.getAuthHeaders(),
    });
    if (response.status === 401) {
      const refreshed = await authService.refreshAccessToken();
      if (refreshed) {
        response = await fetch(`${this.baseUrl}/api/trades/market-quotes/`, {
          headers: this.getAuthHeaders(),
        });
      }
    }
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }
}

export const marketQuotesService = new MarketQuotesService();
