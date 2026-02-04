import React, { useMemo } from 'react';
import { Bar as ChartBar } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import TooltipComponent from '../ui/Tooltip';
import { formatCurrency, formatNumber } from '../../utils/numberFormat';

interface PnlDistributionChartProps {
  data: {
    range: string;
    rangeLabel: string;
    count: number;
    midpoint: number;
    isPositive: boolean;
    start: number;
    end: number;
    binWidth: number;
  }[];
  currencySymbol: string;
  chartColors: any;
  windowWidth: number;
}

export const PnlDistributionChart: React.FC<PnlDistributionChartProps> = ({
  data,
  currencySymbol,
  chartColors,
  windowWidth,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 0,
    },
    plugins: {
      datalabels: {
        display: true,
        color: function(context: any) {
          const index = context.dataIndex;
          const bin = data[index];
          if (bin && bin.isPositive) {
            return '#ffffff';
          }
          return isDark ? '#f3f4f6' : '#ffffff';
        },
        font: {
          weight: 700,
          size: windowWidth < 640 ? 11 : 13,
        },
        backgroundColor: function(context: any) {
          if (windowWidth < 640) {
            return 'rgba(0, 0, 0, 0.4)';
          }
          return 'transparent';
        },
        padding: windowWidth < 640 ? 4 : 0,
        borderRadius: windowWidth < 640 ? 4 : 0,
        formatter: function(value: number, context: any) {
          if (value < 3) return '';
          return formatNumber(value, 1) + '%';
        },
        anchor: 'center' as const,
        align: 'center' as const,
        clamp: true,
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
            const bin = data[index];
            const startValue = bin.start;
            const endValue = bin.end || (startValue + (bin.binWidth || 0));
            
            const startFormatted = formatCurrency(startValue, currencySymbol);
            const endFormatted = formatCurrency(endValue, currencySymbol);
            return t('analytics:charts.pnlDistribution.range', { start: startFormatted, end: endFormatted });
          },
          label: (context: any) => {
            const index = context.dataIndex;
            const count = data[index].count;
            const percentage = context.parsed.y ?? 0;
            const totalTrades = data.reduce((sum, d) => sum + d.count, 0);
            return [
              `${count} ${count > 1 ? t('analytics:common.trades') : t('analytics:common.trade')}`,
              `${formatNumber(percentage, 1)}% (${t('analytics:charts.pnlDistribution.onTotal', { total: totalTrades })})`
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
            size: 12,
          },
          autoSkip: true,
          maxTicksLimit: 10,
        },
        grid: {
          display: false,
        },
        border: {
          color: chartColors.border,
        },
        title: {
          display: true,
          text: t('analytics:charts.pnlDistribution.xAxis'),
          color: chartColors.text,
          font: {
            size: 13,
            weight: 600,
          },
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: chartColors.textSecondary,
          font: {
            size: 12,
          },
          callback: function(value: any) {
            return value + '%';
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
          text: t('analytics:charts.pnlDistribution.yAxis'),
          color: chartColors.text,
          font: {
            size: 13,
            weight: 600,
          },
        },
      },
    },
  }), [chartColors, currencySymbol, t, data, windowWidth, isDark]);

  if (!data || data.length === 0) {
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
      <div className="flex items-center gap-2 mb-6">
        <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-indigo-600 rounded-full mr-3"></div>
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
          {t('analytics:charts.pnlDistribution.title')}
        </h3>
        <TooltipComponent
          content={t('analytics:charts.pnlDistribution.tooltip')}
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
        <ChartBar
          data={{
            labels: data.map(d => formatCurrency(d.start, currencySymbol)),
            datasets: [
              {
                label: t('analytics:charts.pnlDistribution.label'),
                data: (() => {
                  const totalTrades = data.reduce((sum, d) => sum + d.count, 0);
                  return data.map(d => totalTrades > 0 ? (d.count / totalTrades) * 100 : 0);
                })(),
                backgroundColor: data.map(d => 
                  d.isPositive ? '#3b82f6' : '#ec4899'
                ),
                borderRadius: 4,
              },
            ],
          }}
          options={chartOptions}
        />
      </div>
    </div>
  );
};
