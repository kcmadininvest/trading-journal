import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tradingAccountsService, TradeSyncStatus } from '../../services/tradingAccounts';
import { useTopStepSyncEligibility } from '../../hooks/useTopStepSyncEligibility';
import { useTopStepSyncPolling } from '../../hooks/useTopStepSyncPolling';
import { usePreferences } from '../../hooks/usePreferences';
import { formatDateTimeShort, type DateFormatType } from '../../utils/dateFormat';
import Tooltip from '../ui/Tooltip';
import { translateIntegrationError } from '../../utils/integrationErrors';

interface TopStepSyncControlsProps {
  accountId: number | null | undefined;
  /** Polling auto (GET + POST si besoin) — uniquement page Trades, 5 min */
  enablePolling?: boolean;
  onSynced?: () => void;
  /** Si défini, utilisé par le polling auto à la place de `onSynced` (refresh plus discret). */
  onPollingSynced?: () => void;
  className?: string;
  /** Carte compte : bouton compact. Barre d'actions : aligné sur les autres boutons. */
  compact?: boolean;
  /**
   * true = icône seule ;
   * responsive = dashboard : icône en 4 col. (1400–2xl) et quand les stats globales
   *   serrant la barre (1680–2000px, ex. 1683×713) ;
   * narrow = icône seule sous xl (barres flex compte + actions).
   */
  iconOnly?: boolean | 'responsive' | 'narrow';
}

const TOOLBAR_BUTTON_CLASS =
  'h-10 px-3 sm:px-4 text-sm sm:text-base bg-teal-600 dark:bg-teal-500 text-white rounded-md hover:bg-teal-700 dark:hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap';

const SYNC_ICON = (
  <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

export const TopStepSyncControls: React.FC<TopStepSyncControlsProps> = ({
  accountId,
  enablePolling = false,
  onSynced,
  onPollingSynced,
  className = '',
  compact = false,
  iconOnly = false,
}) => {
  const { t } = useTranslation('accounts');
  const { preferences } = usePreferences();
  const { loading, canSync, missingBrokerId, integrationConnected, account } =
    useTopStepSyncEligibility(accountId);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<TradeSyncStatus | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!accountId || !canSync) {
      setStatus(null);
      return;
    }
    try {
      const s = await tradingAccountsService.getSyncStatus(accountId);
      setStatus(s);
    } catch {
      setStatus(null);
    }
  }, [accountId, canSync]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleSynced = useCallback(() => {
    void refreshStatus();
    onSynced?.();
  }, [onSynced, refreshStatus]);

  const handlePollingSynced = useCallback(() => {
    void refreshStatus();
    if (onPollingSynced) {
      onPollingSynced();
    } else {
      onSynced?.();
    }
  }, [onPollingSynced, onSynced, refreshStatus]);

  useTopStepSyncPolling(accountId, {
    enabled: enablePolling && canSync,
    onStatusUpdate: setStatus,
    onSynced: (result) => {
      setToast(
        t('sync.result', {
          created: result.created,
          skipped: result.skipped,
        }),
      );
      handlePollingSynced();
    },
  });

  const handleManualSync = async () => {
    if (!accountId || !canSync) return;
    setSyncing(true);
    try {
      const result = await tradingAccountsService.sync(accountId);
      setToast(
        t('sync.result', {
          created: result.created,
          skipped: result.skipped,
        }),
      );
      handleSynced();
    } catch (err) {
      const apiErr = err as Error & { errorCode?: string };
      setToast(
        translateIntegrationError(t, {
          message: apiErr instanceof Error ? apiErr.message : t('sync.error'),
          errorCode: apiErr.errorCode,
        }),
      );
    } finally {
      setSyncing(false);
    }
  };

  const lastLabel = useMemo(() => {
    if (!status?.last_sync_at) return t('sync.neverSynced');
    const dateFormat = (preferences.date_format || 'EU') as DateFormatType;
    const formatted = formatDateTimeShort(
      status.last_sync_at,
      dateFormat,
      preferences.timezone,
    );
    return t('sync.lastSync', { date: formatted });
  }, [status?.last_sync_at, preferences.date_format, preferences.timezone, t]);

  const actionLabel = syncing ? t('sync.syncing') : t('sync.button');

  const tooltipContent = useMemo(() => {
    const lines = [actionLabel, lastLabel];
    if (toast) lines.push(toast);
    return lines.join('\n');
  }, [actionLabel, lastLabel, toast]);

  if (loading || !accountId || account?.account_type !== 'topstep') {
    return null;
  }

  if (!integrationConnected && !missingBrokerId) {
    return (
      <Tooltip content={t('sync.integrationRequired')} position="top">
        <span
          className={`inline-flex items-center justify-center rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 p-2 text-amber-700 dark:text-amber-300 ${className}`}
          aria-label={t('sync.integrationRequired')}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
      </Tooltip>
    );
  }

  if (missingBrokerId) {
    return (
      <Tooltip content={t('sync.brokerIdRequired')} position="top">
        <span
          className={`inline-flex items-center justify-center rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 p-2 text-amber-700 dark:text-amber-300 ${className}`}
          aria-label={t('sync.brokerIdRequired')}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
      </Tooltip>
    );
  }

  if (!canSync) {
    return null;
  }

  const useResponsiveIcon = iconOnly === 'responsive';
  const useNarrowIcon = iconOnly === 'narrow';
  const forceIconOnly = iconOnly === true;
  const collapsesLabel = forceIconOnly || useResponsiveIcon || useNarrowIcon;

  const buttonClass = compact
    ? 'px-3 py-1.5 text-sm bg-teal-600 dark:bg-teal-500 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2'
    : [
        TOOLBAR_BUTTON_CLASS,
        collapsesLabel && 'max-w-full shrink-0',
        forceIconOnly && 'w-10 min-w-10 px-0 gap-0',
        useNarrowIcon && 'max-xl:w-10 max-xl:min-w-10 max-xl:px-0 max-xl:gap-0',
        useResponsiveIcon &&
          [
            'min-[1400px]:max-2xl:w-10 min-[1400px]:max-2xl:min-w-10 min-[1400px]:max-2xl:max-w-10 min-[1400px]:max-2xl:px-0 min-[1400px]:max-2xl:gap-0',
            'min-[1680px]:max-[1999px]:w-10 min-[1680px]:max-[1999px]:min-w-10 min-[1680px]:max-[1999px]:max-w-10 min-[1680px]:max-[1999px]:px-0 min-[1680px]:max-[1999px]:gap-0',
          ].join(' '),
      ]
        .filter(Boolean)
        .join(' ');

  const labelClass = forceIconOnly
    ? 'sr-only'
    : useNarrowIcon
      ? 'inline max-xl:sr-only'
      : useResponsiveIcon
        ? 'inline min-[1400px]:max-2xl:sr-only min-[1680px]:max-[1999px]:sr-only'
        : 'inline';

  const ariaLabel = collapsesLabel ? actionLabel : tooltipContent;

  return (
    <Tooltip
      content={tooltipContent}
      position="top"
      contentClassName="whitespace-pre-line block"
      className={className}
    >
      <button
        type="button"
        onClick={() => void handleManualSync()}
        disabled={syncing}
        className={buttonClass}
        aria-label={ariaLabel}
      >
        {SYNC_ICON}
        <span className={labelClass}>{actionLabel}</span>
      </button>
    </Tooltip>
  );
};
