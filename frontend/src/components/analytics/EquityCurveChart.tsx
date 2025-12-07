import React, { useMemo } from 'react';
import { Line as ChartLine } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import TooltipComponent from '../ui/Tooltip';
import { formatCurrency } from '../../utils/numberFormat';

interface EquityCurveChartProps {
  data: any;
  currencySymbol: string;
  chartColors: any;
}

export const EquityCurveChart: React.FC<EquityCurveChartProps> = ({
  data,
  currencySymbol,
  chartColors,
}) => {
  const { t } = useTranslation();

  // Mémoriser les options pour éviter les re-rendus
  const chartOptions = useMemo(() => ({
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
        enabled: true,
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
        displayColors: true,
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          title: (context: any) => {
            if (!data?.rawData) return '';
            const index = context[0].dataIndex;
            const rawData = data.rawData[index];
            if (!rawData) return '';
            const date = new Date(rawData.date);
            return date.toLocaleDateString();
          },
          label: (context: any) => {
            if (!data?.rawData) return '';
            const datasetLabel = context.dataset.label || '';
            const value = context.parsed.y;
            const index = context.dataIndex;
            const rawData = data.rawData[index];
            if (!rawData) return '';
            
            if (datasetLabel.includes('Initial')) {
              return `${datasetLabel}: ${formatCurrency(value || 0, currencySymbol)}`;
            }
            
            const initialCapital = data.initialCapital || 0;
            const cumulativePnl = (value || 0) - initialCapital;
            
            return [
              `${datasetLabel}: ${formatCurrency(value || 0, currencySymbol)}`,
              `${t('analytics:equityCurve.dailyPnl', { defaultValue: 'PnL journalier' })}: ${formatCurrency(rawData.pnl || 0, currencySymbol)}`,
              `${t('analytics:equityCurve.cumulativePnl', { defaultValue: 'PnL cumulé' })}: ${formatCurrency(cumulativePnl, currencySymbol)}`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: chartColors.textSecondary,
          font: {
            size: 11,
          },
          maxRotation: 45,
          minRotation: 0,
        },
        border: {
          color: chartColors.border,
        },
      },
      y: {
        beginAtZero: false,
        grid: {
          color: chartColors.grid,
          lineWidth: 1,
        },
        ticks: {
          color: chartColors.textSecondary,
          font: {
            size: 11,
          },
          callback: function(value: number | string) {
            return formatCurrency(Number(value), currencySymbol);
          },
        },
        border: {
          color: chartColors.border,
        },
        title: {
          display: false,
        },
      },
    },
  }), [chartColors, currencySymbol, t, data?.rawData, data?.initialCapital]);

  if (!data) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow duration-300 min-h-[450px]">
        <div className="flex items-center justify-center h-[450px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 dark:border-green-500 mx-auto mb-3"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('analytics:loadingData', { defaultValue: 'Chargement des données...' })}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow duration-300 min-h-[450px]">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-1 h-6 bg-gradient-to-b from-green-500 to-green-600 rounded-full mr-3"></div>
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
          {t('analytics:equityCurve.title', { defaultValue: 'Courbe de Capital' })}
        </h3>
        <TooltipComponent
          content={t('analytics:equityCurve.tooltip', { defaultValue: 'Ce graphique montre l\'évolution de votre capital dans le temps. La courbe verte représente votre capital actuel (capital initial + PnL cumulé). La ligne pointillée grise indique votre capital initial pour référence. Cela permet de visualiser la croissance ou la décroissance de votre capital au fil du temps.' })}
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
        <ChartLine
          data={data}
          options={chartOptions}
        />
      </div>
    </div>
  );
};

