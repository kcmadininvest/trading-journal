import React, { useMemo } from 'react';
import { Line as ChartLine } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import TooltipComponent from '../ui/Tooltip';
import { formatCurrency, formatNumber } from '../../utils/numberFormat';

interface EquityCurveChartProps {
  data: any;
  riskRewardData: any;
  currencySymbol: string;
  chartColors: any;
}

export const EquityCurveChart: React.FC<EquityCurveChartProps> = ({
  data,
  riskRewardData,
  currencySymbol,
  chartColors,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Préparer un map des données R:R par date pour le tooltip
  const rrByDate = useMemo(() => {
    if (!riskRewardData) return {};
    
    const map: { [date: string]: number } = {};
    riskRewardData.rawData.forEach((item: any) => {
      map[item.date] = item.avgRR;
    });
    return map;
  }, [riskRewardData]);

  // Mémoriser les options pour éviter les re-rendus
  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 0, // Désactiver l'animation pour éviter le tremblement après chargement
    },
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
            
            // Ajouter le R:R dans le tooltip si disponible
            const rrValue = rrByDate[rawData.date];
            const tooltipLines = [
              `${datasetLabel}: ${formatCurrency(value || 0, currencySymbol)}`,
              `${t('analytics:equityCurve.dailyPnl', { defaultValue: 'PnL journalier' })}: ${formatCurrency(rawData.pnl || 0, currencySymbol)}`,
              `${t('analytics:equityCurve.cumulativePnl', { defaultValue: 'PnL cumulé' })}: ${formatCurrency(cumulativePnl, currencySymbol)}`,
            ];
            
            if (rrValue !== undefined && rrValue !== null) {
              tooltipLines.push(
                `${t('analytics:charts.riskReward.label', { defaultValue: 'Ratio R:R moyen' })}: ${formatNumber(rrValue, 2)}`
              );
            }
            
            return tooltipLines;
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
  }), [chartColors, currencySymbol, t, data?.rawData, data?.initialCapital, rrByDate]);

  if (!data) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow duration-300 min-h-[450px]">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-1 h-6 bg-gradient-to-b from-green-500 to-green-600 rounded-full mr-3"></div>
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            {t('analytics:equityCurve.title', { defaultValue: 'Courbe de Capital' })}
          </h3>
        </div>
        <div className="flex items-center justify-center h-[350px]">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('analytics:noData', { defaultValue: 'Aucune donnée disponible' })}</p>
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
          content={t('analytics:equityCurve.tooltip', { defaultValue: 'Ce graphique montre l\'évolution de votre capital dans le temps. La courbe verte représente votre capital actuel (capital initial + PnL cumulé). La ligne pointillée grise indique votre capital initial pour référence. Le ratio risque/récompense (R:R) moyen est disponible dans le tooltip au survol de chaque point. Cela permet de visualiser la croissance ou la décroissance de votre capital au fil du temps ainsi que l\'efficacité de votre gestion du risque.' })}
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
          data={{
            labels: data.labels,
            datasets: [
              {
                label: t('analytics:equityCurve.equity', { defaultValue: 'Capital' }),
                data: data.datasets[0].data,
                borderColor: isDark ? '#10b981' : '#059669',
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(5, 150, 105, 0.1)',
                borderWidth: 2,
                fill: true, // Remplir jusqu'au bas du graphique (adapté car beginAtZero: false)
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 4,
                spanGaps: true, // Remplir les trous dans les données
                yAxisID: 'y',
              },
              {
                label: t('analytics:equityCurve.initialCapital', { defaultValue: 'Capital Initial' }),
                data: data.datasets[1].data,
                borderColor: isDark ? 'rgba(156, 163, 175, 0.5)' : 'rgba(107, 114, 128, 0.5)',
                borderWidth: 1,
                borderDash: [5, 5],
                fill: false,
                pointRadius: 0,
                yAxisID: 'y',
              },
            ],
          }}
          options={chartOptions}
        />
      </div>
    </div>
  );
};

