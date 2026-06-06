import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useStatistics, useAnalytics, useTradesUpdateInvalidation } from '../hooks/useStatistics';
import { useTradingAccounts } from '../hooks/useStatistics';
import { formatCurrency as formatCurrencyUtil, formatNumber as formatNumberUtil } from '../utils/numberFormat';
import { AccountSelector } from '../components/accounts/AccountSelector';
import { TradingAccount } from '../services/tradingAccounts';
import { StatisticsPageSkeleton } from '../components/ui/StatisticsPageSkeleton';
import { currenciesService, Currency } from '../services/currencies';
import { tradesService, TradeListItem } from '../services/trades';
import { PositionStrategyFilterField } from '../components/common/PositionStrategyPillBar';
import { usePositionStrategiesForFilter } from '../hooks/usePositionStrategiesForFilter';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { usePreferences } from '../hooks/usePreferences';
import { PeriodSelector } from '../components/common/PeriodSelector';
import { useTradingAccount } from '../contexts/TradingAccountContext';
import { usePersistedPeriodAndStrategyFilters } from '../hooks/usePersistedPeriodAndStrategyFilters';
import { ImportTradesModal } from '../components/trades/ImportTradesModal';
import { useAccountNumberVisibility } from '../hooks/useAccountNumberVisibility';
import { usePrivacySettings } from '../hooks/usePrivacySettings';
import { useAccountIndicators } from '../hooks/useAccountIndicators';
import { AccountSummaryCard } from '../components/common/AccountSummaryCard';
import { useDashboardData } from '../hooks/useDashboardData';
import { useGlobalAllAccountsActivity } from '../hooks/useGlobalAllAccountsActivity';
import { ExportButton } from '../components/exports';
import { usePeriodDateRange } from '../hooks/usePeriodDateRange';
import { PageShell } from '../components/layout';
import { PnlBasisToggle } from '../components/common/PnlBasisToggle';
import { parsePnlDisplayMode } from '../utils/pnlDisplay';
import { useTheme } from '../hooks/useTheme';
import { getChartColors } from '../utils/chartConfig';
import { buildTradesDistributionData } from '../utils/buildTradesDistributionData';
import { StatisticsTabNav } from '../components/statistics/StatisticsTabNav';
import { StatisticsHeroStrip } from '../components/statistics/StatisticsHeroStrip';
import { StatisticsOverviewTab } from '../components/statistics/StatisticsOverviewTab';
import { StatisticsPerformanceTab } from '../components/statistics/StatisticsPerformanceTab';
import { StatisticsTradesTab } from '../components/statistics/StatisticsTradesTab';
import { StatisticsAdvancedTab } from '../components/statistics/StatisticsAdvancedTab';
import {
  isStatisticsTabId,
  STATISTICS_ACTIVE_TAB_KEY,
  type StatisticsTabId,
} from '../components/statistics/statisticsConstants';
import type { PointsStats } from '../components/statistics/statisticsTypes';

