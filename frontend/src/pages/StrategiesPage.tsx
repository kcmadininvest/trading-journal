import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ImportTradesModal } from '../components/trades/ImportTradesModal';
import { AccountSelector } from '../components/accounts/AccountSelector';
import { useAccountNumberVisibility } from '../hooks/useAccountNumberVisibility';
import { PeriodSelector, PeriodRange } from '../components/common/PeriodSelector';
import { RespectRateCard } from '../components/common/RespectRateCard';
import { PerformanceComparison } from '../components/strategy/PerformanceComparison';
import { StrategyBadges } from '../components/strategy/StrategyBadges';
import { StrategyStatsTradingMetricsCard } from '../components/strategy/StrategyStatsTradingMetricsCard';
import { StrategyStatsDisciplineOverviewCard } from '../components/strategy/StrategyStatsDisciplineOverviewCard';
import { TabsFilter } from '../components/common/TabsFilter';
import { tradeStrategiesService } from '../services/tradeStrategies';
import { tradingAccountsService, TradingAccount } from '../services/tradingAccounts';
import { currenciesService, Currency } from '../services/currencies';
import { PositionStrategyFilterField } from '../components/common/PositionStrategyPillBar';
import { usePositionStrategiesForFilter } from '../hooks/usePositionStrategiesForFilter';
import { useTheme } from '../hooks/useTheme';
import { usePreferences } from '../hooks/usePreferences';
import { usePrivacySettings } from '../hooks/usePrivacySettings';
import { useWindowSize } from '../hooks/useWindowSize';
import { useStrategyTrades } from '../hooks/useStrategyTrades';
import { useStrategyCharts } from '../hooks/useStrategyCharts';
import { useComplianceAggregation } from '../hooks/useComplianceAggregation';
import { useWeekdayCompliance } from '../hooks/useWeekdayCompliance';
import { useChartOptions } from '../hooks/useChartOptions';
import { PageShell } from '../components/layout';
import { formatNumber as formatNumberUtil } from '../utils/numberFormat';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { formatDate, getMonthName } from '../utils/dateFormat';
import { useTradingAccount } from '../contexts/TradingAccountContext';
import { useComplianceRefresh } from '../contexts/ComplianceRefreshContext';
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
import { usePeriodDateRange } from '../hooks/usePeriodDateRange';

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
  const hideAccountNumber = useAccountNumberVisibility();
  const { refreshCount } = useComplianceRefresh();
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

  // Libellés du graphique discipline : mois localisés (YYYY-MM) ou jour selon date_format / timezone
  const formatStrategyChartPeriod = useCallback(
    (row: { period: string; date?: string }): string => {
      const { period, date } = row;
      const monthMatch = period.match(/^(\d{4})-(\d{2})$/);
      if (monthMatch) {
        const year = parseInt(monthMatch[1], 10);
        const month = parseInt(monthMatch[2], 10);
        const monthName = getMonthName(month, currentLanguage);
        const capitalizedMonthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        return `${capitalizedMonthName} ${year}`;
      }
      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return formatDate(date, preferences.date_format, false, preferences.timezone);
      }
      return period;
    },
    [currentLanguage, preferences.date_format, preferences.timezone]
  );

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
  const [selectedPositionStrategy, setSelectedPositionStrategy] = useState<number | null>(null);
  const { strategies: positionStrategies, loading: loadingStrategies } = usePositionStrategiesForFilter();
  
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

  const { startDate: summaryStartDate, endDate: summaryEndDate } = usePeriodDateRange({
    selectedPeriod,
    selectedYear,
    selectedMonth,
  });

  // Générer les années disponibles (année en cours et 5 ans précédents)

  // Fonction pour obtenir le label d'une émotion traduit
  const getEmotionLabel = useCallback((emotion: string): string => {
    return t(`strategies:emotions.${emotion}` as any, { defaultValue: emotion });
  }, [t]);

  // Fonction unifiée pour charger toutes les données en parallèle
  const loadAllData = useCallback(async () => {
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
        positionStrategy?: number;
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
      
      if (selectedPositionStrategy) {
        params.positionStrategy = selectedPositionStrategy;
      }
      
      // Paralléliser TOUS les appels API y compris dashboard summary
      const dashboardFilters: any = {};
      if (accountId) dashboardFilters.trading_account = accountId;
      if (summaryStartDate) dashboardFilters.start_date = summaryStartDate;
      if (summaryEndDate) dashboardFilters.end_date = summaryEndDate;
      if (selectedPositionStrategy) dashboardFilters.position_strategy = selectedPositionStrategy;

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
  }, [selectedPeriod, selectedYear, selectedMonth, accountId, summaryStartDate, summaryEndDate, selectedPositionStrategy, t]);

  useEffect(() => {
    // Attendre que le compte soit chargé avant de charger les données
    if (accountLoading) {
      return;
    }
    loadAllData();
  }, [loadAllData, accountLoading]);

  // Se mettre à jour quand une compliance est sauvegardée/supprimée (via ComplianceRefreshContext)
  // On mémorise la valeur de refreshCount au montage pour ne réagir qu'aux changements post-montage
  const mountedRefreshCount = useRef(refreshCount);
  useEffect(() => {
    if (refreshCount === mountedRefreshCount.current) return;
    loadAllData();
    reloadTrades();
  }, [refreshCount]); // eslint-disable-line react-hooks/exhaustive-deps


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
    formatStrategyChartPeriod,
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
    formatStrategyChartPeriod,
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
    <PageShell>
      <div className="flex flex-col">
        {/* Filtres */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex min-w-0 flex-col lg:flex-row lg:items-end gap-4">
            {/* Compte de trading : largeur au contenu comme Dashboard / Analytics (évite lg:w-64 qui tronquait) */}
            <div className="w-full min-w-0 lg:w-auto lg:flex-shrink-0">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('strategies:tradingAccount')}
              </label>
              <AccountSelector value={accountId} onChange={setAccountId} hideLabel hideAccountNumber={hideAccountNumber} />
            </div>
            
            {/* Sélecteur de période — largeur au contenu (aligné Dashboard / Analytics) */}
            <div className="w-full lg:w-auto lg:flex-shrink-0">
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
            
            <PositionStrategyFilterField
              className="w-full lg:min-w-0 lg:flex-1 lg:max-w-sm"
              label={t('strategies:positionStrategy', { defaultValue: 'Stratégie de position' })}
              value={selectedPositionStrategy}
              onChange={setSelectedPositionStrategy}
              strategies={positionStrategies}
              loading={loadingStrategies}
            />
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

        {/* Onglets pour organiser le contenu */}
        <TabsFilter
          tabs={[
            {
              id: 'stats',
              label: t('strategies:tabs.stats'),
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" 
                  />
                </svg>
              ),
              content: (
                <div className="flex flex-col gap-4 sm:gap-6">
                  {/* Indicateurs de respect */}
                  {statistics && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                      {/* Colonne 1: All periods */}
                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide px-1">
                          {t('strategies:allPeriods', { defaultValue: 'All periods' })}
                        </h3>
                        
                        {/* Account respect rate */}
                        <RespectRateCard
                          title={t('strategies:accountRespectRate')}
                          subtitle=""
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
                        />
                        
                        {/* All accounts combined */}
                        <RespectRateCard
                          title={t('strategies:combinedAccountRespectRate')}
                          subtitle=""
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
                        />
                      </div>

                      {/* Colonne 2: Selected period */}
                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide px-1">
                          {t('strategies:selectedPeriod', { defaultValue: 'Selected period' })}
                        </h3>
                        
                        {/* Account respect rate */}
                        <RespectRateCard
                          title={t('strategies:accountRespectRate')}
                          subtitle=""
                          percentage={accountPeriodRespect}
                          tradesCount={statistics?.statistics?.period?.respected_count || 0}
                          totalTrades={statistics?.statistics?.period?.total_trades || 0}
                          totalDays={statistics?.statistics?.period?.total_days}
                          totalTradesInDays={statistics?.statistics?.period?.total_trades_in_days}
                          tradesLabel={t('trades:trades')}
                          daysLabel={t('strategies:days', { defaultValue: 'jours' })}
                          ofWhichLabel={t('strategies:ofWhich', { defaultValue: 'dont' })}
                          outOfLabel={t('strategies:outOf')}
                          gradientColors={accountPeriodRespectColor}
                        />
                        
                        {/* All accounts combined */}
                        <RespectRateCard
                          title={t('strategies:combinedAccountRespectRate')}
                          subtitle=""
                          percentage={periodRespect}
                          tradesCount={statistics?.period?.respected_count || 0}
                          totalTrades={statistics?.period?.total_trades || 0}
                          totalDays={statistics?.period?.total_days}
                          totalTradesInDays={statistics?.period?.total_trades_in_days}
                          tradesLabel={t('trades:trades')}
                          daysLabel={t('strategies:days', { defaultValue: 'jours' })}
                          ofWhichLabel={t('strategies:ofWhich', { defaultValue: 'dont' })}
                          outOfLabel={t('strategies:outOf')}
                          gradientColors={periodRespectColor}
                        />
                      </div>
                    </div>
                  )}

                  {/* Discipline & Stratégie — grille 2×2 alignée (Impact, Badges, métriques, discipline) */}
                  {(complianceSectionData || complianceSectionLoading) && (
                    <div>
                      {complianceSectionData ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:items-stretch">
                          <PerformanceComparison
                            performanceComparison={complianceSectionData.performance_comparison}
                            currencySymbol={currencySymbol}
                            hideProfitLoss={privacySettings.hideProfitLoss}
                          />
                          <StrategyBadges badges={complianceSectionData.badges || []} />
                          <StrategyStatsTradingMetricsCard
                            performanceComparison={complianceSectionData.performance_comparison}
                          />
                          <StrategyStatsDisciplineOverviewCard
                            compliance={complianceSectionData}
                            periodEnd={selectedPeriod?.end ?? null}
                          />
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                          <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700 min-h-80 animate-pulse" />
                          <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700 min-h-80 animate-pulse" />
                          <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700 min-h-80 animate-pulse" />
                          <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700 min-h-80 animate-pulse" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            },
            {
              id: 'charts',
              label: t('strategies:tabs.charts'),
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" 
                  />
                </svg>
              ),
              content: (
                <div className="flex flex-col gap-4 sm:gap-6">
                  {/* Graphiques principaux */}
                  {isLoading ? (
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

                  {/* Graphiques de compliance et évolution */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    {(isLoading || complianceSectionLoading) ? (
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
              )
            }
          ]}
          defaultTab="stats"
          storageKey="strategies-active-tab"
        />
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
    </PageShell>
  );
};

export default StrategiesPage;
