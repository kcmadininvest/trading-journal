import { useCallback, useEffect, useRef } from 'react';
import {
  tradingAccountsService,
  TradeSyncResponse,
  TradeSyncStatus,
} from '../services/tradingAccounts';

/** Intervalle entre deux vérifications (GET sync-status). */
export const TOPSTEP_SYNC_POLL_INTERVAL_MS = 5 * 60 * 1000;

export interface UseTopStepSyncPollingOptions {
  enabled?: boolean;
  intervalMs?: number;
  /** Après un POST sync réussi (nouveaux trades importés). */
  onSynced?: (result: TradeSyncResponse) => void;
  /** Après chaque GET sync-status (léger). */
  onStatusUpdate?: (status: TradeSyncStatus) => void;
  onError?: (message: string) => void;
}

/**
 * Polling léger : GET sync-status toutes les 5 min, POST sync seulement si should_sync.
 * Activé via `enablePolling` (pages Trades et Replay session). Pause si onglet masqué.
 */
export function useTopStepSyncPolling(
  accountId: number | null | undefined,
  options: UseTopStepSyncPollingOptions = {},
) {
  const {
    enabled = true,
    intervalMs = TOPSTEP_SYNC_POLL_INTERVAL_MS,
    onSynced,
    onStatusUpdate,
    onError,
  } = options;

  const busyRef = useRef(false);
  const onSyncedRef = useRef(onSynced);
  const onStatusRef = useRef(onStatusUpdate);
  const onErrorRef = useRef(onError);
  onSyncedRef.current = onSynced;
  onStatusRef.current = onStatusUpdate;
  onErrorRef.current = onError;

  const runSync = useCallback(async (silent = true): Promise<TradeSyncResponse | null> => {
    if (!accountId || busyRef.current) {
      return null;
    }
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return null;
    }
    busyRef.current = true;
    try {
      const result = await tradingAccountsService.sync(accountId);
      onSyncedRef.current?.(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de synchronisation';
      if (!silent) {
        onErrorRef.current?.(message);
      }
      return null;
    } finally {
      busyRef.current = false;
    }
  }, [accountId]);

  const pollTick = useCallback(async () => {
    if (!accountId || busyRef.current) {
      return;
    }
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    busyRef.current = true;
    try {
      const status = await tradingAccountsService.getSyncStatus(accountId);
      onStatusRef.current?.(status);
      if (status.should_sync) {
        const result = await tradingAccountsService.sync(accountId);
        onSyncedRef.current?.(result);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur de synchronisation';
      onErrorRef.current?.(message);
    } finally {
      busyRef.current = false;
    }
  }, [accountId]);

  useEffect(() => {
    if (!enabled || !accountId) {
      return;
    }

    const tick = () => {
      void pollTick();
    };

    void pollTick();

    const intervalId = window.setInterval(tick, intervalMs);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void pollTick();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [accountId, enabled, intervalMs, pollTick]);

  return { runSync, pollTick };
}
