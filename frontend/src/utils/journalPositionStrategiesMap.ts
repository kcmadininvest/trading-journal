import type { JournalPositionStrategiesMap } from '../services/userService';

/** Champs utiles pour rattacher un identifiant mémorisé à la version visible de sa famille. */
export interface StrategyFamilyRef {
  id: number;
  parent_strategy: number | null;
  is_current: boolean;
  version: number;
}

/** Racine de famille : la version parente, ou la stratégie elle-même. */
export function strategyFamilyRootId(strategy: {
  id: number;
  parent_strategy: number | null;
}): number {
  return strategy.parent_strategy || strategy.id;
}

/**
 * Identifiant à afficher dans le filtre.
 * L'identifiant mémorisé n'est pas remplacé s'il est encore visible, introuvable,
 * ou si aucune version de sa famille n'est dans le menu.
 */
export function resolveVisibleStrategyId(
  storedId: number | null,
  visibleStrategies: StrategyFamilyRef[],
  knownStrategy?: StrategyFamilyRef | null,
): number | null {
  if (storedId == null) return null;
  if (visibleStrategies.some((strategy) => strategy.id === storedId)) return storedId;
  if (!knownStrategy || knownStrategy.id !== storedId) return storedId;

  const rootId = strategyFamilyRootId(knownStrategy);
  const family = visibleStrategies.filter(
    (strategy) => strategyFamilyRootId(strategy) === rootId,
  );
  if (family.length === 0) return storedId;

  const current = family.filter((strategy) => strategy.is_current);
  const pool = current.length > 0 ? current : family;
  return pool.reduce((best, strategy) => (
    strategy.version > best.version || (strategy.version === best.version && strategy.id > best.id)
      ? strategy
      : best
  )).id;
}

/** Clé API / JSON pour le filtre stratégie (compte ou agrégat « tous »). */
export function positionStrategyPreferenceKey(accountId: number | null): string {
  return accountId == null ? 'all' : String(accountId);
}

export function readStrategyFromMap(
  map: JournalPositionStrategiesMap | null | undefined,
  accountId: number | null
): number | null | undefined {
  if (!map || typeof map !== 'object') return undefined;
  const key = positionStrategyPreferenceKey(accountId);
  if (!(key in map)) return undefined;
  const v = map[key];
  if (v == null) return null;
  return typeof v === 'number' && v > 0 ? v : null;
}

export function mergeStrategyIntoMap(
  map: JournalPositionStrategiesMap | null | undefined,
  accountId: number | null,
  strategyId: number | null
): JournalPositionStrategiesMap {
  const base: JournalPositionStrategiesMap = { ...(map && typeof map === 'object' ? map : {}) };
  const key = positionStrategyPreferenceKey(accountId);
  if (strategyId == null) {
    base[key] = null;
  } else {
    base[key] = strategyId;
  }
  return base;
}
