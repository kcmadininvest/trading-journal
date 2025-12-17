import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FloatingActionButton } from '../components/ui/FloatingActionButton';
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
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar as ChartBar, Doughnut as ChartDoughnut } from 'react-chartjs-2';

const Bar = ChartBar;
const Doughnut = ChartDoughnut;

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
  const { t } = useI18nTranslation();
  const isDark = theme === 'dark';
  const { selectedAccountId: accountId, setSelectedAccountId: setAccountId, loading: accountLoading } = useTradingAccount();
  
  // Wrapper pour formatNumber avec préférences
  const formatNumber = useCallback((value: number, digits: number = 2): string => {
    return formatNumberUtil(value, digits, preferences.number_format);
  }, [preferences.number_format]);

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

  // Générer les années disponibles (année en cours et 5 ans précédents)

  // Fonction pour obtenir le label d'une émotion traduit
  const getEmotionLabel = useCallback((emotion: string): string => {
    return t(`strategies:emotions.${emotion}` as any, { defaultValue: emotion });
  }, [t]);

  const loadStatistics = useCallback(async () => {
    setIsLoading(true);
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
      
      const data = await tradeStrategiesService.statistics(params);
      setStatistics(data);
    } catch (err: any) {
      setError(err.message || t('strategies:errorLoadingStatistics'));
      console.error('Erreur:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPeriod, selectedYear, selectedMonth, accountId, t]);

  // Charger les statistiques
  useEffect(() => {
    // Attendre que le compte soit chargé avant de charger les statistiques
    if (accountLoading) {
      return;
    }
    loadStatistics();
  }, [loadStatistics, accountLoading]);

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
    if (!statistics?.statistics?.period_data || statistics.statistics.period_data.length === 0) return null;
    // Vérifier qu'il y a au moins une période avec des données (total > 0)
    const hasData = statistics.statistics.period_data.some((d: any) => d.total > 0);
    if (!hasData) return null;
    
    // Enrichir les données avec les informations nécessaires pour les tooltips
    const enrichedData = statistics.statistics.period_data.map((d: any) => {
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
      labels: enrichedData.map((d: any) => d.period),
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
  }, [statistics?.statistics?.period_data, t]);

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
            return period;
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
  }), [statistics?.statistics?.period_data, respectChartData, t, chartColors, formatNumber]);

  // Graphique 2: Taux de réussite selon respect de la stratégie
  const successRateData = useMemo(() => {
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
  }, [statistics?.statistics, t]);

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
  }, [statistics?.statistics?.winning_sessions_distribution, t]);

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

  const emotionsData = useMemo(() => statistics?.statistics?.emotions_distribution ? (() => {
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
          borderWidth: 2,
        },
      ],
      total, // Stocker le total pour les calculs de pourcentage
    };
  })() : null, [statistics?.statistics?.emotions_distribution, getEmotionLabel, t]);

  const emotionsOptions = useMemo(() => ({
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
        formatter: function(value: number, context: any) {
          const label = context.chart.data.labels[context.dataIndex] || '';
          const total = emotionsData?.total || 1;
          const percentage = total > 0 ? (value / total) * 100 : 0;
          // Afficher seulement si le segment est assez grand (> 3%)
          // Sur mobile, afficher seulement le pourcentage si l'écran est petit
          if (window.innerWidth < 640) {
            return value > 0 && (value / total) * 100 > 3 ? `${formatNumber(percentage, 1)}%` : '';
          }
          return value > 0 && (value / total) * 100 > 3 ? `${label}\n${formatNumber(percentage, 1)}%` : '';
        },
      },
      legend: {
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
  }), [emotionsData, chartColors, formatNumber]);

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
        {isLoading ? (
          <div className="flex items-center justify-center h-48 sm:h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-600 dark:border-blue-500 mx-auto mb-3 sm:mb-4"></div>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">{t('strategies:loading')}</p>
            </div>
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
                <div className="h-64 sm:h-72 md:h-80">
                  <Doughnut data={emotionsData} options={emotionsOptions} />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 text-center text-gray-600 dark:text-gray-400">
            <p className="text-sm sm:text-base">{t('strategies:noDataForPeriod')}</p>
          </div>
        )}
      </div>

      <FloatingActionButton onClick={() => setShowImport(true)} title={t('strategies:importTrades')} />
      <ImportTradesModal open={showImport} onClose={(done) => {
        setShowImport(false);
        if (done) {
          // Recharger les statistiques après un import réussi
          loadStatistics();
          // Recharger aussi les trades pour mettre à jour les soldes et les graphiques
          loadAllTrades();
          loadFilteredTrades();
        }
      }} />
    </div>
  );
};

export default StrategiesPage;
