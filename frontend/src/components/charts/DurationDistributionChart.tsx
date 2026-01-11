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
  
  // Couleurs du thème
  const chartThemeColors = useMemo(() => ({
    text: isDark ? '#d1d5db' : '#374151',
    textSecondary: isDark ? '#9ca3af' : '#6b7280',
    grid: isDark ? '#374151' : '#e5e7eb',
    border: isDark ? '#4b5563' : '#d1d5db',
    tooltipBg: isDark ? '#374151' : '#ffffff',
    tooltipBorder: isDark ? '#4b5563' : '#e5e7eb',
  }), [isDark]);

  // Données du graphique
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
          borderColor: isDark ? '#6b7280' : '#d1d5db',
          borderWidth: 0,
          borderRadius: 0,
          borderSkipped: false,
        }
      ]
    };
  }, [bins, t, isDark]);

  // Valeur maximale pour l'axe Y
  const maxYValue = useMemo(() => {
    if (bins.length === 0) return undefined;
    const maxValue = Math.max(...bins.map(bin => bin.successful + bin.unsuccessful));
    return Math.ceil(maxValue * 1.10);
  }, [bins]);

  // Configuration du graphique
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 0,
        right: 0,
        bottom: 5,
        left: 0
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 12,
          font: {
            size: 12
          },
          color: chartThemeColors.text,
          boxWidth: 10,
          boxHeight: 10,
        }
      },
      tooltip: {
        backgroundColor: chartThemeColors.tooltipBg,
        titleColor: chartThemeColors.text,
        bodyColor: chartThemeColors.text,
        borderColor: chartThemeColors.tooltipBorder,
        borderWidth: 1,
        padding: 12,
        displayColors: true,
      },
      datalabels: {
        display: true,
        anchor: 'center' as const,
        align: 'center' as const,
        color: function(context: any) {
          const datasetIndex = context.datasetIndex;
          return datasetIndex === 0 ? '#ffffff' : (isDark ? '#f3f4f6' : '#1f2937');
        },
        font: {
          weight: 600 as const,
          size: 13,
        },
        formatter: function(value: number) {
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
          maxRotation: 0,
          minRotation: 0,
          color: chartThemeColors.textSecondary,
          font: {
            size: 11
          },
        },
        border: {
          color: chartThemeColors.border,
        },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        max: maxYValue,
        grid: {
          color: chartThemeColors.grid,
          lineWidth: 1,
        },
        ticks: {
          color: chartThemeColors.textSecondary,
          font: {
            size: 11
          },
        },
        border: {
          color: chartThemeColors.border,
          display: false,
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
  }), [chartThemeColors, maxYValue, isDark]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          {t('dashboard:durationDistribution')}
        </h3>
      </div>

      <div className="h-[460px]">
        {bins.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            {t('dashboard:noData')}
          </div>
        ) : (
          <Bar data={chartData} options={chartOptions} />
        )}
      </div>
    </div>
  );
}

export default DurationDistributionChart;
