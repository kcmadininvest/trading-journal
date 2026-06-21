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
import {
  formatCurrency as formatCurrencyUtil,
  formatNumber as formatNumberUtil,
  getCurrencySymbolForCode,
} from '../utils/numberFormat';
import { formatDate as formatDateUtil, type LanguageType } from '../utils/dateFormat';
import { useFinancialAggregationMode } from '../hooks/useFinancialAggregationMode';
import { applyConvertedPnlToTrades } from '../utils/convertTradePnl';
import { MultiCurrencyWarningBanner } from '../components/analytics/MultiCurrencyWarningBanner';
import { useTradingAccount } from '../contexts/TradingAccountContext';
import { usePersistedPeriodAndStrategyFilters } from '../hooks/usePersistedPeriodAndStrategyFilters';
import { useAccountIndicators } from '../hooks/useAccountIndicators';
import { AccountSummaryCard } from '../components/common/AccountSummaryCard';
import { useGlobalAllAccountsActivity } from '../hooks/useGlobalAllAccountsActivity';
import { useStatsBundle } from '../hooks/useStatsBundle';
import {
  buildBehaviorNarrative,
  buildBehaviorNarrativeContext,
} from '../utils/behaviorNarrative';
import { PageShell } from '../components/layout';
import { PnlBasisToggle } from '../components/common/PnlBasisToggle';
import { parsePnlDisplayMode } from '../utils/pnlDisplay';
import { usePeriodDateRange } from '../hooks/usePeriodDateRange';
import {
  BehaviorDisciplinePanel,
  BehaviorNarrativePanel,
  PostLossSizingPanel,
  PostWinSizingPanel,
} from '../components/analytics';
import { TabsFilter } from '../components/common/TabsFilter';
import { combineQueryLoadingStates } from '../hooks/useQueryLoadingState';

ChartJS.register(ArcElement, ChartTooltip, ChartLegend);

