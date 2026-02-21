import React, { useMemo } from 'react';
import { Radar as ChartRadar } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import TooltipComponent from '../ui/Tooltip';
import { formatNumber } from '../../utils/numberFormat';

interface RadarChartProps {
  data: any;
  statisticsData: any;
  currencySymbol: string;
  createRadarAlternatingZonesPlugin: (isDark: boolean) => any;
  createRadarGradientPlugin: (isDark: boolean) => any;
  chartColors: any;
}

// Meilleures pratiques pour les graphiques radar:
// 1. Limiter à 5-8 axes maximum pour la lisibilité
// 2. Utiliser des échelles cohérentes (0-100)
// 3. Normaliser intelligemment selon des benchmarks réalistes
// 4. Éviter les valeurs négatives
// 5. Utiliser des couleurs contrastées mais harmonieuses

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

  // Recalculer les données avec une normalisation optimisée
  const optimizedData = useMemo(() => {
    if (!statisticsData) return null;

    // Fonction de normalisation intelligente basée sur des benchmarks réalistes
    const normalizeMetric = (value: number, config: {
      min: number;
      target: number;  // Valeur cible (bonne performance)
      excellent: number; // Valeur excellente
      inverse?: boolean; // true si plus bas = mieux
    }): number => {
      const { min, target, excellent, inverse = false } = config;
      
      // Clamp la valeur
      const clampedValue = Math.max(min, value);
      
      let normalized: number;
      if (clampedValue <= target) {
        // 0-50%: de min à target
        normalized = ((clampedValue - min) / (target - min)) * 50;
      } else {
        // 50-100%: de target à excellent
        normalized = 50 + Math.min(50, ((clampedValue - target) / (excellent - target)) * 50);
      }
      
      const result = inverse ? 100 - normalized : normalized;
      return Math.min(100, Math.max(0, result));
    };

    // Métriques optimisées selon les meilleures pratiques du trading
    const metrics = {
      // Win Rate: 50% = neutre, 60% = bon, 70%+ = excellent
      winRate: Math.min(100, Math.max(0, statisticsData.win_rate || 0)),
      
      // Profit Factor: 1.0 = break-even, 1.5 = bon, 2.5+ = excellent
      profitFactor: normalizeMetric(statisticsData.profit_factor || 0, {
        min: 0,
        target: 1.5,
        excellent: 2.5,
      }),
      
      // Win/Loss Ratio: 1.0 = équilibré, 1.5 = bon, 2.5+ = excellent
      winLossRatio: normalizeMetric(statisticsData.win_loss_ratio || 0, {
        min: 0,
        target: 1.5,
        excellent: 2.5,
      }),
      
      // Recovery Factor: 1.0 = minimum, 2.0 = bon, 5.0+ = excellent
      recoveryFactor: normalizeMetric(statisticsData.recovery_ratio || 0, {
        min: 0,
        target: 2.0,
        excellent: 5.0,
      }),
      
      // Max Drawdown: 0% = parfait, 10% = acceptable, 30%+ = risqué (inversé)
      maxDrawdown: normalizeMetric(statisticsData.max_drawdown_pct || 0, {
        min: 0,
        target: 10,
        excellent: 30,
        inverse: true,
      }),
    };

    return {
      labels: [
        t('analytics:radar.winRate', { defaultValue: 'Taux de Réussite' }),
        t('analytics:radar.profitFactor', { defaultValue: 'Profit Factor' }),
        t('analytics:radar.winLossRatio', { defaultValue: 'Ratio G/P' }),
        t('analytics:radar.recoveryFactor', { defaultValue: 'Récupération' }),
        t('analytics:radar.maxDrawdown', { defaultValue: 'Drawdown' }),
      ],
      datasets: [
        {
          label: t('analytics:radar.performance', { defaultValue: 'Performance' }),
          data: [
            metrics.winRate,
            metrics.profitFactor,
            metrics.winLossRatio,
            metrics.recoveryFactor,
            metrics.maxDrawdown,
          ],
          backgroundColor: 'transparent',
          borderColor: isDark ? '#60a5fa' : '#2563eb',
          borderWidth: 3,
          pointBackgroundColor: [
            '#10b981', // Vert - Win Rate
            '#3b82f6', // Bleu - Profit Factor
            '#8b5cf6', // Violet - Win/Loss Ratio
            '#f59e0b', // Orange - Recovery Factor
            '#ef4444', // Rouge - Max Drawdown
          ],
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointHoverBorderWidth: 3,
        },
      ],
      rawMetrics: metrics,
    };
  }, [statisticsData, isDark, t]);

  // Définir les couleurs et descriptions pour chaque métrique
  const metricInfo = useMemo(() => {
    if (!statisticsData) return [];
    
    return [
      { 
        name: t('analytics:radar.winRate', { defaultValue: 'Taux de Réussite' }), 
        color: '#10b981',
        value: statisticsData.win_rate,
        unit: '%',
        description: t('analytics:radar.winRateDesc', { defaultValue: '% de trades gagnants' }),
      },
      { 
        name: t('analytics:radar.profitFactor', { defaultValue: 'Profit Factor' }), 
        color: '#3b82f6',
        value: statisticsData.profit_factor,
        unit: '',
        description: t('analytics:radar.profitFactorDesc', { defaultValue: 'Gains / Pertes' }),
      },
      { 
        name: t('analytics:radar.winLossRatio', { defaultValue: 'Ratio G/P' }), 
        color: '#8b5cf6',
        value: statisticsData.win_loss_ratio,
        unit: '',
        description: t('analytics:radar.winLossRatioDesc', { defaultValue: 'Gain moyen / Perte moyenne' }),
      },
      { 
        name: t('analytics:radar.recoveryFactor', { defaultValue: 'Récupération' }), 
        color: '#f59e0b',
        value: statisticsData.recovery_ratio,
        unit: '',
        description: t('analytics:radar.recoveryFactorDesc', { defaultValue: 'Profit / Drawdown max' }),
      },
      { 
        name: t('analytics:radar.maxDrawdown', { defaultValue: 'Drawdown' }), 
        color: '#ef4444',
        value: statisticsData.max_drawdown_pct,
        unit: '%',
        description: t('analytics:radar.maxDrawdownDesc', { defaultValue: 'Perte maximale' }),
      },
    ];
  }, [statisticsData, t]);

  // Calculer le score global de performance (moyenne des métriques)
  const globalScore = useMemo(() => {
    if (!optimizedData) return 0;
    const values = optimizedData.datasets[0].data;
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.round(average);
  }, [optimizedData]);

  // Déterminer le niveau de performance
  const performanceLevel = useMemo(() => {
    if (globalScore >= 75) return { label: t('analytics:radar.excellent', { defaultValue: 'Excellent' }), color: 'text-green-600 dark:text-green-400' };
    if (globalScore >= 60) return { label: t('analytics:radar.good', { defaultValue: 'Bon' }), color: 'text-blue-600 dark:text-blue-400' };
    if (globalScore >= 40) return { label: t('analytics:radar.average', { defaultValue: 'Moyen' }), color: 'text-yellow-600 dark:text-yellow-400' };
    return { label: t('analytics:radar.needsImprovement', { defaultValue: 'À améliorer' }), color: 'text-red-600 dark:text-red-400' };
  }, [globalScore, t]);

  if (!optimizedData || !statisticsData) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 hover:shadow-xl transition-shadow duration-300 min-h-[450px]">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full mr-3"></div>
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            {t('analytics:radar.title', { defaultValue: 'Performance Globale' })}
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
      {/* En-tête avec score global */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full mr-3"></div>
          <div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              {t('analytics:radar.title', { defaultValue: 'Performance Globale' })}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('analytics:radar.subtitle', { defaultValue: 'Analyse des métriques clés' })}
            </p>
          </div>
          <TooltipComponent
            content={t('analytics:radar.tooltip', { defaultValue: 'Ce graphique radar affiche 5 métriques essentielles normalisées de 0 à 100. Plus la surface est grande, meilleure est votre performance. 50 = objectif minimum, 75+ = excellente performance.' })}
            position="top"
          >
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-help">
              <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </TooltipComponent>
        </div>
        
        {/* Score global */}
        <div className="text-right">
          <div className="flex items-center justify-end gap-2">
            <div className="text-3xl font-bold text-gray-800 dark:text-gray-100">
              {globalScore}<span className="text-lg text-gray-500">/100</span>
            </div>
            <TooltipComponent
              content={t('analytics:radar.scoreTooltip', { defaultValue: 'Score global calculé comme la moyenne des 5 métriques normalisées. Chaque métrique est évaluée sur une échelle de 0 à 100 selon des benchmarks réalistes du trading. Plus le score est élevé, meilleure est votre performance globale.' })}
              position="left"
            >
              <div className="flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-help">
                <svg className="w-2.5 h-2.5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </TooltipComponent>
          </div>
          <div className={`text-sm font-semibold ${performanceLevel.color}`}>
            {performanceLevel.label}
          </div>
        </div>
      </div>
      
      {/* Graphique et légende */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Graphique radar */}
        <div className="flex-1" style={{ height: '300px', position: 'relative' }}>
          <ChartRadar
            data={optimizedData}
            plugins={[createRadarAlternatingZonesPlugin(isDark), createRadarGradientPlugin(isDark)]}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              layout: {
                padding: {
                  top: -20,
                  right: -20,
                  bottom: 0,
                  left: -20,
                },
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
                  padding: 14,
                  titleFont: {
                    size: 14,
                    weight: 600,
                  },
                  bodyFont: {
                    size: 13,
                    weight: 500,
                  },
                  callbacks: {
                    title: (context: any) => {
                      return context[0].label;
                    },
                    label: (context: any) => {
                      const index = context.dataIndex;
                      const metric = metricInfo[index];
                      const normalizedValue = context.parsed.r;
                      const realValue = formatNumber(metric.value || 0, metric.unit === '%' ? 1 : 2);
                      
                      return [
                        `${t('analytics:radar.value', { defaultValue: 'Valeur' })}: ${realValue}${metric.unit}`,
                        `${t('analytics:radar.score', { defaultValue: 'Score' })}: ${formatNumber(normalizedValue, 0)}/100`,
                        `${metric.description}`,
                      ];
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
                    display: true,
                    stepSize: 25,
                    color: chartColors.textSecondary,
                    font: {
                      size: 10,
                      weight: 500,
                    },
                    backdropColor: 'transparent',
                    callback: function(value) {
                      return value === 0 ? '' : value;
                    },
                  },
                  grid: {
                    color: isDark ? 'rgba(55, 65, 81, 0.5)' : 'rgba(156, 163, 175, 0.4)',
                    lineWidth: 1.5,
                  },
                  pointLabels: {
                    display: true,
                    color: chartColors.text,
                    font: {
                      size: 13,
                      weight: 600,
                    },
                    padding: 2,
                  },
                  angleLines: {
                    color: isDark ? 'rgba(55, 65, 81, 0.5)' : 'rgba(156, 163, 175, 0.4)',
                    lineWidth: 1.5,
                  },
                },
              },
            }}
          />
        </div>

        {/* Légende détaillée */}
        <div className="lg:w-56 flex-shrink-0">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              {t('analytics:radar.metrics', { defaultValue: 'Métriques' })}
            </h4>
            {metricInfo.map((metric, index) => (
              <div key={index} className="group">
                <div className="flex items-start gap-2">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0 mt-1 ring-2 ring-white dark:ring-gray-800" 
                    style={{ backgroundColor: metric.color }}
                  ></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                        {metric.name}
                      </span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {formatNumber(metric.value || 0, metric.unit === '%' ? 1 : 2)}{metric.unit}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {metric.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Échelle de référence sous le graphique */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center gap-6 flex-wrap text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-gray-600 dark:text-gray-400">75-100: {t('analytics:radar.excellent', { defaultValue: 'Excellent' })}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span className="text-gray-600 dark:text-gray-400">60-74: {t('analytics:radar.good', { defaultValue: 'Bon' })}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
            <span className="text-gray-600 dark:text-gray-400">40-59: {t('analytics:radar.average', { defaultValue: 'Moyen' })}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            <span className="text-gray-600 dark:text-gray-400">0-39: {t('analytics:radar.needsImprovement', { defaultValue: 'À améliorer' })}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

