/**
 * Utilitaires de formatage des dates basés sur les préférences utilisateur
 */

export type DateFormatType = 'US' | 'EU';
export type LanguageType = 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh';

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

