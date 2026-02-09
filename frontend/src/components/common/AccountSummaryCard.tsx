import React from 'react';
import { AccountIndicators } from '../../hooks/useAccountIndicators';
import { AccountIndicatorsGrid } from './AccountIndicatorsGrid';

interface AccountSummaryCardProps {
  indicators: AccountIndicators;
  currencySymbol?: string;
  className?: string;
  hideInitialBalance?: boolean;
  hideCurrentBalance?: boolean;
  hideProfitLoss?: boolean;
  onNavigateToTransactions?: () => void;
  loading?: boolean;
  error?: string | null;
}

export const AccountSummaryCard: React.FC<AccountSummaryCardProps> = ({
  indicators,
  currencySymbol,
  className = '',
  hideInitialBalance,
  hideCurrentBalance,
  hideProfitLoss,
  onNavigateToTransactions,
  loading = false,
  error = null,
}) => {
  if (loading) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-5 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(3)].map((_, idx) => (
              <div key={idx} className="h-20 bg-gray-100 dark:bg-gray-700 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-5 ${className}`}>
        <div className="text-sm text-red-500 dark:text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 ${className}`}>
      <AccountIndicatorsGrid
        indicators={indicators}
        currencySymbol={currencySymbol}
        hideInitialBalance={hideInitialBalance}
        hideCurrentBalance={hideCurrentBalance}
        hideProfitLoss={hideProfitLoss}
        onNavigateToTransactions={onNavigateToTransactions}
      />
    </div>
  );
};
