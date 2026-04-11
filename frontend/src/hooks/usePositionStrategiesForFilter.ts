import { useEffect, useState } from 'react';
import { positionStrategiesService, PositionStrategy } from '../services/positionStrategies';

/**
 * Charge toutes les stratégies de position pour les filtres (même jeu que le dashboard).
 */
export function usePositionStrategiesForFilter() {
  const [strategies, setStrategies] = useState<PositionStrategy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const result = await positionStrategiesService.list();
        if (!cancelled) setStrategies(result);
      } catch {
        if (!cancelled) setStrategies([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return { strategies, loading };
}
