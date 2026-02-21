import React, { useMemo } from 'react';
import { Scatter } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import TooltipComponent from '../ui/Tooltip';
import { formatCurrency } from '../../utils/numberFormat';

interface MaeMfeDataPoint {
  tradeId: number;
  contractName: string;
  tradeType: 'Long' | 'Short';
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  mae: number; // Maximum Adverse Excursion (pire mouvement contre nous)
  mfe: number; // Maximum Favorable Excursion (meilleur mouvement pour nous)
  tradeDay: string;
}

interface MaeMfeChartProps {
  data: MaeMfeDataPoint[];
  currencySymbol: string;
  chartColors: any;
  tradesCount: number;
}

export const MaeMfeChart: React.FC<MaeMfeChartProps> = ({
  data,
  currencySymbol,
  chartColors,
  tradesCount,
}) => {
  const { t } = useTranslation();

  // Séparer les trades gagnants et perdants
  const { winningTrades, losingTrades } = useMemo(() => {
    const winning = data.filter(d => d.pnl > 0);
    const losing = data.filter(d => d.pnl <= 0);
    return { winningTrades: winning, losingTrades: losing };
  }, [data]);

  const chartData = useMemo(() => ({
    datasets: [
      {
        label: t('analytics:charts.maeMfe.winningTrades', { defaultValue: 'Trades gagnants' }),
        data: winningTrades.map(d => ({
          x: Math.abs(d.mae),
          y: d.mfe,
          tradeId: d.tradeId,
          contractName: d.contractName,
          tradeType: d.tradeType,
          pnl: d.pnl,
          tradeDay: d.tradeDay,
        })),
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
      },
      {
        label: t('analytics:charts.maeMfe.losingTrades', { defaultValue: 'Trades perdants' }),
        data: losingTrades.map(d => ({
          x: Math.abs(d.mae),
          y: d.mfe,
          tradeId: d.tradeId,
          contractName: d.contractName,
          tradeType: d.tradeType,
          pnl: d.pnl,
          tradeDay: d.tradeDay,
        })),
        backgroundColor: 'rgba(236, 72, 153, 0.6)',
        borderColor: 'rgba(236, 72, 153, 1)',
        borderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8,
      },
    ],
  }), [winningTrades, losingTrades, t]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      datalabels: {
        display: false,
      },
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: chartColors.text,
          font: {
            size: 12,
            weight: 500,
          },
          usePointStyle: true,
          padding: 15,
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
        displayColors: true,
        callbacks: {
          title: (items: any) => {
            const point = items[0].raw;
            return `${point.contractName} - ${point.tradeType}`;
          },
          label: (context: any) => {
            const point = context.raw;
            return [
              `${t('analytics:charts.maeMfe.mae')}: ${formatCurrency(point.x, currencySymbol)}`,
              `${t('analytics:charts.maeMfe.mfe')}: ${formatCurrency(point.y, currencySymbol)}`,
              `${t('analytics:charts.maeMfe.pnl')}: ${formatCurrency(point.pnl, currencySymbol)}`,
              `${t('analytics:charts.maeMfe.date')}: ${point.tradeDay}`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        type: 'linear' as const,
        position: 'bottom' as const,
        title: {
          display: true,
          text: t('analytics:charts.maeMfe.xAxis', { defaultValue: 'MAE - Maximum Adverse Excursion' }),
          color: chartColors.text,
          font: {
            size: 13,
            weight: 600,
          },
        },
        ticks: {
          color: chartColors.textSecondary,
          font: {
            size: 11,
          },
          callback: function(value: any) {
            return formatCurrency(value, currencySymbol);
          },
        },
        grid: {
          color: chartColors.grid,
          lineWidth: 1,
        },
        border: {
          color: chartColors.border,
        },
      },
      y: {
        type: 'linear' as const,
        position: 'left' as const,
        title: {
          display: true,
          text: t('analytics:charts.maeMfe.yAxis', { defaultValue: 'MFE - Maximum Favorable Excursion' }),
          color: chartColors.text,
          font: {
            size: 13,
            weight: 600,
          },
        },
        ticks: {
          color: chartColors.textSecondary,
          font: {
            size: 11,
          },
          callback: function(value: any) {
            return formatCurrency(value, currencySymbol);
          },
        },
        grid: {
          color: chartColors.grid,
          lineWidth: 1,
        },
        border: {
          color: chartColors.border,
        },
      },
    },
  }), [chartColors, currencySymbol, t]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow duration-300 min-h-[450px]">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-purple-600 rounded-full mr-3"></div>
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
          {t('analytics:charts.maeMfe.title', { defaultValue: 'MAE vs MFE' })}
        </h3>
        <TooltipComponent
          content={t('analytics:charts.maeMfe.tooltip', { 
            defaultValue: 'Analyse du Maximum Adverse Excursion (pire mouvement contre vous) vs Maximum Favorable Excursion (meilleur mouvement pour vous). Les points en haut à gauche indiquent des trades bien gérés (faible MAE, fort MFE).' 
          })}
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
              <p className="text-sm">
                {t('analytics:charts.maeMfe.noData', { defaultValue: 'Aucune donnée MAE/MFE disponible pour cette période' })}
              </p>
              {tradesCount === 0 && (
                <p className="text-xs mt-2 text-gray-400 dark:text-gray-500">
                  {t('analytics:noTrades', { defaultValue: 'Aucun trade trouvé' })}
                </p>
              )}
            </div>
          </div>
        ) : (
          <Scatter data={chartData} options={chartOptions} />
        )}
      </div>
    </div>
  );
};
