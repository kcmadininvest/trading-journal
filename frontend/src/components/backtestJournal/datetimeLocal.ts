/** Convertit ISO UTC ↔ valeur datetime-local dans le fuseau utilisateur. */

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function partsInZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  let hour = get('hour');
  if (hour === '24') hour = '00';
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(hour),
    minute: Number(get('minute')),
  };
}

export function isoToDatetimeLocal(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const p = partsInZone(date, timeZone || 'UTC');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export function datetimeLocalToIso(local: string, timeZone: string): string {
  if (!local) return '';
  const [datePart, timePart = '00:00'] = local.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  if (!year || !month || !day) return '';
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  const shown = partsInZone(new Date(utcMs), timeZone || 'UTC');
  const shownMs = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, 0);
  utcMs -= shownMs - Date.UTC(year, month - 1, day, hour, minute, 0);
  return new Date(utcMs).toISOString();
}

export function previewResultPoints(
  direction: 'LONG' | 'SHORT',
  entry: number | null,
  exit: number | null,
): number | null {
  if (entry == null || exit == null) return null;
  return direction === 'LONG' ? exit - entry : entry - exit;
}

export function previewResultR(
  direction: 'LONG' | 'SHORT',
  entry: number | null,
  stop: number | null,
  exit: number | null
): number | null {
  if (entry == null || stop == null || exit == null) return null;
  const risk = Math.abs(entry - stop);
  if (risk <= 0) return null;
  const points = previewResultPoints(direction, entry, exit);
  if (points == null) return null;
  return points / risk;
}

export function statusFromPoints(
  points: number | null,
  tradeTaken: boolean,
): 'WIN' | 'LOSS' | 'BREAKEVEN' | 'OPEN' | 'NOT_TAKEN' {
  if (!tradeTaken) return 'NOT_TAKEN';
  if (points == null) return 'OPEN';
  if (Math.abs(points) < 1e-9) return 'BREAKEVEN';
  return points > 0 ? 'WIN' : 'LOSS';
}
