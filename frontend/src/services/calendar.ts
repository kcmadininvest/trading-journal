import { getApiBaseUrl } from '../utils/apiConfig';

export interface DailyCalendarData {
  date: string;
  pnl: number;
  trade_count: number;
  strategy_compliance_status?: 'compliant' | 'non_compliant' | 'partial' | 'unknown';
}

export interface WeeklyCalendarData {
  week?: number;
  saturday_date?: string;
  pnl: number;
  trade_count: number;
}

export interface MonthlyCalendarData {
  month: number;
  pnl: number;
  trade_count: number;
}

export interface CalendarMonthResponse {
  daily_data: DailyCalendarData[];
  weekly_data: WeeklyCalendarData[];
  monthly_total: number;
  year: number;
  month: number;
}

export interface CalendarYearlyResponse {
  monthly_data: MonthlyCalendarData[];
  yearly_total: number;
  year: number;
}

export interface CalendarWeeklyYearlyResponse {
  weekly_data: WeeklyCalendarData[];
  yearly_total: number;
  year: number;
}

class CalendarService {
  private readonly BASE_URL = getApiBaseUrl();

  private getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
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

  /**
   * Récupère les données pour un mois spécifique (vue quotidienne)
   */
  async getMonthData(year: number, month: number, tradingAccount?: number): Promise<CalendarMonthResponse> {
    const params = new URLSearchParams({
      year: String(year),
      month: String(month),
    });
    if (tradingAccount) {
      params.append('trading_account', String(tradingAccount));
    }
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/topstep/calendar_data/?${params}`);
    if (!res.ok) throw new Error('Erreur lors du chargement des données mensuelles');
    return res.json();
  }

  /**
   * Récupère les données pour une année complète (vue mensuelle)
   */
  async getYearlyMonthlyData(year: number, tradingAccount?: number): Promise<CalendarYearlyResponse> {
    const params = new URLSearchParams({
      year: String(year),
    });
    if (tradingAccount) {
      params.append('trading_account', String(tradingAccount));
    }
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/topstep/calendar_monthly_data/?${params}`);
    if (!res.ok) throw new Error('Erreur lors du chargement des données annuelles');
    return res.json();
  }

  /**
   * Récupère les données hebdomadaires pour une année
   */
  async getYearlyWeeklyData(year: number, tradingAccount?: number): Promise<CalendarWeeklyYearlyResponse> {
    const params = new URLSearchParams({
      year: String(year),
    });
    if (tradingAccount) {
      params.append('trading_account', String(tradingAccount));
    }
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/topstep/calendar_weekly_data/?${params}`);
    if (!res.ok) throw new Error('Erreur lors du chargement des données hebdomadaires');
    return res.json();
  }
}

export const calendarService = new CalendarService();

