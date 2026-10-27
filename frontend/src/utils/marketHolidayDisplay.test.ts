import type { TFunction } from 'i18next';
import {
  formatHolidayRelativeDate,
  isHolidayUrgent,
  localTodayYyyyMmDd,
  sortUpcomingHolidays,
} from './marketHolidayDisplay';
import type { MarketHoliday } from '../services/calendar';

const t = ((key: string, opts?: { defaultValue?: string; count?: string | number }) => {
  if (key === 'common:relativeDate.inDays' && opts?.count != null) {
    return `dans ${opts.count} jours`;
  }
  if (key === 'common:relativeDate.tomorrow') return 'Demain';
  if (key === 'calendar:today') return "Aujourd'hui";
  return opts?.defaultValue ?? key;
}) as TFunction;

describe('marketHolidayDisplay', () => {
  it('sortUpcomingHolidays filters past and limits count', () => {
    const today = localTodayYyyyMmDd();
    const events: MarketHoliday[] = [
      { date: '2000-01-01', name: 'Old', type: 'holiday', market: 'XNYS' },
      { date: today, name: 'Today', type: 'holiday', market: 'XNYS' },
      { date: '2099-12-31', name: 'Far', type: 'holiday', market: 'XNYS' },
    ];
    const sorted = sortUpcomingHolidays(events, 1, today);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].name).toBe('Today');
  });

  it('isHolidayUrgent is true within 2 days using todayYmd', () => {
    expect(isHolidayUrgent('2026-10-25', '2026-10-24')).toBe(true);
    expect(isHolidayUrgent('2026-10-30', '2026-10-24')).toBe(false);
  });

  it('formatHolidayRelativeDate returns today label for same day', () => {
    expect(formatHolidayRelativeDate('2026-10-24', t, 'fr', 'EU', 'comma', '2026-10-24')).toBe(
      "Aujourd'hui",
    );
  });

  it('formatHolidayRelativeDate keeps capitalized Demain via relativeDate.tomorrow', () => {
    expect(formatHolidayRelativeDate('2026-10-25', t, 'fr', 'EU', 'comma', '2026-10-24')).toBe(
      'Demain',
    );
  });

  it('formatHolidayRelativeDate uses inDays for ≤7', () => {
    expect(formatHolidayRelativeDate('2026-10-27', t, 'fr', 'EU', 'comma', '2026-10-24')).toBe(
      'dans 3 jours',
    );
  });
});
