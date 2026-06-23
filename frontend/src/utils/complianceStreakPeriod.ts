/** Fenêtre glissante 12 mois pour les séries de discipline (alignée tooltip dashboard). */
export function getRollingTwelveMonthDateRange(referenceDate: Date = new Date()): {
  start_date: string;
  end_date: string;
} {
  const end = new Date(referenceDate);
  const start = new Date(referenceDate);
  start.setMonth(start.getMonth() - 12);

  const toIso = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return {
    start_date: toIso(start),
    end_date: toIso(end),
  };
}
