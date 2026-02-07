import React from 'react';
import { Bar as ChartBar } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import TooltipComponent from '../ui/Tooltip';
import { formatCurrency } from '../../utils/numberFormat';

interface MonthlyPerformanceChartProps {
  data: {
    labels: string[];
    pnlData: number[];
    countData: number[];
  } | null;
  currencySymbol: string;
  chartColors: any;
}

export const MonthlyPerformanceChart: React.FC<MonthlyPerformanceChartProps> = ({
  data,
  currencySymbol,
  chartColors,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (!data) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow duration-300 min-h-[450px]">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full mr-3"></div>
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            {t('analytics:charts.monthlyPerformance.title', { defaultValue: 'Performance Mensuelle/Annuelle' })}
          </h3>
        </div>
        <div className="flex items-center justify-center h-[350px]">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('analytics:noData', { defaultValue: 'Aucune donnée disponible' })}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow duration-300">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full mr-3"></div>
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
          {t('analytics:charts.monthlyPerformance.title', { defaultValue: 'Performance Mensuelle/Annuelle' })}
        </h3>
        <TooltipComponent
          content={t('analytics:charts.monthlyPerformance.tooltip', { defaultValue: 'Ce graphique montre votre performance (PnL) par mois. Chaque barre représente le PnL total pour un mois donné. Cela permet d\'identifier les mois les plus rentables et les tendances saisonnières.' })}
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
            labels: data.labels,
            datasets: [
              {
                label: t('analytics:charts.monthlyPerformance.pnl', { defaultValue: 'PnL' }),
                data: data.pnlData,
                backgroundColor: data.pnlData.map(pnl => 
                  pnl > 0 
                    ? (isDark ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.7)')
                    : (isDark ? 'rgba(236, 72, 153, 0.8)' : 'rgba(236, 72, 153, 0.7)')
                ),
                borderColor: data.pnlData.map(pnl => 
                  pnl > 0 
                    ? (isDark ? '#60a5fa' : '#3b82f6')
                    : (isDark ? '#f472b6' : '#ec4899')
                ),
                borderWidth: 1,
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
                padding: 12,
                titleFont: {
                  size: 13,
                  weight: 600,
                },
                bodyFont: {
                  size: 12,
                  weight: 500,
                },
                callbacks: {
                  label: (context: any) => {
                    const index = context.dataIndex;
                    const pnl = context.parsed.y;
                    const count = data.countData[index];
                    return [
                      `${t('analytics:charts.monthlyPerformance.pnl', { defaultValue: 'PnL' })}: ${formatCurrency(pnl || 0, currencySymbol)}`,
                      `${t('analytics:charts.monthlyPerformance.trades', { defaultValue: 'Trades' })}: ${count}`,
                    ];
                  },
                },
              },
            },
            scales: {
              x: {
                ticks: {
                  color: chartColors.textSecondary,
                  font: {
                    size: 11,
                  },
                  maxRotation: 45,
                  minRotation: 45,
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
                    size: 11,
                  },
                  callback: function(value) {
                    return formatCurrency(Number(value), currencySymbol);
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
      </div>
    </div>
  );
};

