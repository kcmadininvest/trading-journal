import React from 'react';
import { ChartSection } from '../../common/ChartSection';
import { MemoizedDoughnut as Doughnut } from './MemoizedCharts';

interface EmotionsChartProps {
  data: any;
  options: any;
  formatNumber: (value: number, digits?: number) => string;
  t: any;
}

export const EmotionsChart: React.FC<EmotionsChartProps> = React.memo(({
  data,
  options,
  formatNumber,
  t,
}) => {
  return (
    <ChartSection
      title={t('strategies:dominantEmotionsDistribution')}
      tooltip={t('strategies:dominantEmotionsDistributionTooltip')}
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        {/* Statistiques gauche (2 cartes) */}
        <div className="flex flex-row lg:flex-col gap-3 lg:gap-4 lg:w-52 xl:w-56 flex-shrink-0">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 lg:p-4 flex-1 lg:flex-none">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
              {t('strategies:numberOfOccurrences', { defaultValue: 'Nombre d\'occurrences' })}
            </div>
            <div className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">
              {(data as any)?.total || 0}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 lg:p-4 flex-1 lg:flex-none">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
              {t('strategies:totalEmotions', { defaultValue: 'Émotions différentes' })}
            </div>
            <div className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">
              {(data as any)?.totalEmotions || 0}
            </div>
          </div>
        </div>
        
        {/* Graphique Doughnut au centre */}
        <div className="flex-1 h-64 sm:h-72 md:h-80 min-w-0">
          <Doughnut data={data} options={options} />
        </div>
        
        {/* Statistiques droite (2 cartes) */}
        <div className="flex flex-row lg:flex-col gap-3 lg:gap-4 lg:w-52 xl:w-56 flex-shrink-0">
          {(data as any)?.topEmotion && (
            <>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 lg:p-4 flex-1 lg:flex-none">
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  {t('strategies:mostFrequentEmotion', { defaultValue: 'Émotion la plus fréquente' })}
                </div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5 truncate" title={(data as any).topEmotion.label}>
                  {(data as any).topEmotion.label}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 lg:p-4 flex-1 lg:flex-none">
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  {t('strategies:percentage', { defaultValue: 'Pourcentage' })}
                </div>
                <div className="text-xl lg:text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatNumber((data as any).topEmotion.percentage, 1)}%
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </ChartSection>
  );
});

EmotionsChart.displayName = 'EmotionsChart';
