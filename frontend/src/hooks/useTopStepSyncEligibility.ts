import { useEffect, useState } from 'react';
import { tradingAccountsService, TradingAccount } from '../services/tradingAccounts';
import integrationsService from '../services/integrationsService';

export interface TopStepSyncEligibility {
  loading: boolean;
  account: TradingAccount | null;
  canSync: boolean;
  integrationConnected: boolean;
  missingBrokerId: boolean;
}

/**
 * Détermine si le compte sélectionné peut être synchronisé via l'API TopStepX.
 */
export function useTopStepSyncEligibility(
  accountId: number | null | undefined,
): TopStepSyncEligibility {
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<TradingAccount | null>(null);
  const [integrationConnected, setIntegrationConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!accountId) {
        if (!cancelled) {
          setAccount(null);
          setIntegrationConnected(false);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const acct = await tradingAccountsService.get(accountId);
        if (cancelled) return;
        setAccount(acct);
        if (acct.account_type !== 'topstep') {
          setIntegrationConnected(false);
          return;
        }
        const integrations = await integrationsService.listIntegrations();
        if (cancelled) return;
        const topstepx = integrations.integrations.find((i) => i.provider === 'topstepx');
        // configured suffit : is_connected reflète le dernier test Paramètres, pas la session
        // active (cours live / sync peuvent fonctionner sans test manuel).
        setIntegrationConnected(Boolean(topstepx?.configured));
      } catch {
        if (!cancelled) {
          setAccount(null);
          setIntegrationConnected(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const missingBrokerId = false;

  const canSync =
    Boolean(account) &&
    account?.account_type === 'topstep' &&
    account?.status === 'active' &&
    integrationConnected;

  return {
    loading,
    account,
    canSync,
    integrationConnected,
    missingBrokerId: Boolean(missingBrokerId),
  };
}
