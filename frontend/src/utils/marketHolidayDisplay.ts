import type { TFunction } from 'i18next';
import type { MarketHoliday } from '../services/calendar';
import { formatDate, type DateFormatType } from './dateFormat';
import { formatNumber, type NumberFormatType } from './numberFormat';
import { diffYmdDays } from './zonedWallClock';

/** Aujourd'hui en YYYY-MM-DD (fuseau local navigateur). */
export function localTodayYyyyMmDd(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

/** Minuit local pour une date API YYYY-MM-DD. */
export function parseYmdLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function sortUpcomingHolidays(
  events: MarketHoliday[],
  max: number,
  todayYmd: string = localTodayYyyyMmDd(),
): MarketHoliday[] {
  return events
    .filter((event) => event.date >= todayYmd)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, max);
}

export function isHolidayUrgent(
  dateStr: string,
  todayYmd: string = localTodayYyyyMmDd(),
): boolean {
  return diffYmdDays(todayYmd, dateStr) <= 2;
}

export function formatHolidayRelativeDate(
  dateStr: string,
  t: TFunction,
  locale: string,
  dateFormat: DateFormatType = 'EU',
  numberFormat: NumberFormatType = 'comma',
  todayYmd: string = localTodayYyyyMmDd(),
): string {
  const diffDays = diffYmdDays(todayYmd, dateStr);

  if (diffDays === 0) {
    return t('calendar:today', { defaultValue: "Aujourd'hui" });
  }
  if (diffDays === 1) {
    return t('common:relativeDate.tomorrow', { defaultValue: 'Demain' });
  }
  if (diffDays <= 7) {
    // `value` (pas `count`) : i18next réserve `count` au pluriel (number),
    // alors que l’affichage passe par formatNumber (string, prefs utilisateur).
    const value = formatNumber(diffDays, 0, numberFormat);
    return t('common:relativeDate.inDays', {
      defaultValue: 'dans {{value}} jours',
      value,
    });
  }
  const formatted = formatDate(dateStr, dateFormat, false);
  if (formatted) {
    return formatted;
  }
  return parseYmdLocal(dateStr).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}
