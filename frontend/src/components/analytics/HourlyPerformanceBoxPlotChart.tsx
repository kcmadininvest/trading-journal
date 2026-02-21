import React, { useMemo } from 'react';
import { Chart as ChartJS } from 'chart.js';
import { BoxPlotController, BoxAndWiskers } from '@sgratzl/chartjs-chart-boxplot';
import { Chart } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../utils/numberFormat';

ChartJS.register(BoxPlotController, BoxAndWiskers);

interface HourlyPerformanceBoxPlotChartProps {
  data: {
    data: { timeSlot: number; pnl: number }[];
    timeSlotsWithData: number[];
  };
  currencySymbol: string;
  chartColors: any;
}

interface BoxPlotData {
  hour: string;
  hourNum: number;
  values: number[];
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  outliers: number[];
}

const calculateBoxPlotStats = (values: number[]): Omit<BoxPlotData, 'hour' | 'hourNum' | 'values'> => {
  if (values.length === 0) {
    return { min: 0, q1: 0, median: 0, q3: 0, max: 0, outliers: [] };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const q1Index = Math.floor(n * 0.25);
  const medianIndex = Math.floor(n * 0.5);
  const q3Index = Math.floor(n * 0.75);

  const q1 = sorted[q1Index];
  const median = n % 2 === 0 ? (sorted[medianIndex - 1] + sorted[medianIndex]) / 2 : sorted[medianIndex];
  const q3 = sorted[q3Index];

  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;

  const outliers: number[] = [];
  let min = sorted[0];
  let max = sorted[n - 1];

  for (let i = 0; i < n; i++) {
    if (sorted[i] < lowerFence || sorted[i] > upperFence) {
      outliers.push(sorted[i]);
    } else {
      if (sorted[i] < min || min < lowerFence) min = sorted[i];
      if (sorted[i] > max || max > upperFence) max = sorted[i];
    }
  }

  return { min, q1, median, q3, max, outliers };
};

export const HourlyPerformanceBoxPlotChart: React.FC<HourlyPerformanceBoxPlotChartProps> = ({
  data,
  currencySymbol,
  chartColors,
}) => {
  const { t } = useTranslation();

  const boxPlotData = useMemo(() => {
    const hourlyGroups: { [hour: number]: number[] } = {};

    data.data.forEach(({ timeSlot, pnl }) => {
      const hour = Math.floor(timeSlot);
      if (!hourlyGroups[hour]) {
        hourlyGroups[hour] = [];
      }
      hourlyGroups[hour].push(pnl);
    });

    const hours = Object.keys(hourlyGroups)
      .map(Number)
      .sort((a, b) => a - b);

    return hours.map(hour => {
      const values = hourlyGroups[hour];
      const stats = calculateBoxPlotStats(values);
      return {
        hour: `${hour.toString().padStart(2, '0')}:00`,
        hourNum: hour,
        values,
        ...stats,
      };
    });
  }, [data]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 0,
    },
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
        padding: 16,
        titleFont: {
          size: 14,
          weight: 600,
        },
        bodyFont: {
          size: 13,
          weight: 500,
        },
        displayColors: false,
        callbacks: {
          title: (items: any) => {
            const index = items[0].dataIndex;
            return boxPlotData[index].hour;
          },
          label: (context: any) => {
            const index = context.dataIndex;
            const stats = boxPlotData[index];
            return [
              `${t('analytics:charts.hourlyPerformanceBoxPlot.max')}: ${formatCurrency(stats.max, currencySymbol)}`,
              `${t('analytics:charts.hourlyPerformanceBoxPlot.q3')}: ${formatCurrency(stats.q3, currencySymbol)}`,
              `${t('analytics:charts.hourlyPerformanceBoxPlot.median')}: ${formatCurrency(stats.median, currencySymbol)}`,
              `${t('analytics:charts.hourlyPerformanceBoxPlot.q1')}: ${formatCurrency(stats.q1, currencySymbol)}`,
              `${t('analytics:charts.hourlyPerformanceBoxPlot.min')}: ${formatCurrency(stats.min, currencySymbol)}`,
              `${t('analytics:charts.hourlyPerformanceBoxPlot.trades')}: ${stats.values.length}`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        type: 'category' as const,
        ticks: {
          maxRotation: 45,
          minRotation: 45,
          color: chartColors.textSecondary,
          font: {
            size: 11,
          },
        },
        grid: {
          display: false,
        },
        border: {
          color: chartColors.border,
        },
        title: {
          display: true,
          text: t('analytics:charts.hourlyPerformanceBoxPlot.xAxis'),
          color: chartColors.text,
          font: {
            size: 13,
            weight: 600,
          },
        },
      },
      y: {
        ticks: {
          color: chartColors.textSecondary,
          font: {
            size: 12,
          },
          callback: function(value: any) {
            const numValue = typeof value === 'number' ? value : parseFloat(String(value));
            return formatCurrency(numValue, currencySymbol);
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
          display: true,
          text: t('analytics:charts.hourlyPerformanceBoxPlot.yAxis'),
          color: chartColors.text,
          font: {
            size: 13,
            weight: 600,
          },
        },
      },
    },
  }), [chartColors, currencySymbol, t, boxPlotData]);

  if (!data || data.data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow duration-300 min-h-[450px]">
        <div className="flex items-center justify-center h-[450px]">
          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('analytics:noData', { defaultValue: 'Aucune donnée disponible' })}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow duration-300 min-h-[450px]">
      <div className="mb-3">
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2 flex items-center">
          <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full mr-3"></div>
          {t('analytics:charts.hourlyPerformanceBoxPlot.title')}
        </h3>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-2.5 bg-blue-500 bg-opacity-50 border-2 border-blue-500 rounded"></span>
            <span>{t('analytics:charts.hourlyPerformanceBoxPlot.boxDescription', { defaultValue: 'Boîte : 50% des trades centraux (Q1 à Q3)' })}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-0.5 bg-blue-900 dark:bg-blue-300"></span>
            <span>{t('analytics:charts.hourlyPerformanceBoxPlot.medianDescription', { defaultValue: 'Ligne centrale : Médiane (valeur du milieu)' })}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-0.5 h-2.5 bg-blue-500"></span>
            <span>{t('analytics:charts.hourlyPerformanceBoxPlot.whiskersDescription', { defaultValue: 'Moustaches : Étendue des valeurs normales' })}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex gap-0.5">
              <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
              <span className="inline-block w-1.5 h-1.5 bg-pink-500 rounded-full"></span>
            </span>
            <span>{t('analytics:charts.hourlyPerformanceBoxPlot.outliersDescription', { defaultValue: 'Points : Valeurs exceptionnelles (bleu = gains, rose = pertes)' })}</span>
          </div>
        </div>
      </div>
      <div style={{ height: '320px', position: 'relative' }}>
        <Chart
          type="boxplot"
          data={{
            labels: boxPlotData.map(d => d.hour),
            datasets: [
              {
                label: t('analytics:charts.hourlyPerformanceBoxPlot.label'),
                data: boxPlotData.map(d => ({
                  min: d.min,
                  q1: d.q1,
                  median: d.median,
                  q3: d.q3,
                  max: d.max,
                  outliers: d.outliers,
                })),
                backgroundColor: 'rgba(59, 130, 246, 0.3)',
                borderColor: '#3b82f6',
                borderWidth: 2,
                outlierBackgroundColor: (context: any) => {
                  const dataIndex = context.dataIndex;
                  const outlierIndex = context.outlierIndex;
                  if (dataIndex !== undefined && outlierIndex !== undefined) {
                    const outlierValue = boxPlotData[dataIndex]?.outliers[outlierIndex];
                    return outlierValue >= 0 ? '#3b82f6' : '#ec4899';
                  }
                  return '#ec4899';
                },
                outlierBorderColor: (context: any) => {
                  const dataIndex = context.dataIndex;
                  const outlierIndex = context.outlierIndex;
                  if (dataIndex !== undefined && outlierIndex !== undefined) {
                    const outlierValue = boxPlotData[dataIndex]?.outliers[outlierIndex];
                    return outlierValue >= 0 ? '#3b82f6' : '#ec4899';
                  }
                  return '#ec4899';
                },
                outlierRadius: 4,
                itemRadius: 0,
                itemStyle: 'circle' as const,
                itemBackgroundColor: '#3b82f6',
                itemBorderColor: '#3b82f6',
                medianColor: '#1e40af',
              } as any,
            ],
          }}
          options={chartOptions}
        />
      </div>
    </div>
  );
};
