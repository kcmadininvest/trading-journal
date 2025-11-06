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
  ChartLegend
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
}

function AccountBalanceChart({ 
  data, 
  currencySymbol = '',
  formatCurrency: formatCurrencyProp 
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

    // Créer des labels et balances avec points intermédiaires à 0 pour les transitions
    const processedLabels: string[] = [];
    const processedBalances: number[] = [];
    const processedPnlMapping: number[] = [];

    balances.forEach((balance, index) => {
      const prevBalance = index > 0 ? balances[index - 1] : balance;
      
      // Si on traverse la ligne zéro, ajouter un point à 0
      if ((prevBalance < 0 && balance >= 0) || (prevBalance >= 0 && balance < 0)) {
        // Ajouter le point à 0 avec le label du point actuel
        processedLabels.push(dates[index]);
        processedBalances.push(0);
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
          {
            label: 'Solde',
            data: processedBalances,
            tension: 0.4, // courbe lissée
            borderWidth: 3,
            segment: {
              borderColor: (ctx: any) => {
                const v0 = ctx.p0.parsed.y;
                const v1 = ctx.p1.parsed.y;
                // Si on traverse la ligne zéro, colorer selon la position
                // Si les deux points sont du même côté de 0, utiliser le point d'arrivée
                // Si on va vers 0 (v0 != 0 et v1 == 0), utiliser le point de départ
                // Si on part de 0 (v0 == 0 et v1 != 0), utiliser le point d'arrivée
                // Utiliser les mêmes couleurs que le graphique "Performance par Jour de la Semaine"
                if (v0 === 0) {
                  // On part de 0, utiliser la couleur du point d'arrivée
                  return v1 >= 0 ? '#3b82f6' : '#ec4899';
                } else if (v1 === 0) {
                  // On va vers 0, utiliser la couleur du point de départ
                  return v0 >= 0 ? '#3b82f6' : '#ec4899';
                } else {
                  // Pas de transition par 0, utiliser la couleur du point d'arrivée
                  return v1 >= 0 ? '#3b82f6' : '#ec4899';
                }
              },
            },
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 6,
            spanGaps: false,
            _pnlMapping: processedPnlMapping, // Stocker le mapping pour les tooltips
          },
        ],
      },
      chartLabels: processedLabels,
      pnlMapping: processedPnlMapping,
    };
  }, [data, preferences.timezone]);

  // Options du graphique
  const options = useMemo(() => ({
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
        callbacks: {
          title: function(context: any) {
            const index = context[0].dataIndex;
            return chartLabels[index] || '';
          },
          label: function(context: any) {
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
        beginAtZero: true,
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
      },
    },
    animation: {
      duration: 1000,
      easing: 'easeInOutQuart' as const,
    },
  }), [chartLabels, pnlMapping, chartThemeColors, formatCurrency, currencySymbol, t]);

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

