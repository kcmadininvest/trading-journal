import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
} from 'chart.js';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { AccountSelector } from '../components/accounts/AccountSelector';
import { useAccountNumberVisibility } from '../hooks/useAccountNumberVisibility';
import { usePrivacySettings } from '../hooks/usePrivacySettings';
import { PeriodSelector } from '../components/common/PeriodSelector';
import { tradingAccountsService, TradingAccount } from '../services/tradingAccounts';
import { tradesService, TradeListItem } from '../services/trades';
import { currenciesService, Currency } from '../services/currencies';
import { PositionStrategyFilterField } from '../components/common/PositionStrategyPillBar';
import { usePositionStrategiesForFilter } from '../hooks/usePositionStrategiesForFilter';
import { usePreferences } from '../hooks/usePreferences';
import { useTheme } from '../hooks/useTheme';
import { formatNumber as formatNumberUtil } from '../utils/numberFormat';
import { useTradingAccount } from '../contexts/TradingAccountContext';
import { usePersistedPeriodAndStrategyFilters } from '../hooks/usePersistedPeriodAndStrategyFilters';
import { useAccountIndicators } from '../hooks/useAccountIndicators';
import { AccountSummaryCard } from '../components/common/AccountSummaryCard';
import { useDashboardData } from '../hooks/useDashboardData';
import { useGlobalAllAccountsActivity } from '../hooks/useGlobalAllAccountsActivity';
import { useAnalytics } from '../hooks/useStatistics';
import { PageShell } from '../components/layout';
import { PnlBasisToggle } from '../components/common/PnlBasisToggle';
import { usePeriodDateRange } from '../hooks/usePeriodDateRange';
import { PostLossSizingPanel } from '../components/analytics';
import { parsePnlDisplayMode } from '../utils/pnlDisplay';

ChartJS.register(ArcElement, ChartTooltip, ChartLegend);

