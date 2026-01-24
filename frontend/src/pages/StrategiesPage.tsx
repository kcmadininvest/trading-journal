import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ImportTradesModal } from '../components/trades/ImportTradesModal';
import { AccountSelector } from '../components/accounts/AccountSelector';
import { PeriodSelector, PeriodRange } from '../components/common/PeriodSelector';
import { RespectRateCard } from '../components/common/RespectRateCard';
import { tradeStrategiesService } from '../services/tradeStrategies';
import { tradesService, TradeListItem } from '../services/trades';
import { tradingAccountsService, TradingAccount } from '../services/tradingAccounts';
import { currenciesService, Currency } from '../services/currencies';
import Tooltip from '../components/ui/Tooltip';
import { useTheme } from '../hooks/useTheme';
import { usePreferences } from '../hooks/usePreferences';
import { formatNumber as formatNumberUtil } from '../utils/numberFormat';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { getMonthName } from '../utils/dateFormat';
import { useTradingAccount } from '../contexts/TradingAccountContext';
import { useAccountIndicators } from '../hooks/useAccountIndicators';
import { AccountIndicatorsGrid } from '../components/common/AccountIndicatorsGrid';
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
import type { ChartData } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar as ChartBar, Doughnut as ChartDoughnut, Line as ChartLine, Chart as ChartComponent } from 'react-chartjs-2';

const Bar = ChartBar;
const Doughnut = ChartDoughnut;
const Line = ChartLine;
const MixedChart = ChartComponent;

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

// Composant Skeleton pour les graphiques en chargement
const ChartSkeleton: React.FC<{ height?: string; title?: string }> = ({ 
  height = 'h-64 sm:h-72 md:h-80', 
  title 
}) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 md:p-6">
    <div className="animate-pulse">
      {/* Titre du graphique */}
      {title && (
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <div className="h-5 sm:h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0"></div>
        </div>
      )}
      {/* Zone du graphique */}
      <div className={`${height} bg-gray-100 dark:bg-gray-700/50 rounded flex items-center justify-center`}>
        <div className="space-y-3 w-full px-4">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/6"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
        </div>
      </div>
    </div>
  </div>
);

type WeekdayComplianceChartData = {
  chartData: ChartData<'bar' | 'line', number[], string>;
  dayStats: Array<{
    day: string;
    dayIndex: number;
    rate: number;
    count: number;
    total: number;
  }>;
  avgRate: number;
};

