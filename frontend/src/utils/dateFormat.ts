/**
 * Utilitaires de formatage des dates basés sur les préférences utilisateur
 */

export type DateFormatType = 'US' | 'EU';

/**
 * Formate une date selon les préférences utilisateur
 * @param date - Date à formater (string ISO, Date, ou timestamp)
 * @param dateFormat - Format de date ('US' ou 'EU')
 * @param includeTime - Inclure l'heure (défaut: false)
 * @returns Date formatée
 */
export const formatDate = (
  date: string | Date | number | null | undefined,
  dateFormat: DateFormatType = 'EU',
  includeTime: boolean = false
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

  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const seconds = String(dateObj.getSeconds()).padStart(2, '0');

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
 * @returns Date formatée avec heure courte
 */
export const formatDateTimeShort = (
  date: string | Date | number | null | undefined,
  dateFormat: DateFormatType = 'EU'
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

  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');

  if (dateFormat === 'US') {
    return `${month}/${day}/${year} ${hours}:${minutes}`;
  } else {
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }
};

/**
 * Formate une date pour affichage long avec nom du mois
 * @param date - Date à formater
 * @param dateFormat - Format de date ('US' ou 'EU')
 * @param language - Langue ('fr' ou 'en')
 * @returns Date formatée en format long
 */
export const formatDateLong = (
  date: string | Date | number | null | undefined,
  dateFormat: DateFormatType = 'EU',
  language: 'fr' | 'en' = 'fr'
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

  const locale = language === 'fr' ? 'fr-FR' : 'en-US';
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  };

  return dateObj.toLocaleDateString(locale, options);
};

