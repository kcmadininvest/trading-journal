import React, { useMemo } from 'react';
import { Scatter as ChartScatter } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import TooltipComponent from '../ui/Tooltip';
import { formatCurrency } from '../../utils/numberFormat';

interface TradeDurationPnlScatterChartProps {
  data: Array<{
    durationMinutes: number;
    pnl: number;
  }>;
  currencySymbol: string;
  chartColors: any;
}

export const TradeDurationPnlScatterChart: React.FC<TradeDurationPnlScatterChartProps> = ({
  data,
  currencySymbol,
  chartColors,
}) => {
  const { t } = useTranslation();

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return `${hours}h ${remainingMinutes}m`;
  };

  const maxDuration = useMemo(() => {
    if (!data.length) return 60;
    return Math.max(...data.map((point) => point.durationMinutes));
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
        padding: 14,
        displayColors: false,
        callbacks: {
          title: (items: any) => {
            const raw = items[0]?.raw as { x: number; y: number };
            return t('analytics:charts.durationVsPnl.duration', {
              value: formatDuration(raw.x),
            });
          },
          label: (context: any) => {
            const raw = context.raw as { x: number; y: number };
            return t('analytics:charts.durationVsPnl.pnl', {
              value: formatCurrency(raw.y, currencySymbol),
            });
          },
        },
      },
    },
    scales: {
      x: {
        type: 'linear' as const,
        min: 0,
        max: maxDuration * 1.05,
        ticks: {
          color: chartColors.textSecondary,
          callback: (value: any) => formatDuration(Number(value)),
        },
        grid: {
          color: chartColors.grid,
        },
        title: {
          display: true,
          text: t('analytics:charts.durationVsPnl.xAxis'),
          color: chartColors.text,
          font: { size: 13, weight: 600 },
        },
      },
      y: {
        ticks: {
          color: chartColors.textSecondary,
          callback: (value: any) => formatCurrency(Number(value), currencySymbol),
        },
        grid: {
          color: chartColors.grid,
        },
        title: {
          display: true,
          text: t('analytics:charts.durationVsPnl.yAxis'),
          color: chartColors.text,
          font: { size: 13, weight: 600 },
        },
      },
    },
  }), [chartColors, currencySymbol, maxDuration, t]);

  if (!data.length) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 min-h-[450px]">
        <div className="flex items-center justify-center h-[320px]">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('analytics:noData', { defaultValue: 'Aucune donnée disponible' })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow duration-300">
      <div className="flex items-center mb-6">
        <div className="w-1 h-6 bg-gradient-to-b from-teal-500 to-teal-600 rounded-full mr-3"></div>
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
          {t('analytics:charts.durationVsPnl.title')}
        </h3>
        <TooltipComponent
          content={t('analytics:charts.durationVsPnl.tooltip')}
          position="top"
        >
          <div className="ml-3 flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-help">
            <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </TooltipComponent>
      </div>
      <div style={{ height: '320px', position: 'relative' }}>
        <ChartScatter
          data={{
            datasets: [
              {
                data: data.map((point) => ({ x: point.durationMinutes, y: point.pnl })),
                backgroundColor: data.map((point) => (point.pnl >= 0 ? '#3b82f6' : '#ec4899')),
                pointRadius: 5,
                pointHoverRadius: 7,
                pointBorderWidth: 0,
              },
            ],
          }}
          options={chartOptions}
        />
      </div>
    </div>
  );
};
