import { useCallback, useState } from 'react';
import { usePreferences } from './usePreferences';
import userService, { UserPreferences } from '../services/userService';

/**
 * Préférence partagée pause API TopStep (Settings + bandeau dashboard).
 * Défaut sûr : pause active tant que la préférence n'est pas chargée.
 */
export function useTopStepApiPaused() {
  const { preferences, mergePreferences } = usePreferences();
  const [saving, setSaving] = useState(false);

  const paused = preferences.topstep_api_paused !== false;
  const marketQuotesEnabled = preferences.market_quotes_enabled === true;

  const setPaused = useCallback(
    async (value: boolean, extra?: Partial<UserPreferences>) => {
      const payload: Partial<UserPreferences> = {
        topstep_api_paused: value,
        ...extra,
      };
      mergePreferences(payload);
      setSaving(true);
      try {
        const updated = await userService.updatePreferences(payload);
        mergePreferences(updated);
      } catch (err) {
        mergePreferences({ topstep_api_paused: !value });
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [mergePreferences],
  );

  const activateLiveApi = useCallback(async () => {
    await setPaused(false, { market_quotes_enabled: true });
  }, [setPaused]);

  const pauseApi = useCallback(async () => {
    await setPaused(true);
  }, [setPaused]);

  return {
    paused,
    marketQuotesEnabled,
    saving,
    setPaused,
    activateLiveApi,
    pauseApi,
  };
}
