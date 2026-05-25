export interface DisciplinePeriodPoint {
  date: string;
  respected_count?: number;
  total_with_strategy?: number;
  total?: number;
}

/**
 * Taux de discipline cumulé par période (comme le win rate sparkline).
 * Évite une ligne en dents de scie : un bon mois après un mauvais ne doit pas
 * faire baisser la tendance globale si la discipline s'améliore dans le temps.
 */
export function buildCumulativeDisciplineSparkline(periodData: DisciplinePeriodPoint[]): number[] {
  const sorted = [...periodData]
    .filter((item) => (item.total_with_strategy ?? item.total ?? 0) > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  let cumRespected = 0;
  let cumTotal = 0;
  return sorted.map((item) => {
    cumRespected += item.respected_count ?? 0;
    cumTotal += item.total_with_strategy ?? item.total ?? 0;
    return cumTotal > 0 ? (cumRespected / cumTotal) * 100 : 0;
  });
}
