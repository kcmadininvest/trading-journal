import React from 'react';
import { useTranslation } from 'react-i18next';
import TooltipComponent from '../ui/Tooltip';

interface FeatureCorrelationMatrixChartProps {
  data: {
    labels: string[];
    matrix: number[][];
  };
  chartColors: any;
  isDark: boolean;
}

export const FeatureCorrelationMatrixChart: React.FC<FeatureCorrelationMatrixChartProps> = ({
  data,
  chartColors,
  isDark,
}) => {
  const { t } = useTranslation();

  const getCellColor = (value: number): string => {
    const clamped = Math.max(-1, Math.min(1, value));
    const intensity = Math.abs(clamped);

    if (clamped > 0) {
      if (isDark) {
        if (intensity < 0.2) return '#1e3a8a';
        if (intensity < 0.4) return '#1e40af';
        if (intensity < 0.6) return '#2563eb';
        if (intensity < 0.8) return '#3b82f6';
        return '#60a5fa';
      }
      if (intensity < 0.2) return '#dbeafe';
      if (intensity < 0.4) return '#93c5fd';
      if (intensity < 0.6) return '#60a5fa';
      if (intensity < 0.8) return '#3b82f6';
      return '#2563eb';
    }

    if (clamped < 0) {
      if (isDark) {
        if (intensity < 0.2) return '#831843';
        if (intensity < 0.4) return '#9f1239';
        if (intensity < 0.6) return '#be185d';
        if (intensity < 0.8) return '#db2777';
        return '#ec4899';
      }
      if (intensity < 0.2) return '#fce7f3';
      if (intensity < 0.4) return '#f9a8d4';
      if (intensity < 0.6) return '#f472b6';
      if (intensity < 0.8) return '#ec4899';
      return '#db2777';
    }

    return isDark ? '#4b5563' : '#e5e7eb';
  };

  if (!data.labels.length || !data.matrix.length) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 min-h-[450px]">
        <div className="flex items-center justify-center h-[320px]">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('analytics:noData')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow duration-300">
      <div className="flex items-center mb-6">
        <div className="w-1 h-6 bg-gradient-to-b from-orange-500 to-orange-600 rounded-full mr-3"></div>
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
          {t('analytics:charts.featureCorrelationMatrix.title')}
        </h3>
        <TooltipComponent
          content={t('analytics:charts.featureCorrelationMatrix.tooltip')}
          position="top"
        >
          <div className="ml-3 flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-help">
            <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </TooltipComponent>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full align-middle">
          <div className="grid" style={{ gridTemplateColumns: `150px repeat(${data.labels.length}, minmax(88px, 1fr))` }}>
            <div className="p-2"></div>
            {data.labels.map((label) => (
              <div key={`col-${label}`} className="p-2 text-xs font-semibold text-center" style={{ color: chartColors.textSecondary }}>
                {label}
              </div>
            ))}

            {data.labels.map((rowLabel, rowIndex) => (
              <React.Fragment key={`row-${rowLabel}`}>
                <div className="p-2 text-sm font-semibold" style={{ color: chartColors.textSecondary }}>
                  {rowLabel}
                </div>
                {data.matrix[rowIndex].map((value, colIndex) => (
                  <div
                    key={`${rowLabel}-${colIndex}`}
                    className="m-1 rounded-md flex items-center justify-center h-12 text-xs font-semibold"
                    style={{
                      backgroundColor: getCellColor(value),
                      color: Math.abs(value) >= 0.45 || isDark ? '#ffffff' : '#1f2937',
                    }}
                    title={`${rowLabel} / ${data.labels[colIndex]}: ${value.toFixed(2)}`}
                  >
                    {value >= 0 ? '+' : ''}
                    {value.toFixed(2)}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
        {t('analytics:charts.featureCorrelationMatrix.description')}
      </p>
    </div>
  );
};
