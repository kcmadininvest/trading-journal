import React from 'react';
import { Line as ChartLine } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import TooltipComponent from '../ui/Tooltip';

interface TradingVolumeChartProps {
  data: {
    labels: string[];
    data: number[];
  } | null;
  chartColors: any;
}

export const TradingVolumeChart: React.FC<TradingVolumeChartProps> = ({
  data,
  chartColors,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (!data) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow duration-300">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-1 h-6 bg-gradient-to-b from-cyan-500 to-cyan-600 rounded-full mr-3"></div>
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
          {t('analytics:charts.tradingVolume.title', { defaultValue: 'Volume de Trading dans le Temps' })}
        </h3>
        <TooltipComponent
          content={t('analytics:charts.tradingVolume.tooltip', { defaultValue: 'Ce graphique montre le nombre de trades par jour dans le temps. Cela permet d\'identifier les périodes d\'activité intense et les périodes calmes.' })}
          position="top"
        >
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-help">
            <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </TooltipComponent>
      </div>
      <div style={{ height: '320px', position: 'relative' }}>
        <ChartLine
          data={{
            labels: data.labels,
            datasets: [
              {
                label: t('analytics:charts.tradingVolume.label', { defaultValue: 'Nombre de trades' }),
                data: data.data,
                borderColor: isDark ? '#06b6d4' : '#0891b2',
                backgroundColor: isDark ? 'rgba(6, 182, 212, 0.1)' : 'rgba(8, 145, 178, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 4,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              datalabels: {
                display: false,
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
                  label: (context: any) => {
                    const value = context.parsed.y;
                    return `${t('analytics:charts.tradingVolume.label', { defaultValue: 'Nombre de trades' })}: ${value}`;
                  },
                },
              },
            },
            scales: {
              x: {
                ticks: {
                  color: chartColors.textSecondary,
                  font: {
                    size: 11,
                  },
                  maxRotation: 45,
                  minRotation: 0,
                },
                grid: {
                  color: chartColors.grid,
                  lineWidth: 1,
                },
                border: {
                  color: chartColors.border,
                },
              },
              y: {
                beginAtZero: true,
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
                  display: false,
                },
                title: {
                  display: false,
                },
              },
            },
          }}
        />
      </div>
    </div>
  );
};

