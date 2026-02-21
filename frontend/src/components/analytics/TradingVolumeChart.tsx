import React from 'react';
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
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import TooltipComponent from '../ui/Tooltip';

// Enregistrer les composants nécessaires pour le graphique mixte
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  ChartTooltip,
  ChartLegend
);

interface TradingVolumeChartProps {
  data: {
    labels: string[];
    data: number[];
    movingAverage?: number[];
    stats?: {
      total: number;
      average: number;
      median: number;
      max: number;
      min: number;
    };
    aggregation?: 'day' | 'week' | 'month';
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

  if (!data) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow duration-300 min-h-[450px]">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-1 h-6 bg-gradient-to-b from-cyan-500 to-cyan-600 rounded-full mr-3"></div>
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            {t('analytics:charts.tradingVolume.title', { defaultValue: 'Volume de Trading' })}
          </h3>
        </div>
        <div className="flex items-center justify-center h-[350px]">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('analytics:noData', { defaultValue: 'Aucune donnée disponible' })}</p>
        </div>
      </div>
    );
  }

  const aggregationLabel = data.aggregation === 'month' 
    ? t('analytics:charts.tradingVolume.byMonth', { defaultValue: 'par mois' })
    : data.aggregation === 'week'
    ? t('analytics:charts.tradingVolume.byWeek', { defaultValue: 'par semaine' })
    : t('analytics:charts.tradingVolume.byDay', { defaultValue: 'par jour' });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow duration-300 min-h-[450px]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-gradient-to-b from-cyan-500 to-cyan-600 rounded-full mr-3"></div>
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            {t('analytics:charts.tradingVolume.title', { defaultValue: 'Volume de Trading dans le Temps' })}
          </h3>
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">({aggregationLabel})</span>
          <TooltipComponent
            content={t('analytics:charts.tradingVolume.tooltip', { defaultValue: 'Ce graphique montre le nombre de trades dans le temps avec agrégation automatique selon la période. La ligne orange représente la moyenne mobile sur 7 périodes.' })}
            position="top"
          >
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-help">
              <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </TooltipComponent>
        </div>
        {data.stats && (
          <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <span className="font-medium">{t('analytics:charts.tradingVolume.avg', { defaultValue: 'Moy.' })}:</span>
              <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{data.stats.average.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">{t('analytics:charts.tradingVolume.max', { defaultValue: 'Max' })}:</span>
              <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{data.stats.max}</span>
            </div>
          </div>
        )}
      </div>
      <div style={{ height: '320px', position: 'relative' }}>
        <Chart
          type="bar"
          data={{
            labels: data.labels,
            datasets: [
              {
                type: 'bar' as const,
                label: t('analytics:charts.tradingVolume.label', { defaultValue: 'Nombre de trades' }),
                data: data.data,
                backgroundColor: isDark 
                  ? 'rgba(6, 182, 212, 0.6)' 
                  : 'rgba(8, 145, 178, 0.7)',
                borderColor: isDark ? '#06b6d4' : '#0891b2',
                borderWidth: 1,
                borderRadius: 0, // Barres avec coins carrés
                borderSkipped: false,
              },
              ...(data.movingAverage ? [{
                type: 'line' as const,
                label: t('analytics:charts.tradingVolume.movingAverage', { defaultValue: 'Moyenne mobile (7)' }),
                data: data.movingAverage,
                borderColor: '#f97316',
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [5, 5],
                pointRadius: 0,
                pointHoverRadius: 4,
                tension: 0.4,
                fill: false,
                yAxisID: 'y',
              }] : []),
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            animation: {
              duration: 0,
            },
            interaction: {
              mode: 'index' as const,
              intersect: false,
            },
            plugins: {
              datalabels: {
                display: false,
              },
              legend: {
                display: data.movingAverage ? true : false,
                position: 'bottom' as const,
                labels: {
                  color: chartColors.textSecondary,
                  font: {
                    size: 11,
                  },
                  usePointStyle: true,
                  padding: 12,
                },
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
                    const datasetLabel = context.dataset.label || '';
                    if (datasetLabel.includes('Moyenne mobile')) {
                      return `${datasetLabel}: ${value.toFixed(1)}`;
                    }
                    return `${datasetLabel}: ${value}`;
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
                  display: false,
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
                  precision: 0,
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
                // Ajouter une marge au-dessus des barres les plus hautes
                afterDataLimits: (scale: any) => {
                  const max = scale.max;
                  const range = max - scale.min;
                  // Ajouter 10% de padding en haut pour une meilleure lisibilité
                  const padding = range * 0.1;
                  scale.max = max + padding;
                },
              },
            },
          }}
        />
      </div>
    </div>
  );
};

