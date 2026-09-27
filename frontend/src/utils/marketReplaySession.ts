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

/** Normalise `HH:mm` ; retourne null si vide ou invalide. */
export function parseSessionStartTime(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function readZonedParts(date: Date, timeZone: string): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value || '0');
  let hour = get('hour');
  // Certains moteurs renvoient "24" pour minuit.
  if (hour === 24) hour = 0;
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour,
    minute: get('minute'),
    second: get('second'),
  };
}

/**
 * Convertit une horloge murale (date + HH:mm) dans `timeZone` en timestamp Unix (secondes).
 */
export function wallClockInTimezoneToUnix(
  isoDate: string,
  hours: number,
  minutes: number,
  timeZone: string,
): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  const tz = timeZone.trim() || 'UTC';
  let utcGuess = Date.UTC(y, m - 1, d, hours, minutes, 0);
  for (let i = 0; i < 3; i += 1) {
    const parts = readZonedParts(new Date(utcGuess), tz);
    const asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const wanted = Date.UTC(y, m - 1, d, hours, minutes, 0);
    const diff = wanted - asUtc;
    if (diff === 0) break;
    utcGuess += diff;
  }
  return Math.floor(utcGuess / 1000);
}

/**
 * Résout une heure de début utilisateur dans la fenêtre de séance.
 * Teste sessionDate, J-1 et J+1 (Globex / fuseaux) puis clamp si hors plage.
 * Retourne null si pas d'heure (comportement « début de séance » inchangé).
 */
export function resolveReplayStartUnix(
  sessionDate: string,
  timeHHmm: string | null | undefined,
  timeZone: string,
  rangeStart: number,
  rangeEnd: number,
): number | null {
  const normalized = parseSessionStartTime(timeHHmm);
  if (!normalized) return null;
  const [hours, minutes] = normalized.split(':').map(Number);
  const candidates = [
    sessionDate,
    shiftIsoDate(sessionDate, -1),
    shiftIsoDate(sessionDate, 1),
  ];
  for (const day of candidates) {
    const ts = wallClockInTimezoneToUnix(day, hours, minutes, timeZone);
    if (ts >= rangeStart && ts <= rangeEnd) return ts;
  }
  const onSessionDay = wallClockInTimezoneToUnix(sessionDate, hours, minutes, timeZone);
  return Math.min(Math.max(onSessionDay, rangeStart), rangeEnd);
}
