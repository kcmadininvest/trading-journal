/**
 * Bornes UTC d'une date de séance CME equity Globex
 * (18:00 ET J-1 → 17:00 ET J), alignées sur le backend sessions.py.
 */

function nyOffsetHours(year: number, month: number, day: number): number {
  // Approximation DST US : 2e dimanche mars → 1er dimanche novembre
  const marchSecondSunday = nthWeekdayOfMonth(year, 2, 0, 2);
  const novFirstSunday = nthWeekdayOfMonth(year, 10, 0, 1);
  const utcNoon = Date.UTC(year, month - 1, day, 12, 0, 0);
  const startDst = Date.UTC(year, 2, marchSecondSunday, 7, 0, 0); // 02:00 ET = 07:00 UTC
  const endDst = Date.UTC(year, 10, novFirstSunday, 6, 0, 0);
  return utcNoon >= startDst && utcNoon < endDst ? -4 : -5;
}

function nthWeekdayOfMonth(year: number, monthIndex: number, weekday: number, n: number): number {
  let count = 0;
  for (let d = 1; d <= 31; d += 1) {
    const dt = new Date(Date.UTC(year, monthIndex, d));
    if (dt.getUTCMonth() !== monthIndex) break;
    if (dt.getUTCDay() === weekday) {
      count += 1;
      if (count === n) return d;
    }
  }
  return 1;
}

function toUtcIso(year: number, month: number, day: number, hourEt: number, minuteEt: number): string {
  const offset = nyOffsetHours(year, month, day);
  const utcMs = Date.UTC(year, month - 1, day, hourEt - offset, minuteEt, 0);
  return new Date(utcMs).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Retourne [startIso, endIso) pour une date de séance YYYY-MM-DD. */
export function sessionDateToUtcRange(sessionDate: string): { start: string; end: string } {
  const [y, m, d] = sessionDate.split('-').map(Number);
  if (!y || !m || !d) {
    throw new Error(`Date de séance invalide: ${sessionDate}`);
  }
  const prev = new Date(Date.UTC(y, m - 1, d));
  prev.setUTCDate(prev.getUTCDate() - 1);
  const py = prev.getUTCFullYear();
  const pm = prev.getUTCMonth() + 1;
  const pd = prev.getUTCDate();

  const start = toUtcIso(py, pm, pd, 18, 0);
  const end = toUtcIso(y, m, d, 17, 0);
  return { start, end };
}

export function candleTimeToUnix(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000);
}
