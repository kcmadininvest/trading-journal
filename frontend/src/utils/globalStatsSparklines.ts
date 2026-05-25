import { buildCumulativeDisciplineSparkline, type DisciplinePeriodPoint } from './disciplineSparkline';
import { buildCumulativeWinRateSparkline, type DailyWinLossPoint } from './winRateSparkline';

export function buildGlobalStatsSparklines(input: {
  disciplinePeriodData: DisciplinePeriodPoint[];
  dailyAggregates: DailyWinLossPoint[];
}): { disciplineSparkline: number[]; winRateSparkline: number[] } {
  return {
    disciplineSparkline: buildCumulativeDisciplineSparkline(input.disciplinePeriodData),
    winRateSparkline: buildCumulativeWinRateSparkline(input.dailyAggregates),
  };
}