function StatisticsPage() {
  const { t } = useI18nTranslation();
  const { preferences, loading: preferencesLoading } = usePreferences();
  const { theme } = useTheme();
  const pnlDisplayMode = parsePnlDisplayMode(preferences.pnl_display);
  const { selectedAccountId, setSelectedAccountId, loading: accountLoading } = useTradingAccount();
  const { selectedPeriod, setSelectedPeriod, selectedPositionStrategy, setSelectedPositionStrategy } =
    usePersistedPeriodAndStrategyFilters(selectedAccountId);
  const hideAccountNumber = useAccountNumberVisibility();
  const privacySettings = usePrivacySettings('statistics');
  const [selectedAccount, setSelectedAccount] = useState<TradingAccount | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [filteredTrades, setFilteredTrades] = useState<TradeListItem[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [activeTab, setActiveTab] = useState<StatisticsTabId>(() => {
    const saved = localStorage.getItem(STATISTICS_ACTIVE_TAB_KEY);
    return isStatisticsTabId(saved) ? saved : 'overview';
  });

  const { strategies: positionStrategies, loading: loadingStrategies } = usePositionStrategiesForFilter();
  const { data: accounts, isLoading: accountsLoading } = useTradingAccounts();
  const { data: statisticsData, isLoading: statisticsLoading, error: statisticsError } = useStatistics(
    accountLoading ? undefined : selectedAccountId,
    selectedPeriod ? null : selectedYear,
    selectedPeriod ? null : selectedMonth,
    selectedPeriod?.start || null,
    selectedPeriod?.end || null,
    selectedPositionStrategy,
    pnlDisplayMode,
  );
  const { data: analyticsData, isLoading: analyticsLoading, error: analyticsError } = useAnalytics(
    accountLoading ? undefined : selectedAccountId,
    selectedPeriod ? null : selectedYear,
    selectedPeriod ? null : selectedMonth,
    selectedPeriod?.start || null,
    selectedPeriod?.end || null,
    selectedPositionStrategy,
    pnlDisplayMode,
  );

  const { startDate: summaryStartDate, endDate: summaryEndDate } = usePeriodDateRange({
    selectedPeriod,
    selectedYear,
    selectedMonth,
  });

  const { data: dashboardSummary, isLoading: summaryLoading, error: summaryError } = useDashboardData({
    accountId: selectedAccountId,
    startDate: summaryStartDate,
    endDate: summaryEndDate,
    loading: accountLoading,
    positionStrategy: selectedPositionStrategy,
    pnlDisplay: pnlDisplayMode,
  });
  const { globalAllAccountsActivity } = useGlobalAllAccountsActivity({
    loading: accountLoading,
    pnlDisplay: pnlDisplayMode,
  });

  useEffect(() => {
    localStorage.setItem(STATISTICS_ACTIVE_TAB_KEY, activeTab);
  }, [activeTab]);

  const reloadStatistics = () => {
    const currentPeriod = selectedPeriod;
    const currentYear = selectedYear;
    const currentMonth = selectedMonth;
    if (currentPeriod) {
      setSelectedPeriod(null);
      setTimeout(() => setSelectedPeriod(currentPeriod), 0);
    } else {
      setSelectedYear(null);
      setSelectedMonth(null);
      setTimeout(() => {
        setSelectedYear(currentYear);
        setSelectedMonth(currentMonth);
      }, 0);
    }
  };

  useEffect(() => {
    const loadCurrencies = async () => {
      try {
        const list = await currenciesService.list();
        setCurrencies(list);
      } catch (error) {
        console.error('Error loading currencies:', error);
      }
    };
    loadCurrencies();
  }, []);

  const currencySymbol = useMemo(() => {
    if (!selectedAccount?.currency) return '';
    const currency = currencies.find((c) => c.code === selectedAccount.currency);
    return currency?.symbol || '';
  }, [selectedAccount, currencies]);

  useTradesUpdateInvalidation();

  const isLoading = preferencesLoading || accountLoading || accountsLoading || statisticsLoading || analyticsLoading;
  const hasError = statisticsError || analyticsError;

  useEffect(() => {
    const loadAccount = async () => {
      if (!selectedAccountId) {
        setSelectedAccount(null);
        return;
      }
      try {
        const account = accounts?.find((acc) => acc.id === selectedAccountId);
        if (account) setSelectedAccount(account);
      } catch (err) {
        console.error('Erreur lors du chargement du compte', err);
        setSelectedAccount(null);
      }
    };
    loadAccount();
  }, [selectedAccountId, accounts]);

  useEffect(() => {
    const loadFilteredTrades = async () => {
      if (!selectedAccountId || accountLoading) {
        setFilteredTrades([]);
        return;
      }
      try {
        const params: Record<string, unknown> = {
          trading_account: selectedAccountId,
          page_size: 10000,
        };

        if (selectedPeriod) {
          params.start_date = selectedPeriod.start;
          params.end_date = selectedPeriod.end;
        } else if (selectedYear) {
          const startDate = selectedMonth
            ? `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`
            : `${selectedYear}-01-01`;
          const endDate = selectedMonth
            ? (() => {
                const lastDay = new Date(selectedYear, selectedMonth, 0);
                return `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
              })()
            : `${selectedYear}-12-31`;
          params.start_date = startDate;
          params.end_date = endDate;
        }

        if (selectedPositionStrategy) {
          params.position_strategy = selectedPositionStrategy;
        }

        const response = await tradesService.list(params);
        setFilteredTrades(response.results);
      } catch (err) {
        console.error('Erreur lors du chargement des trades filtrés', err);
        setFilteredTrades([]);
      }
    };
    loadFilteredTrades();
  }, [selectedAccountId, accountLoading, selectedPeriod, selectedYear, selectedMonth, selectedPositionStrategy]);

  const {
    balanceLoading,
    balanceError,
    peakLoading,
    ...accountIndicators
  } = useAccountIndicators({
    selectedAccount,
    filteredTrades,
    analyticsData,
    activeDays: dashboardSummary?.active_days,
    pnlDisplay: pnlDisplayMode,
    timezone: preferences.timezone,
  });

  const medianTradeCost = useMemo(() => {
    if (!filteredTrades || filteredTrades.length === 0) return 0;

    const costs = filteredTrades
      .map((trade) => {
        const fees = trade.fees ? parseFloat(trade.fees) : 0;
        const commissions = trade.commissions ? parseFloat(trade.commissions) : 0;
        return fees + commissions;
      })
      .filter((cost) => cost > 0)
      .sort((a, b) => a - b);

    if (costs.length === 0) return 0;

    const n = costs.length;
    return n % 2 === 0 ? (costs[n / 2 - 1] + costs[n / 2]) / 2 : costs[Math.floor(n / 2)];
  }, [filteredTrades]);

  const pointsStats = useMemo((): PointsStats | null => {
    if (!filteredTrades || filteredTrades.length === 0) return null;

    const calcPts = (trade: TradeListItem): number | null => {
      if (!trade.entry_price || !trade.exit_price) return null;
      const entry = parseFloat(trade.entry_price);
      const exit = parseFloat(trade.exit_price);
      if (isNaN(entry) || isNaN(exit)) return null;
      return trade.trade_type === 'Long' ? exit - entry : entry - exit;
    };

    const allPts = filteredTrades.map(calcPts).filter((p): p is number => p !== null);
    if (allPts.length === 0) return null;

    const winPts = allPts.filter((p) => p > 0);
    const losePts = allPts.filter((p) => p < 0);
    const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

    return {
      avgPointsPerTrade: avg(allPts),
      avgPointsWin: avg(winPts),
      avgPointsLoss: avg(losePts),
      maxPointsGain: allPts.length > 0 ? Math.max(...allPts) : 0,
      maxPointsLoss: allPts.length > 0 ? Math.min(...allPts) : 0,
      totalPoints: allPts.reduce((a, b) => a + b, 0),
      tradesWithPoints: allPts.length,
    };
  }, [filteredTrades]);

  const formatCurrency = useCallback(
    (value: number, symbol: string = currencySymbol): string => {
      return formatCurrencyUtil(value, symbol, preferences.number_format, 2);
    },
    [preferences.number_format, currencySymbol],
  );

  const formatNumber = useCallback(
    (value: number, digits: number = 2) => formatNumberUtil(value, digits, preferences.number_format),
    [preferences.number_format],
  );

  const formatVolume = useCallback(
    (volume: string) => {
      if (!volume) return 'N/A';
      const num = parseFloat(volume);

      if (num >= 1000000) return `${formatNumber(num / 1000000, 1)}M`;
      if (num >= 1000) return `${formatNumber(num / 1000, 1)}K`;
      if (num >= 1) return formatNumber(num, 0);
      return formatNumber(num, 2);
    },
    [formatNumber],
  );

  const formatRatio = useCallback(
    (ratio: number) => {
      const absRatio = Math.abs(ratio);
      if (absRatio >= 1) return formatNumber(ratio, 2);
      if (absRatio >= 0.01) return formatNumber(ratio, 4);
      return formatNumber(ratio, 6);
    },
    [formatNumber],
  );

  const chartColors = useMemo(() => getChartColors(theme === 'dark'), [theme]);

  const tradesDistributionData = useMemo(
    () =>
      statisticsData
        ? buildTradesDistributionData(filteredTrades, statisticsData, t, pnlDisplayMode)
        : null,
    [filteredTrades, statisticsData, t, pnlDisplayMode],
  );

  const tabSharedProps = useMemo(
    () => ({
      statisticsData: statisticsData!,
      analyticsData: analyticsData ?? null,
      currencySymbol,
      formatCurrency,
      formatNumber,
      formatVolume,
      formatRatio,
      hideMoney: privacySettings.hideProfitLoss,
    }),
  [statisticsData, analyticsData, currencySymbol, formatCurrency, formatNumber, formatVolume, formatRatio, privacySettings.hideProfitLoss],
  );

  if (hasError) {
    return (
      <PageShell>
        <div className="py-8 text-center sm:py-12">
          <div className="mb-3 text-sm text-red-500 dark:text-red-400 sm:mb-4 sm:text-base lg:text-lg">
            {t('statistics:errorLoadingData')}
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded bg-blue-500 px-3 py-2 text-sm text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 sm:px-4 sm:text-base"
          >
            {t('statistics:retry')}
          </button>
        </div>
      </PageShell>
    );
  }

  if (isLoading) {
    return <StatisticsPageSkeleton />;
  }

  return (
    <PageShell>
      <div className="w-full">
        <div className="mb-4 rounded-lg bg-white p-3 shadow dark:bg-gray-800 sm:mb-6 sm:p-4">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end">
            <div className="w-full min-w-0 lg:w-auto lg:flex-shrink-0">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('statistics:tradingAccount')}
              </label>
              <AccountSelector
                value={selectedAccountId}
                onChange={(accountId) => setSelectedAccountId(accountId)}
                hideLabel
                hideAccountNumber={hideAccountNumber}
              />
            </div>

            <div className="w-full lg:w-auto lg:flex-shrink-0">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('statistics:period', { defaultValue: 'Période' })}
              </label>
              <PeriodSelector
                value={selectedPeriod}
                onChange={(period) => {
                  setSelectedPeriod(period);
                  setSelectedYear(null);
                  setSelectedMonth(null);
                }}
              />
            </div>

            <PositionStrategyFilterField
              className="w-full lg:min-w-0 lg:flex-1 lg:max-w-sm"
              value={selectedPositionStrategy}
              onChange={setSelectedPositionStrategy}
              strategies={positionStrategies}
              loading={loadingStrategies}
            />

            <div className="flex w-full items-end lg:w-auto lg:flex-shrink-0">
              <PnlBasisToggle />
            </div>

            <div className="flex w-full flex-wrap items-end gap-2 lg:ml-auto lg:w-auto lg:flex-shrink-0 lg:justify-end">
              {selectedAccount && (
                <ExportButton tradingAccountId={selectedAccount.id} tradingAccountName={selectedAccount.name} />
              )}
            </div>
          </div>
        </div>

        {selectedAccount && (
          <AccountSummaryCard
            className="mb-4 sm:mb-6"
            indicators={accountIndicators}
            currencySymbol={currencySymbol}
            globalAllAccountsActivity={globalAllAccountsActivity}
            hideInitialBalance={privacySettings.hideInitialBalance}
            hideCurrentBalance={privacySettings.hideCurrentBalance}
            hideConsistencyTarget={privacySettings.hideConsistencyTarget}
            balanceLoading={balanceLoading}
            peakLoading={peakLoading}
            detailsLoading={isLoading || summaryLoading}
            error={balanceError || (hasError ? t('statistics:errorLoadingData') : summaryError)}
          />
        )}

        {statisticsData && (
          <StatisticsHeroStrip
            statisticsData={statisticsData}
            currencySymbol={currencySymbol}
            formatCurrency={formatCurrency}
            formatNumber={formatNumber}
            hideMoney={privacySettings.hideProfitLoss}
          />
        )}

        <StatisticsTabNav activeTab={activeTab} onTabChange={setActiveTab} />

        {statisticsData && activeTab === 'overview' && (
          <StatisticsOverviewTab
            {...tabSharedProps}
            tradesDistributionData={tradesDistributionData}
            chartColors={chartColors}
          />
        )}

        {statisticsData && activeTab === 'performance' && (
          <StatisticsPerformanceTab {...tabSharedProps} />
        )}

        {statisticsData && activeTab === 'trades' && (
          <StatisticsTradesTab
            {...tabSharedProps}
            pointsStats={pointsStats}
            medianTradeCost={medianTradeCost}
            chartColors={chartColors}
          />
        )}

        {statisticsData && activeTab === 'advanced' && <StatisticsAdvancedTab {...tabSharedProps} />}
      </div>

      <ImportTradesModal
        open={showImport}
        onClose={(done) => {
          setShowImport(false);
          if (done) reloadStatistics();
        }}
      />
    </PageShell>
  );
}

export default StatisticsPage;
