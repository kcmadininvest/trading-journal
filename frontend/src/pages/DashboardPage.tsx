import React, { useState, useEffect, useMemo, useRef, lazy } from 'react';
import { useWindowWidth } from '../hooks/useWindowWidth';
import clsx from 'clsx';
import { ImportTradesModal } from '../components/trades/ImportTradesModal';
import { User } from '../services/auth';
import { calendarService as marketCalendarService, MarketHoliday, MarketTodaySnapshot } from '../services/calendar';
import { useDashboardData } from '../hooks/useDashboardData';
import { useGlobalAllAccountsActivity } from '../hooks/useGlobalAllAccountsActivity';
import { tradingAccountsService, TradingAccount, AccountDailyMetric } from '../services/tradingAccounts';
import { currenciesService, Currency } from '../services/currencies';
import { accountTransactionsService, AccountTransaction } from '../services/accountTransactions';
import { tradeStrategiesService } from '../services/tradeStrategies';
import { usePositionStrategiesForFilter } from '../hooks/usePositionStrategiesForFilter';
import ModernStatCard from '../components/common/ModernStatCard';
import { MetricGauge, GAUGE_CONFIGS } from '../components/statistics/MetricGauge';
import Tooltip from '../components/ui/Tooltip';
import { usePreferences } from '../hooks/usePreferences';
import { useTheme } from '../hooks/useTheme';
import { formatCurrency as formatCurrencyUtil, formatNumber as formatNumberUtil } from '../utils/numberFormat';
import { formatDate, toIsoCalendarDateInTimezone } from '../utils/dateFormat';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useTradingAccount } from '../contexts/TradingAccountContext';
import { usePersistedPeriodAndStrategyFilters } from '../hooks/usePersistedPeriodAndStrategyFilters';
import { useAccountIndicators } from '../hooks/useAccountIndicators';
import { AccountSummaryCard } from '../components/common/AccountSummaryCard';
import { usePrivacySettings } from '../hooks/usePrivacySettings';
import { ModernMarketInfo } from '../components/market/ModernMarketInfo';
import { MarketQuotesTicker } from '../components/dashboard/MarketQuotesTicker';
import { DashboardFilterBar } from '../components/dashboard/DashboardFilterBar';
import { PeriodPerformanceKpis } from '../components/dashboard/PeriodPerformanceKpis';
import { WeekdayPerformanceSection } from '../components/dashboard/WeekdayPerformanceSection';
import {
  DashboardPanel,
  getDashboardChartAxisColors,
  DASHBOARD_GAUGE_TILE_CLASS,
  DASHBOARD_PANEL_HINT_CLASS,
  DASHBOARD_PANEL_TITLE_CLASS,
  getDashboardPerformanceBadgeClasses,
  DASHBOARD_PNL_NEGATIVE_TEXT_CLASS,
  DASHBOARD_PNL_POSITIVE_TEXT_CLASS,
} from '../components/dashboard/tickerShell';
import { useWeekdayPerformance } from '../hooks/useWeekdayPerformance';
import { PageShell } from '../components/layout';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar as ChartBar } from 'react-chartjs-2';
import { getChartColors, buildChartTooltipPlugin } from '../utils/chartConfig';
import { ChartTooltipResetContainer } from '../components/charts/ChartTooltipResetContainer';
import { parsePnlDisplayMode, getTradeDisplayPnlValue } from '../utils/pnlDisplay';
import { resolveAccountChartConfig } from '../utils/accountChartConfig';
import { aggregateDurationDistribution } from '../utils/tradeDurationBuckets';
import { getWaterfallBarBorder, getWaterfallBarFill } from '../utils/waterfallBarGradient';
import { WIN_RATE_ROLLING_WINDOW } from '../utils/tradingSampleThresholds';
import {
  getTradePnlOutcome,
  resolveWinRateRingSecondary,
} from '../utils/computeRollingPeakWinRate';
import { buildGlobalStatsSparklines } from '../utils/globalStatsSparklines';

// Lazy load heavy chart components for better performance
const DurationDistributionChart = lazy(() => import('../components/charts/DurationDistributionChart'));
const AccountBalanceChart = lazy(() => import('../components/charts/AccountBalanceChart'));

// Enregistrer les composants Chart.js nécessaires
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  ChartTooltip,
  ChartLegend,
  ChartDataLabels
);

interface DashboardPageProps {
  currentUser: User;
}

// Fonction utilitaire pour formater les montants avec séparateurs de milliers (remplacée par formatCurrencyUtil avec préférences)

// Fonction pour obtenir le label de performance variable
const getPerformanceLabel = (
  currentValue: number,
  objective: number,
  metricType: 'winRate' | 'avgWinning' | 'avgLosing',
  t: (key: string) => string
): { label: string; color: string } => {
  let percentage: number;
  let color: string;
  let label: string;
  
  if (metricType === 'winRate') {
    // Pour winRate, utiliser des seuils absolus fixes
    // Standards du trading : 60%+ excellent, 50%+ bon, 40%+ moyen, <40% à améliorer
    if (currentValue >= 60) {
      label = t('dashboard:excellent');
      color = '#10b981'; // green
    } else if (currentValue >= 50) {
      label = t('dashboard:good');
      color = '#10b981'; // green
    } else if (currentValue >= 40) {
      label = t('dashboard:average');
      color = '#f59e0b'; // orange
    } else {
      label = t('dashboard:needsImprovement');
      color = '#ef4444'; // red
    }
  } else if (metricType === 'avgLosing') {
    // Pour avgLosing, on veut un montant FAIBLE, donc on inverse la logique
    // Plus c'est bas par rapport à l'objectif, mieux c'est
    percentage = (1 - Math.min(currentValue / objective, 1)) * 100;
    
    if (percentage >= 90) {
      label = t('dashboard:excellent');
      color = '#10b981'; // green
    } else if (percentage >= 70) {
      label = t('dashboard:veryGood');
      color = '#10b981'; // green
    } else if (percentage >= 50) {
      label = t('dashboard:good');
      color = '#f59e0b'; // orange
    } else if (percentage >= 30) {
      label = t('dashboard:average');
      color = '#f59e0b'; // orange
    } else {
      label = t('dashboard:needsImprovement');
      color = '#ef4444'; // red
    }
  } else {
    // Pour avgWinning, plus c'est haut par rapport à l'objectif, mieux c'est
    percentage = Math.min((currentValue / objective) * 100, 100);
    
    if (percentage >= 90) {
      label = t('dashboard:excellent');
      color = '#10b981'; // green
    } else if (percentage >= 70) {
      label = t('dashboard:veryGood');
      color = '#10b981'; // green
    } else if (percentage >= 50) {
      label = t('dashboard:good');
      color = '#f59e0b'; // orange
    } else if (percentage >= 30) {
      label = t('dashboard:average');
      color = '#f59e0b'; // orange
    } else {
      label = t('dashboard:needsImprovement');
      color = '#ef4444'; // red
    }
  }
  
  return {
    label,
    color,
  };
};

/** Seuils d'agrégation automatique pour le graphique waterfall (affichage uniquement). */
const WATERFALL_DAILY_BAR_MAX = 90;
const WATERFALL_WEEKLY_AGGREGATE_MAX_DAYS = 730;
const BALANCE_DAILY_POINT_MAX = 180;
const BALANCE_WEEKLY_AGGREGATE_MAX_DAYS = 730;

interface WaterfallDailyPoint {
  dateKey: string;
  pnlTrading: number;
  dailyNetTransactions: number;
  dailyTotalVariation: number;
  cumulative: number;
  is_positive: boolean;
  hasTradingData: boolean;
}

type WaterfallAggregation = 'day' | 'week' | 'month';

type BalanceAggregation = 'day' | 'week' | 'month';

interface WaterfallDisplayPoint extends WaterfallDailyPoint {
  date: string;
  aggregation: WaterfallAggregation;
  rangeStartKey: string;
  rangeEndKey: string;
}

/** Lundi ISO (UTC) pour regrouper les jours civils YYYY-MM-DD. */
function utcMondayKeyOfIsoDate(isoDateKey: string): string {
  const [y, m, d] = isoDateKey.split('-').map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d);
  const dow = new Date(utcMidnight).getUTCDay();
  const offsetDays = dow === 0 ? -6 : 1 - dow;
  const mondayMs = utcMidnight + offsetDays * 86400000;
  const mon = new Date(mondayMs);
  const yy = mon.getUTCFullYear();
  const mm = String(mon.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(mon.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function formatWaterfallDayLabel(
  dateKey: string,
  locale: string,
  timeZone: string,
  includeYear: boolean
): string {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' as const } : {}),
    timeZone,
  });
}

function formatWaterfallMonthAxisLabel(monthKey: string, locale: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale, {
    month: 'short',
    year: 'numeric',
  });
}

/** Fuseaux alignés sur le backend (market_holidays.MARKET_TIMEZONES) pour détecter le changement de jour calendaire. */
const MARKET_CLOCK_TIMEZONES: Array<[string, string]> = [
  ['XNYS', 'America/New_York'],
  ['XPAR', 'Europe/Paris'],
  ['XLON', 'Europe/London'],
  ['XTKS', 'Asia/Tokyo'],
];

