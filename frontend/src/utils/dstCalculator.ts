/**
 * Utilitaire pour calculer les dates de changement d'heure (DST) des marchés
 * 
 * Règles DST aux États-Unis (depuis 2007):
 * - Heure d'été (Spring Forward): 2ème dimanche de mars à 2h00 AM
 * - Heure d'hiver (Fall Back): 1er dimanche de novembre à 2h00 AM
 * 
 * Règles DST en Europe (Union Européenne):
 * - Heure d'été (Spring Forward): Dernier dimanche de mars à 2h00 AM
 * - Heure d'hiver (Fall Back): Dernier dimanche d'octobre à 3h00 AM
 */

export type MarketRegion = 'US' | 'EU';

export interface DSTEvent {
  date: Date;
  type: 'spring' | 'fall';
  daysUntil: number;
  isToday: boolean;
  isTomorrow: boolean;
  region: MarketRegion;
}

/**
 * Trouve le nième jour de la semaine dans un mois donné
 * @param year - Année
 * @param month - Mois (0-11)
 * @param dayOfWeek - Jour de la semaine (0 = Dimanche, 6 = Samedi)
 * @param occurrence - Occurrence (1 = premier, 2 = deuxième, etc.)
 * @returns Date du jour trouvé
 */
function getNthDayOfWeekInMonth(
  year: number,
  month: number,
  dayOfWeek: number,
  occurrence: number
): Date {
  const firstDay = new Date(year, month, 1);
  const firstDayOfWeek = firstDay.getDay();
  
  // Calculer le premier jour de la semaine souhaité dans le mois
  let dayOffset = dayOfWeek - firstDayOfWeek;
  if (dayOffset < 0) {
    dayOffset += 7;
  }
  
  // Ajouter les semaines supplémentaires
  const day = 1 + dayOffset + (occurrence - 1) * 7;
  
  return new Date(year, month, day, 2, 0, 0, 0); // 2h00 AM
}

/**
 * Trouve le dernier jour de la semaine dans un mois donné
 * @param year - Année
 * @param month - Mois (0-11)
 * @param dayOfWeek - Jour de la semaine (0 = Dimanche, 6 = Samedi)
 * @returns Date du dernier jour trouvé
 */
function getLastDayOfWeekInMonth(
  year: number,
  month: number,
  dayOfWeek: number,
  hour: number = 2
): Date {
  // Commencer par le dernier jour du mois
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const lastDay = lastDayOfMonth.getDate();
  
  // Trouver le dernier dimanche en partant de la fin
  for (let day = lastDay; day >= 1; day--) {
    const date = new Date(year, month, day, hour, 0, 0, 0);
    if (date.getDay() === dayOfWeek) {
      return date;
    }
  }
  
  // Fallback (ne devrait jamais arriver)
  return new Date(year, month, lastDay, hour, 0, 0, 0);
}

/**
 * Calcule la date du changement d'heure de printemps (Spring Forward) - US
 * 2ème dimanche de mars à 2h00 AM
 * @param year - Année
 * @returns Date du changement d'heure
 */
function getSpringDSTDateUS(year: number): Date {
  return getNthDayOfWeekInMonth(year, 2, 0, 2); // Mars (2), Dimanche (0), 2ème occurrence
}

/**
 * Calcule la date du changement d'heure d'automne (Fall Back) - US
 * 1er dimanche de novembre à 2h00 AM
 * @param year - Année
 * @returns Date du changement d'heure
 */
function getFallDSTDateUS(year: number): Date {
  return getNthDayOfWeekInMonth(year, 10, 0, 1); // Novembre (10), Dimanche (0), 1ère occurrence
}

/**
 * Calcule la date du changement d'heure de printemps (Spring Forward) - EU
 * Dernier dimanche de mars à 2h00 AM
 * @param year - Année
 * @returns Date du changement d'heure
 */
