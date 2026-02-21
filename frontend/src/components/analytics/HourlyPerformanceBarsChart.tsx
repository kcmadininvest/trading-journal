import React, { useMemo } from 'react';
import { Bar as ChartBar } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { formatCurrency } from '../../utils/numberFormat';

interface HourlyPerformanceBarsChartProps {
  data: { hour: string; hourNum: number; pnl: number }[];
  currencySymbol: string;
  chartColors: any;
  windowWidth: number;
}

export const HourlyPerformanceBarsChart: React.FC<HourlyPerformanceBarsChartProps> = ({
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
          const pnl = data[index]?.pnl ?? 0;
          if (pnl >= 0) {
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
          const index = context.dataIndex;
          const pnl = data[index]?.pnl ?? value;
          return formatCurrency(pnl, currencySymbol);
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
            return data[index].hour;
          },
          label: (context: any) => {
            const pnl = context.parsed.y ?? 0;
            return formatCurrency(pnl, currencySymbol);
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
          autoSkip: false,
        },
        grid: {
          display: false,
        },
        border: {
          color: chartColors.border,
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
          text: t('analytics:charts.hourlyPerformanceBars.yAxis'),
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
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow duration-300 min-h-[450px]">
      <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6 flex items-center">
        <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-purple-600 rounded-full mr-3"></div>
        {t('analytics:charts.hourlyPerformanceBars.title')}
      </h3>
      <div style={{ height: '320px', position: 'relative' }}>
        <ChartBar
          data={{
            labels: data.map(d => d.hour),
            datasets: [
              {
                label: t('analytics:charts.hourlyPerformanceBars.label'),
                data: data.map(d => d.pnl),
                backgroundColor: data.map(d => 
                  d.pnl >= 0 ? '#3b82f6' : '#ec4899'
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