const DashboardPage: React.FC<DashboardPageProps> = ({ currentUser }) => {
  const { preferences } = usePreferences();
  const pnlDisplayMode = parsePnlDisplayMode(preferences.pnl_display);
  const { theme } = useTheme();
  const { t, i18n } = useI18nTranslation();
  const privacySettings = usePrivacySettings('dashboard');
  /** Évite de reconstruire le PnL (somme des barres) via tooltips / datalabels / axe Y */
  const hideWeekdayChartMoneyValues =
    privacySettings.hideProfitLoss || privacySettings.hideCurrentBalance;
  const isDark = theme === 'dark';
  const [showImport, setShowImport] = useState(false);
  const { selectedAccountId: accountId, setSelectedAccountId: setAccountId, loading: accountLoading } = useTradingAccount();
  const { selectedPeriod, setSelectedPeriod, selectedPositionStrategy, setSelectedPositionStrategy } =
    usePersistedPeriodAndStrategyFilters(accountId);

  // Wrapper pour formatCurrency avec préférences
  const formatCurrency = (value: number, currencySymbol: string = ''): string => {
    return formatCurrencyUtil(value, currencySymbol, preferences.number_format, 2);
  };
  
  // Wrapper pour formatNumber avec préférences
  const formatNumber = (value: number, digits: number = 2): string => {
    return formatNumberUtil(value, digits, preferences.number_format);
  };
  const { strategies: positionStrategies, loading: loadingStrategies } = usePositionStrategiesForFilter();
  
  const windowWidth = useWindowWidth();
  const shouldLoadGlobalStats = windowWidth >= 1536; // 2xl breakpoint
  
  // Use consolidated dashboard data hook for optimized loading
  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError, refetch } = useDashboardData({
    accountId,
    startDate: selectedPeriod?.start,
    endDate: selectedPeriod?.end,
    loading: accountLoading,
    positionStrategy: selectedPositionStrategy,
    pnlDisplay: pnlDisplayMode,
  });

  // Données globales all-time (tous comptes) — KPI du bandeau sur grands écrans
  const { data: globalDashboardData, isLoading: globalDashboardLoading } = useDashboardData({
    accountId: null,
    startDate: undefined,
    endDate: undefined,
    loading: accountLoading,
    pnlDisplay: pnlDisplayMode,
  });

  // Extract data from consolidated response
  const trades = useMemo(() => dashboardData?.trades || [], [dashboardData]);
  const dailyAggregates = useMemo(() => dashboardData?.daily_aggregates || [], [dashboardData]);
  const strategies = useMemo(() => {
    const strategiesMap = new Map();
    if (dashboardData?.strategies) {
      dashboardData.strategies.forEach((strategy: any) => {
        strategiesMap.set(strategy.trade, strategy);
      });
    }
    return strategiesMap;
  }, [dashboardData]);
  const isLoading = dashboardLoading;
  const error = dashboardError;
  const [selectedAccount, setSelectedAccount] = useState<TradingAccount | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [globalStrategyStats, setGlobalStrategyStats] = useState<any>(null);
  const [globalStatsLoading, setGlobalStatsLoading] = useState(false);
  /** Devises des comptes actifs — pour ne pas afficher un symbole monétaire trompeur sur le PnL global */
  const [activeAccountCurrencyCodes, setActiveAccountCurrencyCodes] = useState<string[]>([]);
  
  // Use compliance stats from consolidated endpoint
  const complianceStats = useMemo(() => dashboardData?.compliance_stats || null, [dashboardData]);
  
  // Charger les statistiques globales seulement si l'écran est assez grand (lazy loading)
  const globalStatsLoadStateRef = useRef<'idle' | 'loading' | 'done' | 'failed'>('idle');

  useEffect(() => {
    if (!shouldLoadGlobalStats) {
      return;
    }
    if (
      globalStatsLoadStateRef.current === 'loading' ||
      globalStatsLoadStateRef.current === 'done' ||
      globalStatsLoadStateRef.current === 'failed'
    ) {
      return;
    }

    globalStatsLoadStateRef.current = 'loading';
    let cancelled = false;

    const loadGlobalStrategyStats = async () => {
      setGlobalStatsLoading(true);
      try {
        const now = new Date();
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        const stats = await tradeStrategiesService.statistics({
          start_date: twelveMonthsAgo.toISOString().split('T')[0],
          end_date: now.toISOString().split('T')[0],
        });

        if (cancelled) {
          return;
        }
        setGlobalStrategyStats(stats);
        globalStatsLoadStateRef.current = 'done';
      } catch (err) {
        if (cancelled) {
          return;
        }
        console.error('Erreur lors du chargement des statistiques globales de stratégie:', err);
        globalStatsLoadStateRef.current = 'failed';
      } finally {
        if (!cancelled) {
          setGlobalStatsLoading(false);
        }
      }
    };

    loadGlobalStrategyStats();

    return () => {
      cancelled = true;
    };
  }, [shouldLoadGlobalStats]);

  // Statistiques globales (tous comptes, toutes périodes confondues)
  const globalStats = useMemo(() => {
    if (globalDashboardLoading || !globalStrategyStats || !globalDashboardData) {
      return null;
    }

    const disciplineRate = globalStrategyStats.all_time?.respect_percentage || 0;

    const totalPnL =
      globalDashboardData.daily_aggregates?.reduce(
        (sum: number, day: any) => sum + (day.pnl || 0),
        0
      ) || 0;

    const periodData = globalStrategyStats.statistics?.period_data || [];
    const { disciplineSparkline, winRateSparkline } = buildGlobalStatsSparklines({
      disciplinePeriodData: periodData,
      dailyAggregates: globalDashboardData.daily_aggregates || [],
    });

    const recentAggregates = (globalDashboardData.daily_aggregates || [])
      .sort((a: any, b: any) => a.date.localeCompare(b.date))
      .slice(-30);

    let cumulativePnL = 0;
    const pnlSparkline = recentAggregates.map((day: any) => {
      cumulativePnL += day.pnl || 0;
      return cumulativePnL;
    });

    const totalWinning =
      globalDashboardData.daily_aggregates?.reduce(
        (sum: number, day: any) => sum + (day.winning_count || 0),
        0
      ) || 0;
    const totalLosing =
      globalDashboardData.daily_aggregates?.reduce(
        (sum: number, day: any) => sum + (day.losing_count || 0),
        0
      ) || 0;
    const totalTrades = totalWinning + totalLosing;
    const winRate = totalTrades > 0 ? (totalWinning / totalTrades) * 100 : 0;

    const totalPositions =
      globalDashboardData.daily_aggregates?.reduce(
        (sum: number, day: any) => sum + (day.trade_count || 0),
        0
      ) || 0;
    const globalActiveDays = globalDashboardData.active_days ?? 0;

    return {
      disciplineRate,
      totalPnL,
      disciplineSparkline,
      pnlSparkline,
      winRate,
      winRateSparkline,
      totalPositions,
      globalActiveDays,
    };
  }, [globalDashboardData, globalDashboardLoading, globalStrategyStats]);

  /** Cumul tous comptes / toute période — pour la carte Total trades */
  const { globalAllAccountsActivity } = useGlobalAllAccountsActivity({
    loading: accountLoading,
    pnlDisplay: pnlDisplayMode,
  });
  
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [dailyMetrics, setDailyMetrics] = useState<AccountDailyMetric[]>([]);
  const [marketHolidays, setMarketHolidays] = useState<MarketHoliday[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(true);
  const [marketTodayByCode, setMarketTodayByCode] = useState<Partial<Record<string, MarketTodaySnapshot>>>({});
  const lastMarketCalendarDatesRef = useRef<Record<string, string> | null>(null);

  // Récupérer la liste des devises
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

  // Devises distinctes des comptes actifs (PnL global = agrégat sans conversion)
  useEffect(() => {
    let cancelled = false;
    const loadActiveCurrencies = async () => {
      try {
        const list = await tradingAccountsService.list({ include_archived: false });
        if (cancelled) return;
        const active = list.filter((a) => a.status === 'active');
        const codes = Array.from(new Set(active.map((a) => a.currency).filter(Boolean))) as string[];
        setActiveAccountCurrencyCodes(codes);
      } catch {
        if (!cancelled) setActiveAccountCurrencyCodes([]);
      }
    };
    loadActiveCurrencies();
    return () => {
      cancelled = true;
    };
  }, []);

  const globalPnlCurrencyMode = activeAccountCurrencyCodes.length > 1 ? 'mixed' : 'single';

  // Récupérer le compte sélectionné pour obtenir sa devise
  useEffect(() => {
    const loadAccount = async () => {
      if (!accountId) {
        setSelectedAccount(null);
        return;
      }
      try {
        const account = await tradingAccountsService.get(accountId);
        setSelectedAccount(account);
      } catch (err: any) {
        // Si le compte n'existe pas (404) ou n'appartient pas à l'utilisateur, réinitialiser
        if (err?.status === 404) {
          console.warn('Le compte sélectionné n\'existe plus, réinitialisation...');
          setAccountId(null); // Réinitialiser le compte sélectionné dans le contexte
        } else {
          console.error('Erreur lors du chargement du compte', err);
        }
        setSelectedAccount(null);
      }
    };
    loadAccount();
  }, [accountId, setAccountId]);

  // Charger les transactions du compte
  useEffect(() => {
    const loadTransactions = async () => {
      const tz = preferences.timezone?.trim() || 'Europe/Paris';
      try {
        // Compte unique : filtrer par compte. « Tous les comptes » : toutes les transactions
        // utilisateur (aligné sur daily_aggregates du dashboard sans trading_account).
        const common = {
          start_date: selectedPeriod?.start,
          end_date: selectedPeriod?.end,
          timezone: tz,
          page: 1,
          page_size: 10000,
        };
        const data = accountId
          ? await accountTransactionsService.list({
              ...common,
              trading_account: accountId,
            })
          : await accountTransactionsService.list(common);
        setTransactions(data.results);
      } catch (err) {
        console.error('Erreur lors du chargement des transactions', err);
        setTransactions([]);
      }
    };
    loadTransactions();

    // Écouter les événements de mise à jour des transactions
    const handleTransactionUpdate = () => {
      loadTransactions();
    };
    window.addEventListener('account-transaction:updated', handleTransactionUpdate);
    return () => {
      window.removeEventListener('account-transaction:updated', handleTransactionUpdate);
    };
  }, [accountId, selectedPeriod?.start, selectedPeriod?.end, preferences.timezone]);

  const transactionsInSelectedPeriod = useMemo(() => {
    const tz = preferences.timezone;
    if (!selectedPeriod?.start || !selectedPeriod?.end) {
      return transactions;
    }

    return transactions.filter((transaction) => {
      const localDay = toIsoCalendarDateInTimezone(transaction.transaction_date, tz);
      if (!localDay) return false;
      return localDay >= selectedPeriod.start && localDay <= selectedPeriod.end;
    });
  }, [transactions, selectedPeriod, preferences.timezone]);

  // Compliance stats are now loaded from consolidated endpoint
  // Listen for compliance updates to refetch dashboard data
  useEffect(() => {
    const handleComplianceUpdate = (event: CustomEvent) => {
      const eventAccount = event.detail?.tradingAccount;
      if (!eventAccount || eventAccount === accountId) {
        refetch();
      }
    };

    window.addEventListener('strategy-compliance-updated', handleComplianceUpdate as EventListener);
    return () => {
      window.removeEventListener('strategy-compliance-updated', handleComplianceUpdate as EventListener);
    };
  }, [accountId, refetch]);

  // Obtenir le symbole de devise
  const currencySymbol = useMemo(() => {
    if (!selectedAccount || !currencies.length) return '';
    const currency = currencies.find(c => c.code === selectedAccount.currency);
    return currency?.symbol || '';
  }, [selectedAccount, currencies]);

  // Strategies are not needed for dashboard display - compliance stats come from consolidated endpoint
  // Removed strategy loading to eliminate hundreds of unnecessary API calls

  // Use trades from dashboard data for sequences calculation
  // allTradesForSequences is now the same as trades from useDashboardData
  const allTradesForSequences = useMemo(() => trades, [trades]);
  const allStrategiesForSequences = useMemo(() => strategies, [strategies]);

  // Charger les métriques quotidiennes (MLL)
  useEffect(() => {
    const loadDailyMetrics = async () => {
      if (!accountId || !selectedAccount || selectedAccount.mll_enabled === false) {
        setDailyMetrics([]);
        return;
      }
      
      try {
        const metrics = await tradingAccountsService.getDailyMetrics(accountId);
        setDailyMetrics(metrics);
      } catch (err) {
        console.error('Erreur lors du chargement des métriques quotidiennes', err);
        setDailyMetrics([]);
      }
    };

    loadDailyMetrics();
  }, [accountId, selectedAccount]);

  useEffect(() => {
    const loadMarketHolidaysBundle = async () => {
      setHolidaysLoading(true);
      try {
        // count = 1 prochain événement par marché (le suivant s'affiche une fois la date passée)
        const response = await marketCalendarService.getMarketHolidaysBundle(1, 'XNYS,XPAR,XLON,XTKS');
        const next: Partial<Record<string, MarketTodaySnapshot>> = {};
        for (const code of Object.keys(response.markets)) {
          const entry = response.markets[code];
          if (entry && typeof entry.is_full_day_holiday === 'boolean') {
            next[code] = {
              isFullDayHoliday: entry.is_full_day_holiday,
              isEarlyCloseDay: !!entry.is_early_close_day,
              sessionCloseLocal:
                entry.regular_session_close_local != null &&
                entry.regular_session_close_local !== ''
                  ? entry.regular_session_close_local
                  : null,
            };
          }
        }
        setMarketTodayByCode(next);
        // Comparer en YYYY-MM-DD (calendrier local) : new Date('2026-04-20') est en UTC et peut
        // reculer d’un jour en fuseaux américains, ce qui filtrait tous les événements à tort.
        const nowLocal = new Date();
        const todayStr = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`;
        const upcoming = response.upcoming ?? [];
        const filteredHolidays = upcoming.filter((holiday) => holiday.date >= todayStr);
        setMarketHolidays(filteredHolidays);
      } catch {
        // Silently fail - not critical
      } finally {
        setHolidaysLoading(false);
      }
    };

    const snapshotCalendarDates = (): Record<string, string> => {
      const now = new Date();
      const snap: Record<string, string> = {};
      for (const [code, tz] of MARKET_CLOCK_TIMEZONES) {
        snap[code] = new Intl.DateTimeFormat('en-CA', {
          timeZone: tz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(now);
      }
      return snap;
    };

    const checkCalendarRollAndMaybeReload = () => {
      const next = snapshotCalendarDates();
      const prev = lastMarketCalendarDatesRef.current;
      lastMarketCalendarDatesRef.current = next;
      if (prev && MARKET_CLOCK_TIMEZONES.some(([code]) => prev[code] !== next[code])) {
        void loadMarketHolidaysBundle();
      }
    };

    void loadMarketHolidaysBundle();
    checkCalendarRollAndMaybeReload();

    const intervalId = window.setInterval(checkCalendarRollAndMaybeReload, 60_000);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkCalendarRollAndMaybeReload();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const chartConfig = useMemo(
    () => resolveAccountChartConfig(selectedAccount, dashboardData?.balance_context),
    [selectedAccount, dashboardData?.balance_context],
  );

  // Calculer le solde du compte dans le temps avec format { date, pnl, cumulative, mll }
  // Ancré sur opening_balance (début de période) + PnL/transactions de la période
  const accountBalanceData = useMemo(() => {
    const tz = preferences.timezone;
    const { initialCapital, openingBalance, showMll, mllInitial } = chartConfig;
    const periodStart = selectedPeriod?.start;

    const metricDateKey = (m: AccountDailyMetric) =>
      typeof m.date === 'string'
        ? m.date.split('T')[0]
        : new Date(m.date).toISOString().split('T')[0];

    const historicalPeakFromMetrics = dailyMetrics.reduce((max, m) => {
      const d = metricDateKey(m);
      if (periodStart && d >= periodStart) return max;
      const high = parseFloat(String(m.account_balance_high ?? '0'));
      return Number.isFinite(high) ? Math.max(max, high) : max;
    }, openingBalance);

    const calculateMll = (_balance: number, date: string, maxBalanceSeen: number): number | undefined => {
      if (!showMll || mllInitial == null) return undefined;

      const dailyMetric = dailyMetrics.find((m) => metricDateKey(m) === date);
      if (dailyMetric?.maximum_loss_limit !== undefined) {
        return parseFloat(String(dailyMetric.maximum_loss_limit));
      }

      const baseForMll = Math.max(maxBalanceSeen, initialCapital);
      const calculatedMll = baseForMll - mllInitial;
      if (initialCapital > 0) {
        return Math.min(calculatedMll, initialCapital);
      }
      return calculatedMll;
    };

    const prependOpeningAnchor = <
      T extends { date: string; pnl: number; dailyNetTransactions: number; cumulative: number; mll?: number },
    >(result: T[]): T[] => {
      if (result.length === 0) return result;
      const firstDate = result[0].date;
      const dayBefore = new Date(`${firstDate}T12:00:00Z`);
      dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
      const dayBeforeStr = dayBefore.toISOString().split('T')[0];
      if (result.some((r) => r.date === dayBeforeStr)) return result;

      let initialMll: number | undefined;
      if (showMll && mllInitial != null) {
        const metricDayBefore = dailyMetrics.find((m) => metricDateKey(m) === dayBeforeStr);
        if (metricDayBefore?.maximum_loss_limit !== undefined) {
          initialMll = parseFloat(String(metricDayBefore.maximum_loss_limit));
        } else if (initialCapital > 0) {
          initialMll = initialCapital - mllInitial;
        }
      }

      return [
        {
          date: dayBeforeStr,
          pnl: 0,
          dailyNetTransactions: 0,
          cumulative: openingBalance,
          mll: initialMll,
        } as T,
        ...result,
      ];
    };

    // Grouper les transactions par date (triées chronologiquement)
    const transactionsByDate: { [date: string]: number } = {};
    // Trier les transactions par date pour garantir l'ordre chronologique
    const sortedTransactions = [...transactionsInSelectedPeriod].sort((a, b) => 
      new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
    );
    sortedTransactions.forEach(transaction => {
      const date = toIsoCalendarDateInTimezone(transaction.transaction_date, tz);
      if (!date) return;
      const amount = parseFloat(transaction.amount.toString());
      const signedAmount = transaction.transaction_type === 'deposit' ? amount : -amount;
      transactionsByDate[date] = (transactionsByDate[date] || 0) + signedAmount;
    });

    // Utiliser les données agrégées si disponibles (beaucoup plus rapide)
    if (dailyAggregates.length > 0) {
      const sortedDates = [...dailyAggregates].sort((a, b) => a.date.localeCompare(b.date));
      
      // Créer un ensemble de toutes les dates (trades + transactions)
      const allDates = new Set<string>();
      sortedDates.forEach(item => allDates.add(item.date));
      Object.keys(transactionsByDate).forEach(date => allDates.add(date));
      const sortedAllDates = Array.from(allDates).sort();

      let cumulativePnl = 0;
      let cumulativeTransactions = 0;
      let maxBalanceSeen = Math.max(openingBalance, initialCapital, historicalPeakFromMetrics);
      
      const result = sortedAllDates.map(date => {
        // Appliquer les transactions AVANT les trades du jour (logique : dépôts/retraits en début de journée)
        if (transactionsByDate[date]) {
          cumulativeTransactions += transactionsByDate[date];
        }

        // Ajouter le PnL du jour si disponible (après les transactions)
        const dailyAggregate = dailyAggregates.find(d => d.date === date);
        if (dailyAggregate) {
          cumulativePnl += dailyAggregate.pnl;
        }

        const dailyPnl = dailyAggregate?.pnl || 0;
        const dailyNetTransactions = transactionsByDate[date] || 0;
        const cumulative = openingBalance + cumulativePnl + cumulativeTransactions;
        
        // Mettre à jour le solde maximum vu
        maxBalanceSeen = Math.max(maxBalanceSeen, cumulative);
        
        // Calculer le MLL dynamiquement en fonction du solde maximum
        const mll = calculateMll(cumulative, date, maxBalanceSeen);

        return {
          date: date,
          pnl: dailyPnl,
          dailyNetTransactions,
          cumulative: cumulative,
          mll: mll,
        };
      });

      return prependOpeningAnchor(result);
    }
    
    // Fallback: utiliser les trades individuels si les agrégats ne sont pas disponibles
    const tradesWithDates = trades
      .map(trade => {
        const pv = getTradeDisplayPnlValue(trade, pnlDisplayMode);
        if (pv == null || !trade.entered_at) return null;
        return {
          date: trade.trade_day || toIsoCalendarDateInTimezone(trade.entered_at, tz),
          pnl: pv,
          enteredAt: new Date(trade.entered_at),
        };
      })
      .filter((row): row is { date: string; pnl: number; enteredAt: Date } => row !== null)
      .sort((a, b) => a.enteredAt.getTime() - b.enteredAt.getTime());

    // Grouper par date
    const dailyPnlData: { [date: string]: number } = {};
    tradesWithDates.forEach(trade => {
      dailyPnlData[trade.date] = (dailyPnlData[trade.date] || 0) + trade.pnl;
    });

    // Créer un ensemble de toutes les dates (trades + transactions)
    const allDates = new Set<string>();
    Object.keys(dailyPnlData).forEach(date => allDates.add(date));
    Object.keys(transactionsByDate).forEach(date => allDates.add(date));
    const sortedDates = Array.from(allDates).sort();

    let cumulativePnl = 0;
    let cumulativeTransactions = 0;
    let maxBalanceSeen = Math.max(openingBalance, initialCapital, historicalPeakFromMetrics);
    
    const result = sortedDates.map(date => {
      const dailyPnl = dailyPnlData[date] || 0;
      const dailyTransaction = transactionsByDate[date] || 0;
      
      // Appliquer les transactions AVANT les trades du jour (logique : dépôts/retraits en début de journée)
      if (dailyTransaction !== 0) {
        cumulativeTransactions += dailyTransaction;
      }
      
      // Ajouter le PnL du jour (après les transactions)
      cumulativePnl += dailyPnl;

      const cumulative = openingBalance + cumulativePnl + cumulativeTransactions;
      
      // Mettre à jour le solde maximum vu
      maxBalanceSeen = Math.max(maxBalanceSeen, cumulative);
      
      // Calculer le MLL dynamiquement en fonction du solde maximum
      const mll = calculateMll(cumulative, date, maxBalanceSeen);

      return {
        date: date, // Format YYYY-MM-DD pour les filtres
        pnl: dailyPnl,
        dailyNetTransactions: dailyTransaction,
        cumulative: cumulative,
        mll: mll,
      };
    });

    return prependOpeningAnchor(result);
  }, [dailyAggregates, trades, transactionsInSelectedPeriod, dailyMetrics, pnlDisplayMode, preferences.timezone, chartConfig, selectedPeriod?.start]);

  // Série affichée (agrégation auto) pour le graphique du solde uniquement.
  const balanceDisplay = useMemo(() => {
    const daily = accountBalanceData;
    if (daily.length === 0) {
      return { rows: [] as any[], mode: 'day' as BalanceAggregation };
    }

    const wrapDay = (row: any) => ({
      ...row,
      aggregation: 'day' as const,
      rangeStartKey: row.date,
      rangeEndKey: row.date,
    });

    if (daily.length <= BALANCE_DAILY_POINT_MAX) {
      return { rows: daily.map(wrapDay), mode: 'day' as BalanceAggregation };
    }

    if (daily.length <= BALANCE_WEEKLY_AGGREGATE_MAX_DAYS) {
      const buckets = new Map<string, any[]>();
      for (const row of daily) {
        const wk = utcMondayKeyOfIsoDate(row.date);
        if (!buckets.has(wk)) buckets.set(wk, []);
        buckets.get(wk)!.push(row);
      }
      const sortedWeeks = Array.from(buckets.keys()).sort();
      const rows = sortedWeeks.map((weekKey) => {
        const rowsIn = buckets.get(weekKey)!;
        const first = rowsIn[0];
        const last = rowsIn[rowsIn.length - 1];
        return {
          date: weekKey,
          pnl: rowsIn.reduce((s, r) => s + (r.pnl || 0), 0),
          dailyNetTransactions: rowsIn.reduce((s, r) => s + (r.dailyNetTransactions || 0), 0),
          cumulative: last.cumulative,
          mll: last.mll,
          aggregation: 'week' as const,
          rangeStartKey: first.date,
          rangeEndKey: last.date,
        };
      });
      return { rows, mode: 'week' as BalanceAggregation };
    }

    const monthBuckets = new Map<string, any[]>();
    for (const row of daily) {
      const mk = row.date.slice(0, 7);
      if (!monthBuckets.has(mk)) monthBuckets.set(mk, []);
      monthBuckets.get(mk)!.push(row);
    }
    const sortedMonths = Array.from(monthBuckets.keys()).sort();
    const rows = sortedMonths.map((monthKey) => {
      const rowsIn = monthBuckets.get(monthKey)!;
      const first = rowsIn[0];
      const last = rowsIn[rowsIn.length - 1];
      return {
        date: `${monthKey}-01`,
        pnl: rowsIn.reduce((s, r) => s + (r.pnl || 0), 0),
        dailyNetTransactions: rowsIn.reduce((s, r) => s + (r.dailyNetTransactions || 0), 0),
        cumulative: last.cumulative,
        mll: last.mll,
        aggregation: 'month' as const,
        rangeStartKey: first.date,
        rangeEndKey: last.date,
      };
    });
    return { rows, mode: 'month' as BalanceAggregation };
  }, [accountBalanceData]);

  // Calculer les statistiques de performance
  const performanceStats = useMemo(() => {
    if (accountBalanceData.length === 0) {
      return { totalReturn: 0, isPositive: false, maxDrawdown: 0, highestValue: 0, lowestValue: 0 };
    }
    // Calculer la perte/gain total : somme des PnL de la période filtrée
    // C'est plus fiable car cela représente exactement la variation pendant la période sélectionnée
    const totalReturn = accountBalanceData.reduce((sum, d) => sum + d.pnl, 0);
    const highestValue = Math.max(...accountBalanceData.map(d => d.cumulative));
    const lowestValue = Math.min(...accountBalanceData.map(d => d.cumulative));
    // Couleur alignée sur la performance de trading (somme des PnL), pas sur le solde cumulé incluant flux
    const isPositive = totalReturn >= 0;
    
    return { totalReturn, isPositive, highestValue, lowestValue };
  }, [accountBalanceData]);


  // Répartition par durée : même périmètre et même P/L affiché que le graphique Analytics
  const durationDistribution = useMemo(
    () => aggregateDurationDistribution(trades, pnlDisplayMode),
    [trades, pnlDisplayMode]
  );

  // Préparer les données pour le graphique de répartition par durée
  const durationDistributionBins = useMemo(() => {
    return durationDistribution.map(item => ({
      label: item.label,
      successful: item.winning,
      unsuccessful: item.losing,
    }));
  }, [durationDistribution]);

  // Préparer les données pour le graphique waterfall
  // Utiliser les données agrégées si disponibles
  const waterfallData = useMemo(() => {
    const tz = preferences.timezone;
    const transactionsByDate: { [date: string]: number } = {};
    transactionsInSelectedPeriod.forEach(transaction => {
      const date = toIsoCalendarDateInTimezone(transaction.transaction_date, tz);
      if (!date) return;
      const amount = parseFloat(String(transaction.amount));
      if (Number.isNaN(amount)) return;
      const signedAmount = transaction.transaction_type === 'deposit' ? amount : -amount;
      transactionsByDate[date] = (transactionsByDate[date] || 0) + signedAmount;
    });

    // Utiliser les données agrégées si disponibles (beaucoup plus rapide)
    if (dailyAggregates.length > 0) {
      const tradingPnlByDate: { [date: string]: number } = {};
      dailyAggregates.forEach(item => {
        tradingPnlByDate[item.date] = item.pnl;
      });

      const allDates = new Set<string>(Object.keys(tradingPnlByDate));
      Object.keys(transactionsByDate).forEach(date => allDates.add(date));
      const sortedDates = Array.from(allDates).sort();
      let cumulativeBalance = 0;
      
      return sortedDates.map(date => {
        const pnlTrading = tradingPnlByDate[date] || 0;
        const dailyNetTransactions = transactionsByDate[date] || 0;
        const dailyTotalVariation = pnlTrading + dailyNetTransactions;
        cumulativeBalance += dailyTotalVariation;

        return {
          dateKey: date,
          pnlTrading,
          dailyNetTransactions,
          dailyTotalVariation,
          cumulative: cumulativeBalance,
          is_positive: dailyTotalVariation >= 0,
          hasTradingData: Object.prototype.hasOwnProperty.call(tradingPnlByDate, date),
        };
      });
    }
    
    // Fallback: utiliser les trades individuels
    const tradesWithDatesWaterfall = trades
      .map(trade => {
        const pv = getTradeDisplayPnlValue(trade, pnlDisplayMode);
        if (pv == null || !trade.entered_at) return null;
        return {
          date: trade.trade_day || toIsoCalendarDateInTimezone(trade.entered_at, tz),
          pnl: pv,
          enteredAt: new Date(trade.entered_at),
        };
      })
      .filter((row): row is { date: string; pnl: number; enteredAt: Date } => row !== null)
      .sort((a, b) => a.enteredAt.getTime() - b.enteredAt.getTime());

    // Grouper par date
    const dailyData: { [date: string]: number } = {};
    tradesWithDatesWaterfall.forEach(trade => {
      dailyData[trade.date] = (dailyData[trade.date] || 0) + trade.pnl;
    });

    const allDates = new Set<string>(Object.keys(dailyData));
    Object.keys(transactionsByDate).forEach(date => allDates.add(date));
    const sortedDates = Array.from(allDates).sort();
    let cumulativeBalance = 0;
    
    return sortedDates.map(date => {
      const pnlTrading = dailyData[date] || 0;
      const dailyNetTransactions = transactionsByDate[date] || 0;
      const dailyTotalVariation = pnlTrading + dailyNetTransactions;
      cumulativeBalance += dailyTotalVariation;

      return {
        dateKey: date,
        pnlTrading,
        dailyNetTransactions,
        dailyTotalVariation,
        cumulative: cumulativeBalance,
        is_positive: dailyTotalVariation >= 0,
        hasTradingData: Object.prototype.hasOwnProperty.call(dailyData, date),
      };
    });
  }, [dailyAggregates, trades, transactionsInSelectedPeriod, pnlDisplayMode, preferences.timezone]);

  // Série affichée (agrégation auto) pour le graphique uniquement — waterfallStats reste sur waterfallData journalier.
  const waterfallDisplay = useMemo(() => {
    const daily = waterfallData;
    if (daily.length === 0) {
      return { rows: [] as WaterfallDisplayPoint[], mode: 'day' as WaterfallAggregation };
    }

    const locale = i18n.resolvedLanguage || i18n.language || 'en';
    const tz = preferences.timezone;
    const firstKey = daily[0].dateKey;
    const lastKey = daily[daily.length - 1].dateKey;
    const spanMultipleYears = firstKey.slice(0, 4) !== lastKey.slice(0, 4);
    const includeYearOnDayLabels = spanMultipleYears || daily.length > 365;

    const wrapDay = (row: WaterfallDailyPoint): WaterfallDisplayPoint => ({
      ...row,
      date: formatWaterfallDayLabel(row.dateKey, locale, tz, includeYearOnDayLabels),
      aggregation: 'day',
      rangeStartKey: row.dateKey,
      rangeEndKey: row.dateKey,
    });

    if (daily.length <= WATERFALL_DAILY_BAR_MAX) {
      return { rows: daily.map(wrapDay), mode: 'day' as WaterfallAggregation };
    }

    if (daily.length <= WATERFALL_WEEKLY_AGGREGATE_MAX_DAYS) {
      const buckets = new Map<string, WaterfallDailyPoint[]>();
      for (const row of daily) {
        const wk = utcMondayKeyOfIsoDate(row.dateKey);
        if (!buckets.has(wk)) buckets.set(wk, []);
        buckets.get(wk)!.push(row);
      }
      const sortedWeeks = Array.from(buckets.keys()).sort();
      const rows: WaterfallDisplayPoint[] = sortedWeeks.map((weekKey) => {
        const rowsIn = buckets.get(weekKey)!;
        const first = rowsIn[0];
        const last = rowsIn[rowsIn.length - 1];
        const pnlTrading = rowsIn.reduce((s, r) => s + (r.pnlTrading || 0), 0);
        const dailyTotalVariation = rowsIn.reduce((s, r) => s + (r.dailyTotalVariation || 0), 0);
        // Flux net période = variation totale − PnL trading (dépôts/retraits), cohérent avec la barre agrégée
        const dailyNetTransactions = dailyTotalVariation - pnlTrading;
        return {
          dateKey: weekKey,
          date: t('dashboard:waterfallWeekAxis', {
            start: formatWaterfallDayLabel(first.dateKey, locale, tz, true),
            end: formatWaterfallDayLabel(last.dateKey, locale, tz, true),
          }),
          pnlTrading,
          dailyNetTransactions,
          dailyTotalVariation,
          cumulative: last.cumulative,
          is_positive: dailyTotalVariation >= 0,
          hasTradingData: rowsIn.some((r) => r.hasTradingData),
          aggregation: 'week',
          rangeStartKey: first.dateKey,
          rangeEndKey: last.dateKey,
        };
      });
      return { rows, mode: 'week' as WaterfallAggregation };
    }

    const monthBuckets = new Map<string, WaterfallDailyPoint[]>();
    for (const row of daily) {
      const mk = row.dateKey.slice(0, 7);
      if (!monthBuckets.has(mk)) monthBuckets.set(mk, []);
      monthBuckets.get(mk)!.push(row);
    }
    const sortedMonths = Array.from(monthBuckets.keys()).sort();
    const rows: WaterfallDisplayPoint[] = sortedMonths.map((monthKey) => {
      const rowsIn = monthBuckets.get(monthKey)!;
      const first = rowsIn[0];
      const last = rowsIn[rowsIn.length - 1];
      const pnlTrading = rowsIn.reduce((s, r) => s + (r.pnlTrading || 0), 0);
      const dailyTotalVariation = rowsIn.reduce((s, r) => s + (r.dailyTotalVariation || 0), 0);
      const dailyNetTransactions = dailyTotalVariation - pnlTrading;
      return {
        dateKey: `${monthKey}-01`,
        date: formatWaterfallMonthAxisLabel(monthKey, locale),
        pnlTrading,
        dailyNetTransactions,
        dailyTotalVariation,
        cumulative: last.cumulative,
        is_positive: dailyTotalVariation >= 0,
        hasTradingData: rowsIn.some((r) => r.hasTradingData),
        aggregation: 'month',
        rangeStartKey: first.dateKey,
        rangeEndKey: last.dateKey,
      };
    });
    return { rows, mode: 'month' as WaterfallAggregation };
  }, [waterfallData, preferences.timezone, i18n.resolvedLanguage, i18n.language, t]);

  // Préparer les données pour le graphique waterfall avec barres flottantes
  const waterfallChartData = useMemo(() => {
    const displayRows = waterfallDisplay.rows;
    if (displayRows.length === 0) return null;

    const labels = displayRows.map((d) => d.date);
    
    // Pour un graphique waterfall, nous créons des barres flottantes
    // Chaque barre va de la valeur précédente à la valeur actuelle
    const waterfallBarData = displayRows.map((d, index) => {
      const previousCumulative = index === 0 ? 0 : displayRows[index - 1].cumulative;
      const currentCumulative = d.cumulative;
      const netCashFlow = d.dailyTotalVariation - d.pnlTrading;
      const hasNetFlow = Math.abs(netCashFlow) > 1e-9;
      
      return {
        start: previousCumulative,
        end: currentCumulative,
        value: d.dailyTotalVariation,
        pnlTrading: d.pnlTrading,
        dailyNetTransactions: netCashFlow,
        hasNetFlow,
        isNetFlowPositive: netCashFlow > 0,
        isPositive: d.dailyTotalVariation >= 0,
        cumulative: currentCumulative,
        aggregation: d.aggregation,
        rangeStartKey: d.rangeStartKey,
        rangeEndKey: d.rangeEndKey,
      };
    });

    // Transformer les données en format [min, max] pour les barres flottantes
    const floatingBars = waterfallBarData.map(d => [d.start, d.end]);

    return {
      labels,
      datasets: [
        {
          label: t('dashboard:capitalEvolution'),
          data: floatingBars,
          maxBarThickness: 56,
          // Dégradé le long de la barre : portion flux net (dépôt/retrait) vs portion PnL trading (jour / semaine / mois).
          backgroundColor: (ctx: any) => {
            const row = waterfallBarData[ctx.dataIndex];
            if (!row) return 'rgba(156, 163, 175, 0.5)';
            return getWaterfallBarFill(
              { chart: ctx.chart, dataIndex: ctx.dataIndex, datasetIndex: ctx.datasetIndex },
              {
                start: row.start,
                end: row.end,
                pnlTrading: row.pnlTrading,
                dailyNetTransactions: row.dailyNetTransactions,
              }
            );
          },
          borderColor: (ctx: any) => {
            const row = waterfallBarData[ctx.dataIndex];
            if (!row) return 'rgba(107, 114, 128, 0.8)';
            return getWaterfallBarBorder(
              { chart: ctx.chart, dataIndex: ctx.dataIndex, datasetIndex: ctx.datasetIndex },
              {
                start: row.start,
                end: row.end,
                pnlTrading: row.pnlTrading,
                dailyNetTransactions: row.dailyNetTransactions,
              }
            );
          },
          borderWidth: 0,
          borderRadius: 0,
          borderSkipped: false,
          barPercentage: 0.7,
          categoryPercentage: 0.8,
          _waterfallData: waterfallBarData
        }
      ]
    };
  }, [waterfallDisplay.rows, t]);

  // Statistiques pour le waterfall
  const waterfallStats = useMemo(() => {
    if (waterfallData.length === 0) return null;

    const tradingDays = waterfallData.filter(d => d.hasTradingData);
    if (tradingDays.length === 0) {
      return {
        totalPnl: 0,
        bestDay: 0,
        worstDay: 0,
        positiveDays: 0,
        negativeDays: 0,
        winRate: 0,
        tradingDaysCount: 0,
      };
    }

    const totalPnl = tradingDays.reduce((sum, d) => sum + d.pnlTrading, 0);
    const bestDay = Math.max(...tradingDays.map(d => d.pnlTrading));
    const worstDay = Math.min(...tradingDays.map(d => d.pnlTrading));
    const positiveDays = tradingDays.filter(d => d.pnlTrading > 0).length;
    const negativeDays = tradingDays.filter(d => d.pnlTrading < 0).length;
    const winRate = tradingDays.length > 0 ? (positiveDays / tradingDays.length) * 100 : 0;

    return {
      totalPnl,
      bestDay,
      worstDay,
      positiveDays,
      negativeDays,
      winRate,
      tradingDaysCount: tradingDays.length,
    };
  }, [waterfallData]);

  const weekdayPerformanceData = useWeekdayPerformance(trades, t, pnlDisplayMode);

  // Calculer les métriques de trading pour les jauges circulaires
  const tradingMetrics = useMemo(() => {
    if (trades.length === 0) return null;

    const winningTrades = trades.filter((t) => getTradePnlOutcome(t, pnlDisplayMode) === 'win');
    const losingTrades = trades.filter((t) => getTradePnlOutcome(t, pnlDisplayMode) === 'loss');

    const totalTrades = trades.filter((t) => getTradePnlOutcome(t, pnlDisplayMode) != null).length;
    const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;
    
    const avgWinningTrade = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + (getTradeDisplayPnlValue(t, pnlDisplayMode) ?? 0), 0) / winningTrades.length
      : 0;
    
    const avgLosingTrade = losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => sum + (getTradeDisplayPnlValue(t, pnlDisplayMode) ?? 0), 0) / losingTrades.length
      : 0;

    const winRateRing = resolveWinRateRingSecondary(
      trades,
      pnlDisplayMode,
      selectedPeriod?.preset,
    );

    return {
      winRate,
      avgWinningTrade,
      avgLosingTrade,
      winRateRingSecondary: winRateRing.value,
      winRateRingSecondaryMode: winRateRing.mode,
    };
  }, [trades, pnlDisplayMode, selectedPeriod?.preset]);

  // Calculer les max pour les jauges (basé sur les données réelles avec marge)
  const gaugeMaxValues = useMemo(() => {
    if (!tradingMetrics) return { winRate: 100, avgWinning: 1200, avgLosing: 850 };
    
    return {
      winRate: 100,
      avgWinning: Math.max(tradingMetrics.avgWinningTrade * 1.5, 500),
      avgLosing: Math.max(Math.abs(tradingMetrics.avgLosingTrade) * 1.5, 500),
    };
  }, [tradingMetrics]);

  // Calculer les objectifs pour chaque jauge
  const gaugeObjectives = useMemo(() => {
    if (!tradingMetrics || !gaugeMaxValues) return null;
    
    // Objectif pour avgLosing : réduire la perte moyenne de 20%
    // Plus intuitif : on veut une perte moyenne plus faible (en valeur absolue)
    const currentAvgLoss = Math.abs(tradingMetrics.avgLosingTrade);
    const reductionPercentage = 0.20; // 20% de réduction
    const avgLosingObjective = currentAvgLoss > 0 
      ? currentAvgLoss * (1 - reductionPercentage)
      : gaugeMaxValues.avgLosing * 0.7; // Fallback si pas de perte
    
    // Objectif pour avgWinning : augmenter le gain moyen de 20%
    const currentAvgWin = tradingMetrics.avgWinningTrade;
    const improvementPercentage = 0.20; // 20% d'amélioration
    const avgWinningObjective = currentAvgWin > 0
      ? currentAvgWin * (1 + improvementPercentage)
      : gaugeMaxValues.avgWinning * 0.9; // Fallback si pas de gain
    
    return {
      winRate: Math.max(60, Math.ceil(tradingMetrics.winRate / 10) * 10),
      avgWinning: avgWinningObjective,
      avgLosing: avgLosingObjective,
    };
  }, [tradingMetrics, gaugeMaxValues]);

  // Calculer les labels de performance pour chaque jauge
  const performanceLabels = useMemo(() => {
    if (!tradingMetrics || !gaugeObjectives) return null;
    
    return {
      winRate: getPerformanceLabel(tradingMetrics.winRate, gaugeObjectives.winRate, 'winRate', t),
      avgWinning: getPerformanceLabel(tradingMetrics.avgWinningTrade, gaugeObjectives.avgWinning, 'avgWinning', t),
      avgLosing: getPerformanceLabel(Math.abs(tradingMetrics.avgLosingTrade), gaugeObjectives.avgLosing, 'avgLosing', t),
    };
  }, [tradingMetrics, gaugeObjectives, t]);

  // Calculer les statistiques supplémentaires pour les cartes
  const additionalStats = useMemo(() => {
    // Utiliser les trades complets (sans filtres date) pour les séquences
    // Si allTradesForSequences est vide, utiliser les trades filtrés (fallback)
    const tradesForSequences = allTradesForSequences.length > 0 ? allTradesForSequences : trades;
    // Utiliser allStrategiesForSequences seulement si on a des trades complets
    const strategiesForSequences = (allTradesForSequences.length > 0 && allStrategiesForSequences.size > 0) 
      ? allStrategiesForSequences 
      : strategies;
    
    // Vérifier qu'on a au moins des trades pour calculer les statistiques
    if (trades.length === 0 && tradesForSequences.length === 0) return null;

    const totalTrades = trades.filter(t => t.is_profitable !== null).length;
    const winningTrades = trades.filter(t => t.is_profitable === true && getTradeDisplayPnlValue(t, pnlDisplayMode) != null);
    const losingTrades = trades.filter(t => t.is_profitable === false && getTradeDisplayPnlValue(t, pnlDisplayMode) != null);
    
    const totalPnl = trades.reduce((sum, t) => sum + (getTradeDisplayPnlValue(t, pnlDisplayMode) ?? 0), 0);
    const totalWinnings = winningTrades.reduce((sum, t) => sum + (getTradeDisplayPnlValue(t, pnlDisplayMode) ?? 0), 0);
    const totalLosses = losingTrades.reduce((sum, t) => sum + (getTradeDisplayPnlValue(t, pnlDisplayMode) ?? 0), 0);
    
    const profitFactor = totalLosses !== 0 ? Math.abs(totalWinnings / Math.abs(totalLosses)) : 0;
    
    // Calculer les frais totaux (fees + commissions)
    const totalFees = trades.reduce((sum, t) => {
      const fees = t.fees ? parseFloat(t.fees) : 0;
      const commissions = t.commissions ? parseFloat(t.commissions) : 0;
      return sum + fees + commissions;
    }, 0);

    // Calculer les séquences consécutives avec/sans respect de la stratégie
    // Utiliser tradesForSequences et strategiesForSequences (sans filtres date si disponibles)
    // pour calculer les séquences globales du compte
    // 1. Séquences de trades consécutifs
    let maxConsecutiveTradesRespected = 0;
    let maxConsecutiveTradesNotRespected = 0;
    let currentConsecutiveTradesRespected = 0;
    let currentConsecutiveTradesNotRespected = 0;

    // 2. Séquences de jours consécutifs
    let maxConsecutiveDaysRespected = 0;
    let maxConsecutiveDaysNotRespected = 0;
    let currentConsecutiveDaysRespected = 0;
    let currentConsecutiveDaysNotRespected = 0;
    
    const sortedTradesForSequences = [...tradesForSequences].sort((a, b) => {
      const dateA = a.entered_at ? new Date(a.entered_at).getTime() : 0;
      const dateB = b.entered_at ? new Date(b.entered_at).getTime() : 0;
      return dateA - dateB;
    });

    // Calculer les séquences de trades consécutifs
    sortedTradesForSequences.forEach(trade => {
      const strategy = strategiesForSequences.get(trade.id);
      const isRespected = strategy?.strategy_respected;

      if (isRespected === true) {
        currentConsecutiveTradesRespected++;
        currentConsecutiveTradesNotRespected = 0;
        maxConsecutiveTradesRespected = Math.max(maxConsecutiveTradesRespected, currentConsecutiveTradesRespected);
      } else if (isRespected === false) {
        currentConsecutiveTradesNotRespected++;
        currentConsecutiveTradesRespected = 0;
        maxConsecutiveTradesNotRespected = Math.max(maxConsecutiveTradesNotRespected, currentConsecutiveTradesNotRespected);
      } else {
        // Si strategy_respected est null ou undefined (pas de stratégie), réinitialiser les compteurs
        // pour ne compter que les séquences de trades avec stratégie définie
        currentConsecutiveTradesRespected = 0;
        currentConsecutiveTradesNotRespected = 0;
      }
    });

    // Calculer les séquences de jours consécutifs
    // Grouper les trades par jour
    const tradesByDay = new Map<string, typeof sortedTradesForSequences>();
    sortedTradesForSequences.forEach(trade => {
      if (trade.trade_day || trade.entered_at) {
        const dateStr = trade.trade_day || trade.entered_at;
        if (dateStr) {
          const date = new Date(dateStr);
          const dayKey = date.toISOString().split('T')[0]; // Format YYYY-MM-DD
          if (!tradesByDay.has(dayKey)) {
            tradesByDay.set(dayKey, []);
          }
          tradesByDay.get(dayKey)!.push(trade);
        }
      }
    });

    // Trier les jours par date (seulement les jours avec trades)
    // La consécutivité est basée sur les jours avec trades, pas sur les jours calendaires
    // Deux jours avec trades sont consécutifs s'il n'y a pas d'autre jour avec trades entre eux
    // Puisque la liste est triée et ne contient que les jours avec trades,
    // chaque jour dans cette liste est automatiquement consécutif au précédent
    const sortedDays = Array.from(tradesByDay.keys()).sort();
    
    // Parcourir les jours avec trades dans l'ordre chronologique
    sortedDays.forEach((dayKey) => {
      const dayTrades = tradesByDay.get(dayKey)!;
      
      // Vérifier si tous les trades du jour ont une stratégie
      const tradesWithStrategy = dayTrades.filter(trade => {
        const strategy = strategiesForSequences.get(trade.id);
        return strategy?.strategy_respected !== null && strategy?.strategy_respected !== undefined;
      });

      // Si aucun trade du jour n'a de stratégie, réinitialiser les compteurs
      if (tradesWithStrategy.length === 0) {
        currentConsecutiveDaysRespected = 0;
        currentConsecutiveDaysNotRespected = 0;
        return;
      }

      // Vérifier si tous les trades du jour respectent la stratégie
      const allRespected = tradesWithStrategy.every(trade => {
        const strategy = strategiesForSequences.get(trade.id);
        return strategy?.strategy_respected === true;
      });

      // Vérifier s'il y a au moins un trade qui ne respecte pas la stratégie
      const hasNotRespected = tradesWithStrategy.some(trade => {
        const strategy = strategiesForSequences.get(trade.id);
        return strategy?.strategy_respected === false;
      });

      // Si tous les trades du jour respectent la stratégie, incrémenter le compteur de jours consécutifs
      if (allRespected && tradesWithStrategy.length === dayTrades.length) {
        // Tous les trades du jour ont une stratégie et tous respectent
        currentConsecutiveDaysRespected++;
        currentConsecutiveDaysNotRespected = 0;
        maxConsecutiveDaysRespected = Math.max(maxConsecutiveDaysRespected, currentConsecutiveDaysRespected);
      } else if (hasNotRespected && tradesWithStrategy.length === dayTrades.length) {
        // Au moins un trade ne respecte pas la stratégie (inclut partiel et 100% non respecté)
        // Un jour avec respect partiel = jour de non-respect
        currentConsecutiveDaysNotRespected++;
        currentConsecutiveDaysRespected = 0;
        maxConsecutiveDaysNotRespected = Math.max(maxConsecutiveDaysNotRespected, currentConsecutiveDaysNotRespected);
      } else {
        // Certains trades sans stratégie renseignée
        currentConsecutiveDaysRespected = 0;
        currentConsecutiveDaysNotRespected = 0;
      }
    });

    // Calculer la série en cours de jours consécutifs avec P/L positif
    // Cette série compte depuis le jour le plus récent jusqu'à trouver une perte
    let currentWinningStreakDays = 0;
    let maxWinningStreakDays = 0;
    let tempWinningStreak = 0;
    
    if (sortedDays.length > 0) {
      // Trier les jours par date (du plus récent au plus ancien)
      const sortedDaysReverse = [...sortedDays].sort().reverse();
      
      // Compter les jours consécutifs avec P/L positif depuis le plus récent
      for (const dayKey of sortedDaysReverse) {
        const dayTrades = tradesByDay.get(dayKey)!;
        const dayPnl = dayTrades.reduce((sum, t) => sum + (getTradeDisplayPnlValue(t, pnlDisplayMode) ?? 0), 0);
        
        if (dayPnl > 0) {
          currentWinningStreakDays++;
        } else {
          // Dès qu'on trouve une perte ou un break-even, on s'arrête
          break;
        }
      }
      
      // Calculer le record maximum de jours consécutifs avec P/L positif
      for (const dayKey of sortedDays) {
        const dayTrades = tradesByDay.get(dayKey)!;
        const dayPnl = dayTrades.reduce((sum, t) => sum + (getTradeDisplayPnlValue(t, pnlDisplayMode) ?? 0), 0);
        
        if (dayPnl > 0) {
          tempWinningStreak++;
          maxWinningStreakDays = Math.max(maxWinningStreakDays, tempWinningStreak);
        } else {
          tempWinningStreak = 0;
        }
      }
    }
    
    return {
      totalTrades,
      totalPnl,
      profitFactor,
      totalFees,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      maxConsecutiveTradesRespected,
      maxConsecutiveTradesNotRespected,
      maxConsecutiveDaysRespected,
      maxConsecutiveDaysNotRespected,
      currentConsecutiveTradesRespected,
      currentConsecutiveTradesNotRespected,
      currentConsecutiveDaysRespected,
      currentConsecutiveDaysNotRespected,
      currentWinningStreakDays,
      maxWinningStreakDays,
    };
  }, [trades, strategies, allTradesForSequences, allStrategiesForSequences, pnlDisplayMode]);

  /** Meilleure série (respect stratégie) : API consolidée si présente, sinon fallback client (échantillon trades). */
  const disciplineBestStreakDays = useMemo(() => {
    if (complianceStats != null) {
      return complianceStats.best_streak ?? 0;
    }
    return additionalStats?.maxConsecutiveDaysRespected ?? 0;
  }, [complianceStats, additionalStats?.maxConsecutiveDaysRespected]);

  // Utiliser le hook pour calculer les indicateurs de compte de manière cohérente
  const {
    balanceLoading,
    balanceError,
    peakLoading,
    ...accountIndicators
  } = useAccountIndicators({
    selectedAccount,
    filteredTrades: trades,
    filteredBalanceData: accountBalanceData,
    activeDays: dashboardData?.active_days,
    pnlDisplay: pnlDisplayMode,
    timezone: preferences.timezone,
  });


  const chartColors = useMemo(() => getChartColors(isDark), [isDark]);
  const dashboardChartAxis = useMemo(() => getDashboardChartAxisColors(isDark), [isDark]);


  return (
    <PageShell>
      <div className="mb-4 min-w-0">
        <MarketQuotesTicker />
      </div>

      {/* Market Info - Toujours visible */}
      <div className="mb-4 min-w-0">
        <ModernMarketInfo
          marketHolidays={marketHolidays}
          holidaysLoading={holidaysLoading}
          marketTodayByCode={marketTodayByCode}
        />
      </div>

      <DashboardFilterBar
        className="mb-6"
        accountId={accountId}
        onAccountChange={setAccountId}
        hideAccountNumber={privacySettings.hideAccountNumber}
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
        selectedPositionStrategy={selectedPositionStrategy}
        onPositionStrategyChange={setSelectedPositionStrategy}
        positionStrategies={positionStrategies}
        loadingStrategies={loadingStrategies}
        globalStatsLoading={globalStatsLoading}
        globalDashboardLoading={globalDashboardLoading}
        globalStats={globalStats}
        currencySymbol={currencySymbol}
        globalPnlCurrencyMode={globalPnlCurrencyMode}
        hideCurrentBalance={privacySettings.hideCurrentBalance}
        numberFormat={preferences.number_format}
      />

      {/* Soldes du compte */}
      {selectedAccount && (
        <AccountSummaryCard
          theme="default"
          className="mb-6"
          indicators={accountIndicators}
          currencySymbol={currencySymbol}
          globalAllAccountsActivity={globalAllAccountsActivity}
          onNavigateToTransactions={() => {
            window.location.hash = 'transactions';
          }}
          hideInitialBalance={privacySettings.hideInitialBalance}
          hideCurrentBalance={privacySettings.hideCurrentBalance}
          hideProfitLoss={privacySettings.hideProfitLoss}
          hideConsistencyTarget={privacySettings.hideConsistencyTarget}
          balanceLoading={balanceLoading}
          peakLoading={peakLoading}
          detailsLoading={dashboardLoading}
          error={balanceError || dashboardError}
        />
      )}

      <PeriodPerformanceKpis
        className="mb-6"
        data={dashboardData?.period_performance}
        currencySymbol={currencySymbol}
        pnlCurrencyMode={accountId ? 'single' : globalPnlCurrencyMode}
        hideMoney={hideWeekdayChartMoneyValues}
        loading={dashboardLoading && !dashboardData}
        singleAccountSelected={accountId != null}
      />

      {/* Message d'erreur */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Graphiques */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-gray-200 border-t-sky-500 dark:border-gray-700 dark:border-t-sky-400" />
            <p className="text-gray-500 dark:text-gray-400">{t('dashboard:loading')}</p>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-6">
          {/* Bloc Trader Performance + stat cards (pleine largeur) */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
          {/* Graphique 1: Métriques de trading (jauges circulaires) */}
          {tradingMetrics && (
            <DashboardPanel padding="large" className="flex h-full flex-col">
              <div className="mb-6 text-center">
                <h2 className={`mb-2 text-lg font-bold ${DASHBOARD_PANEL_TITLE_CLASS}`}>{t('dashboard:traderPerformanceTracker')}</h2>
                <div className="mx-auto h-1 w-20 rounded-full bg-gradient-to-r from-emerald-400/80 to-blue-400/80" />
                <p className={`mt-2 text-sm ${DASHBOARD_PANEL_HINT_CLASS}`}>{t('dashboard:objectivesBasedOnHistory')}</p>
              </div>
              
              <div className="grid flex-1 grid-cols-3 gap-2 sm:gap-4">
                {/* Jauge Win Rate */}
                <div className={`${DASHBOARD_GAUGE_TILE_CLASS} cursor-pointer hover:scale-105`}>
                  <h3 className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 sm:mb-4">
                    {t('dashboard:winRate')}
                  </h3>
                  <Tooltip
                    disabled={
                      tradingMetrics.winRateRingSecondary == null ||
                      (tradingMetrics.winRateRingSecondaryMode === 'peak' &&
                        tradingMetrics.winRateRingSecondary <=
                          tradingMetrics.winRate + 1e-9)
                    }
                    content={
                      tradingMetrics.winRateRingSecondaryMode === 'recent'
                        ? t('dashboard:winRateRecentWindowTooltip', {
                            count: WIN_RATE_ROLLING_WINDOW,
                            defaultValue:
                              'Main figure: win rate over the full selected period.\nOrange figure: win rate on your last {{count}} trades within this period only.',
                          })
                        : t('dashboard:winRatePeriodPeakTooltip', {
                            count: WIN_RATE_ROLLING_WINDOW,
                            defaultValue:
                              'Best win rate on a rolling window of {{count}} consecutive trades during the period. The orange ring shows how far above your current period rate that peak was.',
                          })
                    }
                    contentClassName={
                      tradingMetrics.winRateRingSecondaryMode === 'recent'
                        ? 'whitespace-pre-line max-w-[16rem]'
                        : ''
                    }
                    position="bottom"
                    triggerDisplay="block"
                    className="mx-auto mb-1 block max-w-full w-[72px] sm:mb-2 sm:w-[110px] md:w-[90px] lg:w-[110px] xl:w-[130px]"
                  >
                    {(() => {
                      const C = 2 * Math.PI * 66;
                      const secondaryVal = tradingMetrics.winRateRingSecondary;
                      const isRecentRing =
                        tradingMetrics.winRateRingSecondaryMode === 'recent';
                      const currentVal = tradingMetrics.winRate;
                      const p =
                        secondaryVal != null ? Math.min(secondaryVal / 100, 1) : 0;
                      const showPeakExtras =
                        !isRecentRing &&
                        secondaryVal != null &&
                        secondaryVal > currentVal + 1e-9;
                      const showRecentExtras =
                        isRecentRing && secondaryVal != null;
                      const showRingExtras = showPeakExtras || showRecentExtras;
                      return (
                        <div
                          className={clsx(
                            'relative flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700/50 sm:h-[110px] sm:w-[110px] md:h-[90px] md:w-[90px] lg:h-[110px] lg:w-[110px] xl:h-[130px] xl:w-[130px]',
                            showRingExtras && 'cursor-help'
                          )}
                        >
                          <svg
                            className="absolute inset-0 h-full w-full -rotate-90"
                            viewBox="0 0 140 140"
                            preserveAspectRatio="xMidYMid meet"
                          >
                            <circle
                              cx="70"
                              cy="70"
                              r="66"
                              stroke="#d1d5db"
                              strokeWidth="8"
                              fill="none"
                              className="opacity-40"
                            />
                            {showRingExtras ? (
                              <circle
                                cx="70"
                                cy="70"
                                r="66"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="none"
                                strokeDasharray={C}
                                strokeDashoffset={C * (1 - p)}
                                strokeLinecap="round"
                                className="text-amber-500 transition-all duration-1000 ease-out dark:text-amber-400"
                              />
                            ) : null}
                            <circle
                              cx="70"
                              cy="70"
                              r="66"
                              stroke={performanceLabels?.winRate.color || '#10b981'}
                              strokeWidth="8"
                              fill="none"
                              strokeDasharray={C}
                              strokeDashoffset={C * (1 - Math.min(tradingMetrics.winRate / 100, 1))}
                              strokeLinecap="round"
                              className="transition-all duration-1000 ease-out"
                            />
                          </svg>
                          <div className="relative z-10 flex flex-col items-center justify-center px-0.5">
                            <div className="text-sm font-bold text-gray-900 dark:text-gray-100 sm:text-xl xl:text-2xl">
                              {formatNumber(tradingMetrics.winRate, 2)}%
                            </div>
                            {showRingExtras ? (
                              <div className="mt-0.5 text-[10px] font-semibold leading-none text-amber-600 dark:text-amber-400 sm:text-xs">
                                {formatNumber(secondaryVal!, 2)}%
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })()}
                  </Tooltip>
                  {tradingMetrics.winRateRingSecondaryMode === 'recent' &&
                  tradingMetrics.winRateRingSecondary != null ? (
                    <p className="mb-2 text-center text-[10px] leading-snug text-gray-500 dark:text-gray-400 sm:mb-3 sm:text-xs">
                      {t('dashboard:winRateRecentLegend', {
                        count: WIN_RATE_ROLLING_WINDOW,
                        defaultValue:
                          'Black = period · Orange = last {{count}} trades',
                      })}
                    </p>
                  ) : null}
                  <div className="mb-3 text-center text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                    {t('dashboard:objective')}: {gaugeObjectives?.winRate}%
                  </div>
                  <div
                    className={clsx(
                      'mt-2',
                      getDashboardPerformanceBadgeClasses(performanceLabels?.winRate.color)
                    )}
                  >
                    {performanceLabels?.winRate.label}
                  </div>
                </div>

                {/* Jauge Avg Winning Trade */}
                <div className={`${DASHBOARD_GAUGE_TILE_CLASS} cursor-pointer hover:scale-105`}>
                  <h3 className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 sm:mb-4">
                    {t('dashboard:avgWinning')}
                  </h3>
                  <div className="relative mx-auto mb-2 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700/50 sm:mb-4 sm:h-[110px] sm:w-[110px] md:h-[90px] md:w-[90px] lg:h-[110px] lg:w-[110px] xl:h-[130px] xl:w-[130px]">
                    <svg className="w-full h-full transform -rotate-90 absolute top-0 left-0" viewBox="0 0 140 140" preserveAspectRatio="xMidYMid meet">
                      <circle
                        cx="70"
                        cy="70"
                        r="66"
                        stroke="#d1d5db"
                        strokeWidth="8"
                        fill="none"
                        className="opacity-40"
                      />
                      <circle
                        cx="70"
                        cy="70"
                        r="66"
                        stroke="#10b981"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={2 * Math.PI * 66}
                        strokeDashoffset={2 * Math.PI * 66 * (1 - Math.min((tradingMetrics.avgWinningTrade / (gaugeObjectives?.avgWinning || 1)), 1))}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="relative z-10 flex flex-col items-center justify-center">
                      <div className="px-1 text-center text-[10px] font-bold text-gray-900 dark:text-gray-100 sm:text-sm">
                        {formatCurrency(tradingMetrics.avgWinningTrade, currencySymbol)}
                      </div>
                    </div>
                  </div>
                  <div className="mb-3 text-center text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                    {t('dashboard:objective')}: {formatCurrency(gaugeObjectives?.avgWinning || 0, currencySymbol)}
                  </div>
                  <div
                    className={clsx(
                      'mt-2',
                      getDashboardPerformanceBadgeClasses(performanceLabels?.avgWinning.color)
                    )}
                  >
                    {performanceLabels?.avgWinning.label}
                  </div>
                </div>

                {/* Jauge Avg Losing Trade */}
                <div className={`${DASHBOARD_GAUGE_TILE_CLASS} cursor-pointer hover:scale-105`}>
                  <h3 className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300 sm:mb-4">
                    {t('dashboard:avgLosing')}
                  </h3>
                  <div className="relative mx-auto mb-2 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700/50 sm:mb-4 sm:h-[110px] sm:w-[110px] md:h-[90px] md:w-[90px] lg:h-[110px] lg:w-[110px] xl:h-[130px] xl:w-[130px]">
                    <svg className="w-full h-full transform -rotate-90 absolute top-0 left-0" viewBox="0 0 140 140" preserveAspectRatio="xMidYMid meet">
                      <circle
                        cx="70"
                        cy="70"
                        r="66"
                        stroke="#d1d5db"
                        strokeWidth="8"
                        fill="none"
                        className="opacity-40"
                      />
                      <circle
                        cx="70"
                        cy="70"
                        r="66"
                        stroke="#ef4444"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray={2 * Math.PI * 66}
                        strokeDashoffset={2 * Math.PI * 66 * (1 - Math.min((gaugeObjectives?.avgLosing || 1) / Math.abs(tradingMetrics.avgLosingTrade || 1), 1))}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="relative z-10 flex flex-col items-center justify-center">
                      <div className="px-1 text-center text-[10px] font-bold text-gray-900 dark:text-gray-100 sm:text-sm">
                        {formatCurrency(Math.abs(tradingMetrics.avgLosingTrade), currencySymbol)}
                      </div>
                    </div>
                  </div>
                  <div className="mb-3 text-center text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                    {t('dashboard:objective')}: &lt; {formatCurrency(gaugeObjectives?.avgLosing || 0, currencySymbol)}
                  </div>
                  <div
                    className={clsx(
                      'mt-2',
                      getDashboardPerformanceBadgeClasses(performanceLabels?.avgLosing.color)
                    )}
                  >
                    {performanceLabels?.avgLosing.label}
                  </div>
                </div>
              </div>
            </DashboardPanel>
          )}

          {/* Cartes de statistiques à droite */}
          {additionalStats && tradingMetrics && (
            <div className="h-full flex flex-col min-h-0">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 flex-1 items-stretch">
              <ModernStatCard
                theme="default"
                label={t('dashboard:totalPnL')}
                labelTooltip={t('dashboard:totalPnlTransactionsHintTooltip', {
                  defaultValue:
                    'PnL de trading sur la période filtrée (somme des trades). Les dépôts et retraits ne sont pas inclus ici : ils sont pris en compte dans le solde actuel et le plus haut atteint.',
                })}
                value={
                  <div className="flex flex-col w-full gap-1.5">
                    <span className="break-words text-2xl font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(additionalStats.totalPnl, currencySymbol)}</span>
                    <div className="flex flex-col gap-1">
                      <Tooltip content={t('statistics:overview.currentWinningStreakTooltip', { defaultValue: 'Nombre de jours consécutifs avec un P/L positif' })}>
                        <span className="inline-flex items-center justify-between gap-2 cursor-help">
                          <span className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                            {t('statistics:overview.currentWinningStreak', { defaultValue: 'Profit Streak' })}
                          </span>
                          <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-center text-xs font-semibold ${
                            additionalStats.currentWinningStreakDays > 0 
                              ? 'bg-emerald-500/15 text-emerald-400' 
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                          }`}>
                            {additionalStats.currentWinningStreakDays || 0} {(additionalStats.currentWinningStreakDays || 0) === 1 ? t('statistics:overview.day', { defaultValue: 'jour' }) : t('statistics:overview.days', { defaultValue: 'jours' })}
                          </span>
                        </span>
                      </Tooltip>
                      <Tooltip content={t('statistics:overview.maxWinningStreakTooltip', { defaultValue: 'Record de jours consécutifs avec un P/L positif' })}>
                        <span className="inline-flex items-center justify-between gap-2 cursor-help">
                          <span className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                            {t('statistics:overview.maxWinningStreak', { defaultValue: 'Record' })}
                          </span>
                          <span className="inline-block whitespace-nowrap rounded-full bg-amber-500/15 px-2 py-0.5 text-center text-xs font-semibold text-amber-400">
                            {additionalStats.maxWinningStreakDays || 0} {(additionalStats.maxWinningStreakDays || 0) === 1 ? t('statistics:overview.day', { defaultValue: 'jour' }) : t('statistics:overview.days', { defaultValue: 'jours' })}
                          </span>
                        </span>
                      </Tooltip>
                    </div>
                  </div>
                }
                variant={
                  privacySettings.hideCurrentBalance
                    ? 'default'
                    : additionalStats.totalPnl >= 0
                      ? 'success'
                      : 'danger'
                }
                size="small"
                icon={
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                trend={
                  privacySettings.hideCurrentBalance
                    ? undefined
                    : additionalStats.totalPnl >= 0
                      ? 'up'
                      : 'down'
                }
                trendValue={
                  privacySettings.hideCurrentBalance
                    ? undefined
                    : additionalStats.totalPnl >= 0
                      ? t('dashboard:profitable')
                      : t('dashboard:losing')
                }
                hideValue={privacySettings.hideCurrentBalance}
              />
              
              <ModernStatCard
                theme="default"
                label={t('dashboard:profitFactor')}
                value={
                  <div className="w-full flex flex-col h-full">
                    <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                      {formatNumber(additionalStats.profitFactor, 2)}
                    </div>
                    <div className="flex-1 flex items-center">
                      <div className="w-full py-6">
                        <MetricGauge
                          theme="default"
                          label=""
                          value={additionalStats.profitFactor}
                          config={GAUGE_CONFIGS.profitFactor}
                          showLabels={false}
                          size="lg"
                          compactBar
                        />
                      </div>
                    </div>
                  </div>
                }
                variant={additionalStats.profitFactor >= 1.5 ? 'success' : additionalStats.profitFactor >= 1 ? 'warning' : 'danger'}
                size="small"
                icon={
                  additionalStats.profitFactor >= 1 ? (
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                    </svg>
                  ) : (
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.306-4.307a11.95 11.95 0 015.814 5.519l2.74 1.22m0 0l-5.94 2.28m5.94-2.28l2.28-5.941" />
                    </svg>
                  )
                }
                trend={additionalStats.profitFactor >= 1 ? 'up' : 'down'}
                trendValue={additionalStats.profitFactor >= 1.5 ? t('dashboard:excellent') : additionalStats.profitFactor >= 1 ? t('dashboard:good') : t('dashboard:needsImprovement')}
              />
              
              <ModernStatCard
                theme="default"
                label={t('dashboard:wlRatio')}
                value={(() => {
                  const wlRatio = tradingMetrics.avgWinningTrade !== 0 && tradingMetrics.avgLosingTrade !== 0
                    ? Math.abs(tradingMetrics.avgWinningTrade / tradingMetrics.avgLosingTrade)
                    : 0;
                  return (
                    <div className="w-full flex flex-col h-full">
                      <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                        {formatNumber(wlRatio, 2)}
                      </div>
                      <div className="flex-1 flex items-center">
                        <div className="w-full py-6">
                          <MetricGauge
                            theme="default"
                            label=""
                            value={wlRatio}
                            config={GAUGE_CONFIGS.winLossRatio}
                            showLabels={false}
                            size="lg"
                            compactBar
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}
                variant={tradingMetrics.avgWinningTrade !== 0 && tradingMetrics.avgLosingTrade !== 0 && Math.abs(tradingMetrics.avgWinningTrade / tradingMetrics.avgLosingTrade) >= 2 ? 'success' : tradingMetrics.avgWinningTrade !== 0 && tradingMetrics.avgLosingTrade !== 0 && Math.abs(tradingMetrics.avgWinningTrade / tradingMetrics.avgLosingTrade) >= 1.5 ? 'warning' : 'info'}
                size="small"
                icon={
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.036-.177-2.032-.498-2.96" />
                  </svg>
                }
                trend={undefined}
                trendValue={`${t('dashboard:avg')}: ${formatCurrency(Math.abs(tradingMetrics.avgWinningTrade), currencySymbol)} / ${formatCurrency(Math.abs(tradingMetrics.avgLosingTrade), currencySymbol)}`}
              />
              
              <Tooltip
                content={t('dashboard:sequencesPeriodTooltip', { defaultValue: 'Calculé sur les 12 derniers mois glissants' })}
                triggerDisplay="block"
                className="h-full w-full"
              >
                <div className="h-full w-full">
                  <ModernStatCard
                    theme="default"
                    label={(() => {
                      // Utiliser complianceStats.current_streak si disponible (inclut les jours sans trades)
                      // Sinon utiliser additionalStats (seulement les jours avec trades)
                      const streakDays = complianceStats?.current_streak ?? 0;
                      const notRespectedDays = additionalStats.currentConsecutiveDaysNotRespected;
                      
                      if (streakDays > 0) {
                        return `${t('dashboard:currentSeries')} - ${t('dashboard:sequenceRespect')}`;
                      } else if (notRespectedDays > 0) {
                        return `${t('dashboard:currentSeries')} - ${t('dashboard:sequenceNotRespect')}`;
                      }
                      return t('dashboard:currentSeries');
                    })()}
                    value={(() => {
                      // Utiliser complianceStats.current_streak si disponible (inclut les jours sans trades)
                      // Sinon utiliser additionalStats (seulement les jours avec trades)
                      const streakDays = complianceStats?.current_streak ?? 0;
                      const notRespectedDays = additionalStats.currentConsecutiveDaysNotRespected;
                      
                      if (streakDays > 0) {
                        return `${streakDays} ${t('dashboard:days')}`;
                      } else if (notRespectedDays > 0) {
                        return `${notRespectedDays} ${t('dashboard:days')}`;
                      }
                      return `0 ${t('dashboard:days')}`;
                    })()}
                    valueSubtext={(() => {
                      const streakDays = complianceStats?.current_streak ?? 0;
                      const streakStartDate = complianceStats?.current_streak_start;
                      
                      if (streakDays > 0 && streakStartDate) {
                        return `${t('strategy:streak.sinceWithArticle', { defaultValue: 'depuis le' })} ${formatDate(streakStartDate, preferences.date_format, false)}`;
                      }
                      return undefined;
                    })()}
                    variant={(() => {
                      const streakDays = complianceStats?.current_streak ?? 0;
                      return streakDays > 0 ? 'success' : additionalStats.currentConsecutiveDaysNotRespected > 0 ? 'danger' : 'default';
                    })()}
                    size="small"
                    icon={
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                    subMetrics={[
                      {
                        label: additionalStats.currentConsecutiveTradesRespected > 0 ? t('dashboard:currentRespectTrades') : t('dashboard:currentNotRespectTrades'),
                        value: `${additionalStats.currentConsecutiveTradesRespected > 0 ? additionalStats.currentConsecutiveTradesRespected : additionalStats.currentConsecutiveTradesNotRespected || 0} ${t('trades:trades')}`
                      }
                    ]}
                    trend={(() => {
                      const streakDays = complianceStats?.current_streak ?? 0;
                      return streakDays > 0 ? 'up' : additionalStats.currentConsecutiveDaysNotRespected > 0 ? 'down' : undefined;
                    })()}
                    trendValue={(() => {
                      const streakDays = complianceStats?.current_streak ?? 0;
                      return streakDays > 0 ? t('dashboard:sequenceRespect') : additionalStats.currentConsecutiveDaysNotRespected > 0 ? t('dashboard:sequenceNotRespect') : undefined;
                    })()}
                  />
                </div>
              </Tooltip>
              
              <Tooltip
                content={t('dashboard:sequencesPeriodTooltip', { defaultValue: 'Calculé sur les 12 derniers mois glissants' })}
                triggerDisplay="block"
                className="h-full w-full"
              >
                <div className="h-full w-full">
                  <ModernStatCard
                    theme="default"
                    label={t('dashboard:sequenceRespect')}
                    value={(() => {
                      return `${disciplineBestStreakDays} ${t('dashboard:days')}`;
                    })()}
                    variant={(() => {
                      const value = disciplineBestStreakDays;
                      return value >= 21 ? 'success' : value > 0 ? 'info' : 'default';
                    })()}
                    size="small"
                    icon={
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                    progressValue={(() => {
                      return disciplineBestStreakDays;
                    })()}
                    progressMax={21}
                    progressLabel={t('dashboard:objective')}
                    subMetrics={[
                      {
                        label: t('dashboard:maxTrades'),
                        value: `${additionalStats.maxConsecutiveTradesRespected || 0} ${t('trades:trades')}`
                      },
                      {
                        label: '',
                        value: ''
                      }
                    ]}
                    trend={(() => {
                      const value = disciplineBestStreakDays;
                      return value >= 21 ? 'up' : value > 0 ? 'up' : undefined;
                    })()}
                    trendValue={(() => {
                      const value = disciplineBestStreakDays;
                      return value >= 21 ? t('dashboard:objectiveAchieved') : value > 0 ? `${21 - value} ${t('dashboard:daysRemaining')}` : undefined;
                    })()}
                  />
                </div>
              </Tooltip>
              
              <Tooltip
                content={t('dashboard:sequencesPeriodTooltip', { defaultValue: 'Calculé sur les 12 derniers mois glissants' })}
                triggerDisplay="block"
                className="h-full w-full"
              >
                <div className="h-full w-full">
                  <ModernStatCard
                    theme="default"
                    label={t('dashboard:sequenceNotRespect')}
                    value={`${additionalStats.maxConsecutiveDaysNotRespected || 0} ${t('dashboard:days')}`}
                    variant={additionalStats.maxConsecutiveDaysNotRespected >= 3 ? 'danger' : additionalStats.maxConsecutiveDaysNotRespected > 0 ? 'warning' : 'default'}
                    size="small"
                    icon={
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    }
                    subMetrics={[
                      {
                        label: t('dashboard:maxTrades'),
                        value: `${additionalStats.maxConsecutiveTradesNotRespected || 0} ${t('trades:trades')}`
                      },
                      {
                        label: '',
                        value: ''
                      }
                    ]}
                    trend={additionalStats.maxConsecutiveDaysNotRespected > 0 ? 'down' : undefined}
                    trendValue={additionalStats.maxConsecutiveDaysNotRespected > 0 ? t('dashboard:needsAttention') : undefined}
                  />
                </div>
              </Tooltip>
              </div>
            </div>
          )}

          </div>

          {/* Graphiques en 2 colonnes : ligne 1 = solde + perf. semaine ; ligne 2 = waterfall + taux de réussite */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Graphique 2: Solde du compte dans le temps */}
          {accountBalanceData.length > 0 && (
            <DashboardPanel padding="large">
              <div className="mb-4">
                <h3 className={`mb-3 text-lg font-bold ${DASHBOARD_PANEL_TITLE_CLASS}`}>
                  {t('dashboard:accountBalanceOverTime')}
                </h3>
                {/* Stats row */}
                {!privacySettings.hideProfitLoss && !privacySettings.hideCurrentBalance && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-xs sm:text-sm">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500 dark:text-gray-400">{t('dashboard:highest')} :</span>
                      <span className={`font-medium ${performanceStats.highestValue >= 0 ? DASHBOARD_PNL_POSITIVE_TEXT_CLASS : DASHBOARD_PNL_NEGATIVE_TEXT_CLASS}`}>
                        {formatCurrency(performanceStats.highestValue || 0, currencySymbol)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500 dark:text-gray-400">{t('dashboard:lowest')} :</span>
                      <span className={`font-medium ${performanceStats.lowestValue >= 0 ? DASHBOARD_PNL_POSITIVE_TEXT_CLASS : DASHBOARD_PNL_NEGATIVE_TEXT_CLASS}`}>
                        {formatCurrency(performanceStats.lowestValue || 0, currencySymbol)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="h-64 sm:h-80">
                <AccountBalanceChart
                  key={pnlDisplayMode}
                  data={balanceDisplay.rows}
                  currencySymbol={currencySymbol}
                  formatCurrency={formatCurrency}
                  initialCapital={chartConfig.initialCapital}
                  referenceBalance={chartConfig.referenceBalance}
                  hideMll={privacySettings.hideMll || !chartConfig.showMll}
                  hideProfitTarget={chartConfig.profitTargetAbsolute == null}
                  profitTarget={chartConfig.profitTargetAbsolute ?? 0}
                  hideProfitLoss={privacySettings.hideProfitLoss}
                />
              </div>
            </DashboardPanel>
          )}

          <WeekdayPerformanceSection
            variant="pnl"
            weekdayPerformanceData={weekdayPerformanceData}
            pnlDisplayMode={pnlDisplayMode}
            chartColors={chartColors}
            currencySymbol={currencySymbol}
            formatCurrency={formatCurrency}
            formatNumber={formatNumber}
            hideWeekdayChartMoneyValues={hideWeekdayChartMoneyValues}
            windowWidth={windowWidth}
            isDark={isDark}
          />

          {/* Graphique 5: Évolution des gains et pertes journalière */}
          {waterfallData.length > 0 && waterfallChartData && (
            <DashboardPanel padding="large">
                <div className="mb-4 shrink-0">
                  <div className="mb-4 flex items-center gap-2">
                    <h3 className={`text-lg font-bold ${DASHBOARD_PANEL_TITLE_CLASS}`}>{t('dashboard:dailyGainsLossesEvolution')}</h3>
                  </div>
                  {waterfallStats && (
                    <div className="mb-2 flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                      {!privacySettings.hideProfitLoss && (
                        <>
                          <div className="flex items-center gap-1">
                            <span>{t('dashboard:bestDay')} :</span>
                            <span className={`font-medium ${DASHBOARD_PNL_POSITIVE_TEXT_CLASS}`}>{formatCurrency(waterfallStats.bestDay, currencySymbol)}</span>
                          </div>
                          {waterfallStats.worstDay < 0 && (
                            <div className="flex items-center gap-1">
                              <span>{t('dashboard:worstDay')} :</span>
                              <span className={`font-medium ${DASHBOARD_PNL_NEGATIVE_TEXT_CLASS}`}>{formatCurrency(waterfallStats.worstDay, currencySymbol)}</span>
                            </div>
                          )}
                        </>
                      )}
                      <div className="flex items-center gap-1">
                        <span>{t('dashboard:winningDays')} :</span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">{waterfallStats.positiveDays}/{waterfallStats.tradingDaysCount} ({formatNumber(waterfallStats.winRate, 1)}%)</span>
                      </div>
                    </div>
                  )}
                </div>

                <ChartTooltipResetContainer className="h-64 sm:h-80">
                  <ChartBar
                    key={pnlDisplayMode}
                    data={waterfallChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false
                        },
                        tooltip: {
                          ...buildChartTooltipPlugin(chartColors, 'barStackedLike', {
                            enabled: !privacySettings.hideProfitLoss,
                          }),
                          callbacks: {
                            title: function (tooltipItems: any[]) {
                              if (!tooltipItems.length) return '';
                              const idx = tooltipItems[0].dataIndex;
                              const ds = tooltipItems[0].chart.data.datasets[0] as any;
                              const bar = ds._waterfallData?.[idx];
                              if (!bar) return tooltipItems[0].label || '';
                              const loc = i18n.resolvedLanguage || i18n.language || 'en';
                              const tz = preferences.timezone;
                              if (bar.aggregation === 'day') return tooltipItems[0].label || '';
                              if (bar.aggregation === 'week') {
                                return t('dashboard:waterfallTooltipWeekTitle', {
                                  start: formatWaterfallDayLabel(bar.rangeStartKey, loc, tz, true),
                                  end: formatWaterfallDayLabel(bar.rangeEndKey, loc, tz, true),
                                });
                              }
                              return t('dashboard:waterfallTooltipMonthTitle', {
                                monthLabel: formatWaterfallMonthAxisLabel(bar.rangeStartKey.slice(0, 7), loc),
                              });
                            },
                            label: function(context: any) {
                              const index = context.dataIndex;
                              const waterfallBarData = context.dataset._waterfallData[index];
                              const totalVariation = waterfallBarData.value;
                              const pnlTrading = waterfallBarData.pnlTrading ?? 0;
                              // Toujours dériver du total affiché pour inclure dépôts/retraits (cohérent jour comme période)
                              const dailyNetTransactions = totalVariation - pnlTrading;
                              const cumulative = waterfallBarData.cumulative;
                              const start = waterfallBarData.start;
                              const isAgg = waterfallBarData.aggregation && waterfallBarData.aggregation !== 'day';
                              const pnlLineKey = isAgg ? 'dashboard:periodPnL' : 'dashboard:dayPnL';
                              const netFlowLineKey = isAgg ? 'dashboard:periodNetFlow' : 'dashboard:netFlow';
                              
                              // Calculer la variation en % par rapport à la barre précédente
                              let variationPercent = 0;
                              if (start !== 0) {
                                variationPercent = ((cumulative - start) / Math.abs(start)) * 100;
                              } else if (cumulative !== 0) {
                                // Si start est 0, on ne peut pas calculer de pourcentage, on affiche juste le signe
                                variationPercent = cumulative > 0 ? 100 : -100;
                              }
                              
                              return [
                                `${t('dashboard:variation')}: ${formatCurrency(totalVariation, currencySymbol)}`,
                                `${t(pnlLineKey)}: ${formatCurrency(pnlTrading, currencySymbol)}`,
                                `${t(netFlowLineKey)}: ${formatCurrency(dailyNetTransactions, currencySymbol)}`,
                                `${t('dashboard:cumulativeCapital')}: ${formatCurrency(cumulative, currencySymbol)}`,
                                `${t('dashboard:variation')}: ${variationPercent >= 0 ? '+' : ''}${formatNumber(variationPercent, 2)}%`
                              ];
                            }
                          }
                        },
                        datalabels: {
                          display: false
                        }
                      },
                      scales: {
                        x: {
                          grid: {
                            display: false
                          },
                          ticks: {
                            maxRotation: 45,
                            minRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 24,
                            color: dashboardChartAxis.tick,
                            font: {
                              size: 11
                            }
                          },
                          border: {
                            color: dashboardChartAxis.border,
                          },
                        },
                        y: {
                          beginAtZero: true,
                          grid: {
                            color: dashboardChartAxis.grid,
                            lineWidth: 1,
                          },
                          ticks: {
                            display: !privacySettings.hideProfitLoss,
                            callback: function(value: any) {
                              return formatCurrency(value, currencySymbol);
                            },
                            color: dashboardChartAxis.tick,
                            font: {
                              size: 11
                            }
                          },
                          border: {
                            color: dashboardChartAxis.border,
                            display: false,
                          },
                        }
                      },
                      elements: {
                        bar: {
                          borderRadius: 0,
                          borderSkipped: false
                        }
                      },
                      animation: {
                        duration: waterfallDisplay.rows.length > 50 ? 0 : 1000,
                        easing: 'easeInOutQuart' as const
                      }
                    }}
                  />
                </ChartTooltipResetContainer>
            </DashboardPanel>
          )}

          <WeekdayPerformanceSection
            variant="winrate"
            weekdayPerformanceData={weekdayPerformanceData}
            pnlDisplayMode={pnlDisplayMode}
            chartColors={chartColors}
            currencySymbol={currencySymbol}
            formatCurrency={formatCurrency}
            formatNumber={formatNumber}
            hideWeekdayChartMoneyValues={hideWeekdayChartMoneyValues}
            windowWidth={windowWidth}
            isDark={isDark}
          />

          {/* Graphique 6: Répartition des trades par durée (pleine largeur) */}
          {durationDistributionBins.length > 0 && (
            <div className="lg:col-span-2">
              <DurationDistributionChart bins={durationDistributionBins} />
            </div>
          )}
          </div>
        </div>
      )}

      {!isLoading && accountBalanceData.length === 0 && !durationDistribution.some(d => d.total > 0) && waterfallData.length === 0 && weekdayPerformanceData.length === 0 && !tradingMetrics && (
        <DashboardPanel padding="large" className="text-center text-gray-500 dark:text-gray-400">
          <p>{t('dashboard:noDataForPeriod')}</p>
        </DashboardPanel>
      )}

      <ImportTradesModal open={showImport} onClose={() => setShowImport(false)} />
    </PageShell>
  );
};

export default DashboardPage;
