import { useState, useEffect, useCallback } from 'react';
import { tradesService, TradeListItem } from '../services/trades';

interface UseStrategyTradesParams {
  accountId: number | null;
  accountLoading: boolean;
  selectedPeriod: {
    start: string;
    end: string;
    preset?: string;
  } | null;
  selectedYear: number | null;
  selectedMonth: number | null;
  skipAllTrades?: boolean;
}

interface UseStrategyTradesReturn {
  allTrades: TradeListItem[];
  filteredTrades: TradeListItem[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export const useStrategyTrades = ({
  accountId,
  accountLoading,
  selectedPeriod,
  selectedYear,
  selectedMonth,
  skipAllTrades = false,
}: UseStrategyTradesParams): UseStrategyTradesReturn => {
  const [allTrades, setAllTrades] = useState<TradeListItem[]>([]);
  const [filteredTrades, setFilteredTrades] = useState<TradeListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTrades = useCallback(async () => {
    if (!accountId || accountLoading) {
      setAllTrades([]);
      setFilteredTrades([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Préparer les filtres pour les trades filtrés
      const filteredFilters: any = {
        trading_account: accountId,
        page_size: 1000, // Réduit de 10000 à 1000 pour de meilleures performances
      };

      if (selectedPeriod) {
        filteredFilters.start_date = selectedPeriod.start;
        filteredFilters.end_date = selectedPeriod.end;
      } else if (selectedYear) {
        const startDate = selectedMonth 
          ? `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`
          : `${selectedYear}-01-01`;
        
        let endDate: string;
        if (selectedMonth) {
          const lastDay = new Date(selectedYear, selectedMonth, 0);
          endDate = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
        } else {
          endDate = `${selectedYear}-12-31`;
        }
        
        filteredFilters.start_date = startDate;
        filteredFilters.end_date = endDate;
      }

      // Ne charger allTrades que si nécessaire
      if (skipAllTrades) {
        const filteredTradesResponse = await tradesService.list(filteredFilters);
        setAllTrades([]);
        setFilteredTrades(filteredTradesResponse.results);
      } else {
        const [allTradesResponse, filteredTradesResponse] = await Promise.all([
          tradesService.list({
            trading_account: accountId,
            page_size: 1000,
          }),
          tradesService.list(filteredFilters),
        ]);
        setAllTrades(allTradesResponse.results);
        setFilteredTrades(filteredTradesResponse.results);
      }
    } catch (err: any) {
      console.error('Erreur lors du chargement des trades', err);
      setError(err.message || 'Erreur lors du chargement des trades');
      setAllTrades([]);
      setFilteredTrades([]);
    } finally {
      setLoading(false);
    }
  }, [accountId, accountLoading, selectedPeriod, selectedYear, selectedMonth, skipAllTrades]);

  useEffect(() => {
    loadTrades();
  }, [loadTrades]);

  return {
    allTrades,
    filteredTrades,
    loading,
    error,
    reload: loadTrades,
  };
};
