import React from 'react';
import { Doughnut as ChartDoughnut } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import TooltipComponent from '../ui/Tooltip';

interface TradesDistributionChartProps {
  data: {
    labels: string[];
    data: number[];
    percentages: string[];
  } | null;
  chartColors: any;
}

export const TradesDistributionChart: React.FC<TradesDistributionChartProps> = ({
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
        <div className="w-1 h-6 bg-gradient-to-b from-pink-500 to-pink-600 rounded-full mr-3"></div>
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
          {t('analytics:charts.tradesDistribution.title', { defaultValue: 'Répartition des Trades par Résultat' })}
        </h3>
        <TooltipComponent
          content={t('analytics:charts.tradesDistribution.tooltip', { defaultValue: 'Ce graphique montre la répartition de vos trades entre gagnants, perdants et neutres. Cela permet de visualiser rapidement le ratio de trades gagnants vs perdants.' })}
          position="top"
        >
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-help">
            <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </TooltipComponent>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        <div style={{ height: '280px', position: 'relative' }}>
          <ChartDoughnut
            data={{
              labels: data.labels,
              datasets: [
                {
                  data: data.data,
                  backgroundColor: [
                    isDark ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.7)',
                    isDark ? 'rgba(236, 72, 153, 0.8)' : 'rgba(236, 72, 153, 0.7)',
                    isDark ? 'rgba(156, 163, 175, 0.8)' : 'rgba(156, 163, 175, 0.7)',
                  ],
                  borderColor: [
                    isDark ? '#60a5fa' : '#3b82f6',
                    isDark ? '#f472b6' : '#ec4899',
                    isDark ? '#9ca3af' : '#6b7280',
                  ],
                  borderWidth: 2,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                datalabels: {
                  display: true,
                  color: function(context: any) {
                    return '#ffffff';
                  },
                  font: {
                    weight: 600,
                    size: 14,
                  },
                  formatter: function(value: number, context: any) {
                    const percentage = data.percentages[context.dataIndex];
                    return `${percentage}%`;
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
                    label: (context: any) => {
                      const label = context.label || '';
                      const value = context.parsed;
                      const percentage = data.percentages[context.dataIndex];
                      return [
                        `${label}: ${value}`,
                        `${t('analytics:charts.tradesDistribution.percentage', { defaultValue: 'Pourcentage' })}: ${percentage}%`,
                      ];
                    },
                  },
                },
              },
            }}
          />
        </div>
        <div className="space-y-4">
          {data.labels.map((label, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{
                    backgroundColor: index === 0
                      ? (isDark ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.7)')
                      : index === 1
                      ? (isDark ? 'rgba(236, 72, 153, 0.8)' : 'rgba(236, 72, 153, 0.7)')
                      : (isDark ? 'rgba(156, 163, 175, 0.8)' : 'rgba(156, 163, 175, 0.7)'),
                  }}
                ></div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-gray-800 dark:text-gray-200">
                  {data.data[index]}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {data.percentages[index]}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

