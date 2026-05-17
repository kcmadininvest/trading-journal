/** Navigation de dates pour le replay (jours actifs ou calendrier). */

export function getTodayDateInTimezone(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function addCalendarDays(isoDate: string, delta: number): string {
  const base = new Date(`${isoDate}T12:00:00`);
  base.setDate(base.getDate() + delta);
  return base.toISOString().slice(0, 10);
}

/**
 * Jour précédent/suivant : priorité aux jours avec activité (`activeDates`),
 * sinon ±1 jour calendaire.
 */
export function getAdjacentSessionDate(
  current: string,
  activeDates: string[],
  direction: -1 | 1,
): string {
  const sorted = [...activeDates].sort();
  if (sorted.length > 0) {
    const idx = sorted.indexOf(current);
    if (idx >= 0) {
      const nextIdx = idx + direction;
      if (nextIdx >= 0 && nextIdx < sorted.length) {
        return sorted[nextIdx];
      }
    } else if (direction < 0) {
      const before = sorted.filter((d) => d < current);
      if (before.length > 0) return before[before.length - 1];
    } else {
      const after = sorted.filter((d) => d > current);
      if (after.length > 0) return after[0];
    }
  }
  return addCalendarDays(current, direction);
}

/** Durée lisible entre deux horodatages ISO (ex. « 2h 22 min 15 s »). */
export function formatSessionDuration(startIso: string, endIso: string): string {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return '';

  const totalSeconds = Math.floor((endMs - startMs) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes} min`);
  parts.push(`${seconds} s`);
  return parts.join(' ');
}

export function canNavigateSessionDate(
  current: string,
  activeDates: string[],
  direction: -1 | 1,
): boolean {
  const sorted = [...activeDates].sort();
  if (sorted.length > 0) {
    const idx = sorted.indexOf(current);
    if (idx >= 0) {
      const nextIdx = idx + direction;
      return nextIdx >= 0 && nextIdx < sorted.length;
    }
    if (direction < 0) return sorted.some((d) => d < current);
    return sorted.some((d) => d > current);
  }
  return true;
}
