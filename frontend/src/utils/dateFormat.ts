/**
 * Utilitaires de formatage des dates basés sur les préférences utilisateur
 */

export type DateFormatType = 'US' | 'EU';
export type LanguageType = 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh';

const ISO_DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Formate une date calendaire YYYY-MM-DD sans décalage de fuseau horaire. */
function formatIsoCalendarDate(
  isoDate: string,
  dateFormat: DateFormatType,
  includeTime: boolean,
): string {
  const match = isoDate.trim().match(ISO_DATE_ONLY);
  if (!match) {
    return '';
  }
  const [, year, month, day] = match;
  const formatted = dateFormat === 'US' ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;
  return includeTime ? `${formatted} 00:00:00` : formatted;
}

/**
 * Formate une date selon les préférences utilisateur
 * @param date - Date à formater (string ISO, Date, ou timestamp)
 * @param dateFormat - Format de date ('US' ou 'EU')
 * @param includeTime - Inclure l'heure (défaut: false)
 * @param timezone - Fuseau horaire (ex: 'Europe/Paris', 'America/New_York')
 * @returns Date formatée
 */
export const formatDate = (
  date: string | Date | number | null | undefined,
  dateFormat: DateFormatType = 'EU',
  includeTime: boolean = false,
  timezone?: string
): string => {
  if (!date) {
    return '';
  }

  if (typeof date === 'string' && !includeTime) {
    const calendar = formatIsoCalendarDate(date, dateFormat, false);
    if (calendar) {
      return calendar;
    }
  }

  let dateObj: Date;
  if (typeof date === 'string') {
    dateObj = new Date(date);
  } else if (typeof date === 'number') {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }

  if (isNaN(dateObj.getTime())) {
    return '';
  }

  // Utiliser Intl.DateTimeFormat pour convertir dans le timezone spécifié
  let day: string, month: string, year: string, hours: string, minutes: string, seconds: string;
  
  if (timezone) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: includeTime ? '2-digit' : undefined,
      minute: includeTime ? '2-digit' : undefined,
      second: includeTime ? '2-digit' : undefined,
      hour12: false,
    });
    
    const parts = formatter.formatToParts(dateObj);
    year = parts.find(p => p.type === 'year')?.value || '';
    month = parts.find(p => p.type === 'month')?.value || '';
    day = parts.find(p => p.type === 'day')?.value || '';
    hours = includeTime ? (parts.find(p => p.type === 'hour')?.value || '00') : '';
    minutes = includeTime ? (parts.find(p => p.type === 'minute')?.value || '00') : '';
    seconds = includeTime ? (parts.find(p => p.type === 'second')?.value || '00') : '';
  } else {
    // Fallback vers l'ancien comportement si pas de timezone
    day = String(dateObj.getDate()).padStart(2, '0');
    month = String(dateObj.getMonth() + 1).padStart(2, '0');
    year = String(dateObj.getFullYear());
    hours = includeTime ? String(dateObj.getHours()).padStart(2, '0') : '';
    minutes = includeTime ? String(dateObj.getMinutes()).padStart(2, '0') : '';
    seconds = includeTime ? String(dateObj.getSeconds()).padStart(2, '0') : '';
  }

  let formatted: string;
  
  if (dateFormat === 'US') {
    // Format US: MM/DD/YYYY
    formatted = `${month}/${day}/${year}`;
    if (includeTime) {
      formatted += ` ${hours}:${minutes}:${seconds}`;
    }
  } else {
    // Format EU: DD/MM/YYYY
    formatted = `${day}/${month}/${year}`;
    if (includeTime) {
      formatted += ` ${hours}:${minutes}:${seconds}`;
    }
  }

  return formatted;
};

/**
 * Jour calendaire YYYY-MM-DD dans le fuseau donné (ex. alignement dépôts/retraits avec trade_day).
 * Évite le décalage d’un jour causé par `toISOString().split('T')[0]` (jour UTC).
 */
/** Date de référence « aujourd’hui » en jour calendaire du fuseau (préréglages de période). */
export function getCalendarTodayInTimezone(timeZone: string): Date {
  const iso = toIsoCalendarDateInTimezone(new Date(), timeZone);
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) {
    return new Date();
  }
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function toIsoCalendarDateInTimezone(date: string | Date, timeZone: string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(dateObj.getTime())) {
    if (typeof date === 'string') {
      const prefix = date.match(/^(\d{4}-\d{2}-\d{2})/);
      if (prefix) return prefix[1];
    }
    return '';
  }
  const tz = timeZone && timeZone.trim() !== '' ? timeZone.trim() : 'Europe/Paris';
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(dateObj);
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(dateObj);
  }
}