const BehaviorPage: React.FC = () => {
  const { preferences } = usePreferences();
  const pnlDisplayMode = parsePnlDisplayMode(preferences.pnl_display);
  const { theme } = useTheme();
  const { t, i18n } = useI18nTranslation(['analytics', 'dashboard']);
  const hideAccountNumber = useAccountNumberVisibility();
  const privacySettings = usePrivacySettings('analytics');
  const isDark = theme === 'dark';

  const formatNumber = useCallback(
    (value: number, digits: number = 2): string =>
      formatNumberUtil(value, digits, preferences.number_format),
    [preferences.number_format],
  );

  const formatCurrency = useCallback(
    (value: number, symbol: string = ''): string =>
      formatCurrencyUtil(value, symbol, preferences.number_format),
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
  const [filteredTrades, setFilteredTrades] = useState<TradeListItem[]>([]);

  const { strategies: positionStrategies, loading: loadingStrategies } = usePositionStrategiesForFilter();

  const { startDate: summaryStartDate, endDate: summaryEndDate } = usePeriodDateRange({
    selectedPeriod,
    selectedYear,
    selectedMonth,
  });

  const financialAggregation = useFinancialAggregationMode(
    accountId,
    preferences.default_currency || 'USD',
    selectedAccount?.currency,
  );

  const statsConvertTo = useMemo(() => {
    if (accountId != null || financialAggregation.mode !== 'multi_mixed_converted') {
      return null;
    }
    return financialAggregation.baseCurrency;
  }, [accountId, financialAggregation.mode, financialAggregation.baseCurrency]);

  const {
    statistics: statisticsData,
    analytics: analyticsData,
    dashboardSlice,
    isLoading: bundleLoading,
    isFetching: bundleFetching,
    error: bundleError,
  } = useStatsBundle({
    tradingAccountId: accountLoading ? undefined : accountId,
    year: selectedPeriod ? null : selectedYear,
    month: selectedPeriod ? null : selectedMonth,
    startDate: selectedPeriod?.start || null,
    endDate: selectedPeriod?.end || null,
    positionStrategy: selectedPositionStrategy,
    pnlDisplay: pnlDisplayMode,
    convertTo: statsConvertTo,
    enabled: !accountLoading,
  });
  const { globalAllAccountsActivity } = useGlobalAllAccountsActivity({
    loading: accountLoading,
    pnlDisplay: pnlDisplayMode,
  });

  useEffect(() => {
    const loadFilteredTrades = async () => {
      if (accountLoading) {
        setFilteredTrades([]);
        return;
      }
      try {
        const params: Record<string, string | number> = {
          page_size: 10000,
        };

        if (accountId != null) {
          params.trading_account = accountId;
        }

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

  const {
    balanceLoading,
    balanceError,
    peakLoading,
    ...accountIndicators
  } = useAccountIndicators({
    selectedAccount,
    filteredTrades,
    analyticsData,
    activeDays: dashboardSlice?.active_days,
    pnlDisplay: pnlDisplayMode,
    timezone: preferences.timezone,
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
    const code =
      financialAggregation.displayCurrencyCode || selectedAccount?.currency || '';
    if (!code || !currencies.length) return '';
    return getCurrencySymbolForCode(code, currencies);
  }, [financialAggregation.displayCurrencyCode, selectedAccount?.currency, currencies]);

  const formatDate = useCallback(
    (isoDate: string) =>
      formatDateUtil(isoDate, preferences.date_format, false, preferences.timezone),
    [preferences.date_format, preferences.timezone],
  );

  const tradesForNarrative = useMemo(() => {
    if (financialAggregation.mode !== 'multi_mixed_converted') {
      return filteredTrades;
    }
    return applyConvertedPnlToTrades(
      filteredTrades,
      financialAggregation.accountCurrencyById,
      financialAggregation.baseCurrency,
      financialAggregation.fxRates,
      pnlDisplayMode,
    );
  }, [
    filteredTrades,
    financialAggregation.mode,
    financialAggregation.accountCurrencyById,
    financialAggregation.baseCurrency,
    financialAggregation.fxRates,
    pnlDisplayMode,
  ]);

  const useConvertedPnl = financialAggregation.mode === 'multi_mixed_converted';

  const weekdayDayNames = useMemo(
    () => [
      t('dashboard:sunday'),
      t('dashboard:monday'),
      t('dashboard:tuesday'),
      t('dashboard:wednesday'),
      t('dashboard:thursday'),
      t('dashboard:friday'),
      t('dashboard:saturday'),
    ],
    [t],
  );

  const formatMonthLabel = useCallback(
    (monthKey: string) => {
      const [year, month] = monthKey.split('-').map(Number);
      if (!year || !month) return monthKey;
      const localeMap: Record<string, string> = {
        fr: 'fr-FR',
        en: 'en-US',
        es: 'es-ES',
        de: 'de-DE',
      };
      const lang = (i18n.language?.split('-')[0] || 'fr') as LanguageType;
      const locale = localeMap[lang] || 'fr-FR';
      const tz = preferences.timezone?.trim() || 'Europe/Paris';
      return new Date(year, month - 1, 15, 12, 0, 0).toLocaleDateString(locale, {
        month: 'long',
        year: 'numeric',
        timeZone: tz,
      });
    },
    [i18n.language, preferences.timezone],
  );

  const narrativeContext = useMemo(() => {
    return buildBehaviorNarrativeContext({
      statisticsData,
      analyticsData,
      trades: tradesForNarrative,
      timezone: preferences.timezone,
      pnlDisplayMode,
      weekdayDayNames,
      formatMonthLabel,
      monetaryNarrativesEnabled: financialAggregation.monetaryNarrativesEnabled,
      aggregationMode: financialAggregation.mode,
      useConvertedPnl,
    });
  }, [
    statisticsData,
    analyticsData,
    tradesForNarrative,
    preferences.timezone,
    pnlDisplayMode,
    weekdayDayNames,
    formatMonthLabel,
    financialAggregation.monetaryNarrativesEnabled,
    financialAggregation.mode,
    useConvertedPnl,
  ]);

  const isLoading =
    accountLoading ||
    bundleLoading ||
    (accountId == null && financialAggregation.fxLoading);

  const { isInitialLoading, isRefreshing } = combineQueryLoadingStates([
    { isLoading, isFetching: false, data: !isLoading },
    { isLoading: bundleLoading, isFetching: bundleFetching, data: statisticsData && analyticsData },
  ]);

  const narrativeSections = useMemo(() => {
    return buildBehaviorNarrative({
      context: narrativeContext,
      t,
      formatNumber,
      formatCurrency: (value, symbol) => formatCurrency(value, symbol ?? currencySymbol),
      formatDate,
      currencySymbol,
    });
  }, [narrativeContext, t, formatNumber, formatCurrency, formatDate, currencySymbol]);

  const behaviorTabs = useMemo(
    () => [
      {
        id: 'synthesis',
        label: t('analytics:behaviorNarrative.tabTitle'),
        content: (
          <BehaviorNarrativePanel
            sections={narrativeSections}
            context={narrativeContext}
            error={bundleError}
            hideMoney={privacySettings.hideProfitLoss}
            currencySymbol={currencySymbol}
            showMultiCurrencyWarning={financialAggregation.maskAggregatedMoney}
            formatNumber={formatNumber}
          />
        ),
      },
      {
        id: 'discipline',
        label: t('analytics:behaviorDiscipline.tabTitle'),
        content: (
          <BehaviorDisciplinePanel
            data={analyticsData?.behavior_discipline}
            formatNumber={formatNumber}
            showMultiCurrencyNote={financialAggregation.maskAggregatedMoney}
          />
        ),
      },
      {
        id: 'post-loss',
        label: t('analytics:postLossSizing.title'),
        content: (
          <PostLossSizingPanel
            data={analyticsData?.post_loss_sizing}
            chartColors={chartColors}
            isDark={isDark}
            formatNumber={formatNumber}
            showHeader={false}
            hideAggregatedMoney={financialAggregation.maskAggregatedMoney}
          />
        ),
      },
      {
        id: 'post-win',
        label: t('analytics:postWinSizing.title'),
        content: (
          <PostWinSizingPanel
            data={analyticsData?.post_win_sizing}
            chartColors={chartColors}
            isDark={isDark}
            formatNumber={formatNumber}
            showHeader={false}
            hideAggregatedMoney={financialAggregation.maskAggregatedMoney}
          />
        ),
      },
    ],
    [
      narrativeSections,
      narrativeContext,
      bundleError,
      privacySettings.hideProfitLoss,
      currencySymbol,
      financialAggregation.maskAggregatedMoney,
      formatNumber,
      analyticsData?.behavior_discipline,
      analyticsData?.post_loss_sizing,
      analyticsData?.post_win_sizing,
      chartColors,
      isDark,
      t,
    ],
  );

  if (isInitialLoading) {
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
      {isRefreshing && (
        <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-sky-500" />
        </div>
      )}
      <div className={isRefreshing ? 'opacity-80 transition-opacity' : undefined}>
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
          indicators={accountIndicators}
          currencySymbol={currencySymbol}
          globalAllAccountsActivity={globalAllAccountsActivity}
          hideInitialBalance={privacySettings.hideInitialBalance}
          hideCurrentBalance={privacySettings.hideCurrentBalance}
          hideConsistencyTarget={privacySettings.hideConsistencyTarget}
          balanceLoading={balanceLoading}
          peakLoading={peakLoading}
          detailsLoading={bundleLoading && !dashboardSlice}
          error={balanceError || bundleError?.message || null}
        />
      )}

      {bundleError && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-300">
            {bundleError.message}
          </p>
        </div>
      )}

      <MultiCurrencyWarningBanner
        show={financialAggregation.maskAggregatedMoney}
        className="mb-4"
      />

      <TabsFilter
        storageKey="behavior-active-tab"
        defaultTab="synthesis"
        tabs={behaviorTabs}
      />
      </div>
    </PageShell>
  );
};

export default BehaviorPage;
