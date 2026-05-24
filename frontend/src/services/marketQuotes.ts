import { getApiBaseUrl } from '../utils/apiConfig';

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

  async getSnapshot(): Promise<MarketQuotesSnapshot> {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${this.baseUrl}/api/trades/market-quotes/`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }
}

export const marketQuotesService = new MarketQuotesService();
