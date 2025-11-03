import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FloatingActionButton } from '../components/ui/FloatingActionButton';
import { ImportTradesModal } from '../components/trades/ImportTradesModal';
import { AccountSelector } from '../components/accounts/AccountSelector';
import { CustomSelect } from '../components/common/CustomSelect';
import { tradeStrategiesService } from '../services/tradeStrategies';
import Tooltip from '../components/ui/Tooltip';
import { usePreferences } from '../hooks/usePreferences';
import { useTheme } from '../hooks/useTheme';
import { getMonthNames } from '../utils/dateFormat';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useTradingAccount } from '../contexts/TradingAccountContext';
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
  const { preferences } = usePreferences();
  const { theme } = useTheme();
  const { t } = useI18nTranslation();
  const isDark = theme === 'dark';
  const { selectedAccountId: accountId, setSelectedAccountId: setAccountId, loading: accountLoading } = useTradingAccount();

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
  const [selectedYear, setSelectedYear] = useState<number | null>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statistics, setStatistics] = useState<any>(null);

  // Générer les années disponibles (année en cours et 5 ans précédents)
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 6 }, (_, i) => currentYear - i);
  const yearOptions = useMemo(() => [
    { value: null, label: t('strategies:allYears') },
    ...availableYears.map(year => ({ value: year, label: year.toString() }))
  ], [availableYears, t]);
  
  // Utiliser les noms de mois traduits
  const monthNames = useMemo(() => getMonthNames(preferences.language), [preferences.language]);
  const monthOptions = useMemo(() => {
    const availableMonths = monthNames.map((name, index) => ({ value: index + 1, label: name }));
    return [
      { value: null, label: t('strategies:allMonths') },
      ...availableMonths.map(month => ({ value: month.value, label: month.label }))
    ];
  }, [monthNames, t]);

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
        tradingAccount?: number;
      } = {};
      
      if (selectedYear) {
        params.year = selectedYear;
      }
      if (selectedMonth) {
        params.month = selectedMonth;
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
  }, [selectedYear, selectedMonth, accountId, t]);

  // Charger les statistiques
  useEffect(() => {
    // Attendre que le compte soit chargé avant de charger les statistiques
    if (accountLoading) {
      return;
    }
    loadStatistics();
  }, [loadStatistics, accountLoading]);

  // Graphique 1: Respect de la stratégie en % (graphique en barres groupées)
  // Pour chaque période (mois ou jour), afficher les deux barres côte à côte
  const respectChartData = useMemo(() => {
    if (!statistics?.statistics?.period_data || statistics.statistics.period_data.length === 0) return null;
    // Vérifier qu'il y a au moins une période avec des données (total > 0)
    const hasData = statistics.statistics.period_data.some((d: any) => d.total > 0);
    if (!hasData) return null;
    
    return {
    labels: statistics.statistics.period_data.map((d: any) => d.period),
    datasets: [
      {
        label: t('strategies:respected'),
        data: statistics.statistics.period_data.map((d: any) => d.respect_percentage || 0),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: '#3b82f6',
        borderWidth: 0,
        borderRadius: 0,
      },
      {
        label: t('strategies:notRespected'),
        data: statistics.statistics.period_data.map((d: any) => d.not_respect_percentage || 0),
        backgroundColor: 'rgba(236, 72, 153, 0.8)',
        borderColor: '#ec4899',
        borderWidth: 0,
        borderRadius: 0,
      },
    ],
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
          size: 13,
        },
        formatter: function(value: number) {
          // Afficher la valeur avec le symbole %
          return value > 0 ? `${value.toFixed(2)}%` : '';
        },
      },
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12
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
            const total = statistics?.statistics?.period_data?.[context.dataIndex]?.total || 0;
            const count = Math.round((value / 100) * total);
            return `${label}: ${value.toFixed(2)}% (${count} ${t('strategies:trades')} ${t('strategies:on')} ${total})`;
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
          text: t('strategies:percentage'),
          color: chartColors.text,
          font: {
            size: 13,
            weight: 600,
          },
        },
      },
      x: {
        stacked: true,
        ticks: {
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
        },
        title: {
          display: false,
        },
      },
    },
  }), [statistics?.statistics?.period_data, t, chartColors]);

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
          size: 13,
        },
        formatter: function(value: number) {
          // Afficher la valeur avec le symbole %
          return value > 0 ? `${value.toFixed(2)}%` : '';
        },
      },
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12
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
            return `${label}: ${value.toFixed(2)}%`;
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
          text: t('strategies:percentage'),
          color: chartColors.text,
          font: {
            size: 13,
            weight: 600,
          },
        },
      },
      x: {
        title: {
          display: false,
        },
        ticks: {
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
        },
      },
    },
  }), [t, chartColors]);

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
        display: false,
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
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
            return `${label}: ${value} (${percentage}%)`;
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
            size: 13,
            weight: 600,
          },
        },
      },
      x: {
        stacked: false,
        ticks: {
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
        },
        title: {
          display: false,
        },
      },
    },
  }), [statistics?.statistics?.winning_sessions_distribution, winningSessionsMax, t, chartColors]);

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
          size: 13,
        },
        formatter: function(value: number, context: any) {
          const label = context.chart.data.labels[context.dataIndex] || '';
          const total = emotionsData?.total || 1;
          const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
          // Afficher seulement si le segment est assez grand (> 3%)
          return value > 0 && (value / total) * 100 > 3 ? `${label}\n${percentage}%` : '';
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
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
            return `${label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
  }), [emotionsData, chartColors]);

  // Indicateur 5: Taux de respect total toutes périodes confondues
  const allTimeRespect = statistics?.all_time?.respect_percentage || 0;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="mb-6">
        {/* Filtres */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('strategies:tradingAccount')}
              </label>
              <AccountSelector value={accountId} onChange={setAccountId} hideLabel />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('strategies:year')}
              </label>
              <CustomSelect
                value={selectedYear}
                onChange={(value) => setSelectedYear(value as number | null)}
                options={yearOptions}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('strategies:month')}
              </label>
              <CustomSelect
                value={selectedMonth}
                onChange={(value) => setSelectedMonth(value as number | null)}
                options={monthOptions}
                disabled={!selectedYear}
              />
            </div>
            
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSelectedYear(null);
                  setSelectedMonth(null);
                }}
                className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                {t('strategies:reset')}
              </button>
            </div>
          </div>
        </div>

        {/* Message d'erreur */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Indicateur global */}
        {statistics && (
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-700 rounded-lg shadow-lg p-6 mb-6 text-white">
            <h2 className="text-lg font-semibold mb-2">{t('strategies:totalRespectRate')}</h2>
            <p className="text-3xl font-bold mb-1">{allTimeRespect.toFixed(2)}%</p>
            <p className="text-sm opacity-90">
              {t('strategies:allPeriodsAndAccounts')} ({statistics.all_time.total_strategies} {t('strategies:strategies')})
            </p>
          </div>
        )}

        {/* Graphiques */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">{t('strategies:loading')}</p>
            </div>
          </div>
        ) : statistics ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Graphique 1: Respect de la stratégie en % */}
            {respectChartData && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('strategies:strategyRespectPercentage')}</h3>
                  <Tooltip
                    content={t('strategies:strategyRespectPercentageTooltip')}
                    position="top"
                  >
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-help">
                      <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </Tooltip>
                </div>
                <div className="h-80">
                  <Bar data={respectChartData} options={respectChartOptions} />
                </div>
              </div>
            )}

            {/* Graphique 2: Taux de réussite si respect de la stratégie */}
            {successRateData && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('strategies:successRateByStrategyRespect')}</h3>
                  <Tooltip
                    content={t('strategies:successRateByStrategyRespectTooltip')}
                    position="top"
                  >
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-help">
                      <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </Tooltip>
                </div>
                <div className="h-80">
                  <Bar data={successRateData} options={successRateOptions} />
                </div>
              </div>
            )}

            {/* Graphique 3: Répartition des sessions gagnantes */}
            {winningSessionsData && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('strategies:winningSessionsDistribution')}</h3>
                  <Tooltip
                    content={t('strategies:winningSessionsDistributionTooltip')}
                    position="top"
                  >
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-help">
                      <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </Tooltip>
                </div>
                <div className="h-80">
                  <Bar data={winningSessionsData} options={winningSessionsOptions} />
                </div>
              </div>
            )}

            {/* Graphique 4: Répartition des émotions dominantes */}
            {emotionsData && emotionsData.labels.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('strategies:dominantEmotionsDistribution')}</h3>
                  <Tooltip
                    content={t('strategies:dominantEmotionsDistributionTooltip')}
                    position="top"
                  >
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-help">
                      <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </Tooltip>
                </div>
                <div className="h-80">
                  <Doughnut data={emotionsData} options={emotionsOptions} />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center text-gray-600 dark:text-gray-400">
            <p>{t('strategies:noDataForPeriod')}</p>
          </div>
        )}
      </div>

      <FloatingActionButton onClick={() => setShowImport(true)} title={t('strategies:importTrades')} />
      <ImportTradesModal open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
};

export default StrategiesPage;
