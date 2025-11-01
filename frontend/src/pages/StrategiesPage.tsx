import React, { useState, useEffect, useCallback } from 'react';
import { FloatingActionButton } from '../components/ui/FloatingActionButton';
import { ImportTradesModal } from '../components/trades/ImportTradesModal';
import { AccountSelector } from '../components/accounts/AccountSelector';
import { tradeStrategiesService } from '../services/tradeStrategies';
import Tooltip from '../components/ui/Tooltip';
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

// Labels des émotions en français
const EMOTION_LABELS: Record<string, string> = {
  confiance: 'Confiance',
  peur: 'Peur',
  avarice: 'Avarice',
  frustration: 'Frustration',
  impatience: 'Impatience',
  patience: 'Patience',
  euphorie: 'Euphorie',
  anxiete: 'Anxiété',
  colere: 'Colère',
  satisfaction: 'Satisfaction',
  deception: 'Déception',
  calme: 'Calme',
  stress: 'Stress',
  determination: 'Détermination',
  doute: 'Doute',
  excitation: 'Excitation',
  lassitude: 'Lassitude',
  fatigue: 'Fatigue',
};

const StrategiesPage: React.FC = () => {
  const [accountId, setAccountId] = useState<number | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statistics, setStatistics] = useState<any>(null);

  // Générer les années disponibles (année en cours et 5 ans précédents)
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 6 }, (_, i) => currentYear - i);
  const availableMonths = [
    { value: 1, label: 'Janvier' },
    { value: 2, label: 'Février' },
    { value: 3, label: 'Mars' },
    { value: 4, label: 'Avril' },
    { value: 5, label: 'Mai' },
    { value: 6, label: 'Juin' },
    { value: 7, label: 'Juillet' },
    { value: 8, label: 'Août' },
    { value: 9, label: 'Septembre' },
    { value: 10, label: 'Octobre' },
    { value: 11, label: 'Novembre' },
    { value: 12, label: 'Décembre' },
  ];

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
      setError(err.message || 'Erreur lors du chargement des statistiques');
      console.error('Erreur:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedMonth, accountId]);

  // Charger les statistiques
  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  // Graphique 1: Respect de la stratégie en % (graphique en barres groupées)
  // Pour chaque période (mois ou jour), afficher les deux barres côte à côte
  const respectChartData = statistics?.statistics?.period_data && statistics.statistics.period_data.length > 0 ? {
    labels: statistics.statistics.period_data.map((d: any) => d.period),
    datasets: [
      {
        label: 'Respecté (%)',
        data: statistics.statistics.period_data.map((d: any) => d.respect_percentage || 0),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: '#3b82f6',
        borderWidth: 0,
        borderRadius: 0,
      },
      {
        label: 'Non respecté (%)',
        data: statistics.statistics.period_data.map((d: any) => d.not_respect_percentage || 0),
        backgroundColor: 'rgba(236, 72, 153, 0.8)',
        borderColor: '#ec4899',
        borderWidth: 0,
        borderRadius: 0,
      },
    ],
  } : null;

  const respectChartOptions = {
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
          }
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'white',
        titleColor: '#4b5563',
        bodyColor: '#1f2937',
        borderColor: '#e5e7eb',
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
            return `${label}: ${value.toFixed(2)}% (${count} trades sur ${total})`;
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
        },
        title: {
          display: true,
          text: 'Pourcentage (%)',
          color: '#4b5563',
          font: {
            size: 13,
            weight: 600,
          },
        },
      },
      x: {
        stacked: true,
        title: {
          display: false,
        },
      },
    },
  };

  // Graphique 2: Taux de réussite selon respect de la stratégie
  const successRateData = statistics?.statistics ? {
    labels: ['Taux de réussite'],
    datasets: [
      {
        label: 'Si stratégie respectée (%)',
        data: [statistics.statistics.success_rate_if_respected || 0],
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: '#3b82f6',
        borderWidth: 0,
        borderRadius: 0,
      },
      {
        label: 'Si stratégie non respectée (%)',
        data: [statistics.statistics.success_rate_if_not_respected || 0],
        backgroundColor: 'rgba(236, 72, 153, 0.8)',
        borderColor: '#ec4899',
        borderWidth: 0,
        borderRadius: 0,
      },
    ],
  } : null;

  const successRateOptions = {
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
          }
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'white',
        titleColor: '#4b5563',
        bodyColor: '#1f2937',
        borderColor: '#e5e7eb',
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
          color: '#6b7280',
          font: {
            size: 12,
          },
        },
        grid: {
          color: '#e5e7eb',
          lineWidth: 1,
        },
        border: {
          color: '#d1d5db',
          display: false,
        },
        title: {
          display: true,
          text: 'Pourcentage (%)',
          color: '#4b5563',
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
          color: '#6b7280',
          font: {
            size: 12,
          },
        },
        grid: {
          color: '#e5e7eb',
          lineWidth: 1,
        },
        border: {
          color: '#d1d5db',
        },
      },
    },
  };

  // Graphique 3: Répartition des sessions gagnantes selon TP1 et TP2+
  const winningSessionsData = statistics?.statistics?.winning_sessions_distribution ? {
    labels: ['TP1', 'TP2+', 'Sans TP'],
    datasets: [
      {
        label: 'Nombre de sessions gagnantes',
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
  } : null;

  // Calculer la valeur maximale pour l'axe Y avec marge
  const winningSessionsMax = statistics?.statistics?.winning_sessions_distribution ? (() => {
    const values = [
      statistics.statistics.winning_sessions_distribution.tp1_only,
      statistics.statistics.winning_sessions_distribution.tp2_plus,
      statistics.statistics.winning_sessions_distribution.no_tp,
    ];
    const maxValue = Math.max(...values);
    // Ajouter 15% de marge en haut
    return Math.ceil(maxValue * 1.15);
  })() : undefined;

  const winningSessionsOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      datalabels: {
        display: false,
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
          generateLabels: function(chart: any) {
            return [
              {
                text: 'TP1',
                fillStyle: '#3b82f6',
                strokeStyle: '#3b82f6',
                lineWidth: 2,
                hidden: false,
                index: 0,
                datasetIndex: 0,
                pointStyle: 'circle' as const,
              },
              {
                text: 'TP2+',
                fillStyle: '#f97316',
                strokeStyle: '#f97316',
                lineWidth: 2,
                hidden: false,
                index: 1,
                datasetIndex: 0,
                pointStyle: 'circle' as const,
              },
              {
                text: 'Sans TP',
                fillStyle: '#9ca3af',
                strokeStyle: '#9ca3af',
                lineWidth: 2,
                hidden: false,
                index: 2,
                datasetIndex: 0,
                pointStyle: 'circle' as const,
              },
            ];
          },
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'white',
        titleColor: '#4b5563',
        bodyColor: '#1f2937',
        borderColor: '#e5e7eb',
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
          color: '#6b7280',
          font: {
            size: 12,
          },
        },
        grid: {
          color: '#e5e7eb',
          lineWidth: 1,
        },
        border: {
          color: '#d1d5db',
          display: false,
        },
      },
      x: {
        stacked: false,
        title: {
          display: false,
        },
      },
    },
  };

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

  const emotionsData = statistics?.statistics?.emotions_distribution ? (() => {
    // Trier les émotions par fréquence (décroissant)
    const sortedEmotions = [...statistics.statistics.emotions_distribution]
      .sort((a: any, b: any) => b.count - a.count);
    
    // Prendre les 5 premières émotions
    const top5Emotions = sortedEmotions.slice(0, 5);
    const otherEmotions = sortedEmotions.slice(5);
    
    // Calculer le total des autres émotions
    const othersCount = otherEmotions.reduce((sum: number, e: any) => sum + e.count, 0);
    
    // Construire les labels et données
    const labels = top5Emotions.map((e: any) => EMOTION_LABELS[e.emotion] || e.emotion);
    const data = top5Emotions.map((e: any) => e.count);
    
    // Ajouter "Autres" si nécessaire
    if (othersCount > 0) {
      labels.push('Autres');
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
          label: 'Nombre d\'occurrences',
          data,
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
          borderWidth: 2,
        },
      ],
      total, // Stocker le total pour les calculs de pourcentage
    };
  })() : null;

  const emotionsOptions = {
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
        backgroundColor: 'white',
        titleColor: '#4b5563',
        bodyColor: '#1f2937',
        borderColor: '#e5e7eb',
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
  };

  // Indicateur 5: Taux de respect total toutes périodes confondues
  const allTimeRespect = statistics?.all_time?.respect_percentage || 0;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        {/* Filtres */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Compte de trading
              </label>
              <AccountSelector value={accountId} onChange={setAccountId} hideLabel />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Année
              </label>
              <select
                value={selectedYear || ''}
                onChange={(e) => setSelectedYear(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Toutes les années</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mois
              </label>
              <select
                value={selectedMonth || ''}
                onChange={(e) => setSelectedMonth(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={!selectedYear}
              >
                <option value="">Tous les mois</option>
                {availableMonths.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSelectedYear(null);
                  setSelectedMonth(null);
                }}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </div>

        {/* Message d'erreur */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Indicateur global */}
        {statistics && (
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg shadow-lg p-6 mb-6 text-white">
            <h2 className="text-lg font-semibold mb-2">Taux de respect total</h2>
            <p className="text-3xl font-bold mb-1">{allTimeRespect.toFixed(2)}%</p>
            <p className="text-sm opacity-90">
              Toutes périodes et tous comptes confondus ({statistics.all_time.total_strategies} stratégies)
            </p>
          </div>
        )}

        {/* Graphiques */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Chargement des statistiques...</p>
            </div>
          </div>
        ) : statistics ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Graphique 1: Respect de la stratégie en % */}
            {respectChartData && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Respect de la stratégie en %</h3>
                  <Tooltip
                    content="Ce graphique montre le pourcentage de trades respectés et non respectés par rapport au total des trades pour chaque période. La barre bleue représente le % de trades où la stratégie a été respectée, la barre rose représente le % de trades où la stratégie n'a pas été respectée."
                    position="top"
                  >
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors cursor-help">
                      <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Taux de réussite selon respect de la stratégie</h3>
                  <Tooltip
                    content="Ce graphique compare le taux de réussite (trades gagnants) selon que la stratégie ait été respectée ou non. La barre bleue montre le % de trades gagnants quand la stratégie est respectée, la barre rose montre le % de trades gagnants quand la stratégie n'est pas respectée."
                    position="top"
                  >
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors cursor-help">
                      <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Répartition des sessions gagnantes selon TP atteint</h3>
                  <Tooltip
                    content="Ce graphique montre comment sont réparties les sessions gagnantes (trades avec profit) selon le Take Profit atteint. TP1 uniquement : le premier Take Profit a été atteint mais pas le TP2+. TP2+ : le deuxième Take Profit ou plus a été atteint. Sans TP : aucun Take Profit n'a été atteint mais le trade est quand même gagnant."
                    position="top"
                  >
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors cursor-help">
                      <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Répartition des émotions dominantes</h3>
                  <Tooltip
                    content="Ce graphique montre la répartition des émotions dominantes ressenties lors des trades. Chaque segment représente le nombre d'occurrences d'une émotion. Cela permet d'identifier les émotions les plus fréquentes pendant vos sessions de trading."
                    position="top"
                  >
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors cursor-help">
                      <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-600">
            <p>Aucune donnée disponible pour la période sélectionnée.</p>
          </div>
        )}
      </div>

      <FloatingActionButton onClick={() => setShowImport(true)} title="Importer des trades" />
      <ImportTradesModal open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
};

export default StrategiesPage;
