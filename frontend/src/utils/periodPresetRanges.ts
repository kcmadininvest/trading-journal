/** Préréglages de période (hors « custom », calculés à partir d’une date de référence). */
export type PeriodPreset =
  | 'today'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'last3Months'
  | 'last6Months'
  | 'thisYear'
  | 'lastYear'
  | 'rollingYear'
  | 'allTime'
  | 'custom';

export interface PeriodRange {
  start: string;
  end: string;
  preset?: PeriodPreset;
}

export const ALL_PERIOD_PRESET_KEYS: readonly Exclude<PeriodPreset, 'custom'>[] = [
  'today',
  'thisWeek',
  'lastWeek',
  'thisMonth',
  'lastMonth',
  'last3Months',
  'last6Months',
  'thisYear',
  'rollingYear',
  'lastYear',
  'allTime',
] as const;

export type PresetRangesMap = Record<Exclude<PeriodPreset, 'custom'>, PeriodRange>;

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidYyyyMmDd(s: string): boolean {
  if (!YMD_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** Retourne une plage custom valide ou null si format ou ordre invalide. */
export function parseValidatedCustomPeriod(start: string, end: string): PeriodRange | null {
  if (!isValidYyyyMmDd(start) || !isValidYyyyMmDd(end)) return null;
  if (start > end) return null;
  return { start, end, preset: 'custom' };
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calcule toutes les plages de préréglages pour une date de référence (généralement « maintenant »).
 * À appeler à chaque rendu ou à chaque besoin d’actualisation — ne pas mettre dans useMemo([]).
 */
export function computePeriodPresetRanges(referenceDate: Date = new Date()): PresetRangesMap {
  const now = referenceDate;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const thisWeekStart = new Date(today);
  const dayOfWeek = today.getDay();
  const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  thisWeekStart.setDate(diff);

  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(lastWeekStart);
  lastWeekEnd.setDate(lastWeekEnd.getDate() + 6);

  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const last3MonthsStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const last6MonthsStart = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const thisYearStart = new Date(now.getFullYear(), 0, 1);
  const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
  const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);
  const rollingYearStart = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());
  const allTimeStart = new Date(2000, 0, 1);

  return {
    today: {
      start: formatDate(today),
      end: formatDate(today),
      preset: 'today',
    },
    thisWeek: {
      start: formatDate(thisWeekStart),
      end: formatDate(today),
      preset: 'thisWeek',
    },
    lastWeek: {
      start: formatDate(lastWeekStart),
      end: formatDate(lastWeekEnd),
      preset: 'lastWeek',
    },
    thisMonth: {
      start: formatDate(thisMonthStart),
      end: formatDate(today),
      preset: 'thisMonth',
    },
    lastMonth: {
      start: formatDate(lastMonthStart),
      end: formatDate(lastMonthEnd),
      preset: 'lastMonth',
    },
    last3Months: {
      start: formatDate(last3MonthsStart),
      end: formatDate(today),
      preset: 'last3Months',
    },
    last6Months: {
      start: formatDate(last6MonthsStart),
      end: formatDate(today),
      preset: 'last6Months',
    },
    thisYear: {
      start: formatDate(thisYearStart),
      end: formatDate(today),
      preset: 'thisYear',
    },
    lastYear: {
      start: formatDate(lastYearStart),
      end: formatDate(lastYearEnd),
      preset: 'lastYear',
    },
    rollingYear: {
      start: formatDate(rollingYearStart),
      end: formatDate(today),
      preset: 'rollingYear',
    },
    allTime: {
      start: formatDate(allTimeStart),
      end: formatDate(today),
      preset: 'allTime',
    },
  };
}

export function getDefaultLast3MonthsRange(referenceDate: Date = new Date()): PeriodRange {
  const presets = computePeriodPresetRanges(referenceDate);
  return presets.last3Months;
}

function isPresetKey(k: string): k is Exclude<PeriodPreset, 'custom'> {
  return (ALL_PERIOD_PRESET_KEYS as readonly string[]).includes(k);
}

export interface StoredPeriodV1 {
  preset: PeriodPreset;
  start?: string;
  end?: string;
}

/**
 * Hydrate une plage depuis le JSON stocké : préréglages recalculés à partir de now ; custom validé.
 */
export function resolvePeriodFromStored(
  stored: StoredPeriodV1 | null | undefined,
  referenceDate: Date = new Date()
): PeriodRange | null {
  if (!stored || typeof stored.preset !== 'string') {
    return getDefaultLast3MonthsRange(referenceDate);
  }
  if (stored.preset === 'custom') {
    const start = stored.start ?? '';
    const end = stored.end ?? '';
    const custom = parseValidatedCustomPeriod(start, end);
    return custom ?? getDefaultLast3MonthsRange(referenceDate);
  }
  if (!isPresetKey(stored.preset)) {
    return getDefaultLast3MonthsRange(referenceDate);
  }
  const presets = computePeriodPresetRanges(referenceDate);
  return presets[stored.preset];
}

export function periodRangeToStored(range: PeriodRange | null): StoredPeriodV1 | null {
  if (!range) return null;
  if (range.preset === 'custom') {
    return { preset: 'custom', start: range.start, end: range.end };
  }
  if (range.preset) {
    return { preset: range.preset };
  }
  const presets = computePeriodPresetRanges(new Date());
  for (const key of ALL_PERIOD_PRESET_KEYS) {
    const p = presets[key];
    if (p.start === range.start && p.end === range.end) {
      return { preset: key };
    }
  }
  return { preset: 'custom', start: range.start, end: range.end };
}
