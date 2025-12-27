import React from 'react';
import { Radar as ChartRadar } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import TooltipComponent from '../ui/Tooltip';
import { formatNumber, formatCurrency } from '../../utils/numberFormat';

interface RadarChartProps {
  data: any;
  statisticsData: any;
  currencySymbol: string;
  createRadarAlternatingZonesPlugin: (isDark: boolean) => any;
  createRadarGradientPlugin: (isDark: boolean) => any;
  chartColors: any;
}

export const RadarChart: React.FC<RadarChartProps> = ({
  data,
  statisticsData,
  currencySymbol,
  createRadarAlternatingZonesPlugin,
  createRadarGradientPlugin,
  chartColors,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (!data || !statisticsData) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow duration-300 min-h-[450px]">
        <div className="flex items-center justify-center h-[450px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 dark:border-purple-500 mx-auto mb-3"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('analytics:loadingData', { defaultValue: 'Chargement des données...' })}</p>
          </div>
        </div>
      </div>
    );
  }

  // Définir les couleurs pour chaque métrique
  const metricColors = [
    { name: t('analytics:radar.profitFactor', { defaultValue: 'Profit Factor' }), color: '#3b82f6' }, // Bleu
    { name: t('analytics:radar.winRate', { defaultValue: 'Win Rate' }), color: '#10b981' }, // Vert
    { name: t('analytics:radar.recoveryFactor', { defaultValue: 'Recovery Factor' }), color: '#f59e0b' }, // Orange
    { name: t('analytics:radar.winLossRatio', { defaultValue: 'Win/Loss Ratio' }), color: '#8b5cf6' }, // Violet
    { name: t('analytics:radar.expectancy', { defaultValue: 'Expectancy' }), color: '#ec4899' }, // Rose
    { name: t('analytics:radar.maxDrawdown', { defaultValue: 'Max Drawdown' }), color: '#ef4444' }, // Rouge
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow duration-300 min-h-[450px]">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-purple-600 rounded-full mr-3"></div>
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
          {t('analytics:radar.title', { defaultValue: 'Métriques de Performance' })}
        </h3>
        <TooltipComponent
          content={t('analytics:radar.tooltip', { defaultValue: 'Ce graphique en araignée (radar) affiche vos métriques de performance clés normalisées sur une échelle de 0 à 100%. Chaque axe représente une métrique : Profit Factor, Taux de Réussite, Facteur de Récupération, Ratio Gain/Perte, Espérance et Drawdown Max. Plus la zone est grande, meilleure est votre performance globale.' })}
          position="top"
        >
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-help">
            <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </TooltipComponent>
      </div>
      
      {/* Graphique et légende côte à côte */}
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Graphique */}
        <div className="flex-1" style={{ height: '320px', position: 'relative' }}>
          <ChartRadar
            data={data}
            plugins={[createRadarAlternatingZonesPlugin(isDark), createRadarGradientPlugin(isDark)]}
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
                      const label = context.label || '';
                      const value = context.parsed.r;
                      const index = context.dataIndex;
                      
                      let realValue = '';
                      switch (index) {
                        case 0:
                          realValue = formatNumber(statisticsData.profit_factor, 2);
                          break;
                        case 1:
                          realValue = formatNumber(statisticsData.win_rate, 1) + '%';
                          break;
                        case 2:
                          realValue = formatNumber(statisticsData.recovery_ratio || 0, 2);
                          break;
                        case 3:
                          realValue = formatNumber(statisticsData.win_loss_ratio || 0, 2);
                          break;
                        case 4:
                          realValue = formatCurrency(statisticsData.expectancy || 0, currencySymbol);
                          break;
                        case 5:
                          realValue = formatNumber(statisticsData.max_drawdown_pct || 0, 2) + '%';
                          break;
                        default:
                          realValue = formatNumber(value, 1);
                      }
                      
                      return `${label}: ${realValue} (${formatNumber(value, 1)}%)`;
                    },
                  },
                },
              },
              scales: {
                r: {
                  beginAtZero: true,
                  max: 100,
                  min: 0,
                  ticks: {
                    display: false,
                    stepSize: 20,
                    color: chartColors.textSecondary,
                    font: {
                      size: 11,
                    },
                    backdropColor: 'transparent',
                  },
                  grid: {
                    color: isDark ? 'rgba(55, 65, 81, 0.4)' : 'rgba(156, 163, 175, 0.5)',
                    lineWidth: 1,
                  },
                  pointLabels: {
                    display: false, // Masquer les labels autour du graphique
                  },
                  angleLines: {
                    color: isDark ? 'rgba(55, 65, 81, 0.4)' : 'rgba(156, 163, 175, 0.5)',
                    lineWidth: 1,
                  },
                },
              },
            }}
          />
        </div>

        {/* Légende avec points de couleur à droite */}
        <div className="lg:w-48 flex-shrink-0">
          <div className="flex flex-col gap-3 text-xs sm:text-sm">
            {metricColors.map((metric, index) => (
              <div key={index} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: metric.color }}
                ></div>
                <span className="text-gray-700 dark:text-gray-300">{metric.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

