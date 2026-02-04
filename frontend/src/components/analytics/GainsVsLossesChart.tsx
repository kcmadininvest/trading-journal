import React, { useMemo } from 'react';
import { Bar as ChartBar } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import TooltipComponent from '../ui/Tooltip';

interface GainsVsLossesChartProps {
  data: {
    gains: { range: string; rangeLabel: string; count: number; midpoint: number; start: number; end: number; binWidth: number }[];
    losses: { range: string; rangeLabel: string; count: number; midpoint: number; start: number; end: number; binWidth: number }[];
    maxCount: number;
    totalGains: number;
    totalLosses: number;
  };
  chartColors: any;
  windowWidth: number;
}

export const GainsVsLossesChart: React.FC<GainsVsLossesChartProps> = ({
  data,
  chartColors,
  windowWidth,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const gainsChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    animation: {
      duration: 0,
    },
    plugins: {
      datalabels: {
        display: true,
        anchor: 'end' as const,
        align: 'end' as const,
        color: function(context: any) {
          return isDark ? '#e5e7eb' : '#1f2937';
        },
        font: {
          weight: 600,
          size: windowWidth < 640 ? 9 : 11,
        },
        formatter: function(value: number) {
          return value > 0 ? value.toString() : '';
        },
      },
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: chartColors.tooltipBg,
        titleColor: chartColors.tooltipTitle,
        bodyColor: chartColors.tooltipBody,
        borderColor: chartColors.tooltipBorder,
        borderWidth: 1,
        padding: 12,
        titleFont: {
          size: 13,
          weight: 600,
        },
        bodyFont: {
          size: 12,
          weight: 500,
        },
        callbacks: {
          title: (items: any) => {
            const index = items[0].dataIndex;
            const bin = data.gains[index];
            return `${t('analytics:charts.gainsVsLosses.range', { defaultValue: 'Plage' })}: ${bin.range}`;
          },
          label: (context: any) => {
            const value = context.parsed.x || 0;
            const percentage = data.totalGains > 0 
              ? ((value / data.totalGains) * 100).toFixed(1)
              : '0.0';
            return [
              `${t('analytics:charts.gainsVsLosses.count', { defaultValue: 'Nombre' })}: ${value}`,
              `${t('analytics:charts.gainsVsLosses.percentage', { defaultValue: 'Pourcentage' })}: ${percentage}%`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        grace: 1,
        ticks: {
          stepSize: 1,
          color: chartColors.textSecondary,
          font: {
            size: 11,
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
          display: true,
          text: t('analytics:charts.gainsVsLosses.count', { defaultValue: 'Nombre de trades' }),
          color: chartColors.text,
          font: {
            size: 12,
            weight: 600,
          },
        },
      },
      y: {
        ticks: {
          color: chartColors.textSecondary,
          font: {
            size: 10,
          },
          maxRotation: 0,
        },
        grid: {
          display: false,
        },
        border: {
          color: chartColors.border,
        },
      },
    },
  }), [chartColors, t, data.gains, data.totalGains, windowWidth, isDark]);

  const lossesChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    animation: {
      duration: 0,
    },
    plugins: {
      datalabels: {
        display: true,
        anchor: 'end' as const,
        align: 'end' as const,
        color: function(context: any) {
          return isDark ? '#e5e7eb' : '#1f2937';
        },
        font: {
          weight: 600,
          size: windowWidth < 640 ? 9 : 11,
        },
        formatter: function(value: number) {
          return value > 0 ? value.toString() : '';
        },
      },
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: chartColors.tooltipBg,
        titleColor: chartColors.tooltipTitle,
        bodyColor: chartColors.tooltipBody,
        borderColor: chartColors.tooltipBorder,
        borderWidth: 1,
        padding: 12,
        titleFont: {
          size: 13,
          weight: 600,
        },
        bodyFont: {
          size: 12,
          weight: 500,
        },
        callbacks: {
          title: (items: any) => {
            const index = items[0].dataIndex;
            const bin = data.losses[index];
            return `${t('analytics:charts.gainsVsLosses.range', { defaultValue: 'Plage' })}: ${bin.range}`;
          },
          label: (context: any) => {
            const value = context.parsed.x || 0;
            const percentage = data.totalLosses > 0 
              ? ((value / data.totalLosses) * 100).toFixed(1)
              : '0.0';
            return [
              `${t('analytics:charts.gainsVsLosses.count', { defaultValue: 'Nombre' })}: ${value}`,
              `${t('analytics:charts.gainsVsLosses.percentage', { defaultValue: 'Pourcentage' })}: ${percentage}%`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        grace: 1,
        ticks: {
          stepSize: 1,
          color: chartColors.textSecondary,
          font: {
            size: 11,
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
          display: true,
          text: t('analytics:charts.gainsVsLosses.count', { defaultValue: 'Nombre de trades' }),
          color: chartColors.text,
          font: {
            size: 12,
            weight: 600,
          },
        },
      },
      y: {
        ticks: {
          color: chartColors.textSecondary,
          font: {
            size: 10,
          },
          maxRotation: 0,
        },
        grid: {
          display: false,
        },
        border: {
          color: chartColors.border,
        },
      },
    },
  }), [chartColors, t, data.losses, data.totalLosses, windowWidth, isDark]);

  if (!data) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow duration-300">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-indigo-600 rounded-full mr-3"></div>
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
          {t('analytics:charts.gainsVsLosses.title', { defaultValue: 'Distribution des Gains vs Pertes' })}
        </h3>
        <TooltipComponent
          content={t('analytics:charts.gainsVsLosses.tooltip', { defaultValue: 'Ce graphique compare la distribution de vos gains et de vos pertes séparément. L\'histogramme de gauche montre la répartition des trades gagnants par plages de valeurs, et celui de droite montre la répartition des trades perdants. Cela permet d\'identifier les patterns et de comparer la distribution des gains et des pertes pour optimiser votre stratégie.' })}
          position="top"
        >
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-help">
            <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </TooltipComponent>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 text-center">
            {t('analytics:charts.gainsVsLosses.gains', { defaultValue: 'Gains' })} ({data.totalGains} {t('analytics:common.trades', { defaultValue: 'trades' })})
          </h4>
          <div style={{ height: '280px', position: 'relative' }}>
            <ChartBar
              data={{
                labels: data.gains.map(b => b.rangeLabel),
                datasets: [
                  {
                    label: t('analytics:charts.gainsVsLosses.gains', { defaultValue: 'Gains' }),
                    data: data.gains.map(b => b.count),
                    backgroundColor: isDark 
                      ? 'rgba(59, 130, 246, 0.8)' 
                      : 'rgba(59, 130, 246, 0.7)',
                    borderColor: isDark ? '#60a5fa' : '#3b82f6',
                    borderWidth: 1,
                  },
                ],
              }}
              options={gainsChartOptions}
            />
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 text-center">
            {t('analytics:charts.gainsVsLosses.losses', { defaultValue: 'Pertes' })} ({data.totalLosses} {t('analytics:common.trades', { defaultValue: 'trades' })})
          </h4>
          <div style={{ height: '280px', position: 'relative' }}>
            <ChartBar
              data={{
                labels: data.losses.map(b => b.rangeLabel),
                datasets: [
                  {
                    label: t('analytics:charts.gainsVsLosses.losses', { defaultValue: 'Pertes' }),
                    data: data.losses.map(b => b.count),
                    backgroundColor: isDark 
                      ? 'rgba(236, 72, 153, 0.8)' 
                      : 'rgba(236, 72, 153, 0.7)',
                    borderColor: isDark ? '#f472b6' : '#ec4899',
                    borderWidth: 1,
                  },
                ],
              }}
              options={lossesChartOptions}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
