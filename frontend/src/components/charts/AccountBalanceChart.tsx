import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { usePreferences } from '../../hooks/usePreferences';
import { formatCurrency as formatCurrencyUtil } from '../../utils/numberFormat';

// Enregistrer les composants Chart.js nécessaires
ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  ChartTooltip,
  ChartLegend,
  Filler
);

interface BalanceDataPoint {
  date: string; // Format YYYY-MM-DD
  pnl: number;
  cumulative: number;
}

interface AccountBalanceChartProps {
  data: BalanceDataPoint[];
  currencySymbol?: string;
  formatCurrency?: (value: number, currencySymbol?: string) => string;
  initialCapital?: number; // Capital initial pour la ligne de référence
}

function AccountBalanceChart({ 
  data, 
  currencySymbol = '',
  formatCurrency: formatCurrencyProp,
  initialCapital = 0
}: AccountBalanceChartProps) {
  const { t } = useI18nTranslation();
  const { theme } = useTheme();
  const { preferences } = usePreferences();
  const isDark = theme === 'dark';

  // Wrapper pour formatCurrency avec préférences du projet
  // Utilise toujours le currencySymbol de la prop pour garantir la cohérence
  // Si formatCurrencyProp est fourni, l'utiliser, sinon utiliser formatCurrencyUtil directement
  const formatCurrency = useMemo(() => {
    if (formatCurrencyProp) {
      // Si formatCurrencyProp est fourni, créer un wrapper qui utilise toujours currencySymbol de la prop
      return (value: number, symbol?: string): string => {
        const symbolToUse = symbol !== undefined && symbol !== '' ? symbol : currencySymbol;
        return formatCurrencyProp(value, symbolToUse);
      };
    }
    // Sinon, utiliser formatCurrencyUtil directement avec les préférences
    return (value: number, symbol?: string): string => {
      const symbolToUse = symbol !== undefined && symbol !== '' ? symbol : currencySymbol;
      return formatCurrencyUtil(value, symbolToUse, preferences.number_format, 2);
    };
  }, [formatCurrencyProp, currencySymbol, preferences.number_format]);

  // Helper function pour obtenir les couleurs selon le thème
  const chartThemeColors = useMemo(() => ({
    text: isDark ? '#d1d5db' : '#374151',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    background: isDark ? '#1f2937' : '#ffffff',
    grid: isDark ? '#374151' : '#e5e7eb',
    border: isDark ? '#4b5563' : '#d1d5db',
    tooltipBg: isDark ? '#374151' : '#ffffff',
    tooltipBorder: isDark ? '#4b5563' : '#e5e7eb',
  }), [isDark]);

  // Préparer les données du graphique
  const { chartData, chartLabels, pnlMapping } = useMemo(() => {
    if (data.length === 0) {
      return {
        chartData: {
          labels: [],
          datasets: [],
        },
        chartLabels: [] as string[],
        pnlMapping: [] as number[],
      };
    }

    const dates = data.map(d => 
      new Date(d.date).toLocaleDateString('fr-FR', { 
        month: 'short', 
        day: 'numeric', 
        timeZone: preferences.timezone 
      })
    );
    const balances = data.map(d => d.cumulative);

    // Créer des labels et balances avec points intermédiaires au capital initial pour les transitions
    const processedLabels: string[] = [];
    const processedBalances: number[] = [];
    const processedPnlMapping: number[] = [];

    balances.forEach((balance, index) => {
      const prevBalance = index > 0 ? balances[index - 1] : balance;
      
      // Si on traverse la ligne du capital initial, ajouter un point au capital initial
      if ((prevBalance < initialCapital && balance >= initialCapital) || (prevBalance >= initialCapital && balance < initialCapital)) {
        // Ajouter le point au capital initial avec le label du point actuel
        processedLabels.push(dates[index]);
        processedBalances.push(initialCapital);
        processedPnlMapping.push(data[index]?.pnl ?? 0);
      }
      
      // Ajouter le point actuel
      processedLabels.push(dates[index]);
      processedBalances.push(balance);
      processedPnlMapping.push(data[index]?.pnl ?? 0);
    });

    return {
      chartData: {
        labels: processedLabels,
        datasets: [
          // Dataset principal pour la courbe
          {
            label: 'Solde',
            data: processedBalances,
            tension: 0.4, // courbe lissée
            borderWidth: 3,
            segment: {
              borderColor: (ctx: any) => {
                const v0 = ctx.p0.parsed.y;
                const v1 = ctx.p1.parsed.y;
                // Si on traverse la ligne du capital initial, colorer selon la position
                // Si les deux points sont du même côté du capital initial, utiliser le point d'arrivée
                // Si on va vers le capital initial (v0 != initialCapital et v1 == initialCapital), utiliser le point de départ
                // Si on part du capital initial (v0 == initialCapital et v1 != initialCapital), utiliser le point d'arrivée
                // Utiliser les mêmes couleurs que le graphique "Performance par Jour de la Semaine"
                if (v0 === initialCapital) {
                  // On part du capital initial, utiliser la couleur du point d'arrivée
                  return v1 >= initialCapital ? '#3b82f6' : '#ec4899';
                } else if (v1 === initialCapital) {
                  // On va vers le capital initial, utiliser la couleur du point de départ
                  return v0 >= initialCapital ? '#3b82f6' : '#ec4899';
                } else {
                  // Pas de transition par le capital initial, utiliser la couleur du point d'arrivée
                  return v1 >= initialCapital ? '#3b82f6' : '#ec4899';
                }
              },
            },
            fill: false,
            pointRadius: (context: any) => {
              // Afficher les points seulement si le volume de données est faible (< 30 points)
              const dataLength = processedBalances.length;
              if (dataLength > 30) return 0;
              // Vérifier que context.parsed existe avant d'accéder à y
              const value = context.parsed?.y;
              return value !== null && value !== undefined ? 4 : 0;
            },
            pointBackgroundColor: (context: any) => {
              const value = context.parsed?.y;
              return value >= initialCapital ? '#3b82f6' : '#ec4899';
            },
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: (context: any) => {
              const value = context.parsed?.y;
              return value >= initialCapital ? '#3b82f6' : '#ec4899';
            },
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 3,
            spanGaps: false,
            _pnlMapping: processedPnlMapping, // Stocker le mapping pour les tooltips
            order: 0, // Placer devant tout
          },
        ],
      },
      chartLabels: processedLabels,
      pnlMapping: processedPnlMapping,
    };
  }, [data, preferences.timezone, initialCapital]);

  // Options du graphique
  const options = useMemo(() => {
    // Trouver l'index du dataset principal (Solde)
    const mainDatasetIndex = chartData.datasets.findIndex((ds: any) => ds.label === 'Solde');
    
    return {
      responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      datalabels: {
        display: false,
      },
      tooltip: {
        backgroundColor: chartThemeColors.tooltipBg,
        titleColor: chartThemeColors.text,
        bodyColor: chartThemeColors.text,
        borderColor: chartThemeColors.tooltipBorder,
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
        filter: function(tooltipItem: any) {
          // Afficher uniquement le tooltip pour le dataset principal (Solde)
          return tooltipItem.datasetIndex === mainDatasetIndex;
        },
        callbacks: {
          title: function(context: any) {
            // Après le filtre, il ne devrait y avoir qu'un seul élément (le dataset principal)
            const index = context[0]?.dataIndex ?? 0;
            return chartLabels[index] || '';
          },
          label: function(context: any) {
            // Après le filtre, on ne devrait avoir que le dataset principal
            const value = context.parsed.y || 0;
            const index = context.dataIndex;
            const pnl = pnlMapping[index] ?? 0;
            return [
              `${t('dashboard:balance')}: ${formatCurrency(value, currencySymbol)}`,
              `${t('dashboard:dayPnLShort')}: ${formatCurrency(pnl, currencySymbol)}`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          color: chartThemeColors.textSecondary,
          font: {
            size: 11,
          },
        },
        grid: {
          display: false,
        },
        border: {
          color: chartThemeColors.border,
        },
      },
      y: {
        beginAtZero: false,
        ticks: {
          color: chartThemeColors.textSecondary,
          font: {
            size: 12,
          },
          callback: function(value: any) {
            const numValue = typeof value === 'number' ? value : parseFloat(String(value));
            return formatCurrency(numValue, currencySymbol);
          },
        },
        grid: {
          color: chartThemeColors.grid,
          lineWidth: 1,
        },
        border: {
          color: chartThemeColors.border,
          display: false,
        },
        title: {
          display: false,
        },
        // Adapter automatiquement l'échelle aux données avec un padding
        afterDataLimits: (scale: any) => {
          const min = scale.min;
          const max = scale.max;
          const range = max - min;
          // Ajouter 10% de padding en haut et en bas pour une meilleure lisibilité
          const padding = range * 0.1;
          scale.min = min - padding;
          scale.max = max + padding;
        },
      },
    },
      animation: {
        duration: 1000,
        easing: 'easeInOutQuart' as const,
      },
    };
  }, [chartData, chartLabels, pnlMapping, chartThemeColors, formatCurrency, currencySymbol, t]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        {t('dashboard:noDataInPeriod')}
      </div>
    );
  }

  return <Line data={chartData} options={options} />;
}

export default AccountBalanceChart;