const BehaviorPage: React.FC = () => {
  const { preferences } = usePreferences();
  const pnlDisplayMode = parsePnlDisplayMode(preferences.pnl_display);
  const { theme } = useTheme();
  const { t } = useI18nTranslation();
  const hideAccountNumber = useAccountNumberVisibility();
  const privacySettings = usePrivacySettings('analytics');
  const isDark = theme === 'dark';

  const formatNumber = useCallback(
    (value: number, digits: number = 2): string =>
      formatNumberUtil(value, digits, preferences.number_format),
    [preferences.number_format],
  );

  const chartColors = useMemo(
    () => ({
      text: isDark ? '#d1d5db' : '#374151',
      textSecondary: isDark ? '#9ca3af' : '#6b7280',
      background: isDark ? '#1f2937' : '#ffffff',
      grid: isDark ? '#374151' : '#e5e7eb',
      border: isDark ? '#4b5563' : '#d1d5db',
      tooltipBg: isDark ? '#374151' : '#ffffff',
      tooltipTitle: isDark ? '#d1d5db' : '#4b5563',
      tooltipBody: isDark ? '#f3f4f6' : '#1f2937',
      tooltipBorder: isDark ? '#4b5563' : '#e5e7eb',
    }),
    [isDark],
  );

  const { selectedAccountId: accountId, setSelectedAccountId: setAccountId, loading: accountLoading } =
    useTradingAccount();
  const { selectedPeriod, setSelectedPeriod, selectedPositionStrategy, setSelectedPositionStrategy } =
    usePersistedPeriodAndStrategyFilters(accountId);

  const [selectedYear] = useState<number | null>(null);
  const [selectedMonth] = useState<number | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<TradingAccount | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [allTrades, setAllTrades] = useState<TradeListItem[]>([]);
  const [filteredTrades, setFilteredTrades] = useState<TradeListItem[]>([]);

  const { strategies: positionStrategies, loading: loadingStrategies } = usePositionStrategiesForFilter();

  const { startDate: summaryStartDate, endDate: summaryEndDate } = usePeriodDateRange({
    selectedPeriod,
    selectedYear,
    selectedMonth,
  });

  const { data: dashboardSummary, isLoading: summaryLoading, error: summaryError } = useDashboardData({
    accountId,
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

  const { data: analyticsData, isLoading: analyticsLoading, error: analyticsError } = useAnalytics(
    accountLoading ? undefined : accountId,
    selectedPeriod ? null : selectedYear,
    selectedPeriod ? null : selectedMonth,
    selectedPeriod?.start || null,
    selectedPeriod?.end || null,
    selectedPositionStrategy,
    pnlDisplayMode,
  );

  useEffect(() => {
    const loadAllTrades = async () => {
      if (!accountId || accountLoading) {
        setAllTrades([]);
        return;
      }
      try {
        const response = await tradesService.list({
          trading_account: accountId,
          page_size: 10000,
        });
        setAllTrades(response.results);
      } catch (err) {
        console.error('Erreur lors du chargement de tous les trades', err);
        setAllTrades([]);
      }
    };
    loadAllTrades();
  }, [accountId, accountLoading]);

  useEffect(() => {
    const loadFilteredTrades = async () => {
      if (!accountId || accountLoading) {
        setFilteredTrades([]);
        return;
      }
      try {
        const params: Record<string, string | number> = {
          trading_account: accountId,
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
  }, [accountId, accountLoading, selectedPeriod, selectedYear, selectedMonth, selectedPositionStrategy]);

  const indicators = useAccountIndicators({
    selectedAccount,
    allTrades,
    filteredTrades,
    analyticsData,
    activeDays: dashboardSummary?.active_days,
    pnlDisplay: pnlDisplayMode,
  });

  useEffect(() => {
    const loadCurrencies = async () => {
      try {
        const currencyList = await currenciesService.list();
        setCurrencies(currencyList);
      } catch (err) {
        console.error('Erreur lors du chargement des devises', err);
      }
    };
    loadCurrencies();
  }, []);

  useEffect(() => {
    const loadAccount = async () => {
      if (!accountId) {
        setSelectedAccount(null);
        return;
      }
      try {
        const account = await tradingAccountsService.get(accountId);
        setSelectedAccount(account);
      } catch (err) {
        console.error('Erreur lors du chargement du compte', err);
        setSelectedAccount(null);
      }
    };
    loadAccount();
  }, [accountId]);

  const currencySymbol = useMemo(() => {
    if (!selectedAccount || !currencies.length) return '';
    const currency = currencies.find((c) => c.code === selectedAccount.currency);
    return currency?.symbol || '';
  }, [selectedAccount, currencies]);

  const isLoading = accountLoading || analyticsLoading;

  if (isLoading) {
    return (
      <PageShell>
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="flex min-w-0 flex-col lg:flex-row lg:items-end gap-4">
          <div className="w-full min-w-0 lg:w-auto lg:flex-shrink-0">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('analytics:tradingAccount')}
            </label>
            <AccountSelector
              value={accountId}
              onChange={setAccountId}
              hideLabel
              hideAccountNumber={hideAccountNumber}
            />
          </div>

          <div className="w-full lg:w-auto lg:flex-shrink-0">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('analytics:period', { defaultValue: 'Période' })}
            </label>
            <PeriodSelector
              value={selectedPeriod}
              onChange={(period) => setSelectedPeriod(period)}
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
        </div>
      </div>

      {selectedAccount && (
        <AccountSummaryCard
          className="mb-6"
          indicators={indicators}
          currencySymbol={currencySymbol}
          globalAllAccountsActivity={globalAllAccountsActivity}
          hideInitialBalance={privacySettings.hideInitialBalance}
          hideCurrentBalance={privacySettings.hideCurrentBalance}
          hideConsistencyTarget={privacySettings.hideConsistencyTarget}
          loading={summaryLoading}
          error={summaryError}
        />
      )}

      {analyticsError && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-300">{analyticsError.message}</p>
        </div>
      )}

      <PostLossSizingPanel
        data={analyticsData?.post_loss_sizing}
        chartColors={chartColors}
        isDark={isDark}
        formatNumber={formatNumber}
      />
    </PageShell>
  );
};

export default BehaviorPage;
