import { useState, useEffect, useCallback, useRef, type SetStateAction } from 'react';
import type { PeriodRange } from '../utils/periodPresetRanges';
import {
  getDefaultLast3MonthsRange,
  periodRangeToStored,
  resolvePeriodFromStored,
  type StoredPeriodV1,
} from '../utils/periodPresetRanges';
import { usePreferences } from './usePreferences';
import { authService } from '../services/auth';
import { userService } from '../services/userService';
import { mergeStrategyIntoMap, readStrategyFromMap } from '../utils/journalPositionStrategiesMap';

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

const DEBOUNCE_MS = 500;

/**
 * Période (globale) et filtre stratégie (par compte) : localStorage + persistance serveur (UserPreferences).
 * Les sauvegardes API sont débouncées mais flushées au démontage (changement de route) pour éviter de perdre
 * le dernier choix si l'utilisateur quitte la page avant la fin du délai.
 */
export function usePersistedPeriodAndStrategyFilters(accountId: number | null) {
  const { preferences, loading: preferencesLoading, mergePreferences } = usePreferences();
  const [selectedPeriod, setSelectedPeriodState] = useState<PeriodRange | null>(() => readPeriodFromStorage());
  const [selectedPositionStrategy, setSelectedPositionStrategyState] = useState<number | null>(() =>
    readStrategyId(accountId)
  );

  const periodSaveTimerRef = useRef<number | null>(null);
  const strategySaveTimerRef = useRef<number | null>(null);
  const periodLocalUpsyncSentRef = useRef(false);
  /** Dernière période à pousser sur le serveur (débounce ou flush au démontage). */
  const pendingPeriodRangeRef = useRef<PeriodRange | null>(null);
  /** Dernière stratégie à pousser (compte + id) pour flush au démontage. */
  const pendingStrategyRef = useRef<{ accountId: number | null; strategyId: number | null } | null>(null);
  const strategiesMapRef = useRef(preferences.journal_position_strategies ?? null);
  const mergePreferencesRef = useRef(mergePreferences);
  mergePreferencesRef.current = mergePreferences;

  useEffect(() => {
    strategiesMapRef.current = preferences.journal_position_strategies ?? null;
  }, [preferences.journal_position_strategies]);

  const flushPeriodServerSave = useCallback(() => {
    const range = pendingPeriodRangeRef.current;
    pendingPeriodRangeRef.current = null;
    if (!range || !authService.isAuthenticated()) return;
    const stored = periodRangeToStored(range);
    if (!stored) return;
    void userService
      .updatePreferences({ journal_period: stored })
      .then((prefs) => {
        mergePreferencesRef.current({
          journal_period: prefs.journal_period ?? stored,
        });
      })
      .catch(() => {
        /* ignore */
      });
  }, []);

  const flushStrategyServerSave = useCallback(() => {
    const pending = pendingStrategyRef.current;
    pendingStrategyRef.current = null;
    if (!pending || !authService.isAuthenticated()) return;
    const base = mergeStrategyIntoMap(strategiesMapRef.current, pending.accountId, pending.strategyId);
    void userService
      .updatePreferences({ journal_position_strategies: base })
      .then((prefs) => {
        const next = prefs.journal_position_strategies ?? base;
        strategiesMapRef.current = next;
        mergePreferencesRef.current({ journal_position_strategies: next });
      })
      .catch(() => {
        /* ignore */
      });
  }, []);

  useEffect(() => {
    return () => {
      if (periodSaveTimerRef.current != null) {
        window.clearTimeout(periodSaveTimerRef.current);
        periodSaveTimerRef.current = null;
      }
      if (pendingPeriodRangeRef.current) {
        flushPeriodServerSave();
      }
      if (strategySaveTimerRef.current != null) {
        window.clearTimeout(strategySaveTimerRef.current);
        strategySaveTimerRef.current = null;
      }
      if (pendingStrategyRef.current) {
        flushStrategyServerSave();
      }
    };
  }, [flushPeriodServerSave, flushStrategyServerSave]);

  // Hydratation période depuis le serveur (priorité sur le cache local une fois les préférences chargées)
  useEffect(() => {
    if (preferencesLoading || !authService.isAuthenticated()) return;
    const jp = preferences.journal_period;
    if (jp == null || typeof jp !== 'object' || typeof (jp as { preset?: unknown }).preset !== 'string') {
      return;
    }
    const resolved = resolvePeriodFromStored(jp as StoredPeriodV1, new Date());
    if (resolved) {
      setSelectedPeriodState(resolved);
      writePeriodToStorage(resolved);
    }
  }, [preferencesLoading, preferences.journal_period]);

  // Upsync optionnel : localStorage existant alors que le serveur n'a pas encore journal_period
  useEffect(() => {
    if (preferencesLoading || !authService.isAuthenticated()) return;
    if (preferences.journal_period != null) return;
    if (periodLocalUpsyncSentRef.current) return;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(TJ_PERIOD_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    if (!raw) return;
    periodLocalUpsyncSentRef.current = true;
    const range = readPeriodFromStorage();
    const stored = periodRangeToStored(range);
    if (!stored) {
      periodLocalUpsyncSentRef.current = false;
      return;
    }
    void userService
      .updatePreferences({ journal_period: stored })
      .then((prefs) => {
        mergePreferences({
          journal_period: prefs.journal_period ?? stored,
        });
      })
      .catch(() => {
        periodLocalUpsyncSentRef.current = false;
      });
  }, [preferencesLoading, preferences.journal_period, mergePreferences]);

  // Stratégie : serveur par compte si présent, sinon localStorage
  useEffect(() => {
    if (preferencesLoading) return;
    if (!authService.isAuthenticated()) {
      setSelectedPositionStrategyState(readStrategyId(accountId));
      return;
    }
    const fromServer = readStrategyFromMap(preferences.journal_position_strategies, accountId);
    if (fromServer !== undefined) {
      setSelectedPositionStrategyState(fromServer);
      writeStrategyId(accountId, fromServer);
    } else {
      setSelectedPositionStrategyState(readStrategyId(accountId));
    }
  }, [preferencesLoading, accountId, preferences.journal_position_strategies]);

  const schedulePeriodServerSave = useCallback(
    (range: PeriodRange | null) => {
      if (!authService.isAuthenticated()) return;
      if (!range) return;
      const stored = periodRangeToStored(range);
      if (!stored) return;
      pendingPeriodRangeRef.current = range;
      if (periodSaveTimerRef.current != null) window.clearTimeout(periodSaveTimerRef.current);
      periodSaveTimerRef.current = window.setTimeout(() => {
        periodSaveTimerRef.current = null;
        flushPeriodServerSave();
      }, DEBOUNCE_MS);
    },
    [flushPeriodServerSave]
  );

  const scheduleStrategyServerSave = useCallback(
    (strategyId: number | null) => {
      if (!authService.isAuthenticated()) return;
      pendingStrategyRef.current = { accountId, strategyId };
      if (strategySaveTimerRef.current != null) window.clearTimeout(strategySaveTimerRef.current);
      strategySaveTimerRef.current = window.setTimeout(() => {
        strategySaveTimerRef.current = null;
        flushStrategyServerSave();
      }, DEBOUNCE_MS);
    },
    [accountId, flushStrategyServerSave]
  );

  const setSelectedPeriod = useCallback(
    (value: SetStateAction<PeriodRange | null>) => {
      setSelectedPeriodState((prev) => {
        const next = typeof value === 'function' ? (value as (p: PeriodRange | null) => PeriodRange | null)(prev) : value;
        writePeriodToStorage(next);
        schedulePeriodServerSave(next);
        return next;
      });
    },
    [schedulePeriodServerSave]
  );

  const setSelectedPositionStrategy = useCallback(
    (value: SetStateAction<number | null>) => {
      setSelectedPositionStrategyState((prev) => {
        const next = typeof value === 'function' ? (value as (p: number | null) => number | null)(prev) : value;
        writeStrategyId(accountId, next);
        scheduleStrategyServerSave(next);
        return next;
      });
    },
    [accountId, scheduleStrategyServerSave]
  );

  return {
    selectedPeriod,
    setSelectedPeriod,
    selectedPositionStrategy,
    setSelectedPositionStrategy,
  };
}
