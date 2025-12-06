import React from 'react';
import { Line as ChartLine } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import TooltipComponent from '../ui/Tooltip';
import { formatNumber, formatCurrency } from '../../utils/numberFormat';

interface DrawdownChartProps {
  data: Array<{ date: string; drawdown: number; drawdownAmount: number; drawdownPercent: number; cumulativePnl: number }>;
  currencySymbol: string;
  chartColors: any;
  tradesCount: number;
}

export const DrawdownChart: React.FC<DrawdownChartProps> = ({
  data,
  currencySymbol,
  chartColors,
  tradesCount,
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow duration-300">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-1 h-6 bg-gradient-to-b from-red-500 to-red-600 rounded-full mr-3"></div>
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t('analytics:charts.drawdown.title')}</h3>
        <TooltipComponent
          content={t('analytics:charts.drawdown.tooltip')}
          position="top"
        >
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-help">
            <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </TooltipComponent>
      </div>
      <div style={{ height: '320px', position: 'relative' }}>
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <p className="text-sm">{t('analytics:charts.drawdown.noData', { defaultValue: 'Aucune donnée de drawdown disponible pour cette période' })}</p>
              {tradesCount === 0 && (
                <p className="text-xs mt-2 text-gray-400 dark:text-gray-500">
                  {t('analytics:noTrades', { defaultValue: 'Aucun trade trouvé' })}
                </p>
              )}
            </div>
          </div>
        ) : (
          <ChartLine
            data={{
              labels: data.map(d => d.date),
              datasets: [
                {
                  label: t('analytics:charts.drawdown.label'),
                  data: data.map(d => d.drawdown),
                  borderColor: '#ec4899',
                  backgroundColor: 'rgba(236, 72, 153, 0.1)',
                  borderWidth: 3,
                  pointRadius: (context: any) => {
                    const dataLength = data.length;
                    if (dataLength > 30) return 0;
                    const value = context.parsed?.y;
                    return value !== null && value !== undefined ? 4 : 0;
                  },
                  pointBackgroundColor: '#ec4899',
                  pointBorderColor: '#fff',
                  pointBorderWidth: 2,
                  pointHoverRadius: 7,
                  fill: true,
                  tension: 0,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
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
                      return data[index].date;
                    },
                    label: (context: any) => {
                      const index = context.dataIndex;
                      const dataPoint = data[index];
                      return [
                        `${t('analytics:charts.drawdown.amount')}: ${formatCurrency(dataPoint.drawdownAmount, currencySymbol)} (${formatNumber(dataPoint.drawdownPercent, 2)}%)`,
                        `${t('analytics:charts.drawdown.cumulativePnl')}: ${formatCurrency(dataPoint.cumulativePnl, currencySymbol)}`,
                      ];
                    },
                  },
                },
              },
              scales: {
                x: {
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
                },
                y: {
                  beginAtZero: true,
                  ticks: {
                    color: chartColors.textSecondary,
                    font: {
                      size: 12,
                    },
                    callback: function(value) {
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
                    display: false,
                  },
                },
              },
            }}
          />
        )}
      </div>
    </div>
  );
};

