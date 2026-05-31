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
  loading?: boolean;
  error?: string | null;
  /** Cumul tous comptes — affiché dans Total trades sous <2000px (carte Activité du header masquée) */
  globalAllAccountsActivity?: GlobalAllAccountsActivity | null;
  /** `band` = thème bandeau cotations (dashboard) */
  theme?: 'default' | 'band';
}

export const AccountSummaryCard: React.FC<AccountSummaryCardProps> = React.memo(({
  indicators,
  currencySymbol,
  className = '',
  hideInitialBalance,
  hideCurrentBalance,
  hideProfitLoss,
  hideConsistencyTarget,
  onNavigateToTransactions,
  loading = false,
  error = null,
  globalAllAccountsActivity = null,
  theme = 'default',
}) => {
  const shellClass =
    theme === 'band'
      ? DASHBOARD_PANEL_SHELL_CLASS
      : 'bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4';

  if (loading) {
    return (
      <div className={`${shellClass} ${className}`.trim()}>
        <div className="animate-pulse space-y-4">
          <div
            className={`h-5 rounded ${theme === 'band' ? 'bg-white/10' : 'bg-gray-200 dark:bg-gray-700'}`}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(3)].map((_, idx) => (
              <div
                key={idx}
                className={`h-20 rounded ${theme === 'band' ? 'bg-white/10' : 'bg-gray-100 dark:bg-gray-700'}`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${shellClass} ${className}`.trim()}>
        <div className="text-sm text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className={`${shellClass} ${className}`.trim()}>
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
      />
    </div>
  );
});
