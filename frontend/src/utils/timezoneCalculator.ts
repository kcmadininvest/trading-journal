/**
 * Utilitaire pour calculer les décalages horaires entre Paris et d'autres marchés
 */

export type MarketTimezone = 'America/New_York' | 'Europe/Paris' | 'Europe/London' | 'Asia/Tokyo';

export interface TimezoneOffset {
  hours: number;
  minutes: number;
  formatted: string;
}

/**
 * Calcule le décalage horaire entre Paris et une autre timezone
 * @param targetTimezone - Timezone cible
 * @param referenceDate - Date de référence (par défaut: maintenant)
 * @returns Décalage horaire (positif = en avance sur Paris, négatif = en retard sur Paris)
 */
export function getTimezoneOffsetFromParis(
  targetTimezone: MarketTimezone,
  referenceDate: Date = new Date()
): TimezoneOffset {
  // Si c'est Paris, le décalage est 0
  if (targetTimezone === 'Europe/Paris') {
    return { hours: 0, minutes: 0, formatted: 'UTC+1/+2' };
  }

  // Créer des formateurs pour obtenir l'heure dans chaque timezone
  const parisFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const targetFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: targetTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Obtenir les timestamps pour chaque timezone
  const parisTime = new Date(parisFormatter.format(referenceDate));
  const targetTime = new Date(targetFormatter.format(referenceDate));

  // Calculer la différence en minutes
  const diffMs = targetTime.getTime() - parisTime.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));

  const hours = Math.floor(Math.abs(diffMinutes) / 60);
  const minutes = Math.abs(diffMinutes) % 60;

  // Formater le décalage
  const sign = diffMinutes >= 0 ? '+' : '-';
  const formatted = minutes > 0 
    ? `${sign}${hours}h${minutes.toString().padStart(2, '0')}`
    : `${sign}${hours}h`;

  return {
    hours: diffMinutes >= 0 ? hours : -hours,
    minutes: diffMinutes >= 0 ? minutes : -minutes,
    formatted,
  };
}

/**
 * Calcule le décalage horaire entre le timezone utilisateur et une timezone cible
 * @param targetTimezone - Timezone cible (marché)
 * @param userTimezone - Timezone de l'utilisateur
 * @param referenceDate - Date de référence (par défaut: maintenant)
 * @returns Décalage horaire (positif = en avance sur l'utilisateur, négatif = en retard)
 */
export function getTimezoneOffsetFromUser(
  targetTimezone: string,
  userTimezone: string,
  referenceDate: Date = new Date()
): TimezoneOffset | null {
  // Si c'est le même timezone, pas de décalage
  if (targetTimezone === userTimezone) {
    return null;
  }

  try {
    // Créer des formateurs pour obtenir l'heure dans chaque timezone
    const userFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: userTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const targetFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: targetTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    // Obtenir les timestamps pour chaque timezone
    const userTime = new Date(userFormatter.format(referenceDate));
    const targetTime = new Date(targetFormatter.format(referenceDate));

    // Calculer la différence en minutes
    const diffMs = targetTime.getTime() - userTime.getTime();
    const diffMinutes = Math.round(diffMs / (1000 * 60));

    const hours = Math.floor(Math.abs(diffMinutes) / 60);
    const minutes = Math.abs(diffMinutes) % 60;

    // Formater le décalage
    const sign = diffMinutes >= 0 ? '+' : '-';
    const formatted = minutes > 0 
      ? `${sign}${hours}h${minutes.toString().padStart(2, '0')}`
      : `${sign}${hours}h`;

    return {
      hours: diffMinutes >= 0 ? hours : -hours,
      minutes: diffMinutes >= 0 ? minutes : -minutes,
      formatted,
    };
  } catch (error) {
    console.error('Error calculating timezone offset:', error);
    return null;
  }
}

/**
 * Obtient le décalage horaire pour un code marché donné
 * @param marketCode - Code du marché (XNYS, XPAR, XLON, XTKS)
 * @param referenceDate - Date de référence (par défaut: maintenant)
 * @returns Décalage horaire formaté
 */
export function getMarketTimezoneOffset(
  marketCode: string,
  referenceDate: Date = new Date()
): string {
  const timezoneMap: Record<string, MarketTimezone> = {
    'XNYS': 'America/New_York',
    'NYSE': 'America/New_York',
    'XPAR': 'Europe/Paris',
    'XLON': 'Europe/London',
    'XTKS': 'Asia/Tokyo',
  };

  const timezone = timezoneMap[marketCode];
  if (!timezone) {
    return '';
  }

  if (timezone === 'Europe/Paris') {
    return '';
  }

  const offset = getTimezoneOffsetFromParis(timezone, referenceDate);
  return offset.formatted;
}
