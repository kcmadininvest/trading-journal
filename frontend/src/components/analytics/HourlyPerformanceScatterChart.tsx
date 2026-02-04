import React, { useMemo } from 'react';
import { Scatter as ChartScatter } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../utils/numberFormat';

interface HourlyPerformanceScatterChartProps {
  data: {
    data: { timeSlot: number; pnl: number }[];
    timeSlotsWithData: number[];
  };
  currencySymbol: string;
  chartColors: any;
}

export const HourlyPerformanceScatterChart: React.FC<HourlyPerformanceScatterChartProps> = ({
  data,
  currencySymbol,
  chartColors,
}) => {
  const { t } = useTranslation();

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
            const item = items[0];
            const raw = item.raw as { x: number; y: number };
            const timeSlot = raw.x;
            const hour = Math.floor(timeSlot);
            const minutes = (timeSlot % 1) === 0.5 ? 30 : 0;
            return `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
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
        min: data.timeSlotsWithData.length > 0 
          ? Math.min(...data.timeSlotsWithData) - 0.25 
          : -0.25,
        max: data.timeSlotsWithData.length > 0 
          ? Math.max(...data.timeSlotsWithData) + 0.25 
          : 23.75,
        ticks: {
          stepSize: 0.5,
          color: chartColors.textSecondary,
          font: {
            size: 11,
          },
          callback: function(value: any, index: number, ticks: any) {
            const numValue = typeof value === 'number' ? value : parseFloat(String(value));
            
            const roundedValue = Math.round(numValue * 2) / 2;
            const remainder = Math.abs(roundedValue % 1);
            
            const isHalfHour = Math.abs(remainder - 0.5) < 0.001;
            const isFullHour = remainder < 0.001;
            
            if (!isHalfHour && !isFullHour) {
              return '';
            }
            
            if (ticks && index > 0) {
              const prevTick = ticks[index - 1];
              const prevValue = typeof prevTick.value === 'number' ? prevTick.value : parseFloat(String(prevTick.value));
              const prevRounded = Math.round(prevValue * 2) / 2;
              if (Math.abs(prevRounded - roundedValue) < 0.001) {
                return '';
              }
            }
            
            if (data.timeSlotsWithData.length > 0) {
              const minSlot = Math.min(...data.timeSlotsWithData);
              const maxSlot = Math.max(...data.timeSlotsWithData);
              
              if (roundedValue >= minSlot && roundedValue <= maxSlot) {
                const hour = Math.floor(roundedValue);
                const minutes = isHalfHour ? 30 : 0;
                return `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
              }
            }
            return '';
          },
          maxRotation: 45,
          minRotation: 45,
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
          text: t('analytics:charts.hourlyPerformanceScatter.xAxis'),
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
          text: t('analytics:charts.hourlyPerformanceScatter.yAxis'),
          color: chartColors.text,
          font: {
            size: 13,
            weight: 600,
          },
        },
      },
    },
  }), [chartColors, currencySymbol, t, data.timeSlotsWithData]);

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
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow duration-300">
      <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6 flex items-center">
        <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full mr-3"></div>
        {t('analytics:charts.hourlyPerformanceScatter.title')}
      </h3>
      <div style={{ height: '320px', position: 'relative' }}>
        <ChartScatter
          data={{
            datasets: [
              {
                label: t('analytics:charts.hourlyPerformanceScatter.label'),
                data: data.data.map(d => ({
                  x: d.timeSlot,
                  y: d.pnl,
                })),
                backgroundColor: data.data.map(d => 
                  d.pnl >= 0 ? '#3b82f6' : '#ec4899'
                ),
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