/**
 * Formate une date pour affichage avec heure courte (HH:MM)
 * @param date - Date à formater
 * @param dateFormat - Format de date ('US' ou 'EU')
 * @param timezone - Fuseau horaire (ex: 'Europe/Paris', 'America/New_York')
 * @returns Date formatée avec heure courte
 */
export const formatDateTimeShort = (
  date: string | Date | number | null | undefined,
  dateFormat: DateFormatType = 'EU',
  timezone?: string
): string => {
  if (!date) {
    return '';
  }

  let dateObj: Date;
  if (typeof date === 'string') {
    dateObj = new Date(date);
  } else if (typeof date === 'number') {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }

  if (isNaN(dateObj.getTime())) {
    return '';
  }

  let day: string, month: string, year: string, hours: string, minutes: string;
  
  if (timezone) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    
    const parts = formatter.formatToParts(dateObj);
    year = parts.find(p => p.type === 'year')?.value || '';
    month = parts.find(p => p.type === 'month')?.value || '';
    day = parts.find(p => p.type === 'day')?.value || '';
    hours = parts.find(p => p.type === 'hour')?.value || '00';
    minutes = parts.find(p => p.type === 'minute')?.value || '00';
  } else {
    // Fallback vers l'ancien comportement si pas de timezone
    day = String(dateObj.getDate()).padStart(2, '0');
    month = String(dateObj.getMonth() + 1).padStart(2, '0');
    year = String(dateObj.getFullYear());
    hours = String(dateObj.getHours()).padStart(2, '0');
    minutes = String(dateObj.getMinutes()).padStart(2, '0');
  }

  if (dateFormat === 'US') {
    return `${month}/${day}/${year} ${hours}:${minutes}`;
  } else {
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }
};

/**
 * Formate une date pour affichage long avec nom du mois
 * @param date - Date à formater
 * @param dateFormat - Format de date ('US' ou 'EU') - non utilisé dans cette fonction mais conservé pour compatibilité
 * @param language - Langue (fr, en, es, de, it, pt, ja, ko, zh)
 * @param timezone - Fuseau horaire (ex: 'Europe/Paris', 'America/New_York')
 * @returns Date formatée en format long
 */
export const formatDateLong = (
  date: string | Date | number | null | undefined,
  dateFormat: DateFormatType = 'EU',
  language: LanguageType = 'fr',
  timezone?: string
): string => {
  if (!date) {
    return '';
  }

  let dateObj: Date;
  if (typeof date === 'string') {
    dateObj = new Date(date);
  } else if (typeof date === 'number') {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }

  if (isNaN(dateObj.getTime())) {
    return '';
  }

  // Mapper les codes de langue aux locales
  const localeMap: Record<LanguageType, string> = {
    'fr': 'fr-FR',
    'en': 'en-US',
    'es': 'es-ES',
    'de': 'de-DE',
    'it': 'it-IT',
    'pt': 'pt-PT',
    'ja': 'ja-JP',
    'ko': 'ko-KR',
    'zh': 'zh-CN',
  };
  const locale = localeMap[language] || 'fr-FR';
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: timezone,
  };

  return dateObj.toLocaleDateString(locale, options);
};

/**
 * Formate une heure selon les préférences utilisateur
 * @param date - Date à formater
 * @param timezone - Fuseau horaire (ex: 'Europe/Paris', 'America/New_York')
 * @param language - Langue (fr, en, es, de, it, pt, ja, ko, zh)
 * @returns Heure formatée
 */
export const formatTime = (
  date: string | Date | number | null | undefined,
  timezone?: string,
  language: LanguageType = 'fr'
): string => {
  if (!date) {
    return '';
  }

  let dateObj: Date;
  if (typeof date === 'string') {
    dateObj = new Date(date);
  } else if (typeof date === 'number') {
    dateObj = new Date(date);
  } else {
    dateObj = date;
  }

  if (isNaN(dateObj.getTime())) {
    return '';
  }

  // Mapper les codes de langue aux locales
  const localeMap: Record<LanguageType, string> = {
    'fr': 'fr-FR',
    'en': 'en-US',
    'es': 'es-ES',
    'de': 'de-DE',
    'it': 'it-IT',
    'pt': 'pt-PT',
    'ja': 'ja-JP',
    'ko': 'ko-KR',
    'zh': 'zh-CN',
  };
  const locale = localeMap[language] || 'fr-FR';
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  };

  return dateObj.toLocaleTimeString(locale, options);
};

