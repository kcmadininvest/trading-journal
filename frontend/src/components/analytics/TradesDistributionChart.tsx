import React from 'react';
import clsx from 'clsx';
import { Doughnut as ChartDoughnut } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { ChartHelpTooltip } from '../charts/ChartHelpTooltip';
import { ChartTooltipResetContainer } from '../charts/ChartTooltipResetContainer';
import { CHART_FONT_FAMILY, buildChartTooltipPlugin } from '../../utils/chartConfig';

interface TradesDistributionChartProps {
  data: {
    labels: string[];
    data: number[];
    percentages: string[];
  } | null;
  chartColors: any;
  variant?: 'full' | 'compact';
}

export const TradesDistributionChart: React.FC<TradesDistributionChartProps> = ({
  data,
  chartColors,
  variant = 'full',
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isCompact = variant === 'compact';

  const shellClass = clsx(
    'rounded-xl border border-gray-100 bg-white shadow-lg transition-shadow duration-300 dark:border-gray-700 dark:bg-gray-800',
    isCompact ? 'min-h-[280px] p-4 sm:p-6' : 'min-h-[450px] p-6 hover:shadow-xl'
  );
  const titleClass = clsx(
    'font-bold text-gray-800 dark:text-gray-100',
    isCompact ? 'text-base sm:text-lg' : 'text-xl'
  );
  const chartHeight = isCompact ? 200 : 320;
  const emptyHeight = isCompact ? 200 : 350;
  const datalabelSize = isCompact ? 12 : 14;

  const title = t('analytics:charts.tradesDistribution.title', {
    defaultValue: 'Répartition des Trades par Résultat',
  });

  if (!data) {
    return (
      <div className={shellClass}>
        <div className="mb-4 flex items-center gap-2 sm:mb-6">
          <div className="mr-2 h-6 w-1 rounded-full bg-gradient-to-b from-pink-500 to-pink-600" />
          <h3 className={titleClass}>{title}</h3>
        </div>
        <div className="flex items-center justify-center" style={{ height: emptyHeight }}>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('analytics:noData', { defaultValue: 'Aucune donnée disponible' })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className={clsx('mb-4 flex items-center gap-2', !isCompact && 'sm:mb-6')}>
        <div className="mr-2 h-6 w-1 rounded-full bg-gradient-to-b from-pink-500 to-pink-600" />
        <h3 className={titleClass}>{title}</h3>
        <ChartHelpTooltip
          content={t('analytics:charts.tradesDistribution.tooltip', {
            defaultValue:
              'Ce graphique montre la répartition de vos trades entre gagnants, perdants et break-even.',
          })}
        />
      </div>
      <div className={clsx('grid items-center gap-4', isCompact ? 'grid-cols-1' : 'grid-cols-1 gap-6 md:grid-cols-2')}>
        <ChartTooltipResetContainer style={{ height: chartHeight, position: 'relative' }}>
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
                  borderColor: [isDark ? '#60a5fa' : '#3b82f6', isDark ? '#f472b6' : '#ec4899', isDark ? '#9ca3af' : '#6b7280'],
                  borderWidth: 0,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                datalabels: {
                  display: true,
                  color: () => '#ffffff',
                  font: {
                    family: CHART_FONT_FAMILY,
                    weight: 600,
                    size: datalabelSize,
                  },
                  formatter: (_value: number, context: { dataIndex: number }) => {
                    return `${data.percentages[context.dataIndex]}%`;
                  },
                },
                legend: { display: false },
                tooltip: {
                  ...buildChartTooltipPlugin(chartColors, 'barStackedLike', undefined, {
                    padding: 12,
                    callbacks: {
                      label: (context: { label?: string; parsed: number; dataIndex: number }) => {
                        const label = context.label || '';
                        const value = context.parsed;
                        const percentage = data.percentages[context.dataIndex];
                        return [
                          `${label}: ${value}`,
                          `${t('analytics:charts.tradesDistribution.percentage', { defaultValue: 'Pourcentage' })}: ${percentage}%`,
                        ];
                      },
                    },
                  }),
                },
              },
            }}
          />
        </ChartTooltipResetContainer>
        <div className={clsx('space-y-3', isCompact && 'sm:space-y-2')}>
          {data.labels.map((label, index) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50"
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-4 w-4 rounded-full"
                  style={{
                    backgroundColor:
                      index === 0
                        ? isDark
                          ? 'rgba(59, 130, 246, 0.8)'
                          : 'rgba(59, 130, 246, 0.7)'
                        : index === 1
                          ? isDark
                            ? 'rgba(236, 72, 153, 0.8)'
                            : 'rgba(236, 72, 153, 0.7)'
                          : isDark
                            ? 'rgba(156, 163, 175, 0.8)'
                            : 'rgba(156, 163, 175, 0.7)',
                  }}
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-gray-800 dark:text-gray-200">{data.data[index]}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{data.percentages[index]}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
