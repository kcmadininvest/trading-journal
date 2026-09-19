import {
  TickMarkType,
  type LocalizationOptions,
  type Time,
  type TickMarkFormatter,
} from 'lightweight-charts';

const LOCALE_MAP: Record<string, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  es: 'es-ES',
  de: 'de-DE',
};

function resolveBcp47Locale(language: string | undefined): string {
  if (!language) return 'fr-FR';
  const base = language.split('-')[0].toLowerCase();
  return LOCALE_MAP[base] || language;
}

function timeToUnixSeconds(time: Time): number | null {
  if (typeof time === 'number' && Number.isFinite(time)) {
    return time;
  }
  if (typeof time === 'string') {
    const ms = Date.parse(time);
    return Number.isFinite(ms) ? ms / 1000 : null;
  }
  if (time && typeof time === 'object' && 'year' in time) {
    const { year, month, day } = time;
    if (!year || !month || !day) return null;
    return Date.UTC(year, month - 1, day) / 1000;
  }
  return null;
}

function formatInTimezone(
  unixSeconds: number,
  timezone: string,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      hour12: false,
      ...options,
    }).format(new Date(unixSeconds * 1000));
  } catch {
    return new Intl.DateTimeFormat(locale, {
      timeZone: 'UTC',
      hour12: false,
      ...options,
    }).format(new Date(unixSeconds * 1000));
  }
}

/**
 * Libellé court du fuseau pour l’UI (ex. "New York (EDT)").
 */
export function formatTimezoneDisplayLabel(
  timezone: string,
  language?: string,
): string {
  const tz = timezone.trim() || 'UTC';
  const city = tz.split('/').pop()?.replace(/_/g, ' ') || tz;
  const locale = resolveBcp47Locale(language);
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      timeZone: tz,
      timeZoneName: 'short',
    }).formatToParts(new Date());
    const abbr = parts.find((p) => p.type === 'timeZoneName')?.value;
    return abbr ? `${city} (${abbr})` : city;
  } catch {
    return city;
  }
}

function buildTickMarkFormatter(timezone: string, locale: string): TickMarkFormatter {
  return (time, tickMarkType) => {
    const unix = timeToUnixSeconds(time);
    if (unix == null) return null;

    switch (tickMarkType) {
      case TickMarkType.Year:
        return formatInTimezone(unix, timezone, locale, { year: 'numeric' });
      case TickMarkType.Month:
        return formatInTimezone(unix, timezone, locale, { month: 'short' });
      case TickMarkType.DayOfMonth:
        return formatInTimezone(unix, timezone, locale, { day: 'numeric' });
      case TickMarkType.Time:
        return formatInTimezone(unix, timezone, locale, {
          hour: '2-digit',
          minute: '2-digit',
        });
      case TickMarkType.TimeWithSeconds:
        return formatInTimezone(unix, timezone, locale, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      default:
        return null;
    }
  };
}

/**
 * Options Lightweight Charts pour afficher l’axe / crosshair dans un fuseau IANA.
 * Ne modifie pas les timestamps des bougies (restent UTC).
 */
export function buildChartTimeLocalization(
  timezone: string,
  language?: string,
): { localization: LocalizationOptions<Time>; timeScale: { tickMarkFormatter: TickMarkFormatter } } {
  const tz = timezone.trim() || 'UTC';
  const locale = resolveBcp47Locale(language);
  const tickMarkFormatter = buildTickMarkFormatter(tz, locale);

  return {
    localization: {
      locale,
      dateFormat: 'dd MMM \'yy',
      timeFormatter: (time: Time) => {
        const unix = timeToUnixSeconds(time);
        if (unix == null) return '';
        return formatInTimezone(unix, tz, locale, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      },
    },
    timeScale: {
      tickMarkFormatter,
    },
  };
}
