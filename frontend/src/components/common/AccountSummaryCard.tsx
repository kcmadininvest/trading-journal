import React from 'react';
import { AccountIndicators } from '../../hooks/useAccountIndicators';
import { DASHBOARD_PANEL_SHELL_CLASS } from '../dashboard/tickerShell';
import { AccountIndicatorsGrid } from './AccountIndicatorsGrid';

export interface GlobalAllAccountsActivity {
  totalPositions: number;
  globalActiveDays: number;
}

interface AccountSummaryCardProps {
  indicators: AccountIndicators;
  currencySymbol?: string;
  className?: string;
  hideInitialBalance?: boolean;
  hideCurrentBalance?: boolean;
  hideProfitLoss?: boolean;
  hideConsistencyTarget?: boolean;
  onNavigateToTransactions?: () => void;
  /** Chargement des soldes actuels (API balance sans pic) */
  balanceLoading?: boolean;
  /** Chargement du pic de solde (2e requête) */
  peakLoading?: boolean;
  /** Chargement du reste (trades, best/worst, consistency…) */
  detailsLoading?: boolean;
  error?: string | null;
  globalAllAccountsActivity?: GlobalAllAccountsActivity | null;
  theme?: 'default' | 'band';
}

const valueSkeletonClass = (theme: 'default' | 'band') =>
  theme === 'band'
    ? 'h-7 w-24 animate-pulse rounded bg-white/10'
    : 'h-7 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700';

export const AccountSummaryCard: React.FC<AccountSummaryCardProps> = React.memo(({
  indicators,
  currencySymbol,
  className = '',
  hideInitialBalance,
  hideCurrentBalance,
  hideProfitLoss,
  hideConsistencyTarget,
  onNavigateToTransactions,
  balanceLoading = false,
  peakLoading = false,
  detailsLoading = false,
  error = null,
  globalAllAccountsActivity = null,
  theme = 'default',
}) => {
  const shellClass =
    theme === 'band'
      ? DASHBOARD_PANEL_SHELL_CLASS
      : 'bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4';

  return (
    <div className={`${shellClass} ${className}`.trim()}>
      {error ? (
        <div className="mb-3 text-sm text-red-400">{error}</div>
      ) : null}
      <AccountIndicatorsGrid
        indicators={indicators}
        currencySymbol={currencySymbol}
        globalAllAccountsActivity={globalAllAccountsActivity}
        hideInitialBalance={hideInitialBalance}
        hideCurrentBalance={hideCurrentBalance}
        hideProfitLoss={hideProfitLoss}
        hideConsistencyTarget={hideConsistencyTarget}
        onNavigateToTransactions={onNavigateToTransactions}
        theme={theme}
        balanceLoading={balanceLoading}
        peakLoading={peakLoading}
        detailsLoading={detailsLoading}
        valueSkeletonClass={valueSkeletonClass(theme)}
      />
    </div>
  );
});
