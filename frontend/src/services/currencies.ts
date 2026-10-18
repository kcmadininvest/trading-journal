import { getApiBaseUrl } from '../utils/apiConfig';
import { fetchWithAuth } from './apiClient';

export interface Currency {
  id: number;
  code: string;
  name: string;
  symbol: string;
}

class CurrenciesService {
  private readonly BASE_URL = getApiBaseUrl();
  private cachedCurrencies: Currency[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
  private pendingRequest: Promise<Currency[]> | null = null;

  async list(): Promise<Currency[]> {
    // Return cached data if still valid
    if (this.cachedCurrencies && (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION) {
      return this.cachedCurrencies;
    }

    // Deduplicate concurrent requests
    if (this.pendingRequest) {
      return this.pendingRequest;
    }

    this.pendingRequest = (async () => {
      try {
        const res = await fetchWithAuth(`${this.BASE_URL}/api/trades/currencies/?page_size=200`);
        if (!res.ok) throw new Error('Erreur lors du chargement des devises');
        const data = await res.json();
        const currencies = Array.isArray(data) ? data : (data?.results ?? []);
        this.cachedCurrencies = currencies;
        this.cacheTimestamp = Date.now();
        return currencies;
      } finally {
        this.pendingRequest = null;
      }
    })();

    return this.pendingRequest;
  }
}

export const currenciesService = new CurrenciesService();


