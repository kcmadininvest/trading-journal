import { getApiBaseUrl } from '../utils/apiConfig';

export interface FxRatesResponse {
  available: boolean;
  base_currency: string;
  rates: Record<string, number>;
  fx_conversion_applied: boolean;
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('access_token');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export const fxRatesService = {
  async getRates(base: string, symbols: string[]): Promise<FxRatesResponse | null> {
    const baseCode = base.trim().toUpperCase();
    const wanted = symbols
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s && s !== baseCode);
    if (wanted.length === 0) {
      return {
        available: true,
        base_currency: baseCode,
        rates: {},
        fx_conversion_applied: false,
      };
    }

    const params = new URLSearchParams({
      base: baseCode,
      symbols: wanted.join(','),
    });

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/trades/fx-rates/?${params}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return null;
      return (await res.json()) as FxRatesResponse;
    } catch {
      return null;
    }
  },

  async fetchRates(base: string, symbols: string[]): Promise<boolean> {
    const data = await this.getRates(base, symbols);
    return data?.available === true;
  },
};
