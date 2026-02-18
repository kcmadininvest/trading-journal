import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ImportTradesModal } from '../components/trades/ImportTradesModal';
import { AccountSelector } from '../components/accounts/AccountSelector';
import { PeriodSelector, PeriodRange } from '../components/common/PeriodSelector';
import { RespectRateCard } from '../components/common/RespectRateCard';
import { PerformanceComparison } from '../components/strategy/PerformanceComparison';
import { StrategyBadges } from '../components/strategy/StrategyBadges';
import { tradeStrategiesService } from '../services/tradeStrategies';
import { tradingAccountsService, TradingAccount } from '../services/tradingAccounts';
import { currenciesService, Currency } from '../services/currencies';
import { useTheme } from '../hooks/useTheme';
import { usePreferences } from '../hooks/usePreferences';
import { usePrivacySettings } from '../hooks/usePrivacySettings';
import { useWindowSize } from '../hooks/useWindowSize';
import { useStrategyTrades } from '../hooks/useStrategyTrades';
import { useStrategyCharts } from '../hooks/useStrategyCharts';
import { useComplianceAggregation } from '../hooks/useComplianceAggregation';
import { useWeekdayCompliance } from '../hooks/useWeekdayCompliance';
import { useChartOptions } from '../hooks/useChartOptions';
import { formatNumber as formatNumberUtil } from '../utils/numberFormat';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { getMonthName } from '../utils/dateFormat';
import { useTradingAccount } from '../contexts/TradingAccountContext';
import { useAccountIndicators } from '../hooks/useAccountIndicators';
import { AccountSummaryCard } from '../components/common/AccountSummaryCard';
import { dashboardService } from '../services/dashboard';
import { getChartColors } from '../utils/chartConfig';
import { ChartSkeleton } from '../components/strategy/charts/ChartSkeleton';
import { LazyChart } from '../components/strategy/charts/LazyChart';
import { ChartSection } from '../components/common/ChartSection';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
  ArcElement,
  Filler,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { MemoizedBar as Bar, MemoizedMixedChart as MixedChart } from '../components/strategy/charts/MemoizedCharts';
import { EmotionsChart } from '../components/strategy/charts/EmotionsChart';
import { EvolutionChart } from '../components/strategy/charts/EvolutionChart';
import { useEvolutionData } from '../hooks/useEvolutionData';

// Enregistrer les composants Chart.js nécessaires
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  ChartTooltip,
  ChartLegend,
  ArcElement,
  Filler,
  ChartDataLabels
);

