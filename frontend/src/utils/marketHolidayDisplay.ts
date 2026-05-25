import type { TFunction } from 'i18next';
import type { MarketHoliday } from '../services/calendar';
import { formatDate, type DateFormatType } from './dateFormat';
import { formatNumber, type NumberFormatType } from './numberFormat';

/** Aujourd'hui en YYYY-MM-DD (fuseau local). */
export function localTodayYyyyMmDd(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

/** Minuit local pour une date API YYYY-MM-DD. */
export function parseYmdLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function sortUpcomingHolidays(events: MarketHoliday[], max: number): MarketHoliday[] {
  const todayStr = localTodayYyyyMmDd();
  return events
    .filter((event) => event.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, max);
}

export function isHolidayUrgent(dateStr: string): boolean {
  const eventDate = parseYmdLocal(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = eventDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= 2;
}

export function formatHolidayRelativeDate(
  dateStr: string,
  t: TFunction,
  locale: string,
  dateFormat: DateFormatType = 'EU',
  numberFormat: NumberFormatType = 'comma',
): string {
  const eventDate = parseYmdLocal(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = eventDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return t('calendar:today', { defaultValue: "Aujourd'hui" });
  }
  if (diffDays === 1) {
    return t('common:dstChange.tomorrow', { defaultValue: 'Demain' });
  }
  if (diffDays <= 7) {
    return `${t('common:dstChange.in', { defaultValue: 'dans' })} ${formatNumber(diffDays, 0, numberFormat)} ${t('common:dstChange.days', { defaultValue: 'jours' })}`;
  }
  const formatted = formatDate(dateStr, dateFormat, false);
  if (formatted) {
    return formatted;
  }
  return eventDate.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}
