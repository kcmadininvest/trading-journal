/**
 * Utilitaire pour calculer les dates de changement d'heure (DST) des marchés
 *
 * Règles DST aux États-Unis (depuis 2007):
 * - Heure d'été (Spring Forward): 2ème dimanche de mars à 2h00 AM
 * - Heure d'hiver (Fall Back): 1er dimanche de novembre à 2h00 AM
 *
 * Règles DST en Europe (Union Européenne):
 * - Heure d'été (Spring Forward): Dernier dimanche de mars à 2h00 AM
 * - Heure d'hiver (Fall Back): Dernier dimanche d'octobre à 3h00 AM
 */

import {
  addYmdDays,
  diffYmdDays,
  getTodayYmdInTimezone,
  wallClockInTimezoneToUnix,
} from './zonedWallClock';

export type MarketRegion = 'US' | 'EU';

export interface DSTEvent {
  instant: Date;
  dateYmd: string;
  type: 'spring' | 'fall';
  daysUntil: number;
  isToday: boolean;
  isTomorrow: boolean;
  region: MarketRegion;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toYmd(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

/** Nième jour de semaine du mois (UTC weekday pour stabilité). */
function getNthWeekdayYmd(
  year: number,
  monthIndex: number,
  dayOfWeek: number,
  occurrence: number,
): string {
  let count = 0;
  for (let day = 1; day <= 31; day += 1) {
    const dt = new Date(Date.UTC(year, monthIndex, day));
    if (dt.getUTCMonth() !== monthIndex) break;
    if (dt.getUTCDay() === dayOfWeek) {
      count += 1;
      if (count === occurrence) {
        return toYmd(year, monthIndex, day);
      }
    }
  }
  return toYmd(year, monthIndex, 1);
}

function getLastWeekdayYmd(year: number, monthIndex: number, dayOfWeek: number): string {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  for (let day = lastDay; day >= 1; day -= 1) {
    const dt = new Date(Date.UTC(year, monthIndex, day));
    if (dt.getUTCDay() === dayOfWeek) {
      return toYmd(year, monthIndex, day);
    }
  }
  return toYmd(year, monthIndex, lastDay);
}

function springYmdUS(year: number): string {
  return getNthWeekdayYmd(year, 2, 0, 2);
}

function fallYmdUS(year: number): string {
  return getNthWeekdayYmd(year, 10, 0, 1);
}

function springYmdEU(year: number): string {
  return getLastWeekdayYmd(year, 2, 0);
}

function fallYmdEU(year: number): string {
  return getLastWeekdayYmd(year, 9, 0);
}

function transitionHour(region: MarketRegion, type: 'spring' | 'fall'): number {
  if (region === 'EU' && type === 'fall') return 3;
  return 2;
}

/**
 * Prochain changement d'heure DST pour une région, ancré sur le fuseau marché.
 */
export function getNextDSTChange(
  region: MarketRegion,
  marketTimeZone: string,
  now: Date = new Date(),
): DSTEvent | null {
  const todayYmd = getTodayYmdInTimezone(marketTimeZone, now);
  const currentYear = Number(todayYmd.slice(0, 4));

  const ymds: Array<{ dateYmd: string; type: 'spring' | 'fall' }> =
    region === 'US'
      ? [
          { dateYmd: springYmdUS(currentYear), type: 'spring' },
          { dateYmd: fallYmdUS(currentYear), type: 'fall' },
          { dateYmd: springYmdUS(currentYear + 1), type: 'spring' },
          { dateYmd: fallYmdUS(currentYear + 1), type: 'fall' },
        ]
      : [
          { dateYmd: springYmdEU(currentYear), type: 'spring' },
          { dateYmd: fallYmdEU(currentYear), type: 'fall' },
          { dateYmd: springYmdEU(currentYear + 1), type: 'spring' },
          { dateYmd: fallYmdEU(currentYear + 1), type: 'fall' },
        ];

  const upcoming = ymds
    .filter((e) => e.dateYmd >= todayYmd)
    .sort((a, b) => a.dateYmd.localeCompare(b.dateYmd));

  if (upcoming.length === 0) {
    return null;
  }

  const next = upcoming[0];
  const hour = transitionHour(region, next.type);
  const instantUnix = wallClockInTimezoneToUnix(next.dateYmd, hour, 0, marketTimeZone);
  const daysUntil = diffYmdDays(todayYmd, next.dateYmd);
  const tomorrowYmd = addYmdDays(todayYmd, 1);

  return {
    instant: new Date(instantUnix * 1000),
    dateYmd: next.dateYmd,
    type: next.type,
    daysUntil,
    isToday: next.dateYmd === todayYmd,
    isTomorrow: next.dateYmd === tomorrowYmd,
    region,
  };
}
