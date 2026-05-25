import type { TFunction } from 'i18next';
import {
  formatHolidayRelativeDate,
  isHolidayUrgent,
  localTodayYyyyMmDd,
  sortUpcomingHolidays,
} from './marketHolidayDisplay';
import type { MarketHoliday } from '../services/calendar';

const t = ((key: string, opts?: { defaultValue?: string }) =>
  opts?.defaultValue ?? key) as TFunction;

describe('marketHolidayDisplay', () => {
  it('sortUpcomingHolidays filters past and limits count', () => {
    const today = localTodayYyyyMmDd();
    const events: MarketHoliday[] = [
      { date: '2000-01-01', name: 'Old', type: 'holiday', market: 'XNYS' },
      { date: today, name: 'Today', type: 'holiday', market: 'XNYS' },
      { date: '2099-12-31', name: 'Far', type: 'holiday', market: 'XNYS' },
    ];
    const sorted = sortUpcomingHolidays(events, 1);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].name).toBe('Today');
  });

  it('isHolidayUrgent is true within 2 days', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const y = tomorrow.getFullYear();
    const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const d = String(tomorrow.getDate()).padStart(2, '0');
    expect(isHolidayUrgent(`${y}-${m}-${d}`)).toBe(true);
  });

  it('formatHolidayRelativeDate returns today label for same day', () => {
    const today = localTodayYyyyMmDd();
    expect(formatHolidayRelativeDate(today, t, 'fr')).toBe("Aujourd'hui");
  });
});
