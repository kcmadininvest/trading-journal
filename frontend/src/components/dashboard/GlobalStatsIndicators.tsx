import React from 'react';
import { useTranslation } from 'react-i18next';
import Tooltip from '../ui/Tooltip';

interface GlobalStatsIndicatorsProps {
  disciplineRate: number;
  disciplineTrend?: number;
  disciplineSparkline?: number[];
  totalPnL: number;
  pnlTrend?: number;
  pnlSparkline?: number[];
  currencySymbol: string;
  className?: string;
}

export const GlobalStatsIndicators: React.FC<GlobalStatsIndicatorsProps> = ({
  disciplineRate,
  disciplineTrend,
  disciplineSparkline = [],
  totalPnL,
  pnlTrend,
  pnlSparkline = [],
  currencySymbol,
  className = '',
}) => {
  const { t } = useTranslation();

  const getDisciplineColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    if (rate >= 60) return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800';
    return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
  };

  const getPnLColor = (pnl: number) => {
    if (pnl > 0) return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    if (pnl < 0) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
    return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800';
  };

  const formatPnL = (value: number) => {
    const absValue = Math.abs(value);
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(absValue);
    return `${value >= 0 ? '+' : '-'}${formatted}${currencySymbol}`;
  };

  const renderTrend = (trend: number | undefined, isPositive: boolean) => {
    if (trend === undefined || trend === 0) return null;
    
    const trendColor = (isPositive && trend > 0) || (!isPositive && trend < 0)
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400';
    
    return (
      <div className={`flex items-center gap-0.5 text-xs font-medium ${trendColor}`}>
        {trend > 0 ? (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
        <span>{Math.abs(trend).toFixed(1)}%</span>
      </div>
    );
  };

  const renderSparkline = (data: number[], color: string) => {
    if (!data || data.length < 2) return null;
    
    const width = 60;
    const height = 24;
    const padding = 2;
    
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    
    const points = data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((value - min) / range) * (height - 2 * padding);
      return `${x},${y}`;
    }).join(' ');
    
    return (
      <svg width={width} height={height} className="flex-shrink-0">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      {/* Carte Discipline */}
      <Tooltip content={t('dashboard:disciplineTooltip', { defaultValue: 'Taux de respect de la stratégie sur la période' })}>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${getDisciplineColor(disciplineRate)}`}>
          <div className="flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex flex-col min-w-0">
            <div className="text-xs font-medium opacity-75 whitespace-nowrap">
              {t('dashboard:globalDiscipline', { defaultValue: 'Discipline' })}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold leading-none">
                {disciplineRate.toFixed(2)}%
              </span>
              {renderTrend(disciplineTrend, true)}
            </div>
          </div>
          {disciplineSparkline && disciplineSparkline.length > 0 && (
            <div className="ml-auto opacity-60">
              {renderSparkline(disciplineSparkline, 'currentColor')}
            </div>
          )}
        </div>
      </Tooltip>

      {/* Carte PnL Global */}
      <Tooltip content={t('dashboard:pnlTooltip', { defaultValue: 'Performance totale tous comptes confondus' })}>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${getPnLColor(totalPnL)}`}>
          <div className="flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex flex-col min-w-0">
            <div className="text-xs font-medium opacity-75 whitespace-nowrap">
              {t('dashboard:globalPnL', { defaultValue: 'PnL Global' })}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold leading-none whitespace-nowrap">
                {formatPnL(totalPnL)}
              </span>
              {renderTrend(pnlTrend, totalPnL >= 0)}
            </div>
          </div>
          {pnlSparkline && pnlSparkline.length > 0 && (
            <div className="ml-auto opacity-60">
              {renderSparkline(pnlSparkline, 'currentColor')}
            </div>
          )}
        </div>
      </Tooltip>
    </div>
  );
};
