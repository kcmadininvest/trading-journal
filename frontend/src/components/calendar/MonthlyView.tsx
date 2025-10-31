import React from 'react';
import { MonthlyCalendarData, WeeklyCalendarData } from '../../services/calendar';
import { Tooltip } from '../ui';

interface MonthlyViewProps {
  year: number;
  monthlyData: MonthlyCalendarData[];
  weeklyData: WeeklyCalendarData[];
  yearlyTotal: number;
  onYearChange: (year: number) => void;
  onMonthClick: (month: number) => void;
  viewType?: 'daily' | 'monthly';
  onViewTypeChange?: (viewType: 'daily' | 'monthly') => void;
}

const monthNames = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const MonthlyView: React.FC<MonthlyViewProps> = ({
  year,
  monthlyData,
  weeklyData,
  yearlyTotal,
  onYearChange,
  onMonthClick,
  viewType,
  onViewTypeChange,
}) => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  // Créer un map pour accéder rapidement aux données par mois
  const monthlyDataMap = new Map<number, MonthlyCalendarData>();
  monthlyData.forEach(month => {
    monthlyDataMap.set(month.month, month);
  });

  // Calculer le PnL hebdomadaire par mois
  const weeklyByMonth = new Map<number, number>();
  weeklyData.forEach(week => {
    if (week.saturday_date) {
      const date = new Date(week.saturday_date);
      const month = date.getMonth() + 1;
      const existing = weeklyByMonth.get(month) || 0;
      weeklyByMonth.set(month, existing + week.pnl);
    }
  });

  // Organiser les mois en grille : 3 mois par ligne + 1 colonne hebdomadaire = 4 colonnes
  const monthsPerRow = 3;
  const rows = Math.ceil(12 / monthsPerRow);

  const formatPnl = (pnl: number): string => {
    if (pnl === 0) return '';
    const sign = pnl > 0 ? '+' : '';
    return `${sign}${Math.abs(pnl).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getPnlColor = (pnl: number): string => {
    if (pnl > 0) return 'text-green-600';
    if (pnl < 0) return 'text-red-600';
    return 'text-gray-400';
  };

  const getMonthBgColor = (month: number, pnl: number): string => {
    const isCurrentMonth = year === currentYear && month === currentMonth;
    if (isCurrentMonth) {
      return pnl > 0 ? 'bg-green-100' :
             pnl < 0 ? 'bg-red-100' :
             'bg-blue-50';
    }
    if (pnl > 0) return 'bg-green-50 hover:bg-green-100';
    if (pnl < 0) return 'bg-red-50 hover:bg-red-100';
    return 'bg-white hover:bg-gray-50';
  };

  const getMonthBorderClasses = (month: number, colIndex: number, rowIndex: number): string => {
    const isCurrentMonth = year === currentYear && month === currentMonth;
    if (!isCurrentMonth) {
      // Pour les mois non-actuels, garder la bordure droite standard
      return 'border-r border-gray-200';
    }
    // Pour le mois actuel, utiliser border-2 sur tous les côtés
    // La bordure bleue 2px remplace visuellement celle du divide-y (1px grise)
    return 'border-2 border-blue-500';
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
      <div className="flex items-center justify-between">
        {/* Sélecteur de vue à gauche */}
        {onViewTypeChange && (
          <div className="inline-flex rounded-md shadow-sm" role="group">
            <button
              type="button"
              onClick={() => onViewTypeChange('daily')}
              className={`px-4 py-2 text-sm font-medium rounded-l-lg border ${
                viewType === 'daily'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Quotidienne
            </button>
            <button
              type="button"
              onClick={() => onViewTypeChange('monthly')}
              className={`px-4 py-2 text-sm font-medium rounded-r-lg border-t border-r border-b ${
                viewType === 'monthly'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Mensuelle
            </button>
          </div>
        )}

        {/* Navigation de période centrée */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigateYear('prev')}
            className="p-2 rounded-md hover:bg-gray-200 transition-colors"
            aria-label="Année précédente"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <h2 className="text-2xl font-bold text-gray-800">
            {year}
          </h2>

          <button
            onClick={() => navigateYear('next')}
            className="p-2 rounded-md hover:bg-gray-200 transition-colors"
            aria-label="Année suivante"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {year !== currentYear && (
            <button
              onClick={goToToday}
              className="ml-4 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Aujourd'hui
            </button>
          )}
        </div>

        {/* Espaceur à droite pour équilibrer */}
        {onViewTypeChange && <div className="w-[160px]"></div>}
      </div>

      {/* Calendrier */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {/* En-têtes des colonnes */}
        <div className="grid grid-cols-4 bg-gray-100 border-b border-gray-200">
          <div className="px-2 py-3 text-center text-sm font-semibold text-gray-700 border-r border-gray-200">
          </div>
          <div className="px-2 py-3 text-center text-sm font-semibold text-gray-700 border-r border-gray-200">
          </div>
          <div className="px-2 py-3 text-center text-sm font-semibold text-gray-700 border-r border-gray-200">
          </div>
          <div className="px-2 py-3 text-center text-sm font-semibold text-gray-700 bg-blue-50">
            PnL Hebdomadaire
          </div>
        </div>

        {/* Grille du calendrier */}
        <div className="divide-y divide-gray-200">
          {Array.from({ length: rows }).map((_, rowIndex) => {
            const monthCells = calendarCells.slice(rowIndex * monthsPerRow, (rowIndex + 1) * monthsPerRow);
            
            // Calculer le PnL hebdomadaire pour cette ligne (somme des 3 mois de la ligne)
            const weeklyPnlForRow = monthCells.reduce((sum, month) => {
              return sum + (weeklyByMonth.get(month) || 0);
            }, 0);

            return (
              <div key={rowIndex} className="grid grid-cols-4">
                {monthCells.map((month, colIndex) => {
                  const monthData = monthlyDataMap.get(month);
                  const monthlyPnl = monthData?.pnl || 0;
                  const tradeCount = monthData?.trade_count || 0;
                  const isCurrentMonth = year === currentYear && month === currentMonth;

                  return (
                    <div
                      key={month}
                      className={`h-32 p-2 cursor-pointer ${getMonthBgColor(month, monthlyPnl)} ${getMonthBorderClasses(month, colIndex, rowIndex)}`}
                      onClick={() => onMonthClick(month)}
                    >
                      <div className="flex flex-col h-full">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-sm font-medium ${isCurrentMonth ? 'text-blue-600 font-bold' : 'text-gray-700'}`}>
                            {monthNames[month - 1]}
                          </span>
                          {tradeCount > 0 && (
                            <Tooltip content={`${tradeCount} trade${tradeCount > 1 ? 's' : ''}`} position="top">
                              <span className="text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded-full cursor-help">
                                {tradeCount}
                              </span>
                            </Tooltip>
                          )}
                        </div>
                        {monthlyPnl !== 0 && (
                          <div className={`text-base font-semibold mt-auto ${getPnlColor(monthlyPnl)}`}>
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
                  // Ne pas ajouter de bordure droite si c'est la dernière colonne avant la colonne hebdomadaire
                  return (
                    <div
                      key={`empty-${emptyIndex}`}
                      className={`h-32 bg-gray-50 ${emptyColIndex < monthsPerRow - 1 ? 'border-r border-gray-200' : ''}`}
                    />
                  );
                })}

                {/* Colonne PnL Hebdomadaire pour cette ligne */}
                <div
                  className={`h-32 p-2 bg-blue-50 ${weeklyPnlForRow > 0 ? 'bg-green-50' : weeklyPnlForRow < 0 ? 'bg-red-50' : ''}`}
                >
                  <div className="flex flex-col h-full justify-center">
                    {weeklyPnlForRow !== 0 && (
                      <div className={`text-base font-semibold text-center ${getPnlColor(weeklyPnlForRow)}`}>
                        {formatPnl(weeklyPnlForRow)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Ligne supplémentaire avec le total annuel dans la colonne PnL Hebdomadaire */}
          <div className="grid grid-cols-4 bg-gray-100 border-t-2 border-gray-300">
            <div className="col-span-3 px-4 py-3 font-semibold text-gray-900 border-r border-gray-200">
              Total {year}
            </div>
            <div className={`px-4 py-3 font-bold text-center ${getPnlColor(yearlyTotal)}`}>
              {formatPnl(yearlyTotal)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlyView;
