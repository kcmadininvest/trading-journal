import type { DailyCalendarData, AdjacentDayCalendarData } from '../../services/calendar';

export interface CurrentCell {
  kind: 'current';
  day: number;
  data?: DailyCalendarData;
}

/** Jour du mois précédent ou suivant affiché dans la grille dimanche → samedi. */
export interface AdjacentCell {
  kind: 'adjacent';
  date: string; // YYYY-MM-DD
  day: number;
  month: number;
  year: number;
  pnl: number;
  tradeCount: number;
}

export type CalendarCell = CurrentCell | AdjacentCell;

export interface CalendarWeek {
  cells: CalendarCell[];
  /** Somme des PnL de toutes les cases affichées sur la ligne (jours adjacents inclus). */
  weeklyPnl: number;
}

export interface BuildCalendarWeeksInput {
  year: number;
  month: number;
  dailyData: DailyCalendarData[];
  adjacentDays?: AdjacentDayCalendarData[];
}

const pad = (n: number): string => String(n).padStart(2, '0');

export function buildCalendarWeeks({
  year,
  month,
  dailyData,
  adjacentDays = [],
}: BuildCalendarWeeksInput): CalendarWeek[] {
  const dailyDataMap = new Map<number, DailyCalendarData>();
  dailyData.forEach((day) => {
    const dayNum = parseInt(day.date, 10);
    if (!Number.isNaN(dayNum)) dailyDataMap.set(dayNum, day);
  });
  const adjacentMap = new Map(adjacentDays.map((day) => [day.date, day]));

  const daysInMonth = new Date(year, month, 0).getDate();
  const startingDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0 = Dimanche
  const rows = Math.ceil((startingDayOfWeek + daysInMonth) / 7);

  const weeks: CalendarWeek[] = [];
  for (let row = 0; row < rows; row++) {
    const cells: CalendarCell[] = [];
    let weeklyPnl = 0;
    for (let col = 0; col < 7; col++) {
      const offset = row * 7 + col - startingDayOfWeek; // 0 = 1er du mois
      if (offset >= 0 && offset < daysInMonth) {
        const data = dailyDataMap.get(offset + 1);
        cells.push({ kind: 'current', day: offset + 1, data });
        weeklyPnl += data?.pnl ?? 0;
        continue;
      }
      // new Date gère le débordement (jour 0 = dernier jour du mois précédent, etc.)
      const d = new Date(year, month - 1, offset + 1);
      const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const data = adjacentMap.get(date);
      const cell: AdjacentCell = {
        kind: 'adjacent',
        date,
        day: d.getDate(),
        month: d.getMonth() + 1,
        year: d.getFullYear(),
        pnl: data?.pnl ?? 0,
        tradeCount: data?.trade_count ?? 0,
      };
      cells.push(cell);
      weeklyPnl += cell.pnl;
    }
    weeks.push({ cells, weeklyPnl });
  }
  return weeks;
}
