import React from 'react';
import { useTranslation } from 'react-i18next';
import Tooltip from '../ui/Tooltip';
import { maskValue } from '../../hooks/usePrivacySettings';
import { formatNumber, type NumberFormatType } from '../../utils/numberFormat';

interface GlobalStatsIndicatorsProps {
  disciplineRate: number;
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
  numberFormat?: NumberFormatType;
  className?: string;
}

export const GlobalStatsIndicators: React.FC<GlobalStatsIndicatorsProps> = ({
  disciplineRate,
  disciplineSparkline = [],
  totalPnL,
  pnlTrend,
  pnlSparkline = [],
  winRate,
  winRateSparkline = [],
  currencySymbol,
  hideCurrentBalance = false,
  pnlCurrencyMode = 'single',
  numberFormat = 'comma',
  className = '',
}) => {
  const { t } = useTranslation();

  const getDisciplineColor = (rate: number) => {
    if (rate >= 80) {
      return 'text-emerald-700 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-400/30 dark:bg-emerald-500/10';
    }
    if (rate >= 60) {
      return 'text-amber-700 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-400/30 dark:bg-amber-500/10';
    }
    return 'text-red-700 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-400/30 dark:bg-red-500/10';
  };

  const getPnLColor = (pnl: number) => {
    if (pnl > 0) {
      return 'text-blue-700 border-blue-200 bg-blue-50 dark:text-blue-400 dark:border-blue-400/30 dark:bg-blue-500/10';
    }
    if (pnl < 0) {
      return 'text-pink-700 border-pink-200 bg-pink-50 dark:text-pink-400 dark:border-pink-400/30 dark:bg-pink-500/10';
    }
    return 'text-gray-600 border-gray-200 bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:bg-gray-700/50';
  };

  const getWinRateColor = (rate: number) => {
    if (rate >= 60) {
      return 'text-emerald-700 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-400/30 dark:bg-emerald-500/10';
    }
    if (rate >= 45) {
      return 'text-amber-700 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-400/30 dark:bg-amber-500/10';
    }
    return 'text-red-700 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-400/30 dark:bg-red-500/10';
  };

  const formatPnL = (value: number) => {
    const formatted = formatNumber(Math.abs(value), 2, numberFormat);
    const suffix =
      pnlCurrencyMode === 'mixed' || !currencySymbol ? '' : currencySymbol;
    return `${value >= 0 ? '+' : '-'}${formatted}${suffix}`;
  };

  const formatPercent = (value: number) =>
    `${formatNumber(value, 2, numberFormat)}%`;

  const renderTrend = (trend: number | undefined, isPositive: boolean) => {
    if (trend === undefined || trend === 0) return null;
    
    const trendColor = (isPositive && trend > 0) || (!isPositive && trend < 0)
      ? 'text-emerald-600 dark:text-emerald-400'
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

  const cardShell =
    'flex h-10 min-h-10 items-center gap-2 rounded-lg border px-3 py-1.5 transition-colors';

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
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {t('dashboard:globalDiscipline', { defaultValue: 'Discipline' })}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold leading-none">
                {formatPercent(disciplineRate)}
              </span>
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
              ? 'text-gray-600 border-gray-200 bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:bg-gray-700/50'
              : getPnLColor(totalPnL)
          }`}
        >
          <div className="flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex min-w-0 flex-col justify-center">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
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
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {t('dashboard:globalWinRate', { defaultValue: 'Win Rate' })}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-lg font-bold leading-none">
                  {formatPercent(winRate)}
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
