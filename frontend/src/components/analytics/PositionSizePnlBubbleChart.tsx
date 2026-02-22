import React, { useMemo } from 'react';
import { Bubble as ChartBubble } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import TooltipComponent from '../ui/Tooltip';
import { formatCurrency } from '../../utils/numberFormat';

interface PositionSizePnlBubbleChartProps {
  data: Array<{
    size: number;
    pnl: number;
    notional: number;
  }>;
  currencySymbol: string;
  chartColors: any;
}

export const PositionSizePnlBubbleChart: React.FC<PositionSizePnlBubbleChartProps> = ({
  data,
  currencySymbol,
  chartColors,
}) => {
  const { t } = useTranslation();

  const chartData = useMemo(() => {
    if (!data.length) {
      return [];
    }

    const maxNotional = Math.max(...data.map((point) => point.notional), 1);

    return data.map((point) => ({
      x: point.size,
      y: point.pnl,
      r: Math.max(4, Math.min(14, (point.notional / maxNotional) * 14)),
      notional: point.notional,
    }));
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
            const raw = items[0]?.raw as { x: number; y: number; notional: number };
            return t('analytics:charts.sizeVsPnl.size', {
              value: raw.x,
            });
          },
          label: (context: any) => {
            const raw = context.raw as { x: number; y: number; notional: number };
            return [
              t('analytics:charts.sizeVsPnl.pnl', {
                value: formatCurrency(raw.y, currencySymbol),
              }),
              t('analytics:charts.sizeVsPnl.notional', {
                value: formatCurrency(raw.notional, currencySymbol),
              }),
            ];
          },
        },
      },
    },
    scales: {
      x: {
        type: 'linear' as const,
        ticks: {
          color: chartColors.textSecondary,
        },
        grid: {
          color: chartColors.grid,
        },
        title: {
          display: true,
          text: t('analytics:charts.sizeVsPnl.xAxis'),
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
          text: t('analytics:charts.sizeVsPnl.yAxis'),
          color: chartColors.text,
          font: { size: 13, weight: 600 },
        },
      },
    },
  }), [chartColors, currencySymbol, t]);

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
        <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-indigo-600 rounded-full mr-3"></div>
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
          {t('analytics:charts.sizeVsPnl.title')}
        </h3>
        <TooltipComponent
          content={t('analytics:charts.sizeVsPnl.tooltip')}
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
        <ChartBubble
          data={{
            datasets: [
              {
                data: chartData,
                backgroundColor: chartData.map((point) => (point.y >= 0 ? '#3b82f6AA' : '#ec4899AA')),
                borderWidth: 0,
              },
            ],
          }}
          options={chartOptions}
        />
      </div>
    </div>
  );
};