const StrategiesPage: React.FC = () => {
  const { theme } = useTheme();
  const { preferences } = usePreferences();
  const { t, i18n } = useI18nTranslation();
  const privacySettings = usePrivacySettings('strategies');
  const isDark = theme === 'dark';
  const { selectedAccountId: accountId, setSelectedAccountId: setAccountId, loading: accountLoading } = useTradingAccount();
  const windowSize = useWindowSize();
  
  // Tracker le premier rendu pour optimiser les animations (Optimisation L)
  const isFirstRender = useRef(true);
  useEffect(() => {
    isFirstRender.current = false;
  }, []);
  
  // Obtenir la langue actuelle depuis i18n (plus fiable que preferences.language)
  // Utiliser useMemo pour que ça se mette à jour quand la langue change
  const currentLanguage = useMemo(() => {
    const lang = i18n.language?.split('-')[0] || 'fr';
    const supportedLangs: Array<'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh'> = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'ko', 'zh'];
    return (supportedLangs.includes(lang as any) ? lang : 'fr') as 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh';
  }, [i18n.language]);
  
  // Wrapper pour formatNumber avec préférences
  const formatNumber = useCallback((value: number, digits: number = 2): string => {
    return formatNumberUtil(value, digits, preferences.number_format);
  }, [preferences.number_format]);

  // Fonction pour formater une période selon la langue de l'utilisateur
  // La période peut être au format "YYYY-MM" (mois) ou "DD/MM" (jour)
  const formatPeriod = useCallback((period: string): string => {
    // Vérifier si c'est un format de mois (YYYY-MM)
    const monthMatch = period.match(/^(\d{4})-(\d{2})$/);
    if (monthMatch) {
      const year = parseInt(monthMatch[1], 10);
      const month = parseInt(monthMatch[2], 10);
      const monthName = getMonthName(month, currentLanguage);
      // Mettre la première lettre en majuscule
      const capitalizedMonthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);
      return `${capitalizedMonthName} ${year}`;
    }
    // Sinon, retourner tel quel (format jour DD/MM)
    return period;
  }, [currentLanguage]);

  // Helper function pour obtenir les couleurs des graphiques selon le thème
  const chartColors = useMemo(() => getChartColors(isDark), [isDark]);
  
  // Helper pour les options d'animation optimisées (Optimisation L)
  const optimizedAnimation = useMemo(() => ({
    duration: isFirstRender.current ? 0 : 750, // Pas d'animation au premier rendu
    easing: 'easeInOutQuart' as const,
  }), []);
  const [showImport, setShowImport] = useState(false);
  // Utiliser un sélecteur de période moderne
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodRange | null>(() => {
    // Par défaut: 3 derniers mois
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    return {
      start: `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`,
      end: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
      preset: 'last3Months',
    };
  });
  // Garder pour compatibilité
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statistics, setStatistics] = useState<any>(null);
  const [selectedAccount, setSelectedAccount] = useState<TradingAccount | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  
  // Utiliser le hook optimisé pour charger les trades filtrés (allTrades n'est plus chargé)
  const { filteredTrades, reload: reloadTrades } = useStrategyTrades({
    accountId,
    accountLoading,
    selectedPeriod,
    selectedYear,
    selectedMonth,
    skipAllTrades: true,
  });
  const [allAccountsCompliance, setAllAccountsCompliance] = useState<any>(null);
  const [selectedAccountCompliance, setSelectedAccountCompliance] = useState<any>(null);
  const [loadingAllAccountsCompliance, setLoadingAllAccountsCompliance] = useState(false);
  const [loadingSelectedAccountCompliance, setLoadingSelectedAccountCompliance] = useState(false);

  // État pour le dashboard summary (intégré dans loadAllData)
  const [dashboardSummary, setDashboardSummary] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Cache pour les données chargées (optimisation pour les changements de compte/période fréquents)
  const dataCache = useRef<Map<string, {
    statistics: any;
    allAccountsCompliance: any;
    selectedAccountCompliance: any;
    currencies: Currency[];
    selectedAccount: TradingAccount | null;
    dashboardSummary: any;
    timestamp: number;
  }>>(new Map());

  // Fonction pour générer une clé de cache unique
  const getCacheKey = useCallback(() => {
    const periodKey = selectedPeriod 
      ? `${selectedPeriod.start}-${selectedPeriod.end}`
      : selectedYear 
        ? `${selectedYear}-${selectedMonth || 'all'}`
        : 'all';
    return `${accountId || 'all'}-${periodKey}`;
  }, [accountId, selectedPeriod, selectedYear, selectedMonth]);

  const { summaryStartDate, summaryEndDate } = useMemo(() => {
    if (selectedPeriod) {
      return { summaryStartDate: selectedPeriod.start, summaryEndDate: selectedPeriod.end };
    }
    if (selectedYear) {
      if (selectedMonth) {
        const lastDay = new Date(selectedYear, selectedMonth, 0);
        const year = lastDay.getFullYear();
        const month = String(selectedMonth).padStart(2, '0');
        const day = String(lastDay.getDate()).padStart(2, '0');
        return {
          summaryStartDate: `${selectedYear}-${month}-01`,
          summaryEndDate: `${year}-${month}-${day}`,
        };
      }
      return {
        summaryStartDate: `${selectedYear}-01-01`,
        summaryEndDate: `${selectedYear}-12-31`,
      };
    }
    return { summaryStartDate: undefined, summaryEndDate: undefined };
  }, [selectedPeriod, selectedYear, selectedMonth]);

  // Générer les années disponibles (année en cours et 5 ans précédents)

  // Fonction pour obtenir le label d'une émotion traduit
  const getEmotionLabel = useCallback((emotion: string): string => {
    return t(`strategies:emotions.${emotion}` as any, { defaultValue: emotion });
  }, [t]);

  // Fonction unifiée pour charger toutes les données en parallèle
  const loadAllData = useCallback(async () => {
    // Vérifier le cache d'abord
    const cacheKey = getCacheKey();
    const cached = dataCache.current.get(cacheKey);
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      // Utiliser les données en cache
      setStatistics(cached.statistics);
      setAllAccountsCompliance(cached.allAccountsCompliance);
      setSelectedAccountCompliance(cached.selectedAccountCompliance);
      setCurrencies(cached.currencies);
      setSelectedAccount(cached.selectedAccount);
      setDashboardSummary(cached.dashboardSummary);
      return;
    }
    
    setIsLoading(true);
    setLoadingAllAccountsCompliance(true);
    setLoadingSelectedAccountCompliance(true);
    setSummaryLoading(true);
    setError(null);
    
    try {
      const params: {
        year?: number;
        month?: number;
        start_date?: string;
        end_date?: string;
        tradingAccount?: number;
      } = {};
      
      // Utiliser la période sélectionnée (priorité) ou calculer depuis année/mois (rétrocompatibilité)
      if (selectedPeriod) {
        params.start_date = selectedPeriod.start;
        params.end_date = selectedPeriod.end;
      } else if (selectedYear) {
        params.year = selectedYear;
        if (selectedMonth) {
          params.month = selectedMonth;
        }
      }
      
      if (accountId) {
        params.tradingAccount = accountId;
      }
      
      // Paralléliser TOUS les appels API y compris dashboard summary
      const dashboardFilters: any = {};
      if (accountId) dashboardFilters.trading_account = accountId;
      if (summaryStartDate) dashboardFilters.start_date = summaryStartDate;
      if (summaryEndDate) dashboardFilters.end_date = summaryEndDate;

      const [statisticsData, allAccountsComplianceData, selectedAccountComplianceData, currenciesData, accountData, dashboardData] = 
        await Promise.all([
          // Appel 1: Statistics
          tradeStrategiesService.statistics(params),
          // Appel 2: Compliance tous comptes
          tradeStrategiesService.strategyComplianceStats(undefined, params),
          // Appel 3: Compliance compte sélectionné (si applicable)
          accountId ? tradeStrategiesService.strategyComplianceStats(accountId, params) : Promise.resolve(null),
          // Appel 4: Currencies (caché côté service)
          currenciesService.list(),
          // Appel 5: Account sélectionné
          accountId ? tradingAccountsService.get(accountId) : Promise.resolve(null),
          // Appel 6: Dashboard summary
          dashboardService.getSummary(dashboardFilters).catch(() => null),
        ]);
      
      // Stocker dans le cache
      dataCache.current.set(cacheKey, {
        statistics: statisticsData,
        allAccountsCompliance: allAccountsComplianceData,
        selectedAccountCompliance: selectedAccountComplianceData,
        currencies: currenciesData,
        selectedAccount: accountData,
        dashboardSummary: dashboardData,
        timestamp: Date.now(),
      });
      
      // Limiter la taille du cache (garder seulement les 10 dernières entrées)
      if (dataCache.current.size > 10) {
        const firstKey = dataCache.current.keys().next().value;
        if (firstKey !== undefined) {
          dataCache.current.delete(firstKey);
        }
      }
      
      setStatistics(statisticsData);
      setAllAccountsCompliance(allAccountsComplianceData);
      setSelectedAccountCompliance(selectedAccountComplianceData);
      setCurrencies(currenciesData);
      setSelectedAccount(accountData);
      setDashboardSummary(dashboardData);
    } catch (err: any) {
      setError(err.message || t('strategies:errorLoadingStatistics'));
      console.error('Erreur lors du chargement des données:', err);
    } finally {
      setIsLoading(false);
      setLoadingAllAccountsCompliance(false);
      setLoadingSelectedAccountCompliance(false);
      setSummaryLoading(false);
    }
  }, [getCacheKey, selectedPeriod, selectedYear, selectedMonth, accountId, summaryStartDate, summaryEndDate, t]);

  // Charger toutes les données
  useEffect(() => {
    // Attendre que le compte soit chargé avant de charger les données
    if (accountLoading) {
      return;
    }
    loadAllData();
  }, [loadAllData, accountLoading]);


  const complianceSectionData = useMemo(() => selectedAccountCompliance || allAccountsCompliance, [selectedAccountCompliance, allAccountsCompliance]);
  const complianceSectionLoading = loadingSelectedAccountCompliance || loadingAllAccountsCompliance;


  // Obtenir le symbole de la devise du compte sélectionné
  const currencySymbol = useMemo(() => {
    if (!selectedAccount?.currency) return '';
    const currency = currencies.find(c => c.code === selectedAccount.currency);
    return currency?.symbol || '';
  }, [selectedAccount, currencies]);


  // allTrades n'est plus chargé, passer un tableau vide (le fallback balance n'est plus utilisé)
  const indicators = useAccountIndicators({
    selectedAccount,
    allTrades: [],
    filteredTrades,
    activeDays: dashboardSummary?.active_days,
  });


  // Utiliser le hook optimisé pour les graphiques de stratégie
  const { respectChartData, successRateData, winningSessionsData, emotionsData } = useStrategyCharts({
    statistics,
    isLoading,
    formatPeriod,
    formatNumber,
    getEmotionLabel,
    t,
  });

  // Hook optimisé pour les options de graphiques
  // Les données volatiles (statistics, chartData, etc.) sont passées via refs dans le hook
  // pour éviter d'invalider les useMemo à chaque changement de données

  // Graphique 5: Évolution du taux de compliance (prend en compte le sélecteur de compte)
  const complianceAggregation = useComplianceAggregation({
    complianceData: selectedAccountCompliance || allAccountsCompliance,
    isLoading,
  });

  const evolutionData = useEvolutionData({
    complianceAggregation,
    t,
  });

  // Graphique 7: Compliance par jour de la semaine (prend en compte le sélecteur de compte)
  const weekdayComplianceData = useWeekdayCompliance({
    complianceData: selectedAccountCompliance || allAccountsCompliance,
    isLoading,
    t,
  });

  // Hook optimisé pour toutes les options de graphiques
  const {
    respectChartOptions,
    successRateOptions,
    winningSessionsOptions,
    emotionsOptions,
    evolutionOptions,
    weekdayComplianceOptions,
  } = useChartOptions({
    chartColors,
    windowSize,
    isDark,
    optimizedAnimation,
    formatNumber,
    formatPeriod,
    t,
    i18nLanguage: i18n.language,
    statistics,
    respectChartData,
    emotionsData,
    evolutionData,
    weekdayComplianceData,
  });

  // Indicateur 5: Taux de respect total toutes périodes confondues
  const allTimeRespect = statistics?.all_time?.respect_percentage || 0;
  // Taux de respect total pour la période sélectionnée (tous comptes)
  const periodRespect = statistics?.period?.respect_percentage || 0;
  // Taux de respect du compte (toutes périodes)
  const accountRespect = statistics?.statistics?.respect_percentage || 0;
  // Taux de respect du compte pour la période sélectionnée
  const accountPeriodRespect = statistics?.statistics?.period?.respect_percentage || 0;
  
  // Fonction pour déterminer la couleur du gradient selon le taux de respect
  // Bonnes pratiques de trading : >80% excellent, 70-80% bon, 50-70% moyen, <50% à améliorer
  const getRespectRateColor = useCallback((rate: number) => {
    if (rate >= 80) {
      return { from: 'from-green-600', to: 'to-emerald-500', darkFrom: 'dark:from-green-700', darkTo: 'dark:to-emerald-600' };
    } else if (rate >= 70) {
      return { from: 'from-green-500', to: 'to-emerald-400', darkFrom: 'dark:from-green-600', darkTo: 'dark:to-emerald-500' };
    } else if (rate >= 50) {
      return { from: 'from-amber-500', to: 'to-orange-500', darkFrom: 'dark:from-amber-600', darkTo: 'dark:to-orange-600' };
    } else {
      return { from: 'from-red-500', to: 'to-rose-500', darkFrom: 'dark:from-red-600', darkTo: 'dark:to-rose-600' };
    }
  }, []);
  
  // Mémoiser les couleurs dérivées
  const accountRespectColor = useMemo(() => getRespectRateColor(accountRespect), [getRespectRateColor, accountRespect]);
  const accountPeriodRespectColor = useMemo(() => getRespectRateColor(accountPeriodRespect), [getRespectRateColor, accountPeriodRespect]);
  const allTimeRespectColor = useMemo(() => getRespectRateColor(allTimeRespect), [getRespectRateColor, allTimeRespect]);
  const periodRespectColor = useMemo(() => getRespectRateColor(periodRespect), [getRespectRateColor, periodRespect]);

  return (
    <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="mb-4 sm:mb-6">
        {/* Filtres */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div className="flex flex-col lg:flex-row lg:items-end gap-4">
              {/* Compte de trading */}
              <div className="flex-shrink-0 max-w-sm">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('strategies:tradingAccount')}
                </label>
                <AccountSelector value={accountId} onChange={setAccountId} hideLabel />
              </div>
              
              {/* Sélecteur de période moderne */}
              <div className="flex-shrink-0 lg:w-80">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('strategies:period', { defaultValue: 'Période' })}
                </label>
                <PeriodSelector
                  value={selectedPeriod}
                  onChange={(period) => {
                    setSelectedPeriod(period);
                    // Réinitialiser les anciens sélecteurs
                    setSelectedYear(null);
                    setSelectedMonth(null);
                  }}
                />
              </div>
            </div>

          </div>
        </div>

        {/* Soldes du compte */}
        {selectedAccount && (
          <AccountSummaryCard 
            className="mb-4 sm:mb-6"
            indicators={indicators} 
            currencySymbol={currencySymbol} 
            loading={isLoading || summaryLoading}
            error={error || null}
          />
        )}

        {/* Message d'erreur */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
            <p className="text-sm sm:text-base text-red-800 dark:text-red-300 break-words">{error}</p>
          </div>
        )}

        {/* Indicateurs de respect */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
            {/* Taux de respect total (avec période sélectionnée en dessous) */}
            <RespectRateCard
              title={t('strategies:totalRespectRate')}
              subtitle={`(${t('strategies:allPeriodsAndAccounts')})`}
              percentage={allTimeRespect}
              tradesCount={statistics?.all_time?.respected_count || 0}
              totalTrades={statistics?.all_time?.total_trades || 0}
              totalDays={statistics?.all_time?.total_days}
              totalTradesInDays={statistics?.all_time?.total_trades_in_days}
              tradesLabel={t('trades:trades')}
              daysLabel={t('strategies:days', { defaultValue: 'jours' })}
              ofWhichLabel={t('strategies:ofWhich', { defaultValue: 'dont' })}
              outOfLabel={t('strategies:outOf')}
              gradientColors={allTimeRespectColor}
              secondaryPercentage={periodRespect}
              secondaryTradesCount={statistics?.period?.respected_count || 0}
              secondaryTotalTrades={statistics?.period?.total_trades || 0}
              secondaryTotalDays={statistics?.period?.total_days}
              secondaryTotalTradesInDays={statistics?.period?.total_trades_in_days}
              secondarySubtitle={`(${t('strategies:forSelectedPeriod')})`}
              secondaryGradientColors={periodRespectColor}
            />
            
            {/* Taux de respect du compte (avec période sélectionnée en dessous) */}
            <RespectRateCard
              title={t('strategies:accountRespectRate')}
              subtitle={`(${t('strategies:allPeriods')})`}
              percentage={accountRespect}
              tradesCount={statistics?.statistics?.respected_count || 0}
              totalTrades={statistics?.statistics?.total_trades || 0}
              totalDays={statistics?.statistics?.total_days}
              totalTradesInDays={statistics?.statistics?.total_trades_in_days}
              tradesLabel={t('trades:trades')}
              daysLabel={t('strategies:days', { defaultValue: 'jours' })}
              ofWhichLabel={t('strategies:ofWhich', { defaultValue: 'dont' })}
              outOfLabel={t('strategies:outOf')}
              gradientColors={accountRespectColor}
              secondaryPercentage={accountPeriodRespect}
              secondaryTradesCount={statistics?.statistics?.period?.respected_count || 0}
              secondaryTotalTrades={statistics?.statistics?.period?.total_trades || 0}
              secondaryTotalDays={statistics?.statistics?.period?.total_days}
              secondaryTotalTradesInDays={statistics?.statistics?.period?.total_trades_in_days}
              secondarySubtitle={`(${t('strategies:forSelectedPeriod')})`}
              secondaryGradientColors={accountPeriodRespectColor}
            />
          </div>
        )}

        {/* Discipline & Stratégie (hors bandeau) */}
        {(complianceSectionData || complianceSectionLoading) && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
            <div>
              {complianceSectionData ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <PerformanceComparison
                    performanceComparison={complianceSectionData.performance_comparison}
                    currencySymbol={currencySymbol}
                    hideProfitLoss={privacySettings.hideProfitLoss}
                  />
                  <StrategyBadges badges={complianceSectionData.badges || []} />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700 h-48 animate-pulse" />
                  <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700 h-48 animate-pulse" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Graphiques (rendu progressif : chaque graphique s'affiche dès que ses données arrivent) */}
        {isLoading && !statistics ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <ChartSkeleton title={t('strategies:strategyRespectPercentage')} />
            <ChartSkeleton title={t('strategies:successRateByStrategyRespect')} />
            <ChartSkeleton title={t('strategies:winningSessionsDistribution')} />
            <ChartSkeleton title={t('strategies:dominantEmotionsDistribution')} />
          </div>
        ) : statistics ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Graphique 1: Respect de la stratégie en % */}
            {respectChartData && (
              <ChartSection title={t('strategies:strategyRespectPercentage')} tooltip={t('strategies:strategyRespectPercentageTooltip')}>
                <LazyChart height="h-64 sm:h-72 md:h-80">
                  <Bar data={respectChartData} options={respectChartOptions} />
                </LazyChart>
              </ChartSection>
            )}

            {/* Graphique 2: Taux de réussite si respect de la stratégie */}
            {successRateData && (
              <ChartSection title={t('strategies:successRateByStrategyRespect')} tooltip={t('strategies:successRateByStrategyRespectTooltip')}>
                <LazyChart height="h-64 sm:h-72 md:h-80">
                  <Bar data={successRateData} options={successRateOptions} />
                </LazyChart>
              </ChartSection>
            )}

            {/* Graphique 3: Distribution des sessions gagnantes */}
            {winningSessionsData && (
              <ChartSection title={t('strategies:winningSessionsDistribution')} tooltip={t('strategies:winningSessionsDistributionTooltip')}>
                <LazyChart height="h-64 sm:h-72 md:h-80">
                  <Bar data={winningSessionsData} options={winningSessionsOptions} />
                </LazyChart>
              </ChartSection>
            )}

            {/* Graphique 4: Émotions dominantes */}
            {emotionsData && (
              <EmotionsChart
                data={emotionsData}
                options={emotionsOptions}
                formatNumber={formatNumber}
                t={t}
              />
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 text-center text-gray-600 dark:text-gray-400">
            <p className="text-sm sm:text-base">{t('strategies:noDataForPeriod')}</p>
          </div>
        )}

        {/* Graphiques de compliance et évolution (rendu progressif) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
          {(isLoading && !complianceSectionData) ? (
            <>
              <ChartSkeleton 
                height="h-64 sm:h-80 md:h-96" 
                title={t('strategies:complianceByWeekday', { defaultValue: 'Respect de la stratégie par jour de la semaine' })} 
              />
              <ChartSkeleton 
                height="h-64 sm:h-80 md:h-96" 
                title={t('strategies:compliance.evolution')} 
              />
            </>
          ) : (
            <>
              {/* Graphique: Compliance par jour de la semaine */}
              {weekdayComplianceData ? (
                <ChartSection 
                  title={t('strategies:complianceByWeekday', { defaultValue: 'Respect de la stratégie par jour de la semaine' })}
                  tooltip={t('strategies:complianceByWeekdayTooltip', { defaultValue: 'Taux de respect moyen pour chaque jour de la semaine. Les jours en bleu sont ceux où vous respectez le mieux votre stratégie, les jours en rose sont ceux à améliorer.' })}
                >
                  <LazyChart height="h-64 sm:h-80 md:h-96">
                    <MixedChart
                      type="bar"
                      data={weekdayComplianceData}
                      options={weekdayComplianceOptions}
                    />
                  </LazyChart>
                </ChartSection>
              ) : null}

              {/* Graphique: Évolution du taux de respect */}
              <EvolutionChart
                data={evolutionData}
                options={evolutionOptions}
                selectedAccount={selectedAccount}
                t={t}
              />
            </>
          )}
        </div>
      </div>

      <ImportTradesModal open={showImport} onClose={(done) => {
        setShowImport(false);
        if (done) {
          // Recharger toutes les données après un import réussi
          loadAllData();
          // Recharger aussi les trades pour mettre à jour les soldes et les graphiques
          reloadTrades();
        }
      }} />
    </div>
  );
};

export default StrategiesPage;
