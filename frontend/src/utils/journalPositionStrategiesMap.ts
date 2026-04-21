import type { JournalPositionStrategiesMap } from '../services/userService';

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
