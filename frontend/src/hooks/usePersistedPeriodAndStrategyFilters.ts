import { useState, useEffect, useCallback, type SetStateAction } from 'react';
import type { PeriodRange } from '../utils/periodPresetRanges';
import {
  getDefaultLast3MonthsRange,
  periodRangeToStored,
  resolvePeriodFromStored,
  type StoredPeriodV1,
} from '../utils/periodPresetRanges';

export const TJ_PERIOD_STORAGE_KEY = 'tj_period_v1';
export const TJ_POSITION_STRATEGY_KEY_PREFIX = 'tj_position_strategy_v1_';

function strategyStorageKey(accountId: number | null): string {
  return `${TJ_POSITION_STRATEGY_KEY_PREFIX}${accountId ?? 'all'}`;
}

function readStrategyId(accountId: number | null): number | null {
  try {
    const raw = localStorage.getItem(strategyStorageKey(accountId));
    if (raw == null || raw === '' || raw === 'null') return null;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? null : n;
  } catch {
    return null;
  }
}

function writeStrategyId(accountId: number | null, id: number | null): void {
  try {
    const key = strategyStorageKey(accountId);
    if (id == null) localStorage.removeItem(key);
    else localStorage.setItem(key, String(id));
  } catch {
    /* ignore */
  }
}

function readPeriodFromStorage(): PeriodRange {
  try {
    const raw = localStorage.getItem(TJ_PERIOD_STORAGE_KEY);
    if (!raw) return getDefaultLast3MonthsRange();
    const parsed = JSON.parse(raw) as StoredPeriodV1;
    return resolvePeriodFromStored(parsed, new Date()) ?? getDefaultLast3MonthsRange();
  } catch {
    return getDefaultLast3MonthsRange();
  }
}

function writePeriodToStorage(range: PeriodRange | null): void {
  try {
    // Ne pas effacer le stockage sur null (ex. StatisticsPage force un cycle null → période pour invalider).
    if (!range) return;
    const stored = periodRangeToStored(range);
    if (stored) localStorage.setItem(TJ_PERIOD_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    /* ignore */
  }
}

export function clearTradingJournalFilterStorageKeys(): void {
  try {
    localStorage.removeItem(TJ_PERIOD_STORAGE_KEY);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(TJ_POSITION_STRATEGY_KEY_PREFIX)) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    /* ignore */
  }
}

/**
 * Période (globale) et filtre stratégie (par compte) persistés dans localStorage.
 */
export function usePersistedPeriodAndStrategyFilters(accountId: number | null) {
  const [selectedPeriod, setSelectedPeriodState] = useState<PeriodRange | null>(() => readPeriodFromStorage());
  const [selectedPositionStrategy, setSelectedPositionStrategyState] = useState<number | null>(() =>
    readStrategyId(accountId)
  );

  useEffect(() => {
    setSelectedPositionStrategyState(readStrategyId(accountId));
  }, [accountId]);

  const setSelectedPeriod = useCallback((value: SetStateAction<PeriodRange | null>) => {
    setSelectedPeriodState((prev) => {
      const next = typeof value === 'function' ? (value as (p: PeriodRange | null) => PeriodRange | null)(prev) : value;
      writePeriodToStorage(next);
      return next;
    });
  }, []);

  const setSelectedPositionStrategy = useCallback((value: SetStateAction<number | null>) => {
    setSelectedPositionStrategyState((prev) => {
      const next = typeof value === 'function' ? (value as (p: number | null) => number | null)(prev) : value;
      writeStrategyId(accountId, next);
      return next;
    });
  }, [accountId]);

  return {
    selectedPeriod,
    setSelectedPeriod,
    selectedPositionStrategy,
    setSelectedPositionStrategy,
  };
}
