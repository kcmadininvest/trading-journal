import { getApiBaseUrl } from '../utils/apiConfig';
import type { PnlDisplayMode } from '../utils/pnlDisplay';
import { fetchWithAuth } from './apiClient';

export interface DailyCalendarData {
  date: string;
  pnl: number;
  trade_count: number;
  strategy_compliance_status?: 'compliant' | 'non_compliant' | 'partial' | 'unknown';
  has_journal_entry?: boolean;
  journal_entry_id?: number | null;
  has_deposit?: boolean;
  has_withdrawal?: boolean;
  deposit_count?: number;
  withdrawal_count?: number;
  deposit_total?: string;
  withdrawal_total?: string;
}

export interface WeeklyCalendarData {
  week?: number;
  saturday_date?: string;
  pnl: number;
  trade_count: number;
}

export interface AdjacentDayCalendarData {
  date: string; // YYYY-MM-DD
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
  adjacent_days?: AdjacentDayCalendarData[];
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

export interface MarketHoliday {
  date: string;
  name: string;
  type: 'holiday' | 'early_close';
  market: string;
}

export interface MarketHolidaysResponse {
  upcoming: MarketHoliday[];
  count: number;
}

export interface MarketHolidayTodayEntry {
  date: string | null;
  is_full_day_holiday: boolean;
  is_early_close_day?: boolean;
  regular_session_close_local?: string | null;
}

export interface MarketTodaySnapshot {
  isFullDayHoliday: boolean;
  isEarlyCloseDay: boolean;
  sessionCloseLocal: string | null;
}

export interface MarketHolidaysTodayResponse {
  markets: Record<string, MarketHolidayTodayEntry>;
}

/** Réponse ?bundle=1 : statut du jour + prochains événements en une requête */
export interface MarketHolidaysBundleResponse {
  markets: Record<string, MarketHolidayTodayEntry>;
  upcoming: MarketHoliday[];
  count: number;
}

class CalendarService {
  private readonly BASE_URL = getApiBaseUrl();

  /**
   * Récupère les données pour un mois spécifique (vue quotidienne)
   */
  async getMonthData(
    year: number,
    month: number,
    tradingAccount?: number,
    pnlDisplay?: PnlDisplayMode
  ): Promise<CalendarMonthResponse> {
    const params = new URLSearchParams({
      year: String(year),
      month: String(month),
    });
    if (tradingAccount) {
      params.append('trading_account', String(tradingAccount));
    }
    if (pnlDisplay) {
      params.append('pnl_display', pnlDisplay);
    }
    const res = await fetchWithAuth(`${this.BASE_URL}/api/trades/imported/calendar_data/?${params}`);
    if (!res.ok) throw new Error('Erreur lors du chargement des données mensuelles');
    return res.json();
  }

  /**
   * Récupère les données pour une année complète (vue mensuelle)
   */
  async getYearlyMonthlyData(
    year: number,
    tradingAccount?: number,
    pnlDisplay?: PnlDisplayMode
  ): Promise<CalendarYearlyResponse> {
    const params = new URLSearchParams({
      year: String(year),
    });
    if (tradingAccount) {
      params.append('trading_account', String(tradingAccount));
    }
    if (pnlDisplay) {
      params.append('pnl_display', pnlDisplay);
    }
    const res = await fetchWithAuth(`${this.BASE_URL}/api/trades/imported/calendar_monthly_data/?${params}`);
    if (!res.ok) throw new Error('Erreur lors du chargement des données annuelles');
    return res.json();
  }

  /**
   * Récupère les données hebdomadaires pour une année
   */
  async getYearlyWeeklyData(
    year: number,
    tradingAccount?: number,
    pnlDisplay?: PnlDisplayMode
  ): Promise<CalendarWeeklyYearlyResponse> {
    const params = new URLSearchParams({
      year: String(year),
    });
    if (tradingAccount) {
      params.append('trading_account', String(tradingAccount));
    }
    if (pnlDisplay) {
      params.append('pnl_display', pnlDisplay);
    }
    const res = await fetchWithAuth(`${this.BASE_URL}/api/trades/imported/calendar_weekly_data/?${params}`);
    if (!res.ok) throw new Error('Erreur lors du chargement des données hebdomadaires');
    return res.json();
  }

  /**
   * Récupère les prochains jours fériés et demi-journées des marchés boursiers
   * Endpoint public (pas besoin d'authentification)
   */
  async getMarketHolidays(count: number = 1, markets: string = 'XNYS,XPAR'): Promise<MarketHolidaysResponse> {
    const params = new URLSearchParams({
      count: String(count),
      markets: markets,
    });
    const res = await fetch(`${this.BASE_URL}/api/trades/market-holidays/?${params}`);
    if (!res.ok) throw new Error('Erreur lors du chargement des jours fériés des marchés');
    return res.json();
  }

  /**
   * Jours fériés « journée entière » pour la date locale de chaque marché (endpoint public, léger).
   */
  async getMarketHolidaysToday(markets: string = 'XNYS,XPAR,XLON,XTKS'): Promise<MarketHolidaysTodayResponse> {
    const params = new URLSearchParams({ markets, today: '1' });
    const res = await fetch(`${this.BASE_URL}/api/trades/market-holidays/?${params}`);
    if (!res.ok) throw new Error('Erreur lors du chargement du statut jour férié pour aujourd\'hui');
    return res.json();
  }

  /**
   * Statut « aujourd’hui » par marché + prochains jours fériés en une seule requête (moins de latence au chargement).
   */
  async getMarketHolidaysBundle(
    count: number = 1,
    markets: string = 'XNYS,XPAR,XLON,XTKS'
  ): Promise<MarketHolidaysBundleResponse> {
    const params = new URLSearchParams({
      bundle: '1',
      count: String(count),
      markets,
    });
    const res = await fetch(`${this.BASE_URL}/api/trades/market-holidays/?${params}`);
    if (!res.ok) throw new Error('Erreur lors du chargement du bundle calendrier marchés');
    return res.json();
  }
}

export const calendarService = new CalendarService();

