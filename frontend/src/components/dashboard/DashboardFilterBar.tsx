import React from 'react';
import { useTranslation } from 'react-i18next';
import { AccountSelector } from '../accounts/AccountSelector';
import { PeriodSelector, type PeriodRange } from '../common/PeriodSelector';
import { PositionStrategyPillBar } from '../common/PositionStrategyPillBar';
import { PnlBasisToggle } from '../common/PnlBasisToggle';
import { PrivacyDropdown } from '../common/PrivacyDropdown';
import { GlobalStatsIndicators } from './GlobalStatsIndicators';
import { BAND_ROW_MIN_HEIGHT } from './filterBarStyles';
import { FILTER_BAR_SHELL_CLASS, TickerShell } from './tickerShell';
import { PAGE_CONTEXTS, PAGE_PRIVACY_OPTIONS } from '../../utils/privacyHelpers';
import type { PositionStrategy } from '../../services/positionStrategies';

export interface DashboardFilterBarGlobalStats {
  disciplineRate: number;
  disciplineSparkline?: number[];
  totalPnL: number;
  pnlSparkline?: number[];
  winRate?: number;
  winRateSparkline?: number[];
  totalPositions: number;
  globalActiveDays: number;
}

export interface DashboardFilterBarProps {
  accountId: number | null;
  onAccountChange: (accountId: number | null) => void;
  hideAccountNumber?: boolean;
  prefetchedAccounts?: import('../../services/tradingAccounts').TradingAccount[] | null;
  selectedPeriod: PeriodRange | null;
  onPeriodChange: (period: PeriodRange) => void;
  selectedPositionStrategy: number | null;
  onPositionStrategyChange: (strategyId: number | null) => void;
  positionStrategies: PositionStrategy[];
  loadingStrategies?: boolean;
  globalStatsLoading?: boolean;
  globalDashboardLoading?: boolean;
  globalStats: DashboardFilterBarGlobalStats | null;
  currencySymbol: string;
  globalPnlCurrencyMode?: 'single' | 'mixed';
  hideCurrentBalance?: boolean;
  numberFormat?: 'point' | 'comma';
  className?: string;
}

const PILL_WIDTH = 'w-44 sm:w-48 shrink-0';

export const DashboardFilterBar: React.FC<DashboardFilterBarProps> = ({
  accountId,
  onAccountChange,
  hideAccountNumber = false,
  prefetchedAccounts,
  selectedPeriod,
  onPeriodChange,
  selectedPositionStrategy,
  onPositionStrategyChange,
  positionStrategies,
  loadingStrategies = false,
  globalStatsLoading = false,
  globalDashboardLoading = false,
  globalStats,
  currencySymbol,
  globalPnlCurrencyMode = 'single',
  hideCurrentBalance = false,
  numberFormat = 'comma',
  className = 'mb-4',
}) => {
  const { t } = useTranslation('dashboard');
  const ariaLabel = t('filterBar.regionLabel', {
    defaultValue: 'Filtres du tableau de bord',
  });

  const statsLoading = globalStatsLoading || globalDashboardLoading || !globalStats;

  return (
    <div className={`min-w-0 ${className}`.trim()}>
      <TickerShell ariaLabel={ariaLabel} shellClassName={FILTER_BAR_SHELL_CLASS}>
        <div
          className={`flex w-full ${BAND_ROW_MIN_HEIGHT} min-w-0 flex-nowrap items-center gap-2 sm:gap-3`}
        >
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="min-w-0 w-max max-w-[min(100vw-8rem,20rem)]">
              <AccountSelector
                value={accountId}
                onChange={onAccountChange}
                hideLabel
                hideAccountNumber={hideAccountNumber}
                prefetchedAccounts={prefetchedAccounts}
                variant="default"
              />
            </div>
            <div className="flex h-10 shrink-0 items-center">
              <PrivacyDropdown
                pageContext={PAGE_CONTEXTS.DASHBOARD}
                availableOptions={PAGE_PRIVACY_OPTIONS[PAGE_CONTEXTS.DASHBOARD]}
                variant="default"
              />
            </div>
          </div>

          <div
            className={`flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto overflow-y-visible py-1 overscroll-x-contain sm:gap-3 [-webkit-overflow-scrolling:touch]`}
          >
            <div className={`min-w-0 ${PILL_WIDTH}`}>
              <PeriodSelector
                value={selectedPeriod}
                onChange={onPeriodChange}
                variant="default"
              />
            </div>

            <div className={`min-w-0 ${PILL_WIDTH}`}>
              <PositionStrategyPillBar
                value={selectedPositionStrategy}
                onChange={onPositionStrategyChange}
                strategies={positionStrategies}
                disabled={loadingStrategies}
                variant="default"
              />
            </div>

            <div className={`min-w-0 ${PILL_WIDTH}`}>
              <PnlBasisToggle variant="default" />
            </div>
          </div>

          <div className="hidden shrink-0 2xl:ml-auto 2xl:flex 2xl:items-center">
            {statsLoading ? (
              <div className={`flex ${BAND_ROW_MIN_HEIGHT} items-center gap-2`}>
                <div className="h-10 w-32 shrink-0 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
                <div className="h-10 w-32 shrink-0 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
                <div className="h-10 w-32 shrink-0 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
              </div>
            ) : (
              <GlobalStatsIndicators
                disciplineRate={globalStats.disciplineRate}
                disciplineSparkline={globalStats.disciplineSparkline}
                totalPnL={globalStats.totalPnL}
                pnlSparkline={globalStats.pnlSparkline}
                winRate={globalStats.winRate}
                winRateSparkline={globalStats.winRateSparkline}
                totalPositions={globalStats.totalPositions}
                globalActiveDays={globalStats.globalActiveDays}
                currencySymbol={currencySymbol}
                pnlCurrencyMode={globalPnlCurrencyMode}
                hideCurrentBalance={hideCurrentBalance}
                numberFormat={numberFormat}
              />
            )}
          </div>
        </div>
      </TickerShell>
    </div>
  );
};

export default DashboardFilterBar;
