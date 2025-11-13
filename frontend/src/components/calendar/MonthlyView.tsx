import React, { useMemo } from 'react';
import { MonthlyCalendarData, WeeklyCalendarData } from '../../services/calendar';
import { Tooltip } from '../ui';
import { usePreferences } from '../../hooks/usePreferences';
import { formatCurrencyWithSign } from '../../utils/numberFormat';
import { getMonthNames } from '../../utils/dateFormat';
import { useTranslation as useI18nTranslation } from 'react-i18next';

interface MonthlyViewProps {
  year: number;
  monthlyData: MonthlyCalendarData[];
  weeklyData: WeeklyCalendarData[];
  yearlyTotal: number;
  onYearChange: (year: number) => void;
  onMonthClick: (month: number) => void;
  viewType?: 'daily' | 'monthly';
  onViewTypeChange?: (viewType: 'daily' | 'monthly') => void;
  currencySymbol?: string;
}

const MonthlyView: React.FC<MonthlyViewProps> = ({
  year,
  monthlyData,
  weeklyData,
  yearlyTotal,
  onYearChange,
  onMonthClick,
  viewType,
  onViewTypeChange,
  currencySymbol = '',
}) => {
  const { preferences } = usePreferences();
  const { t } = useI18nTranslation();
  const monthNames = useMemo(() => getMonthNames(preferences.language), [preferences.language]);
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  // Créer un map pour accéder rapidement aux données par mois
  const monthlyDataMap = new Map<number, MonthlyCalendarData>();
  monthlyData.forEach(month => {
    monthlyDataMap.set(month.month, month);
  });

  // Organiser les mois en grille : 3 mois par ligne
  const monthsPerRow = 3;
  const rows = Math.ceil(12 / monthsPerRow);

  const formatPnl = (pnl: number): string => {
    if (pnl === 0) return '';
    const formatted = formatCurrencyWithSign(pnl, currencySymbol, preferences.number_format, 2);
    return formatted === '-' ? '' : formatted;
  };

  const getPnlColor = (pnl: number): string => {
    if (pnl > 0) return 'text-green-600 dark:text-green-400';
    if (pnl < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-400 dark:text-gray-500';
  };

  const getMonthBgColor = (month: number, pnl: number): string => {
    const isCurrentMonth = year === currentYear && month === currentMonth;
    if (isCurrentMonth) {
      return pnl > 0 ? 'bg-green-100 dark:bg-green-900/30' :
             pnl < 0 ? 'bg-red-100 dark:bg-red-900/30' :
             'bg-blue-50 dark:bg-blue-900/30';
    }
    if (pnl > 0) return 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30';
    if (pnl < 0) return 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30';
    return 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700';
  };

  const getMonthBorderClasses = (month: number, colIndex: number, rowIndex: number): string => {
    const isCurrentMonth = year === currentYear && month === currentMonth;
    if (!isCurrentMonth) {
      // Pour les mois non-actuels, ajouter la bordure droite sauf pour la dernière colonne
      return colIndex < monthsPerRow - 1 ? 'border-r border-gray-200 dark:border-gray-700' : '';
    }
    // Pour le mois actuel, utiliser border-2 sur tous les côtés
    // La bordure bleue 2px remplace visuellement celle du divide-y (1px grise)
    return 'border-2 border-blue-500 dark:border-blue-400';
  };

  const navigateYear = (direction: 'prev' | 'next') => {
    onYearChange(direction === 'prev' ? year - 1 : year + 1);
  };

  const goToToday = () => {
    onYearChange(currentYear);
  };

  // Créer les cellules du calendrier mensuel (12 mois)
  const calendarCells: number[] = [];
  for (let month = 1; month <= 12; month++) {
    calendarCells.push(month);
  }

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Sélecteur de vue à gauche */}
        {onViewTypeChange && (
          <div className="inline-flex rounded-md shadow-sm" role="group">
            <button
              type="button"
              onClick={() => onViewTypeChange('daily')}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-l-lg border ${
                viewType === 'daily'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {t('calendar:daily')}
            </button>
            <button
              type="button"
              onClick={() => onViewTypeChange('monthly')}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-r-lg border-t border-r border-b ${
                viewType === 'monthly'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {t('calendar:monthly')}
            </button>
          </div>
        )}

        {/* Navigation de période centrée */}
        <div className="flex items-center justify-center flex-1 space-x-2 sm:space-x-4">
          <button
            onClick={() => navigateYear('prev')}
            className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
            aria-label={t('calendar:previousYear')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <h2 className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-gray-100 text-center">
            {year}
          </h2>

          <button
            onClick={() => navigateYear('next')}
            className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
            aria-label={t('calendar:nextYear')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {year !== currentYear && (
            <button
              onClick={goToToday}
              className="ml-2 sm:ml-4 px-3 sm:px-4 py-2 text-xs sm:text-sm bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              {t('calendar:today')}
            </button>
          )}
        </div>
      </div>

      {/* Calendrier */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          {/* En-têtes des colonnes */}
          <div className="grid grid-cols-3 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 min-w-[360px]">
            <div className="px-1 sm:px-2 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600">
            </div>
            <div className="px-1 sm:px-2 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600">
            </div>
            <div className="px-1 sm:px-2 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
            </div>
          </div>

          {/* Grille du calendrier */}
          <div className="divide-y divide-gray-200 dark:divide-gray-700 min-w-[360px]">
            {Array.from({ length: rows }).map((_, rowIndex) => {
            const monthCells = calendarCells.slice(rowIndex * monthsPerRow, (rowIndex + 1) * monthsPerRow);

            return (
              <div key={rowIndex} className="grid grid-cols-3">
                {monthCells.map((month, colIndex) => {
                  const monthData = monthlyDataMap.get(month);
                  const monthlyPnl = monthData?.pnl || 0;
                  const tradeCount = monthData?.trade_count || 0;
                  const isCurrentMonth = year === currentYear && month === currentMonth;

                  return (
                    <div
                      key={month}
                      className={`h-24 sm:h-32 p-1 sm:p-2 cursor-pointer ${getMonthBgColor(month, monthlyPnl)} ${getMonthBorderClasses(month, colIndex, rowIndex)}`}
                      onClick={() => onMonthClick(month)}
                    >
                      <div className="flex flex-col h-full">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs sm:text-sm font-medium ${isCurrentMonth ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-700 dark:text-gray-300'}`}>
                            {monthNames[month - 1]}
                          </span>
                          {tradeCount > 0 && (
                            <Tooltip content={`${tradeCount} ${tradeCount > 1 ? t('calendar:trades') : t('calendar:trade')}`} position="top">
                              <span className="text-[10px] sm:text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-1 sm:px-1.5 py-0.5 rounded-full cursor-help">
                                {tradeCount}
                              </span>
                            </Tooltip>
                          )}
                        </div>
                        {monthlyPnl !== 0 && (
                          <div className={`text-xs sm:text-base font-semibold mt-auto ${getPnlColor(monthlyPnl)} break-words`}>
                            {formatPnl(monthlyPnl)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Cellules vides si moins de 3 mois dans la ligne */}
                {monthCells.length < monthsPerRow && Array.from({ length: monthsPerRow - monthCells.length }).map((_, emptyIndex) => {
                  const emptyColIndex = monthCells.length + emptyIndex;
                  return (
                    <div
                      key={`empty-${emptyIndex}`}
                      className={`h-24 sm:h-32 bg-gray-50 dark:bg-gray-700 ${emptyColIndex < monthsPerRow - 1 ? 'border-r border-gray-200 dark:border-gray-700' : ''}`}
                    />
                  );
                })}
              </div>
            );
          })}

            {/* Ligne supplémentaire avec le total annuel */}
            <div className="grid grid-cols-3 bg-gray-100 dark:bg-gray-700 border-t-2 border-gray-300 dark:border-gray-600">
              <div className="col-span-3 px-2 sm:px-4 py-2 sm:py-3 text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">
                {t('calendar:total')} {year} : <span className={`font-bold ${getPnlColor(yearlyTotal)}`}>{formatPnl(yearlyTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlyView;