const StrategiesPage: React.FC = () => {
  const { theme } = useTheme();
  const { preferences } = usePreferences();
  const { t, i18n } = useI18nTranslation();
  const isDark = theme === 'dark';
  const { selectedAccountId: accountId, setSelectedAccountId: setAccountId, loading: accountLoading } = useTradingAccount();
  
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
  const chartColors = useMemo(() => ({
    text: isDark ? '#d1d5db' : '#374151',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    background: isDark ? '#1f2937' : '#ffffff',
    grid: isDark ? '#374151' : '#e5e7eb',
    border: isDark ? '#4b5563' : '#d1d5db',
    tooltipBg: isDark ? '#374151' : '#ffffff',
    tooltipTitle: isDark ? '#d1d5db' : '#4b5563',
    tooltipBody: isDark ? '#f3f4f6' : '#1f2937',
    tooltipBorder: isDark ? '#4b5563' : '#e5e7eb',
  }), [isDark]);
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
  const [allTrades, setAllTrades] = useState<TradeListItem[]>([]);
  const [filteredTrades, setFilteredTrades] = useState<TradeListItem[]>([]);
  const [allAccountsCompliance, setAllAccountsCompliance] = useState<any>(null);
  const [selectedAccountCompliance, setSelectedAccountCompliance] = useState<any>(null);
  const [loadingAllAccountsCompliance, setLoadingAllAccountsCompliance] = useState(false);
  const [loadingSelectedAccountCompliance, setLoadingSelectedAccountCompliance] = useState(false);

  // Cache pour les données chargées (optimisation pour les changements de compte/période fréquents)
  const dataCache = useRef<Map<string, {
    statistics: any;
    allAccountsCompliance: any;
    selectedAccountCompliance: any;
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
      return;
    }
    
    setIsLoading(true);
    setLoadingAllAccountsCompliance(true);
    setLoadingSelectedAccountCompliance(true);
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
      
      // Paralléliser tous les appels API
      const [statisticsData, allAccountsComplianceData, selectedAccountComplianceData] = 
        await Promise.all([
          // Appel 1: Statistics
          tradeStrategiesService.statistics(params),
          // Appel 2: Compliance tous comptes
          tradeStrategiesService.strategyComplianceStats(undefined),
          // Appel 3: Compliance compte sélectionné (si applicable)
          accountId ? tradeStrategiesService.strategyComplianceStats(accountId) : Promise.resolve(null)
        ]);
      
      // Stocker dans le cache
      dataCache.current.set(cacheKey, {
        statistics: statisticsData,
        allAccountsCompliance: allAccountsComplianceData,
        selectedAccountCompliance: selectedAccountComplianceData,
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
    } catch (err: any) {
      setError(err.message || t('strategies:errorLoadingStatistics'));
      console.error('Erreur lors du chargement des données:', err);
    } finally {
      setIsLoading(false);
      setLoadingAllAccountsCompliance(false);
      setLoadingSelectedAccountCompliance(false);
    }
  }, [getCacheKey, selectedPeriod, selectedYear, selectedMonth, accountId, t]);

  // Charger toutes les données
  useEffect(() => {
    // Attendre que le compte soit chargé avant de charger les données
    if (accountLoading) {
      return;
    }
    loadAllData();
  }, [loadAllData, accountLoading]);

  // État de chargement global : toutes les données sont chargées
  const allDataLoaded = useMemo(() => {
    return !isLoading && 
           !loadingAllAccountsCompliance && 
           !loadingSelectedAccountCompliance && 
           statistics !== null && 
           (allAccountsCompliance !== null || selectedAccountCompliance !== null);
  }, [isLoading, loadingAllAccountsCompliance, loadingSelectedAccountCompliance, statistics, allAccountsCompliance, selectedAccountCompliance]);

  // Charger les devises
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

  // Charger le compte sélectionné
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

  // Fonction pour charger tous les trades du compte
  const loadAllTrades = useCallback(async () => {
    if (!accountId || accountLoading) {
      setAllTrades([]);
      return;
    }
    try {
      const response = await tradesService.list({
        trading_account: accountId,
        page_size: 10000, // Charger tous les trades
      });
      setAllTrades(response.results);
    } catch (err) {
      console.error('Erreur lors du chargement des trades', err);
      setAllTrades([]);
    }
  }, [accountId, accountLoading]);

  // Charger tous les trades du compte pour calculer le solde
  useEffect(() => {
    loadAllTrades();
  }, [loadAllTrades]);

  // Obtenir le symbole de la devise du compte sélectionné
  const currencySymbol = useMemo(() => {
    if (!selectedAccount?.currency) return '';
    const currency = currencies.find(c => c.code === selectedAccount.currency);
    return currency?.symbol || '';
  }, [selectedAccount, currencies]);

  // Fonction pour charger les trades filtrés par période
  const loadFilteredTrades = useCallback(async () => {
    if (!accountId || accountLoading) {
      setFilteredTrades([]);
      return;
    }
    try {
      const filters: any = {
        trading_account: accountId,
        page_size: 10000,
      };

      if (selectedPeriod) {
        filters.start_date = selectedPeriod.start;
        filters.end_date = selectedPeriod.end;
      } else if (selectedYear) {
        const startDate = selectedMonth 
          ? `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-01`
          : `${selectedYear}-01-01`;
        
        let endDate: string;
        if (selectedMonth) {
          const lastDay = new Date(selectedYear, selectedMonth, 0);
          endDate = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
        } else {
          endDate = `${selectedYear}-12-31`;
        }
        
        filters.start_date = startDate;
        filters.end_date = endDate;
      }

      const response = await tradesService.list(filters);
      setFilteredTrades(response.results);
    } catch (err) {
      console.error('Erreur lors du chargement des trades filtrés', err);
      setFilteredTrades([]);
    }
  }, [accountId, accountLoading, selectedPeriod, selectedYear, selectedMonth]);

  // Charger les trades filtrés par période pour calculer le meilleur/pire jour
  useEffect(() => {
    loadFilteredTrades();
  }, [loadFilteredTrades]);


  // Utiliser le hook pour calculer les indicateurs de compte de manière cohérente
  const indicators = useAccountIndicators({
    selectedAccount,
    allTrades,
    filteredTrades,
  });

  // Graphique 1: Respect de la stratégie en % (graphique en barres groupées)
  // Pour chaque période (mois ou jour), afficher les deux barres côte à côte
  const respectChartData = useMemo(() => {
    // Guard: éviter le calcul pendant le chargement
    if (isLoading || !allDataLoaded) return null;
    if (!statistics?.statistics?.period_data || statistics.statistics.period_data.length === 0) return null;
    
    // Filtrer les périodes avec des données (total_with_strategy > 0 ou total > 0)
    const periodsWithData = statistics.statistics.period_data.filter((d: any) => 
      (d.total_with_strategy && d.total_with_strategy > 0) || (d.total && d.total > 0)
    );
    
    if (periodsWithData.length === 0) return null;
    
    // Enrichir les données avec les informations nécessaires pour les tooltips
    const enrichedData = periodsWithData.map((d: any) => {
      const totalTrades = d.total || 0;
      const totalWithStrategy = d.total_with_strategy || totalTrades; // Utiliser la valeur du backend si disponible
      const respectPercentage = d.respect_percentage || 0;
      const notRespectPercentage = d.not_respect_percentage || 0;
      
      // Utiliser les valeurs du backend si disponibles, sinon calculer
      const respectedCount = d.respected_count !== undefined ? d.respected_count : Math.round((respectPercentage / 100) * totalWithStrategy);
      const notRespectedCount = d.not_respected_count !== undefined ? d.not_respected_count : Math.round((notRespectPercentage / 100) * totalWithStrategy);
      const daysWithoutTrades = Math.max(0, totalWithStrategy - totalTrades);
      
    return {
        ...d,
        totalWithStrategy,
        daysWithoutTrades,
        respectedCount,
        notRespectedCount,
      };
    });
    
    return {
      labels: enrichedData.map((d: any) => formatPeriod(d.period)),
    datasets: [
      {
        label: t('strategies:respected'),
          data: enrichedData.map((d: any) => d.respect_percentage || 0),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: '#3b82f6',
        borderWidth: 0,
        borderRadius: 0,
      },
      {
        label: t('strategies:notRespected'),
          data: enrichedData.map((d: any) => d.not_respect_percentage || 0),
        backgroundColor: 'rgba(236, 72, 153, 0.8)',
        borderColor: '#ec4899',
        borderWidth: 0,
        borderRadius: 0,
      },
    ],
      enrichedData, // Stocker les données enrichies pour les tooltips
  };
  }, [isLoading, allDataLoaded, statistics?.statistics?.period_data, t, formatPeriod]);

  const respectChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      datalabels: {
        display: true,
        color: '#ffffff',
        font: {
          weight: 600,
          size: window.innerWidth < 640 ? 10 : 13,
        },
        formatter: function(value: number) {
          return value > 0 ? formatNumber(value, 1) + '%' : '';
        },
        anchor: 'center' as const,
        align: 'center' as const,
      },
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: window.innerWidth < 640 ? 12 : 20,
          font: {
            size: window.innerWidth < 640 ? 10 : 12
          },
          color: chartColors.textSecondary,
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: chartColors.tooltipBg,
        titleColor: chartColors.tooltipTitle,
        bodyColor: chartColors.tooltipBody,
        borderColor: chartColors.tooltipBorder,
        borderWidth: 1,
        padding: 16,
        titleFont: {
          size: 14,
          weight: 600,
        },
        bodyFont: {
          size: 13,
          weight: 500,
        },
        displayColors: false,
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          title: function(context: any) {
            const period = statistics?.statistics?.period_data?.[context[0].dataIndex]?.period || '';
            return formatPeriod(period);
          },
          label: function(context: any) {
            const label = context.dataset.label || '';
            const value = context.parsed.y || 0;
            const enrichedData = (respectChartData as any)?.enrichedData;
            const periodData = enrichedData?.[context.dataIndex];
            
            if (!periodData) {
              // Fallback si les données enrichies ne sont pas disponibles
              const fallbackData = statistics?.statistics?.period_data?.[context.dataIndex];
              const totalTrades = fallbackData?.total || 0;
              const count = Math.round((value / 100) * totalTrades);
              return `${label}: ${formatNumber(value, 2)}% (${count} ${t('strategies:trades')} ${t('strategies:on', { defaultValue: 'sur' })} ${totalTrades})`;
            }
            
            const isRespected = label === t('strategies:respected');
            const count = isRespected ? periodData.respectedCount : periodData.notRespectedCount;
            const totalTrades = periodData.total || 0;
            const totalWithStrategy = periodData.totalWithStrategy || totalTrades;
            const daysWithoutTrades = periodData.daysWithoutTrades || 0;
            
            // Calculer la répartition entre trades et jours sans trades
            // Si count <= totalTrades, tous sont des trades
            // Sinon, il y a des jours sans trades dans le count
            let elementTrades = 0;
            let elementDays = 0;
            
            if (count <= totalTrades) {
              // Tous les éléments respectés/non respectés sont des trades
              elementTrades = count;
              elementDays = 0;
            } else {
              // Il y a des jours sans trades dans le count
              elementDays = Math.min(count - totalTrades, daysWithoutTrades);
              elementTrades = count - elementDays;
            }
            
            // Afficher le tooltip avec les informations détaillées
            // Utiliser totalWithStrategy pour le dénominateur car c'est ce qui est utilisé pour le calcul du pourcentage
            if (elementDays > 0) {
              return `${label}: ${formatNumber(value, 2)}% (${elementTrades} ${t('strategies:trades')} + ${elementDays} ${elementDays === 1 ? 'jour sans trade' : 'jours sans trades'} ${t('strategies:on', { defaultValue: 'sur' })} ${totalWithStrategy})`;
            } else {
              return `${label}: ${formatNumber(value, 2)}% (${elementTrades} ${t('strategies:trades')} ${t('strategies:on', { defaultValue: 'sur' })} ${totalWithStrategy})`;
            }
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        stacked: true,
        max: 100,
        ticks: {
          callback: function(value: any) {
            return value + '%';
          },
          color: chartColors.textSecondary,
          font: {
            size: window.innerWidth < 640 ? 10 : 12,
          },
        },
        grid: {
          color: chartColors.grid,
          lineWidth: 1,
        },
        border: {
          color: chartColors.border,
          display: false,
        },
        title: {
          display: false,
        },
      },
      x: {
        stacked: true,
        ticks: {
          color: chartColors.textSecondary,
          font: {
            size: window.innerWidth < 640 ? 10 : 12,
          },
        },
        grid: {
          color: chartColors.grid,
          lineWidth: 1,
        },
        border: {
          color: chartColors.border,
        },
        title: {
          display: false,
        },
      },
    },
  }), [statistics?.statistics?.period_data, respectChartData, t, chartColors, formatNumber, formatPeriod]);

  // Graphique 2: Taux de réussite selon respect de la stratégie
  const successRateData = useMemo(() => {
    // Guard: éviter le calcul pendant le chargement
    if (isLoading || !allDataLoaded) return null;
    if (!statistics?.statistics) return null;
    // Vérifier qu'il y a des statistiques significatives
    const hasData = statistics.statistics.total_strategies > 0;
    if (!hasData) return null;
    
    return {
    labels: [t('strategies:successRateByStrategyRespect')],
    datasets: [
      {
        label: t('strategies:ifStrategyRespected'),
        data: [statistics.statistics.success_rate_if_respected || 0],
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: '#3b82f6',
        borderWidth: 0,
        borderRadius: 0,
      },
      {
        label: t('strategies:ifStrategyNotRespected'),
        data: [statistics.statistics.success_rate_if_not_respected || 0],
        backgroundColor: 'rgba(236, 72, 153, 0.8)',
        borderColor: '#ec4899',
        borderWidth: 0,
        borderRadius: 0,
      },
    ],
  };
  }, [isLoading, allDataLoaded, statistics?.statistics, t]);

  const successRateOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      datalabels: {
        display: true,
        color: '#ffffff',
        font: {
          weight: 600,
          size: window.innerWidth < 640 ? 10 : 13,
        },
        formatter: function(value: number) {
          // Afficher la valeur avec le symbole %
          return value > 0 ? `${formatNumber(value, 2)}%` : '';
        },
      },
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: window.innerWidth < 640 ? 12 : 20,
          font: {
            size: window.innerWidth < 640 ? 10 : 12
          },
          color: chartColors.textSecondary,
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: chartColors.tooltipBg,
        titleColor: chartColors.tooltipTitle,
        bodyColor: chartColors.tooltipBody,
        borderColor: chartColors.tooltipBorder,
        borderWidth: 1,
        padding: 16,
        titleFont: {
          size: 14,
          weight: 600,
        },
        bodyFont: {
          size: 13,
          weight: 500,
        },
        displayColors: false,
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: function(context: any) {
            const label = context.dataset.label || '';
            const value = context.parsed.y || 0;
            return `${label}: ${formatNumber(value, 2)}%`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value: any) {
            return value + '%';
          },
          color: chartColors.textSecondary,
          font: {
            size: window.innerWidth < 640 ? 10 : 12,
          },
        },
        grid: {
          color: chartColors.grid,
          lineWidth: 1,
        },
        border: {
          color: chartColors.border,
          display: false,
        },
        title: {
          display: false,
        },
      },
      x: {
        title: {
          display: false,
        },
        ticks: {
          color: chartColors.textSecondary,
          font: {
            size: window.innerWidth < 640 ? 10 : 12,
          },
        },
        grid: {
          color: chartColors.grid,
          lineWidth: 1,
        },
        border: {
          color: chartColors.border,
        },
      },
    },
  }), [chartColors, formatNumber]);

  // Graphique 3: Répartition des sessions gagnantes selon TP1 et TP2+
  const winningSessionsData = useMemo(() => {
    // Guard: éviter le calcul pendant le chargement
    if (isLoading || !allDataLoaded) return null;
    if (!statistics?.statistics?.winning_sessions_distribution) return null;
    // Vérifier qu'il y a au moins une session gagnante
    const dist = statistics.statistics.winning_sessions_distribution;
    const hasData = (dist.tp1_only || 0) + (dist.tp2_plus || 0) + (dist.no_tp || 0) > 0;
    if (!hasData) return null;
    
    return {
    labels: [t('strategies:tp1Only'), t('strategies:tp2Plus'), t('strategies:noTp')],
    datasets: [
      {
        label: t('strategies:numberOfWinningSessions'),
        data: [
          statistics.statistics.winning_sessions_distribution.tp1_only,
          statistics.statistics.winning_sessions_distribution.tp2_plus,
          statistics.statistics.winning_sessions_distribution.no_tp,
        ],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(249, 115, 22, 0.8)',
          'rgba(156, 163, 175, 0.8)',
        ],
        borderColor: [
          '#3b82f6',
          '#f97316',
          '#9ca3af',
        ],
        borderWidth: 0,
        borderRadius: 0,
      },
    ],
  };
  }, [isLoading, allDataLoaded, statistics?.statistics?.winning_sessions_distribution, t]);

  // Calculer la valeur maximale pour l'axe Y avec marge
  const winningSessionsMax = useMemo(() => statistics?.statistics?.winning_sessions_distribution ? (() => {
    const values = [
      statistics.statistics.winning_sessions_distribution.tp1_only,
      statistics.statistics.winning_sessions_distribution.tp2_plus,
      statistics.statistics.winning_sessions_distribution.no_tp,
    ];
    const maxValue = Math.max(...values);
    // Ajouter 15% de marge en haut
    return Math.ceil(maxValue * 1.15);
  })() : undefined, [statistics?.statistics?.winning_sessions_distribution]);

  const winningSessionsOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      datalabels: {
        display: true,
        color: '#ffffff',
        font: {
          weight: 600,
          size: window.innerWidth < 640 ? 10 : 13,
        },
        formatter: function(value: number) {
          return value > 0 ? value.toString() : '';
        },
        anchor: 'center' as const,
        align: 'center' as const,
      },
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: chartColors.text,
          usePointStyle: true,
          padding: 16,
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: chartColors.tooltipBg,
        titleColor: chartColors.tooltipTitle,
        bodyColor: chartColors.tooltipBody,
        borderColor: chartColors.tooltipBorder,
        borderWidth: 1,
        padding: 16,
        titleFont: {
          size: 14,
          weight: 600,
        },
        bodyFont: {
          size: 13,
          weight: 500,
        },
        displayColors: false,
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          title: function(context: any) {
            return context[0].label || '';
          },
          label: function(context: any) {
            const label = context.dataset.label || '';
            const value = context.parsed.y || 0;
            const total = statistics?.statistics?.winning_sessions_distribution?.total_winning || 1;
            const percentage = total > 0 ? (value / total) * 100 : 0;
            return `${label}: ${value} (${formatNumber(percentage, 1)}%)`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        stacked: false,
        max: winningSessionsMax,
        ticks: {
          stepSize: 1,
          color: chartColors.textSecondary,
          font: {
            size: 12,
          },
        },
        grid: {
          color: chartColors.grid,
          lineWidth: 1,
        },
        border: {
          color: chartColors.border,
          display: false,
        },
        title: {
          display: true,
          text: t('strategies:numberOfWinningSessions'),
          color: chartColors.text,
          font: {
            size: window.innerWidth < 640 ? 11 : 13,
            weight: 600,
          },
        },
      },
      x: {
        stacked: false,
        ticks: {
          color: chartColors.textSecondary,
          font: {
            size: window.innerWidth < 640 ? 10 : 12,
          },
        },
        grid: {
          color: chartColors.grid,
          lineWidth: 1,
        },
        border: {
          color: chartColors.border,
        },
        title: {
          display: false,
        },
      },
    },
  }), [statistics?.statistics?.winning_sessions_distribution, winningSessionsMax, t, chartColors, formatNumber]);

  // Graphique 4: Répartition des émotions dominantes (camembert)
  const generateColors = (count: number) => {
    const baseColors = [
      { bg: 'rgba(59, 130, 246, 0.8)', border: 'rgb(59, 130, 246)' },   // blue
      { bg: 'rgba(34, 197, 94, 0.8)', border: 'rgb(34, 197, 94)' },    // green
      { bg: 'rgba(239, 68, 68, 0.8)', border: 'rgb(239, 68, 68)' },    // red
      { bg: 'rgba(251, 191, 36, 0.8)', border: 'rgb(251, 191, 36)' },   // yellow
      { bg: 'rgba(168, 85, 247, 0.8)', border: 'rgb(168, 85, 247)' },   // purple
      { bg: 'rgba(236, 72, 153, 0.8)', border: 'rgb(236, 72, 153)' },   // pink
      { bg: 'rgba(20, 184, 166, 0.8)', border: 'rgb(20, 184, 166)' },   // teal
      { bg: 'rgba(249, 115, 22, 0.8)', border: 'rgb(249, 115, 22)' },   // orange
      { bg: 'rgba(6, 182, 212, 0.8)', border: 'rgb(6, 182, 212)' },    // cyan
      { bg: 'rgba(132, 204, 22, 0.8)', border: 'rgb(132, 204, 22)' },   // lime
      { bg: 'rgba(234, 179, 8, 0.8)', border: 'rgb(234, 179, 8)' },    // amber
      { bg: 'rgba(225, 29, 72, 0.8)', border: 'rgb(225, 29, 72)' },    // rose
      { bg: 'rgba(139, 92, 246, 0.8)', border: 'rgb(139, 92, 246)' },   // violet
      { bg: 'rgba(14, 165, 233, 0.8)', border: 'rgb(14, 165, 233)' },   // sky
      { bg: 'rgba(5, 150, 105, 0.8)', border: 'rgb(5, 150, 105)' },    // emerald
      { bg: 'rgba(217, 119, 6, 0.8)', border: 'rgb(217, 119, 6)' },    // amber
      { bg: 'rgba(190, 24, 93, 0.8)', border: 'rgb(190, 24, 93)' },    // fuchsia
      { bg: 'rgba(99, 102, 241, 0.8)', border: 'rgb(99, 102, 241)' },   // indigo
    ];
    
    // Répéter les couleurs si nécessaire
    const colors: string[] = [];
    const borders: string[] = [];
    for (let i = 0; i < count; i++) {
      const color = baseColors[i % baseColors.length];
      colors.push(color.bg);
      borders.push(color.border);
    }
    return { backgroundColor: colors, borderColor: borders };
  };

  const emotionsData = useMemo(() => {
    // Guard: éviter le calcul pendant le chargement
    if (isLoading || !allDataLoaded) return null;
    return statistics?.statistics?.emotions_distribution ? (() => {
      // Trier les émotions par fréquence (décroissant)
      const sortedEmotions = [...statistics.statistics.emotions_distribution]
        .sort((a: any, b: any) => b.count - a.count);
    
    // Prendre les 5 premières émotions
    const top5Emotions = sortedEmotions.slice(0, 5);
    const otherEmotions = sortedEmotions.slice(5);
    
    // Calculer le total des autres émotions
    const othersCount = otherEmotions.reduce((sum: number, e: any) => sum + e.count, 0);
    
    // Construire les labels et données
    const labels = top5Emotions.map((e: any) => getEmotionLabel(e.emotion));
    const data = top5Emotions.map((e: any) => e.count);
    
    // Ajouter "Autres" si nécessaire
    if (othersCount > 0) {
      labels.push(t('strategies:others'));
      data.push(othersCount);
    }
    
    const colors = generateColors(labels.length);
    
    // Calculer le total pour les pourcentages
    const total = sortedEmotions.reduce((sum: number, e: any) => sum + e.count, 0);
    
    return {
      labels,
      data,
      datasets: [
        {
          label: t('strategies:numberOfOccurrences'),
          data,
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
          borderWidth: 0,
        },
      ],
      total, // Stocker le total pour les calculs de pourcentage
      totalEmotions: sortedEmotions.length, // Nombre total d'émotions différentes
      topEmotion: top5Emotions.length > 0 ? {
        label: getEmotionLabel(top5Emotions[0].emotion),
        count: top5Emotions[0].count,
        percentage: total > 0 ? (top5Emotions[0].count / total) * 100 : 0,
      } : null, // Émotion la plus fréquente
      colors: colors, // Stocker les couleurs pour la légende
    };
    })() : null;
  }, [isLoading, allDataLoaded, statistics?.statistics?.emotions_distribution, getEmotionLabel, t]);

  const emotionsOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 10,
        bottom: 10,
        left: 10,
        right: 10,
      },
    },
    plugins: {
      datalabels: {
        display: function(context: any) {
          const value = context.dataset.data[context.dataIndex];
          const total = emotionsData?.total || 1;
          const percentage = total > 0 ? (value / total) * 100 : 0;
          // Masquer les labels des très petits segments (< 4%) pour éviter les superpositions
          // Ces informations seront disponibles dans le tooltip
          return percentage >= 4;
        },
        color: function(context: any) {
          const value = context.dataset.data[context.dataIndex];
          const total = emotionsData?.total || 1;
          const percentage = total > 0 ? (value / total) * 100 : 0;
          
          // Pour les petits segments, utiliser une couleur plus contrastée
          if (percentage < 10) {
            return isDark ? '#ffffff' : '#1f2937';
          }
          // Pour les grands segments, utiliser la couleur standard
          return isDark ? '#ffffff' : '#374151';
        },
        font: {
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          weight: 600,
          size: window.innerWidth < 640 ? 10 : window.innerWidth < 1024 ? 11 : 12,
        },
        formatter: function(value: number, context: any) {
          const label = context.chart.data.labels[context.dataIndex] || '';
          const total = emotionsData?.total || 1;
          const percentage = total > 0 ? (value / total) * 100 : 0;
          
          // Sur mobile, afficher seulement le pourcentage pour économiser l'espace
          if (window.innerWidth < 640) {
            return `${formatNumber(percentage, 1)}%`;
          }
          
          // Pour les petits segments (4-10%), afficher seulement le pourcentage
          if (percentage < 10) {
            return `${formatNumber(percentage, 1)}%`;
          }
          
          // Pour les segments moyens (10-20%), afficher label et pourcentage sur une ligne
          if (percentage < 20) {
            return `${label} ${formatNumber(percentage, 1)}%`;
          }
          
          // Pour les grands segments (> 20%), afficher label et pourcentage sur deux lignes
          return `${label}\n${formatNumber(percentage, 1)}%`;
        },
        anchor: function(context: any) {
          const value = context.dataset.data[context.dataIndex];
          const total = emotionsData?.total || 1;
          const percentage = total > 0 ? (value / total) * 100 : 0;
          
          // Pour les petits segments (< 10%), placer les labels au centre pour éviter les superpositions
          if (percentage < 10) {
            return 'center';
          }
          // Pour les segments moyens et grands, placer au centre aussi
          return 'center';
        },
        align: function(context: any) {
          // Toujours centrer pour éviter les problèmes de superposition
          return 'center';
        },
        offset: 0, // Pas d'offset pour garder les labels centrés
        clamp: false, // Permettre aux labels de dépasser légèrement si nécessaire
        clip: false,
        textShadow: false, // Désactiver l'ombre des datalabels
      },
      legend: {
        display: false, // Désactiver la légende car les infos sont dans les statistiques latérales
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: chartColors.tooltipBg,
        titleColor: chartColors.tooltipTitle,
        bodyColor: chartColors.tooltipBody,
        borderColor: chartColors.tooltipBorder,
        borderWidth: 1,
        padding: 16,
        titleFont: {
          size: 14,
          weight: 600,
        },
        bodyFont: {
          size: 13,
          weight: 500,
        },
        displayColors: false,
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = emotionsData?.total || 1;
            const percentage = total > 0 ? (value / total) * 100 : 0;
            return `${label}: ${value} (${formatNumber(percentage, 1)}%)`;
          },
        },
      },
    },
  }), [emotionsData, chartColors, formatNumber, isDark]);

  // Graphique 5: Évolution du taux de compliance (prend en compte le sélecteur de compte)
  const evolutionData = useMemo(() => {
    // Guard: éviter le calcul pendant le chargement
    if (isLoading || !allDataLoaded) return null;
    // Utiliser les données du compte sélectionné si disponible, sinon tous les comptes
    const complianceData = selectedAccountCompliance || allAccountsCompliance;
    if (!complianceData?.daily_compliance || complianceData.daily_compliance.length === 0) return null;
    
    const sortedData = [...complianceData.daily_compliance]
      .map((d: any) => {
        // Recalculer le compliance_rate pour gérer les jours sans trades mais avec compliance
        // Pour un jour sans trades (total = 0) mais avec compliance, respected + not_respected = 1
        // Le dénominateur doit être respected + not_respected (nombre de stratégies/compliances)
        const totalStrategies = (d.respected || 0) + (d.not_respected || 0);
        const complianceRate = totalStrategies > 0 
          ? ((d.respected || 0) / totalStrategies) * 100 
          : (d.compliance_rate || 0);
        
        return {
          ...d,
          compliance_rate: complianceRate,
          total_strategies: totalStrategies || d.total || 0, // Pour l'affichage dans les tooltips
          date: new Date(d.date),
        };
      })
      .sort((a: any, b: any) => 
        a.date.getTime() - b.date.getTime()
      );

    if (sortedData.length === 0) return null;

    // Déterminer le niveau d'agrégation selon le nombre de points
    const firstDate = sortedData[0].date;
    const lastDate = sortedData[sortedData.length - 1].date;
    const daysDiff = Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
    const dataPoints = sortedData.length;

    let aggregation: 'day' | 'week' | 'month' | 'year' = 'day';
    let groupKey: (date: Date) => string;
    let formatLabel: (date: Date) => string;
    let formatTooltipDate: (date: Date) => string;

    // Seuils optimisés pour éviter trop de points sur le graphique
    if (dataPoints > 365 || daysDiff > 730) {
      // Agréger par année si plus de 365 points ou plus de 2 ans
      aggregation = 'year';
      groupKey = (date: Date) => `${date.getFullYear()}`;
      formatLabel = (date: Date) => `${date.getFullYear()}`;
      formatTooltipDate = (date: Date) => {
        return date.toLocaleDateString('fr-FR', { year: 'numeric' });
      };
    } else if (dataPoints > 120 || daysDiff > 365) {
      // Agréger par mois si plus de 120 points ou plus d'un an
      aggregation = 'month';
      groupKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      formatLabel = (date: Date) => {
        const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
        return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      };
      formatTooltipDate = (date: Date) => {
        const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
        return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      };
    } else if (dataPoints > 60 || daysDiff > 90) {
      // Agréger par semaine si plus de 60 points ou plus de 90 jours
      aggregation = 'week';
      groupKey = (date: Date) => {
        // Obtenir le lundi de la semaine
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajuster pour lundi = 1
        const monday = new Date(d);
        monday.setDate(diff);
        monday.setHours(0, 0, 0, 0);
        return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      };
      formatLabel = (date: Date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d);
        monday.setDate(diff);
        return monday.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      };
      formatTooltipDate = (date: Date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d);
        monday.setDate(diff);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return `Semaine du ${monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au ${sunday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
      };
    } else {
      // Garder par jour
      aggregation = 'day';
      groupKey = (date: Date) => date.toISOString().split('T')[0];
      formatLabel = (date: Date) => date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      formatTooltipDate = (date: Date) => date.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    // Agréger les données
    const aggregated: { [key: string]: { 
      sum: number; 
      count: number; 
      totalRespected: number; 
      totalStrategies: number;
      dates: Date[];
      rawData: any[];
    } } = {};

    sortedData.forEach((d: any) => {
      const key = groupKey(d.date);
      if (!aggregated[key]) {
        aggregated[key] = {
          sum: 0,
          count: 0,
          totalRespected: 0,
          totalStrategies: 0,
          dates: [],
          rawData: [],
        };
      }
      aggregated[key].sum += d.compliance_rate;
      aggregated[key].count += 1;
      aggregated[key].totalRespected += d.respected || 0;
      aggregated[key].totalStrategies += d.total_strategies || 0;
      aggregated[key].dates.push(d.date);
      aggregated[key].rawData.push(d);
    });

    // Convertir en tableau trié et calculer la moyenne pondérée
    const aggregatedArray = Object.keys(aggregated)
      .map(key => {
        const group = aggregated[key];
        // Calculer la moyenne pondérée par le nombre de stratégies
        const avgRate = group.totalStrategies > 0
          ? (group.totalRespected / group.totalStrategies) * 100
          : group.sum / group.count;
        
        // Utiliser la première date du groupe pour le label
        const representativeDate = group.dates[0];
        
        return {
          key,
          date: representativeDate,
          compliance_rate: avgRate,
          total_strategies: group.totalStrategies,
          respected: group.totalRespected,
          count: group.count,
          rawData: group.rawData,
        };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    // Créer un dégradé pour le remplissage
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const gradient = ctx ? ctx.createLinearGradient(0, 0, 0, 400) : null;
    if (gradient) {
      gradient.addColorStop(0, 'rgba(98, 155, 248, 0.3)');
      gradient.addColorStop(0.5, 'rgba(98, 155, 248, 0.15)');
      gradient.addColorStop(1, 'rgba(98, 155, 248, 0.05)');
    }

    // Calculer la moyenne cumulative pour chaque point (moyenne depuis le début jusqu'à ce point)
    const cumulativeAverageData = aggregatedArray.map((_, index) => {
      // Prendre tous les points depuis le début jusqu'à l'index actuel
      const pointsUpToNow = aggregatedArray.slice(0, index + 1);
      
      // Calculer la moyenne pondérée par le nombre de stratégies
      const totalStrategies = pointsUpToNow.reduce((sum, d) => sum + (d.total_strategies || 0), 0);
      const totalRespected = pointsUpToNow.reduce((sum, d) => sum + (d.respected || 0), 0);
      
      if (totalStrategies > 0) {
        return (totalRespected / totalStrategies) * 100;
      } else {
        // Fallback si pas de stratégies : moyenne simple
        const sum = pointsUpToNow.reduce((sum, d) => sum + (d.compliance_rate || 0), 0);
        return sum / pointsUpToNow.length;
      }
    });

    // Calculer la moyenne globale pour référence (utilisée dans le tooltip)
    const totalStrategies = aggregatedArray.reduce((sum, d) => sum + (d.total_strategies || 0), 0);
    const totalRespected = aggregatedArray.reduce((sum, d) => sum + (d.respected || 0), 0);
    const averageRate = totalStrategies > 0
      ? (totalRespected / totalStrategies) * 100
      : aggregatedArray.reduce((sum, d) => sum + (d.compliance_rate || 0), 0) / aggregatedArray.length;

    const result = {
      labels: aggregatedArray.map(d => formatLabel(d.date)),
      datasets: [
        {
          label: t('strategies:compliance.rate'),
          data: aggregatedArray.map((d: any) => d.compliance_rate || 0),
          borderColor: '#629bf8',
          backgroundColor: gradient || 'rgba(98, 155, 248, 0.1)',
          borderWidth: 3,
          tension: 0.5,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointBackgroundColor: '#629bf8',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 3,
          pointHoverBackgroundColor: '#ffffff',
          pointHoverBorderColor: '#629bf8',
          pointHoverBorderWidth: 3,
          cubicInterpolationMode: 'monotone' as const,
        },
        {
          label: t('strategies:averageRate', { defaultValue: 'Moyenne' }),
          data: cumulativeAverageData,
          borderColor: '#f06dad',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 5],
          tension: 0.3,
          fill: false,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: '#f06dad',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
        },
      ],
      rawData: aggregatedArray,
      aggregation,
      formatTooltipDate,
      averageRate,
      cumulativeAverageData,
    };
    return result;
  }, [isLoading, allDataLoaded, selectedAccountCompliance, allAccountsCompliance, t]);

  const evolutionOptions = useMemo(() => {
    // Calculer le domaine dynamique de l'axe Y
    let minValue = 100;
    let maxValue = 0;
    
    if (evolutionData) {
      const allValues = [
        ...(evolutionData.datasets[0]?.data || []),
        ...(evolutionData.datasets[1]?.data || [])
      ].filter((v): v is number => typeof v === 'number');
      
      if (allValues.length > 0) {
        minValue = Math.min(...allValues);
        maxValue = Math.max(...allValues);
      }
    }
    
    // Déterminer le domaine optimal
    let yMin: number;
    let yMax: number;
    
    const range = maxValue - minValue;
    
    if (range < 1) {
      // Si la variation est très faible (< 1%), zoomer sur une plage de 5%
      const center = (minValue + maxValue) / 2;
      yMin = Math.max(0, Math.floor(center - 2.5));
      yMax = Math.min(100, Math.ceil(center + 2.5));
    } else if (range < 5) {
      // Si la variation est faible (< 5%), ajouter 2% de marge de chaque côté
      yMin = Math.max(0, Math.floor(minValue - 2));
      yMax = Math.min(100, Math.ceil(maxValue + 2));
    } else {
      // Sinon, ajouter 5% de marge
      yMin = Math.max(0, Math.floor(minValue - 5));
      yMax = Math.min(100, Math.ceil(maxValue + 5));
    }
    
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1000,
        easing: 'easeInOutQuart' as const,
      },
      interaction: {
        intersect: false,
        mode: 'index' as const,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: {
            usePointStyle: true,
            padding: window.innerWidth < 640 ? 12 : 20,
            font: {
              size: window.innerWidth < 640 ? 10 : 12
            },
            color: chartColors.textSecondary,
          },
        },
        datalabels: {
          display: false,
        },
        title: {
          display: false,
        },
        tooltip: {
          backgroundColor: chartColors.tooltipBg,
          titleColor: chartColors.tooltipTitle,
          bodyColor: chartColors.tooltipBody,
          borderColor: chartColors.tooltipBorder,
          borderWidth: 1,
          padding: 16,
          titleFont: {
            size: 14,
            weight: 600,
          },
          bodyFont: {
            size: 13,
            weight: 500,
          },
          displayColors: true,
          callbacks: {
            title: function(context: any) {
              const rawData = (evolutionData as any)?.rawData;
              const formatTooltipDate = (evolutionData as any)?.formatTooltipDate;
              if (rawData && rawData[context[0].dataIndex]) {
                const dayData = rawData[context[0].dataIndex];
                if (formatTooltipDate) {
                  return formatTooltipDate(dayData.date);
                }
                return dayData.date.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
              }
              return context[0].label || '';
            },
            label: function(context: any) {
              const value = context.parsed.y || 0;
              const datasetLabel = context.dataset.label || '';
              
              // Si c'est la courbe de moyenne, afficher la moyenne cumulative
              if (datasetLabel === t('strategies:averageRate', { defaultValue: 'Moyenne' })) {
                return `${datasetLabel}: ${formatNumber(value, 2)}%`;
              }
              
              const rawData = (evolutionData as any)?.rawData;
              const aggregation = (evolutionData as any)?.aggregation;
              const dayData = rawData?.[context.dataIndex];
              if (!dayData) return `${datasetLabel}: ${formatNumber(value, 2)}%`;
              
              const totalStrategies = dayData.total_strategies || 0;
              const respected = dayData.respected || 0;
              const count = dayData.count || 1;
              
              // Afficher le nombre de jours/semaines/mois selon l'agrégation
              let periodLabel = '';
              if (aggregation === 'week') {
                periodLabel = count === 1 
                  ? `(${count} ${t('strategies:day', { defaultValue: 'jour' })})`
                  : `(${count} ${t('strategies:days', { defaultValue: 'jours' })})`;
              } else if (aggregation === 'month') {
                periodLabel = count === 1 
                  ? `(${count} ${t('strategies:day', { defaultValue: 'jour' })})`
                  : `(${count} ${t('strategies:days', { defaultValue: 'jours' })})`;
              } else if (aggregation === 'year') {
                periodLabel = count === 1 
                  ? `(${count} ${t('strategies:day', { defaultValue: 'jour' })})`
                  : `(${count} ${t('strategies:days', { defaultValue: 'jours' })})`;
              }
              
              return `${datasetLabel}: ${formatNumber(value, 2)}% ${totalStrategies > 0 ? `(${respected}/${totalStrategies})` : ''} ${periodLabel}`;
            },
          },
        },
      },
      scales: {
        y: {
          min: yMin,
          max: yMax,
          ticks: {
            callback: function(value: any) {
              return value + '%';
            },
            color: chartColors.textSecondary,
            font: {
              size: window.innerWidth < 640 ? 10 : 12,
            },
          },
          grid: {
            color: 'rgba(148, 163, 184, 0.1)',
            lineWidth: 1,
            drawBorder: false,
          },
          border: {
            color: chartColors.border,
            display: false,
          },
          title: {
            display: true,
            text: t('strategies:compliance.rate'),
            color: chartColors.text,
            font: {
              size: window.innerWidth < 640 ? 11 : 13,
              weight: 600,
            },
          },
        },
      x: {
        ticks: {
          color: chartColors.textSecondary,
          font: {
            size: window.innerWidth < 640 ? 10 : 12,
          },
          maxRotation: 45,
          minRotation: 45,
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
          lineWidth: 1,
          drawBorder: false,
        },
        border: {
          color: chartColors.border,
          display: false,
        },
        title: {
          display: false,
        },
      },
    },
    elements: {
      point: {
        hoverRadius: 6,
        hoverBorderWidth: 3,
      },
      line: {
        borderCapStyle: 'round' as const,
        borderJoinStyle: 'round' as const,
      },
    },
  };
  }, [evolutionData, chartColors, formatNumber, t]);

  // Graphique 7: Compliance par jour de la semaine (prend en compte le sélecteur de compte)
  const weekdayComplianceData = useMemo<WeekdayComplianceChartData | null>(() => {
    // Guard: éviter le calcul pendant le chargement
    if (isLoading || !allDataLoaded) return null;
    // Utiliser les données du compte sélectionné si disponible, sinon tous les comptes
    const complianceData = selectedAccountCompliance || allAccountsCompliance;
    if (!complianceData?.daily_compliance || complianceData.daily_compliance.length === 0) return null;

    // Préparer les données avec le calcul correct du compliance_rate
    const processedData = complianceData.daily_compliance.map((d: any) => {
      const totalStrategies = (d.respected || 0) + (d.not_respected || 0);
      const complianceRate = totalStrategies > 0 
        ? ((d.respected || 0) / totalStrategies) * 100 
        : (d.compliance_rate || 0);
      return {
        ...d,
        compliance_rate: complianceRate,
        date: new Date(d.date),
      };
    });

    // Grouper par jour de la semaine (0 = dimanche, 1 = lundi, ..., 6 = samedi)
    const weekdayStats: { [key: number]: { total: number; sum: number; count: number } } = {};
    
    processedData.forEach((d: any) => {
      const weekday = d.date.getDay(); // 0 = dimanche, 1 = lundi, etc.
      if (!weekdayStats[weekday]) {
        weekdayStats[weekday] = { total: 0, sum: 0, count: 0 };
      }
      weekdayStats[weekday].sum += d.compliance_rate;
      weekdayStats[weekday].count += 1;
      weekdayStats[weekday].total += (d.respected || 0) + (d.not_respected || 0);
    });

    // Ordre des jours : lundi à dimanche
    const weekdayOrder = [1, 2, 3, 4, 5, 6, 0]; // Lundi à dimanche
    const weekdayNames = [
      t('dashboard:sunday', { defaultValue: 'Dimanche' }),
      t('dashboard:monday', { defaultValue: 'Lundi' }),
      t('dashboard:tuesday', { defaultValue: 'Mardi' }),
      t('dashboard:wednesday', { defaultValue: 'Mercredi' }),
      t('dashboard:thursday', { defaultValue: 'Jeudi' }),
      t('dashboard:friday', { defaultValue: 'Vendredi' }),
      t('dashboard:saturday', { defaultValue: 'Samedi' }),
    ];

    const dayStats = weekdayOrder
      .map(dayIndex => {
        const stats = weekdayStats[dayIndex];
        if (!stats || stats.count === 0) return null;
        
        const avgRate = stats.sum / stats.count;
        return {
          day: weekdayNames[dayIndex],
          dayIndex,
          rate: avgRate,
          count: stats.count,
          total: stats.total,
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);

    if (dayStats.length === 0) return null;

    // Garder l'ordre lundi à dimanche (pas de tri)
    // Calculer la moyenne pour déterminer positif/négatif
    const avgRate = dayStats.reduce((sum, d) => sum + d.rate, 0) / dayStats.length;

    const chartConfig: ChartData<'bar' | 'line', number[], string> = {
      labels: dayStats.map(d => d.day),
      datasets: [
        {
          type: 'bar' as const,
          label: t('strategies:compliance.rate'),
          data: dayStats.map(d => d.rate),
          backgroundColor: dayStats.map(d => {
            // Utiliser les couleurs du projet : #629bf8 pour positif, #f06dad pour négatif
            // Positif si au-dessus de la moyenne, négatif si en dessous
            const isPositive = d.rate >= avgRate;
            return isPositive ? 'rgba(98, 155, 248, 0.8)' : 'rgba(240, 109, 173, 0.8)';
          }),
          borderColor: dayStats.map(d => {
            const isPositive = d.rate >= avgRate;
            return isPositive ? '#629bf8' : '#f06dad';
          }),
          borderWidth: 0,
          borderRadius: 0,
        },
        {
          type: 'line' as const,
          label: t('strategies:compliance.averageLine', { defaultValue: 'Moyenne hebdomadaire' }),
          data: dayStats.map(() => avgRate),
          borderColor: '#fbbf24',
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0,
          pointHoverRadius: 0,
          tension: 0,
          fill: false,
          datalabels: {
            display: false,
          },
        },
      ],
    };

    return {
      chartData: chartConfig,
      dayStats,
      avgRate,
    };
  }, [isLoading, allDataLoaded, selectedAccountCompliance, allAccountsCompliance, t]);

  const weekdayComplianceOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'x' as const, // Forcer les barres verticales
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: chartColors.text,
          usePointStyle: true,
          padding: 16,
        },
      },
      datalabels: {
        display: true,
        color: '#ffffff',
        font: {
          weight: 600,
          size: window.innerWidth < 640 ? 10 : 12,
        },
        formatter: function(value: number) {
          return formatNumber(value, 1) + '%';
        },
        anchor: 'end' as const,
        align: 'start' as const,
        offset: -6,
        clamp: true,
      },
      tooltip: {
        backgroundColor: chartColors.tooltipBg,
        titleColor: chartColors.tooltipTitle,
        bodyColor: chartColors.tooltipBody,
        borderColor: chartColors.tooltipBorder,
        borderWidth: 1,
        padding: 16,
        titleFont: {
          size: 14,
          weight: 600,
        },
        bodyFont: {
          size: 13,
          weight: 500,
        },
        displayColors: true,
        callbacks: {
          label: function(context: any) {
            const value = context.parsed.y || 0;
            const datasetType = context.dataset.type || 'bar';

            if (datasetType === 'line') {
              return `${context.dataset.label}: ${formatNumber(value, 2)}%`;
            }

            // Utiliser directement weekdayComplianceData depuis la closure
            const dayStats = weekdayComplianceData?.dayStats;
            const dayData = dayStats?.[context.dataIndex];
            const count = dayData?.count || 0;
            const dayName = context.label || ''; // Nom du jour (Lundi, Mardi, etc.)

            // Ne pas afficher le nombre de jours si c'est 0
            if (count === 0) {
              return `${context.dataset.label}: ${formatNumber(value, 2)}%`;
            }

            const locale = i18n.language || 'fr';
            const dayLabel = t('strategies:tooltips.dayLabel', {
              defaultValue: dayName,
              day: dayName,
              dayOriginal: dayName,
              locale,
            });

            const baseParams = {
              label: context.dataset.label,
              value: formatNumber(value, 2),
              count,
              day: dayLabel,
              dayLabel,
              dayOriginal: dayName,
              locale,
            } as const;

            const basedOnText = t('strategies:tooltips.basedOn', {
              defaultValue: 'basé sur {{count}} {{dayLabel}}',
              ...baseParams,
            });

            return t('strategies:tooltips.respectByWeekday', {
              defaultValue: '{{label}}: {{value}}% ({{basedOn}})',
              basedOn: basedOnText,
              ...baseParams,
            });
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          callback: function(value: any) {
            return value + '%';
          },
          color: chartColors.textSecondary,
          font: {
            size: window.innerWidth < 640 ? 10 : 12,
          },
        },
        grid: {
          color: chartColors.grid,
          lineWidth: 1,
        },
        border: {
          color: chartColors.border,
          display: false,
        },
        title: {
          display: true,
          text: t('strategies:compliance.rate'),
          color: chartColors.text,
          font: {
            size: window.innerWidth < 640 ? 11 : 13,
            weight: 600,
          },
        },
      },
      x: {
        ticks: {
          color: chartColors.textSecondary,
          font: {
            size: window.innerWidth < 640 ? 10 : 12,
          },
        },
        grid: {
          color: chartColors.grid,
          lineWidth: 1,
        },
        border: {
          color: chartColors.border,
        },
        title: {
          display: false,
        },
      },
    },
  }), [weekdayComplianceData, chartColors, formatNumber, t, i18n.language]);

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
  const getRespectRateColor = (rate: number) => {
    if (rate >= 80) {
      // Excellent : vert foncé vers vert moyen
      return {
        from: 'from-green-600',
        to: 'to-emerald-500',
        darkFrom: 'dark:from-green-700',
        darkTo: 'dark:to-emerald-600'
      };
    } else if (rate >= 70) {
      // Bon : vert moyen vers vert clair
      return {
        from: 'from-green-500',
        to: 'to-emerald-400',
        darkFrom: 'dark:from-green-600',
        darkTo: 'dark:to-emerald-500'
      };
    } else if (rate >= 50) {
      // Moyen : orange/ambre
      return {
        from: 'from-amber-500',
        to: 'to-orange-500',
        darkFrom: 'dark:from-amber-600',
        darkTo: 'dark:to-orange-600'
      };
    } else {
      // À améliorer : rouge
      return {
        from: 'from-red-500',
        to: 'to-rose-500',
        darkFrom: 'dark:from-red-600',
        darkTo: 'dark:to-rose-600'
      };
    }
  };
  
  const accountRespectColor = getRespectRateColor(accountRespect);
  const accountPeriodRespectColor = getRespectRateColor(accountPeriodRespect);
  const allTimeRespectColor = getRespectRateColor(allTimeRespect);
  const periodRespectColor = getRespectRateColor(periodRespect);

  return (
    <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="mb-4 sm:mb-6">
        {/* Filtres */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
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

        {/* Soldes du compte */}
        {selectedAccount && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
            <AccountIndicatorsGrid 
              indicators={indicators} 
              currencySymbol={currencySymbol} 
            />
          </div>
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

        {/* Graphiques */}
        {!allDataLoaded ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <ChartSkeleton title={t('strategies:strategyRespectPercentage')} />
            <ChartSkeleton title={t('strategies:successRateByStrategyRespect')} />
            <ChartSkeleton title={t('strategies:winningSessionsDistribution')} />
            <ChartSkeleton title={t('strategies:dominantEmotionsDistribution')} />
          </div>
        ) : statistics ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Graphique 1: Respect de la stratégie en % */}
            {respectChartData && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 md:p-6">
                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 break-words">{t('strategies:strategyRespectPercentage')}</h3>
                  <Tooltip
                    content={t('strategies:strategyRespectPercentageTooltip')}
                    position="top"
                  >
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-help flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </Tooltip>
                </div>
                <div className="h-64 sm:h-72 md:h-80">
                  <Bar data={respectChartData} options={respectChartOptions} />
                </div>
              </div>
            )}

            {/* Graphique 2: Taux de réussite si respect de la stratégie */}
            {successRateData && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 md:p-6">
                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 break-words">{t('strategies:successRateByStrategyRespect')}</h3>
                  <Tooltip
                    content={t('strategies:successRateByStrategyRespectTooltip')}
                    position="top"
                  >
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-help flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </Tooltip>
                </div>
                <div className="h-64 sm:h-72 md:h-80">
                  <Bar data={successRateData} options={successRateOptions} />
                </div>
              </div>
            )}

            {/* Graphique 3: Répartition des sessions gagnantes */}
            {winningSessionsData && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 md:p-6">
                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 break-words">{t('strategies:winningSessionsDistribution')}</h3>
                  <Tooltip
                    content={t('strategies:winningSessionsDistributionTooltip')}
                    position="top"
                  >
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-help flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </Tooltip>
                </div>
                <div className="h-64 sm:h-72 md:h-80">
                  <Bar data={winningSessionsData} options={winningSessionsOptions} />
                </div>
              </div>
            )}

            {/* Graphique 4: Répartition des émotions dominantes */}
            {emotionsData && emotionsData.labels.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 md:p-6">
                <div className="flex items-center gap-2 mb-3 sm:mb-4">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 break-words">{t('strategies:dominantEmotionsDistribution')}</h3>
                  <Tooltip
                    content={t('strategies:dominantEmotionsDistributionTooltip')}
                    position="top"
                  >
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-help flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </Tooltip>
                </div>
                {/* Layout responsive : statistiques en haut sur mobile, sur les côtés sur desktop */}
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Statistiques gauche (2 cartes) */}
                  <div className="flex flex-row lg:flex-col gap-3 lg:gap-4 lg:w-52 xl:w-56 flex-shrink-0">
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 lg:p-4 flex-1 lg:flex-none">
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                        {t('strategies:numberOfOccurrences', { defaultValue: 'Nombre d\'occurrences' })}
                      </div>
                      <div className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {(emotionsData as any)?.total || 0}
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 lg:p-4 flex-1 lg:flex-none">
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                        {t('strategies:totalEmotions', { defaultValue: 'Émotions différentes' })}
                      </div>
                      <div className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {(emotionsData as any)?.totalEmotions || 0}
                      </div>
                    </div>
                  </div>
                  
                  {/* Graphique Doughnut au centre */}
                  <div className="flex-1 h-64 sm:h-72 md:h-80 min-w-0">
                    <Doughnut data={emotionsData} options={emotionsOptions} />
                  </div>
                  
                  {/* Statistiques droite (2 cartes) */}
                  <div className="flex flex-row lg:flex-col gap-3 lg:gap-4 lg:w-52 xl:w-56 flex-shrink-0">
                    {(emotionsData as any)?.topEmotion && (
                      <>
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 lg:p-4 flex-1 lg:flex-none">
                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                            {t('strategies:mostFrequentEmotion', { defaultValue: 'Émotion la plus fréquente' })}
                          </div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5 truncate" title={(emotionsData as any).topEmotion.label}>
                            {(emotionsData as any).topEmotion.label}
                          </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 lg:p-4 flex-1 lg:flex-none">
                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                            {t('strategies:percentage', { defaultValue: 'Pourcentage' })}
                          </div>
                          <div className="text-xl lg:text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {formatNumber((emotionsData as any).topEmotion.percentage, 1)}%
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 text-center text-gray-600 dark:text-gray-400">
            <p className="text-sm sm:text-base">{t('strategies:noDataForPeriod')}</p>
          </div>
        )}

        {/* Graphiques de compliance et évolution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
          {!allDataLoaded ? (
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
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 md:p-6">
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 break-words">
                      {t('strategies:complianceByWeekday', { defaultValue: 'Respect de la stratégie par jour de la semaine' })}
                    </h3>
                    <Tooltip
                      content={t('strategies:complianceByWeekdayTooltip', { defaultValue: 'Taux de respect moyen pour chaque jour de la semaine. Les jours en bleu sont ceux où vous respectez le mieux votre stratégie, les jours en rose sont ceux à améliorer.' })}
                      position="top"
                    >
                      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-help flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </Tooltip>
                  </div>
                  <div className="h-64 sm:h-80 md:h-96">
                    <MixedChart<'bar' | 'line', number[], string>
                      type="bar"
                      data={weekdayComplianceData.chartData}
                      options={weekdayComplianceOptions}
                    />
                  </div>
                </div>
              ) : null}

              {/* Graphique: Évolution du taux de respect */}
              {evolutionData ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 md:p-6">
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 break-words">
                      {t('strategies:compliance.evolution')}
                    </h3>
                    <Tooltip
                      content={selectedAccount 
                        ? t('strategies:complianceEvolutionSelectedAccountTooltip', { defaultValue: 'Évolution du taux de respect de la stratégie pour le compte sélectionné' })
                        : t('strategies:complianceEvolutionAllAccountsTooltip', { defaultValue: 'Évolution du taux de respect de la stratégie pour tous vos comptes actifs' })}
                      position="top"
                    >
                      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-help flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </Tooltip>
                  </div>
                  <div className="h-64 sm:h-80 md:h-96">
                    <Line data={evolutionData!} options={evolutionOptions} />
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 md:p-6">
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 break-words">
                      {t('strategies:compliance.evolution')}
                    </h3>
                  </div>
                  <div className="h-64 sm:h-80 md:h-96 flex items-center justify-center">
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                      {t('strategies:noDataForAccount', { defaultValue: 'Aucune donnée disponible' })}
                    </p>
                  </div>
                </div>
              )}
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
          loadAllTrades();
          loadFilteredTrades();
        }
      }} />
    </div>
  );
};

export default StrategiesPage;
