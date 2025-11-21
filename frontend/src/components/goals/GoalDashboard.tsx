import React, { useMemo } from 'react';
import { TradingGoal, GoalStatistics } from '../../services/goals';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { formatNumber } from '../../utils/numberFormat';
import Tooltip from '../ui/Tooltip';

interface GoalDashboardProps {
  goals: TradingGoal[];
  statistics: GoalStatistics | null;
  loading?: boolean;
}

export const GoalDashboard: React.FC<GoalDashboardProps> = ({
  goals,
  statistics,
  loading = false,
}) => {
  const { t } = useI18nTranslation();

  const { activeGoals, dangerGoals, successRate, avgProgress } = useMemo(() => {
    const active = goals.filter(g => g.status === 'active');
    const achieved = goals.filter(g => g.status === 'achieved');
    const failed = goals.filter(g => g.status === 'failed');
    
    const danger = active.filter(g => {
      // Si zone_status est défini, l'utiliser directement
      if (g.zone_status) {
        return g.zone_status === 'danger';
      }
      // Sinon, calculer basé sur la progression (fallback)
      // Si progression < 50%, considérer comme en danger
      const progress = g.progress_percentage || 0;
      return progress < 50;
    });

    // Calculer le taux de réussite
    // Seulement parmi les objectifs terminés (atteints + échoués)
    // Les objectifs annulés ne sont pas comptés
    const totalCompleted = achieved.length + failed.length;
    const success = totalCompleted > 0 
      ? (achieved.length / totalCompleted) * 100 
      : 0;

    // Calculer la progression moyenne
    const avg = active.length > 0
      ? active.reduce((sum, g) => sum + (g.progress_percentage || 0), 0) / active.length
      : 0;

    return {
      activeGoals: active,
      dangerGoals: danger,
      successRate: success,
      avgProgress: avg,
    };
  }, [goals]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          </div>
        ))}
      </div>
    );
  }

  const kpis = [
    {
      label: t('goals:dashboard.activeGoals', { defaultValue: 'Objectifs actifs' }),
      value: statistics?.active_goals ?? activeGoals.length,
      tooltip: t('goals:dashboard.activeGoalsTooltip', { 
        defaultValue: 'Nombre d\'objectifs actuellement en cours',
        count: statistics?.active_goals ?? activeGoals.length
      }),
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      label: t('goals:dashboard.successRate', { defaultValue: 'Taux de réussite' }),
      value: `${formatNumber(successRate, 1)}%`,
      tooltip: t('goals:dashboard.successRateTooltip', { 
        defaultValue: 'Pourcentage d\'objectifs atteints parmi les objectifs terminés (atteints + échoués)',
        rate: formatNumber(successRate, 1),
        achieved: goals.filter(g => g.status === 'achieved').length,
        total: goals.filter(g => g.status === 'achieved' || g.status === 'failed').length
      }),
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      label: t('goals:dashboard.avgProgress', { defaultValue: 'Progression moyenne' }),
      value: `${formatNumber(avgProgress, 1)}%`,
      tooltip: t('goals:dashboard.avgProgressTooltip', { 
        defaultValue: 'Progression moyenne de tous les objectifs actifs',
        progress: formatNumber(avgProgress, 1),
        count: activeGoals.length
      }),
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    },
    {
      label: t('goals:dashboard.dangerGoals', { defaultValue: 'En danger' }),
      value: dangerGoals.length,
      tooltip: t('goals:dashboard.dangerGoalsTooltip', { 
        defaultValue: 'Nombre d\'objectifs actifs qui sont en zone de danger (risque d\'échec)',
        count: dangerGoals.length
      }),
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {kpis.map((kpi, index) => (
        <div
          key={index}
          className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className={`p-2 rounded-lg ${kpi.bgColor} flex-shrink-0`}>
                <div className={kpi.color}>
                  {kpi.icon}
                </div>
              </div>
              <div className="flex items-center gap-1 min-w-0 flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                  {kpi.label}
                </p>
                <Tooltip content={kpi.tooltip} position="top" delay={300}>
                  <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </Tooltip>
              </div>
            </div>
            <p className={`text-xl font-bold ${kpi.color} whitespace-nowrap flex-shrink-0`}>
              {kpi.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

