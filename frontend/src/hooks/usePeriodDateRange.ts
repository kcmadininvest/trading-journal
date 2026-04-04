import { useMemo } from 'react';
import { PeriodRange } from '../components/common/PeriodSelector';

interface PeriodDateRangeParams {
  selectedPeriod: PeriodRange | null;
  selectedYear: number | null;
  selectedMonth: number | null;
}

interface PeriodDateRange {
  startDate: string | undefined;
  endDate: string | undefined;
}

/**
 * Hook pour calculer les dates de début et fin à partir d'une période, année ou mois.
 * Utilisé pour les appels API nécessitant start_date et end_date.
 * 
 * Élimine la duplication de code présente dans StrategiesPage, AnalyticsPage et StatisticsPage.
 * 
 * @param selectedPeriod - Période sélectionnée via PeriodSelector (priorité 1)
 * @param selectedYear - Année sélectionnée (rétrocompatibilité, priorité 2)
 * @param selectedMonth - Mois sélectionné (rétrocompatibilité, priorité 2)
 * @returns Objet avec startDate et endDate au format YYYY-MM-DD
 */
export const usePeriodDateRange = ({
  selectedPeriod,
  selectedYear,
  selectedMonth
}: PeriodDateRangeParams): PeriodDateRange => {
  return useMemo(() => {
    // Priorité 1: Période sélectionnée (PeriodSelector moderne)
    if (selectedPeriod) {
      return {
        startDate: selectedPeriod.start,
        endDate: selectedPeriod.end
      };
    }
    
    // Priorité 2: Année/mois (rétrocompatibilité)
    if (selectedYear) {
      if (selectedMonth) {
        // Mois spécifique : calculer le dernier jour du mois
        const lastDay = new Date(selectedYear, selectedMonth, 0);
        const year = lastDay.getFullYear();
        const month = String(selectedMonth).padStart(2, '0');
        const day = String(lastDay.getDate()).padStart(2, '0');
        return {
          startDate: `${selectedYear}-${month}-01`,
          endDate: `${year}-${month}-${day}`
        };
      }
      // Année complète
      return {
        startDate: `${selectedYear}-01-01`,
        endDate: `${selectedYear}-12-31`
      };
    }
    
    // Aucune période sélectionnée
    return {
      startDate: undefined,
      endDate: undefined
    };
  }, [selectedPeriod, selectedYear, selectedMonth]);
};
