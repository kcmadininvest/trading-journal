import React from 'react';
import { useTranslation } from 'react-i18next';
import Tooltip from '../ui/Tooltip';
import { maskValue } from '../../hooks/usePrivacySettings';

interface GlobalStatsIndicatorsProps {
  disciplineRate: number;
  disciplineTrend?: number;
  disciplineSparkline?: number[];
  totalPnL: number;
  pnlTrend?: number;
  pnlSparkline?: number[];
  winRate?: number;
  winRateSparkline?: number[];
  totalPositions: number;
  globalActiveDays: number;
  /** Conservé pour compatibilité / HMR ; non affiché */
  activitySparkline?: number[];
  currencySymbol: string;
  /** Masque le montant PnL global (aligné sur « masquer le solde actuel ») */
  hideCurrentBalance?: boolean;
  /**
   * En multi-devises, ne pas suffixer le PnL global d’un symbole unique (valeur trompeuse).
   */
  pnlCurrencyMode?: 'single' | 'mixed';
  className?: string;
}

export const GlobalStatsIndicators: React.FC<GlobalStatsIndicatorsProps> = ({
  disciplineRate,
  disciplineTrend,
  disciplineSparkline = [],
  totalPnL,
  pnlTrend,
  pnlSparkline = [],
  winRate,
  winRateSparkline = [],
  currencySymbol,
  hideCurrentBalance = false,
  pnlCurrencyMode = 'single',
  className = '',
}) => {
  const { t } = useTranslation();

  const getDisciplineColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    if (rate >= 60) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
    return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
  };

  const getPnLColor = (pnl: number) => {
    if (pnl > 0) return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    if (pnl < 0) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
    return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800';
  };

  const getWinRateColor = (rate: number) => {
    if (rate >= 60) return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    if (rate >= 45) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
    return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
  };

  const formatPnL = (value: number) => {
    const absValue = Math.abs(value);
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(absValue);
    const suffix =
      pnlCurrencyMode === 'mixed' || !currencySymbol ? '' : currencySymbol;
    return `${value >= 0 ? '+' : '-'}${formatted}${suffix}`;
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

  const renderSparklineSlot = (data: number[]) => (
    <div className="ml-auto flex h-6 w-[60px] flex-shrink-0 items-center justify-end">
      {data && data.length >= 2 ? (
        <div className="opacity-60">{renderSparkline(data, 'currentColor')}</div>
      ) : null}
    </div>
  );

  const cardShell = 'flex h-full min-h-[3.25rem] items-center gap-2 px-3 py-2 rounded-lg border transition-colors';

  return (
    <div className={`flex items-stretch gap-2 ${className}`}>
      {/* Carte Discipline */}
      <Tooltip
        className="block h-full min-h-0"
        content={t('dashboard:disciplineTooltip', { defaultValue: 'Taux de respect de la stratégie sur la période' })}
      >
        <div className={`${cardShell} ${getDisciplineColor(disciplineRate)}`}>
          <div className="flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex min-w-0 flex-col justify-center">
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
          {renderSparklineSlot(disciplineSparkline)}
        </div>
      </Tooltip>

      {/* Carte PnL Global */}
      <Tooltip
        className="block h-full min-h-0"
        content={
          pnlCurrencyMode === 'mixed'
            ? t('dashboard:pnlTooltipMixedCurrency', {
                defaultValue:
                  'Somme des PnL de tous les comptes actifs (unités natives par compte — pas de conversion de devise).',
              })
            : t('dashboard:pnlTooltip', { defaultValue: 'Performance totale tous comptes confondus' })
        }
      >
        <div
          className={`${cardShell} ${
            hideCurrentBalance
              ? 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800'
              : getPnLColor(totalPnL)
          }`}
        >
          <div className="flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex min-w-0 flex-col justify-center">
            <div className="text-xs font-medium opacity-75 whitespace-nowrap">
              {t('dashboard:globalPnL', { defaultValue: 'PnL Global' })}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold leading-none whitespace-nowrap">
                {hideCurrentBalance ? maskValue(null, currencySymbol) : formatPnL(totalPnL)}
              </span>
              {!hideCurrentBalance && renderTrend(pnlTrend, totalPnL >= 0)}
            </div>
          </div>
          {!hideCurrentBalance ? renderSparklineSlot(pnlSparkline) : <div className="ml-auto h-6 w-[60px] flex-shrink-0" aria-hidden />}
        </div>
      </Tooltip>

      {/* Carte Win Rate */}
      {winRate !== undefined && (
        <Tooltip
          className="block h-full min-h-0"
          content={t('dashboard:winRateTooltip', { defaultValue: 'Taux de réussite tous comptes confondus' })}
        >
          <div className={`${cardShell} ${getWinRateColor(winRate)}`}>
            <div className="flex-shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex min-w-0 flex-col justify-center">
              <div className="text-xs font-medium opacity-75 whitespace-nowrap">
                {t('dashboard:globalWinRate', { defaultValue: 'Win Rate' })}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-lg font-bold leading-none">
                  {winRate.toFixed(2)}%
                </span>
              </div>
            </div>
            {renderSparklineSlot(winRateSparkline)}
          </div>
        </Tooltip>
      )}

      {/* Carte Activité retirée de la barre du haut :
          les données d'activité restent affichées dans Total trades */}
    </div>
  );
};
