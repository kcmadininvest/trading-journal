import { useEffect, useState } from 'react';
import { positionStrategiesService, PositionStrategy } from '../services/positionStrategies';
import { resolveVisibleStrategyId } from '../utils/journalPositionStrategiesMap';

/**
 * Charge les stratégies visibles du filtre.
 * Si l'identifiant mémorisé n'y figure plus, lit cette seule version pour retrouver
 * la version visible de la même famille. Cet identifiant d'affichage ne remplace pas
 * celui envoyé aux statistiques.
 */
export function usePositionStrategiesForFilter(selectedStrategyId?: number | null) {
  const [strategies, setStrategies] = useState<PositionStrategy[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [resolvedLookup, setResolvedLookup] = useState<{
    id: number;
    strategy: PositionStrategy | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setListLoading(true);
      try {
        const result = await positionStrategiesService.list();
        if (!cancelled) setStrategies(result);
      } catch {
        if (!cancelled) setStrategies([]);
      } finally {
        if (!cancelled) setListLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (listLoading) return;
    if (
      selectedStrategyId == null
      || strategies.some((strategy) => strategy.id === selectedStrategyId)
    ) {
      return;
    }

    let cancelled = false;
    positionStrategiesService.get(selectedStrategyId)
      .then((strategy) => {
        if (!cancelled) setResolvedLookup({ id: selectedStrategyId, strategy });
      })
      .catch(() => {
        if (!cancelled) setResolvedLookup({ id: selectedStrategyId, strategy: null });
      });

    return () => {
      cancelled = true;
    };
  }, [listLoading, selectedStrategyId, strategies]);

  const listed = selectedStrategyId != null
    && strategies.some((strategy) => strategy.id === selectedStrategyId);
  const awaitingLookup = !listLoading
    && selectedStrategyId != null
    && !listed
    && resolvedLookup?.id !== selectedStrategyId;

  const knownStrategy = resolvedLookup != null && resolvedLookup.id === selectedStrategyId
    ? resolvedLookup.strategy
    : undefined;

  const displayStrategyId = resolveVisibleStrategyId(
    selectedStrategyId ?? null,
    strategies,
    knownStrategy,
  );

  return {
    strategies,
    loading: listLoading || awaitingLookup,
    displayStrategyId,
  };
}