function getSpringDSTDateEU(year: number): Date {
  return getLastDayOfWeekInMonth(year, 2, 0, 2); // Mars (2), Dimanche (0), à 2h00
}

/**
 * Calcule la date du changement d'heure d'automne (Fall Back) - EU
 * Dernier dimanche d'octobre à 3h00 AM
 * @param year - Année
 * @returns Date du changement d'heure
 */
function getFallDSTDateEU(year: number): Date {
  return getLastDayOfWeekInMonth(year, 9, 0, 3); // Octobre (9), Dimanche (0), à 3h00
}

/**
 * Calcule le nombre de jours entre deux dates
 * @param date1 - Date de départ
 * @param date2 - Date d'arrivée
 * @returns Nombre de jours
 */
function getDaysDifference(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  const diffTime = date2.getTime() - date1.getTime();
  return Math.ceil(diffTime / oneDay);
}

/**
 * Obtient le prochain changement d'heure DST à venir pour une région
 * @param region - Région du marché ('US' pour NYSE, 'EU' pour Euronext)
 * @returns Événement DST ou null si aucun événement trouvé
 */
export function getNextDSTChange(region: MarketRegion = 'US'): DSTEvent | null {
  const now = new Date();
  const currentYear = now.getFullYear();
  
  // Obtenir les dates DST selon la région
  let springThisYear: Date, fallThisYear: Date, springNextYear: Date;
  
  if (region === 'US') {
    springThisYear = getSpringDSTDateUS(currentYear);
    fallThisYear = getFallDSTDateUS(currentYear);
    springNextYear = getSpringDSTDateUS(currentYear + 1);
  } else {
    springThisYear = getSpringDSTDateEU(currentYear);
    fallThisYear = getFallDSTDateEU(currentYear);
    springNextYear = getSpringDSTDateEU(currentYear + 1);
  }
  
  // Créer une liste de tous les événements DST possibles
  const events: Array<{ date: Date; type: 'spring' | 'fall' }> = [
    { date: springThisYear, type: 'spring' },
    { date: fallThisYear, type: 'fall' },
    { date: springNextYear, type: 'spring' },
  ];
  
  // Filtrer les événements futurs et trouver le plus proche
  const futureEvents = events.filter(event => event.date > now);
  
  if (futureEvents.length === 0) {
    return null;
  }
  
  // Trier par date et prendre le premier
  futureEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
  const nextEvent = futureEvents[0];
  
  // Calculer les jours restants
  const daysUntil = getDaysDifference(now, nextEvent.date);
  
  // Vérifier si c'est aujourd'hui ou demain
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const eventStart = new Date(nextEvent.date.getFullYear(), nextEvent.date.getMonth(), nextEvent.date.getDate());
  
  const isToday = eventStart.getTime() === todayStart.getTime();
  const isTomorrow = eventStart.getTime() === tomorrowStart.getTime();
  
  return {
    date: nextEvent.date,
    type: nextEvent.type,
    daysUntil,
    isToday,
    isTomorrow,
    region,
  };
}

/**
 * Vérifie si une date donnée est un jour de changement d'heure DST
 * @param date - Date à vérifier
 * @param region - Région du marché ('US' ou 'EU')
 * @returns true si c'est un jour de changement d'heure
 */
export function isDSTChangeDay(date: Date, region: MarketRegion = 'US'): boolean {
  const year = date.getFullYear();
  
  let springDST: Date, fallDST: Date;
  
  if (region === 'US') {
    springDST = getSpringDSTDateUS(year);
    fallDST = getFallDSTDateUS(year);
  } else {
    springDST = getSpringDSTDateEU(year);
    fallDST = getFallDSTDateEU(year);
  }
  
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const springStart = new Date(springDST.getFullYear(), springDST.getMonth(), springDST.getDate());
  const fallStart = new Date(fallDST.getFullYear(), fallDST.getMonth(), fallDST.getDate());
  
  return dateStart.getTime() === springStart.getTime() || dateStart.getTime() === fallStart.getTime();
}
