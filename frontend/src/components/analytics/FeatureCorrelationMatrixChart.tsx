import React from 'react';
import { useTranslation } from 'react-i18next';
import TooltipComponent from '../ui/Tooltip';
import { usePreferences } from '../../hooks/usePreferences';
import { ANALYTICS_CHART_CARD_CLASS, getDivergingCellColor } from '../../utils/chartConfig';
import { formatNumber, type NumberFormatType } from '../../utils/numberFormat';

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
  const { preferences } = usePreferences();
  const numberFormat = (preferences.number_format as NumberFormatType) || 'comma';

  const getCellTextClass = (value: number): string => {
    const intensity = Math.abs(value);
    return (intensity >= 0.45 || isDark) ? 'correlation-text-dark' : 'correlation-text-light';
  };

  const formatCoefficient = (value: number): string => {
    const formatted = formatNumber(value, 2, numberFormat);
    return value >= 0 ? `+${formatted}` : formatted;
  };

  if (!data.labels.length || !data.matrix.length) {
    return (
      <div className={ANALYTICS_CHART_CARD_CLASS}>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('analytics:noData')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={ANALYTICS_CHART_CARD_CLASS}>
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
              <div key={`col-${label}`} className="p-2 text-xs font-semibold text-center text-chart-secondary">
                {label}
              </div>
            ))}

            {data.labels.map((rowLabel, rowIndex) => (
              <React.Fragment key={`row-${rowLabel}`}>
                <div className="p-2 text-sm font-semibold text-chart-secondary">
                  {rowLabel}
                </div>
                {data.matrix[rowIndex].map((value, colIndex) => {
                  const coefficient = formatCoefficient(value);
                  return (
                    <div
                      key={`${rowLabel}-${colIndex}`}
                      className={`m-1 rounded-md flex items-center justify-center h-12 text-xs font-semibold ${getCellTextClass(value)}`}
                      style={{ backgroundColor: getDivergingCellColor(value, isDark) }}
                      title={`${rowLabel} / ${data.labels[colIndex]}: ${coefficient}`}
                    >
                      {coefficient}
                    </div>
                  );
                })}
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
