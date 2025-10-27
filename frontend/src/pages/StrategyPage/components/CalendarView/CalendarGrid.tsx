import React from 'react';
import { CalendarData, StrategyDataMap, DailyData } from '../../types/strategy.types';

interface CalendarGridProps {
  calendarDays: any[];
  calendarData: CalendarData | null;
  strategyData: StrategyDataMap;
  getDayData: (day: number) => DailyData | undefined;
  getStrategyIndicator: (day: number) => any;
  formatCurrency: (amount: number) => string;
  getResponsiveTextSize: (amount: number) => string;
  onDayClick: (dayInfo: any) => Promise<void>;
}

const CalendarGrid: React.FC<CalendarGridProps> = ({
  calendarDays,
  calendarData,
  strategyData,
  getDayData,
  getStrategyIndicator,
  formatCurrency,
  getResponsiveTextSize,
  onDayClick
}) => {
  const weekDays = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  const isToday = (dayInfo: any) => {
    const today = new Date();
    return dayInfo.isCurrentMonth && 
           dayInfo.date.getDate() === today.getDate() &&
           dayInfo.date.getMonth() === today.getMonth() &&
           dayInfo.date.getFullYear() === today.getFullYear();
  };

  return (
    <>
      {/* En-têtes */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {weekDays.map((day) => (
          <div key={day} className="p-3 text-center text-sm font-medium text-gray-600 bg-gray-50">
            {day}
          </div>
        ))}
      </div>
      
      {/* Indicateur de chargement initial si pas de données */}
      {!calendarData && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <div className="text-sm text-gray-600">Chargement du calendrier...</div>
          </div>
        </div>
      )}

      {/* Grille du calendrier - seulement si les données sont disponibles */}
      {calendarData && (
        <div className="grid grid-cols-7">
          {calendarDays.map((dayInfo, index) => {
            const dayData = dayInfo.isCurrentMonth ? getDayData(dayInfo.day) : null;
            const today = isToday(dayInfo);
            const isSaturday = index % 7 === 6; // Samedi est le 7ème jour (index 6)
            
            // Calculer le total de la semaine pour les samedis
            let weekTotal = 0;
            let weekTradeCount = 0;
            let hasCurrentMonthDays = false;
            
            if (isSaturday) {
              const weekStart = Math.floor(index / 7) * 7;
              const weekEnd = Math.min(weekStart + 7, calendarDays.length);
              const weekDays = calendarDays.slice(weekStart, weekEnd);
              
              weekDays.forEach(weekDayInfo => {
                if (weekDayInfo.isCurrentMonth) {
                  hasCurrentMonthDays = true;
                  const weekDayData = getDayData(weekDayInfo.day);
                  if (weekDayData) {
                    weekTotal += weekDayData.pnl;
                    weekTradeCount += weekDayData.trade_count;
                  }
                }
              });
            }
            
            return (
              <div 
                key={index} 
                className={`border-r border-b border-gray-200 min-h-[140px] p-2 cursor-pointer hover:bg-gray-50 transition-colors ${today ? 'bg-violet-50 border-violet-200' : ''} ${isSaturday ? 'bg-violet-50' : ''}`}
                onClick={() => onDayClick(dayInfo)}
              >
                {dayInfo.isCurrentMonth ? (
                  <div className="h-full flex flex-col">
                    <div className={`text-base font-medium mb-1 ${today ? 'text-violet-600 font-bold' : 'text-gray-900'}`}>
                      {dayInfo.day}
                    </div>
                    
                    {/* Section pour les sessions de stratégie */}
                    <div className="flex-1 space-y-1">
                      {(() => {
                        const indicator = getStrategyIndicator(dayInfo.day);
                        if (indicator) {
                          return (
                            <div className="flex flex-col items-center justify-center space-y-1">
                              <div 
                                className={`w-8 h-8 rounded-full ${indicator.color}`}
                                title={indicator.text}
                              ></div>
                              <div className="text-sm text-center leading-tight">
                                <div className={`font-medium ${indicator.isRespected ? 'text-blue-600' : 'text-gray-600'}`}>
                                  {indicator.isRespected ? 'Respectée' : 'Non respectée'}
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>

                    {/* Données de trading ou total de semaine pour samedi */}
                    {isSaturday ? (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <div className="text-xs text-gray-600 mb-1">Total semaine</div>
                        {hasCurrentMonthDays && weekTradeCount > 0 ? (
                          <>
                            <div className={`${getResponsiveTextSize(weekTotal)} font-bold ${weekTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(weekTotal)}
                            </div>
                            <div className="text-sm text-gray-500">
                              {weekTradeCount} trade{weekTradeCount > 1 ? 's' : ''}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-gray-400">$0.00</div>
                        )}
                      </div>
                    ) : (
                      dayData && dayData.trade_count > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <div className={`${getResponsiveTextSize(dayData.pnl)} font-bold ${dayData.pnl >= 0 ? 'text-blue-600' : 'text-gray-600'}`}>
                            {formatCurrency(dayData.pnl)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {dayData.trade_count} trade{dayData.trade_count > 1 ? 's' : ''}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-base text-gray-300">{dayInfo.day}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

export default CalendarGrid;
