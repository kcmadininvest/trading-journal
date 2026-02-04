import React, { useMemo } from 'react';
import { Scatter as ChartScatter } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import TooltipComponent from '../ui/Tooltip';
import { formatCurrency } from '../../utils/numberFormat';

interface CorrelationChartProps {
  data: {
    dataPoints: { trades: number; pnl: number }[];
    xTicks: number[];
    minTrades: number;
    maxTrades: number;
    regressionLine: { x: number; y: number }[];
    correlationCoefficient: number;
    rSquared: number;
  };
  currencySymbol: string;
  chartColors: any;
}

export const CorrelationChart: React.FC<CorrelationChartProps> = ({
  data,
  currencySymbol,
  chartColors,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();

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
        display: data.regressionLine.length > 0,
        position: 'top' as const,
        labels: {
          color: chartColors.text,
          font: {
            size: 12,
          },
          usePointStyle: true,
          padding: 12,
          filter: (legendItem: any) => {
            return legendItem.text === t('analytics:charts.correlation.regressionLine');
          },
        },
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
            const item = items[0];
            const raw = item.raw as { x: number; y: number };
            const trades = raw.x;
            return `${trades} ${trades > 1 ? t('analytics:common.trades') : t('analytics:common.trade')}`;
          },
          label: (context: any) => {
            const raw = context.raw as { x: number; y: number };
            const pnl = raw.y;
            return formatCurrency(pnl, currencySymbol);
          },
        },
      },
    },
    scales: {
      x: {
        type: 'linear' as const,
        position: 'bottom' as const,
        min: data.minTrades - 0.25,
        max: data.maxTrades + 0.25,
        ticks: {
          stepSize: 0.5,
          color: chartColors.textSecondary,
          font: {
            size: 12,
          },
          callback: function(value: any) {
            const numValue = typeof value === 'number' ? value : parseFloat(String(value));
            const roundedValue = Math.round(numValue * 2) / 2;
            const remainder = Math.abs(roundedValue % 1);
            
            if (remainder < 0.001 || Math.abs(remainder - 0.5) < 0.001) {
              if (roundedValue % 1 === 0) {
                return Math.round(roundedValue).toString();
              } else {
                return roundedValue.toFixed(1);
              }
            }
            return '';
          },
        },
        grid: {
          color: chartColors.grid,
          lineWidth: 1,
        },
        border: {
          color: chartColors.border,
        },
        title: {
          display: true,
          text: t('analytics:charts.correlation.xAxis'),
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
          text: t('analytics:charts.correlation.yAxis'),
          color: chartColors.text,
          font: {
            size: 13,
            weight: 600,
          },
        },
      },
    },
  }), [chartColors, currencySymbol, t, data.minTrades, data.maxTrades, data.regressionLine.length]);

  if (!data || data.dataPoints.length === 0) {
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
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow duration-300">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-emerald-600 rounded-full mr-3"></div>
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
          {t('analytics:charts.correlation.title')}
        </h3>
        {data.dataPoints.length > 1 && (
          <>
            <span className="ml-3 text-sm font-normal text-gray-600 dark:text-gray-400">
              (R² = {data.rSquared.toFixed(3)})
            </span>
            <TooltipComponent
              content={t('analytics:charts.correlation.rSquaredTooltip')}
              position="top"
            >
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-help">
                <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </TooltipComponent>
          </>
        )}
      </div>
      <div style={{ height: '320px', position: 'relative' }}>
        <ChartScatter
          data={{
            datasets: [
              {
                label: t('analytics:charts.correlation.label'),
                data: data.dataPoints.map(d => ({
                  x: d.trades,
                  y: d.pnl,
                })),
                backgroundColor: data.dataPoints.map(d => 
                  d.pnl >= 0 ? '#3b82f6' : '#ec4899'
                ),
                pointRadius: 5,
                pointHoverRadius: 7,
                pointBorderWidth: 0,
                hidden: false,
              },
              ...(data.regressionLine.length > 0 ? [{
                label: t('analytics:charts.correlation.regressionLine'),
                data: data.regressionLine,
                borderColor: theme === 'dark' ? '#10b981' : '#059669',
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [5, 5],
                pointRadius: 0,
                pointHoverRadius: 0,
                showLine: true,
                fill: false,
              }] : []),
            ],
          }}
          options={chartOptions}
        />
      </div>
    </div>
  );
};
