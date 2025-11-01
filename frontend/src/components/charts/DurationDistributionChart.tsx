import React, { useMemo } from 'react';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

import { Bar } from 'react-chartjs-2';
import { useBarChartConfig } from '../../hooks/useChartConfig';
import { chartColors } from '../../config/chartConfig';
import ChartCard from '../common/ChartCard';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  ChartDataLabels
);

interface DurationBin {
  label: string;
  successful: number;
  unsuccessful: number;
}

interface DurationDistributionChartProps {
  bins: DurationBin[];
}

function DurationDistributionChart({ bins }: DurationDistributionChartProps) {
  const { t } = useI18nTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  // Prepare chart data
  const chartData = useMemo(() => {
    const labels = bins.map(bin => bin.label);
    const successfulData = bins.map(bin => bin.successful);
    const unsuccessfulData = bins.map(bin => bin.unsuccessful);

    return {
      labels,
      datasets: [
        {
          label: t('dashboard:winningTrades'),
          data: successfulData,
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: '#3b82f6',
          borderWidth: 0,
          borderRadius: 0,
          borderSkipped: false,
        },
        {
          label: t('dashboard:losingTrades'),
          data: unsuccessfulData,
          backgroundColor: isDark ? 'rgba(107, 114, 128, 0.8)' : 'rgba(209, 213, 219, 0.8)',
          borderColor: isDark ? chartColors.gray[500] : chartColors.gray[300],
          borderWidth: 0,
          borderRadius: 0,
          borderSkipped: false,
        }
      ]
    };
  }, [bins, t, isDark]);

  // Calculer la valeur maximale pour l'axe Y avec marge
  const maxYValue = useMemo(() => {
    if (bins.length === 0) return undefined;
    const maxValue = Math.max(...bins.map(bin => bin.successful + bin.unsuccessful));
    // Ajouter 10% de marge en haut
    return Math.ceil(maxValue * 1.10);
  }, [bins]);

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

  // Use global chart configuration
  const { options } = useBarChartConfig({
    layout: {
      padding: {
        bottom: 0  // Espace pour les labels sous l'axe X
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 15,
          font: {
            size: 12
          },
        }
      },
      datalabels: {
        display: true,
        color: function(context: any) {
          // Blanc pour les gagnants (bleu), couleur adaptée pour les perdants selon le thème
          const datasetIndex = context.datasetIndex;
          return datasetIndex === 0 ? '#ffffff' : (isDark ? '#f3f4f6' : '#1f2937');
        },
        font: {
          weight: 600,
          size: 13,
        },
        formatter: function(value: number) {
          // Afficher la valeur seulement si elle est supérieure à 0
          return value > 0 ? value.toString() : '';
        },
      }
    },
    scales: {
      x: {
        stacked: true,
        grid: {
          display: false
        },
        ticks: {
          padding: 8,  // Aligne avec le graphique "Évolution des Gains et Pertes Journalière"
        },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: {
          color: chartThemeColors.grid,
        },
      }
    },
    elements: {
      bar: {
        borderRadius: 0
      }
    },
    animation: {
      duration: 1000,
      easing: 'easeInOutQuart' as const
    }
  });

  // Ajouter la valeur max à l'axe Y et adapter les tooltips après la configuration de base
  const finalOptions = useMemo(() => ({
    ...options,
    plugins: {
      ...options.plugins,
      tooltip: {
        ...(options.plugins?.tooltip as any),
        backgroundColor: chartThemeColors.tooltipBg,
        titleColor: chartThemeColors.text,
        bodyColor: chartThemeColors.text,
        borderColor: chartThemeColors.tooltipBorder,
      },
      legend: {
        ...(options.plugins?.legend as any),
        labels: {
          ...(options.plugins?.legend as any)?.labels,
          color: chartThemeColors.text,
        },
      },
    },
    scales: {
      ...options.scales,
      x: {
        ...(options.scales?.x as any),
        ticks: {
          ...(options.scales?.x as any)?.ticks,
          color: chartThemeColors.textSecondary,
        },
        border: {
          color: chartThemeColors.border,
        },
      },
      y: {
        ...(options.scales?.y as any),
        max: maxYValue,
        grid: {
          ...(options.scales?.y as any)?.grid,
          color: chartThemeColors.grid,
        },
        ticks: {
          ...(options.scales?.y as any)?.ticks,
          color: chartThemeColors.textSecondary,
        },
        border: {
          ...(options.scales?.y as any)?.border,
          color: chartThemeColors.border,
          display: false,
        },
      },
    },
  }), [options, maxYValue, chartThemeColors]);

  return (
    <ChartCard
      title={(
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('dashboard:durationDistribution')}</h3>
        </div>
      )}
      height={420}
    >
      {bins.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
          {t('dashboard:noData')}
        </div>
      ) : (
        <Bar data={chartData} options={finalOptions} />
      )}
    </ChartCard>
  );
}

export default DurationDistributionChart;
