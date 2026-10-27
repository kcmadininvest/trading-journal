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

/** Jour civil YYYY-MM-DD dans le fuseau donné. */
export function getTodayYmdInTimezone(timeZone: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone.trim() || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Écart en jours civils entre deux YYYY-MM-DD (peut être négatif). */
export function diffYmdDays(fromYmd: string, toYmd: string): number {
  const [fy, fm, fd] = fromYmd.split('-').map(Number);
  const [ty, tm, td] = toYmd.split('-').map(Number);
  const fromUtc = Date.UTC(fy, fm - 1, fd);
  const toUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((toUtc - fromUtc) / (24 * 60 * 60 * 1000));
}

/** Ajoute N jours calendaires à un YYYY-MM-DD (arithmétique UTC noon-safe). */
export function addYmdDays(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
