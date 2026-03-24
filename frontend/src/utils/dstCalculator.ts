/**
 * Utilitaire pour calculer les dates de changement d'heure (DST) du NYSE
 * 
 * Règles DST aux États-Unis (depuis 2007):
 * - Heure d'été (Spring Forward): 2ème dimanche de mars à 2h00 AM
 * - Heure d'hiver (Fall Back): 1er dimanche de novembre à 2h00 AM
 */

export interface DSTEvent {
  date: Date;
  type: 'spring' | 'fall';
  daysUntil: number;
  isToday: boolean;
  isTomorrow: boolean;
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
 * Calcule la date du changement d'heure de printemps (Spring Forward)
 * 2ème dimanche de mars à 2h00 AM
 * @param year - Année
 * @returns Date du changement d'heure
 */
function getSpringDSTDate(year: number): Date {
  return getNthDayOfWeekInMonth(year, 2, 0, 2); // Mars (2), Dimanche (0), 2ème occurrence
}

/**
 * Calcule la date du changement d'heure d'automne (Fall Back)
 * 1er dimanche de novembre à 2h00 AM
 * @param year - Année
 * @returns Date du changement d'heure
 */
function getFallDSTDate(year: number): Date {
  return getNthDayOfWeekInMonth(year, 10, 0, 1); // Novembre (10), Dimanche (0), 1ère occurrence
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
 * Obtient le prochain changement d'heure DST à venir
 * @returns Événement DST ou null si aucun événement trouvé
 */
export function getNextDSTChange(): DSTEvent | null {
  const now = new Date();
  const currentYear = now.getFullYear();
  
  // Obtenir les dates DST pour l'année en cours et l'année suivante
  const springThisYear = getSpringDSTDate(currentYear);
  const fallThisYear = getFallDSTDate(currentYear);
  const springNextYear = getSpringDSTDate(currentYear + 1);
  
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
  };
}

/**
 * Vérifie si une date donnée est un jour de changement d'heure DST
 * @param date - Date à vérifier
 * @returns true si c'est un jour de changement d'heure
 */
export function isDSTChangeDay(date: Date): boolean {
  const year = date.getFullYear();
  const springDST = getSpringDSTDate(year);
  const fallDST = getFallDSTDate(year);
  
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const springStart = new Date(springDST.getFullYear(), springDST.getMonth(), springDST.getDate());
  const fallStart = new Date(fallDST.getFullYear(), fallDST.getMonth(), fallDST.getDate());
  
  return dateStart.getTime() === springStart.getTime() || dateStart.getTime() === fallStart.getTime();
}