/**
 * Affiche une heure de session (HH:mm) telle qu'enregistrée — pas de conversion fuseau.
 */
export const formatSessionClockLabel = (clock: string): string => {
  if (!clock) return '';
  const parts = clock.split(':');
  if (parts.length < 2) return clock;
  const h = parts[0].padStart(2, '0');
  const m = parts[1].padStart(2, '0');
  return `${h}:${m}`;
};

/**
 * Horloge marché (HH:mm:ss) selon la langue des paramètres et le fuseau du marché.
 */
export const formatClockTime = (
  date: Date,
  timezone: string,
  language: LanguageType = 'fr',
): string => {
  if (isNaN(date.getTime())) {
    return '';
  }

  const localeMap: Record<LanguageType, string> = {
    fr: 'fr-FR',
    en: 'en-US',
    es: 'es-ES',
    de: 'de-DE',
    it: 'it-IT',
    pt: 'pt-PT',
    ja: 'ja-JP',
    ko: 'ko-KR',
    zh: 'zh-CN',
  };
  const locale = localeMap[language] || 'fr-FR';

  try {
    return date.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: timezone,
    });
  } catch {
    return date.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }
};

/**
 * Obtient le nom d'un mois localisé (1-12)
 * @param month - Numéro du mois (1-12)
 * @param language - Langue (fr, en, es, de, it, pt, ja, ko, zh)
 * @returns Nom du mois localisé
 */
export const getMonthName = (month: number, language: LanguageType = 'fr'): string => {
  const localeMap: Record<LanguageType, string> = {
    'fr': 'fr-FR',
    'en': 'en-US',
    'es': 'es-ES',
    'de': 'de-DE',
    'it': 'it-IT',
    'pt': 'pt-PT',
    'ja': 'ja-JP',
    'ko': 'ko-KR',
    'zh': 'zh-CN',
  };
  const locale = localeMap[language] || 'fr-FR';
  const date = new Date(2024, month - 1, 1);
  return date.toLocaleDateString(locale, { month: 'long' });
};

/**
 * Obtient le nom d'un jour de la semaine localisé (0-6, où 0 = Dimanche)
 * @param dayIndex - Index du jour (0-6, où 0 = Dimanche)
 * @param language - Langue (fr, en, es, de, it, pt, ja, ko, zh)
 * @returns Nom du jour localisé
 */
export const getDayName = (dayIndex: number, language: LanguageType = 'fr'): string => {
  const localeMap: Record<LanguageType, string> = {
    'fr': 'fr-FR',
    'en': 'en-US',
    'es': 'es-ES',
    'de': 'de-DE',
    'it': 'it-IT',
    'pt': 'pt-PT',
    'ja': 'ja-JP',
    'ko': 'ko-KR',
    'zh': 'zh-CN',
  };
  const locale = localeMap[language] || 'fr-FR';
  // Dimanche = 0, donc on utilise 2024-01-07 (Dimanche) comme base et on ajoute dayIndex jours
  const date = new Date(2024, 0, 7 + dayIndex);
  return date.toLocaleDateString(locale, { weekday: 'long' });
};

/**
 * Obtient tous les noms de mois localisés
 * @param language - Langue (fr, en, es, de, it, pt, ja, ko, zh)
 * @returns Tableau des noms de mois (index 0 = Janvier)
 */
export const getMonthNames = (language: LanguageType = 'fr'): string[] => {
  return Array.from({ length: 12 }, (_, i) => getMonthName(i + 1, language));
};

/**
 * Obtient tous les noms de jours de la semaine localisés
 * @param language - Langue (fr, en, es, de, it, pt, ja, ko, zh)
 * @returns Tableau des noms de jours (index 0 = Dimanche)
 */
export const getDayNames = (language: LanguageType = 'fr'): string[] => {
  return Array.from({ length: 7 }, (_, i) => getDayName(i, language));
};

