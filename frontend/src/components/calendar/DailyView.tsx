import React, { useState, useMemo } from 'react';
import { DailyCalendarData, WeeklyCalendarData } from '../../services/calendar';
import { Tooltip } from '../ui';
import { DayTradesModal } from '../trades/DayTradesModal';
import { StrategyComplianceModal } from '../trades/StrategyComplianceModal';
import { usePreferences } from '../../hooks/usePreferences';
import { formatCurrencyWithSign } from '../../utils/numberFormat';
import { getMonthNames, getDayNames } from '../../utils/dateFormat';
import { useTranslation as useI18nTranslation } from 'react-i18next';

interface DailyViewProps {
  year: number;
  month: number;
  dailyData: DailyCalendarData[];
  weeklyData: WeeklyCalendarData[];
  monthlyTotal: number;
  onMonthChange: (year: number, month: number) => void;
  viewType?: 'daily' | 'monthly';
  onViewTypeChange?: (viewType: 'daily' | 'monthly') => void;
  tradingAccount?: number;
  onDataRefresh?: () => void;
  currencySymbol?: string;
}

const DailyView: React.FC<DailyViewProps> = ({
  year,
  month,
  dailyData,
  weeklyData,
  monthlyTotal,
  onMonthChange,
  viewType,
  onViewTypeChange,
  tradingAccount,
  onDataRefresh,
  currencySymbol = '',
}) => {
  const { preferences } = usePreferences();
  const { t } = useI18nTranslation();
  const [selectedDateForTrades, setSelectedDateForTrades] = useState<string | null>(null);
  const [selectedDateForStrategy, setSelectedDateForStrategy] = useState<string | null>(null);
  
  const monthNames = useMemo(() => getMonthNames(preferences.language), [preferences.language]);
  const dayNames = useMemo(() => getDayNames(preferences.language), [preferences.language]);

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const currentDay = currentDate.getDate();

  // Créer un map pour accéder rapidement aux données par jour
  const dailyDataMap = new Map<number, DailyCalendarData>();
  dailyData.forEach(day => {
    const dayNum = parseInt(day.date);
    dailyDataMap.set(dayNum, day);
  });

  // Calculer le premier jour du mois et le nombre de jours
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay(); // 0 = Dimanche, 6 = Samedi

  // Calculer le PnL total mensuel pour la colonne Samedi
  const monthlyPnlForSaturday = monthlyTotal;

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

  const getDayBgColor = (day: number, pnl: number): string => {
    const isToday = year === currentYear && month === currentMonth && day === currentDay;
    if (isToday) {
      return pnl > 0 ? 'bg-green-100 dark:bg-green-900/30 border-2 border-blue-500 dark:border-blue-400' :
             pnl < 0 ? 'bg-red-100 dark:bg-red-900/30 border-2 border-blue-500 dark:border-blue-400' :
             'bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-500 dark:border-blue-400';
    }
    if (pnl > 0) return 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30';
    if (pnl < 0) return 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30';
    return 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700';
  };

  const getStrategyStatusColor = (status?: 'compliant' | 'non_compliant' | 'partial' | 'unknown'): string => {
    switch (status) {
      case 'compliant':
        return 'bg-green-500';
      case 'non_compliant':
        return 'bg-red-500';
      case 'partial':
        return 'bg-orange-500';
      default:
        return 'bg-gray-400';
    }
  };

  const formatDateForApi = (day: number): string => {
    // Formater la date sans passer par toISOString pour éviter les problèmes de timezone
    const monthStr = String(month).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    return `${year}-${monthStr}-${dayStr}`;
  };

  const handleTradesClick = (day: number) => {
    setSelectedDateForTrades(formatDateForApi(day));
  };

  const handleStrategyClick = (day: number) => {
    setSelectedDateForStrategy(formatDateForApi(day));
  };

  const handleCloseTradesModal = () => {
    setSelectedDateForTrades(null);
  };

  const handleCloseStrategyModal = (saved?: boolean) => {
    setSelectedDateForStrategy(null);
    if (saved && onDataRefresh) {
      onDataRefresh();
    }
  };

  const handleStrategyClickFromTrades = (date: string) => {
    setSelectedDateForTrades(null);
    setSelectedDateForStrategy(date);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    let newYear = year;
    let newMonth = month;

    if (direction === 'prev') {
      newMonth--;
      if (newMonth < 1) {
        newMonth = 12;
        newYear--;
      }
    } else {
      newMonth++;
      if (newMonth > 12) {
        newMonth = 1;
        newYear++;
      }
    }

    onMonthChange(newYear, newMonth);
  };

  const goToToday = () => {
    onMonthChange(currentYear, currentMonth);
  };

  // Fonction pour déterminer si une position dans la grille appartient au mois en cours
  // Grille fixe : 7 colonnes (jours de la semaine), jusqu'à 6 lignes (semaines)
  const isDayInCurrentMonth = (gridIndex: number): boolean => {
    // Le premier jour du mois commence à l'index startingDayOfWeek
    // Les jours valides vont de startingDayOfWeek à startingDayOfWeek + daysInMonth - 1
    return gridIndex >= startingDayOfWeek && gridIndex < startingDayOfWeek + daysInMonth;
  };

  // Fonction pour obtenir le numéro du jour à partir de l'index de la grille
  const getDayNumber = (gridIndex: number): number | null => {
    if (isDayInCurrentMonth(gridIndex)) {
      // Le numéro du jour = index - startingDayOfWeek + 1
      return gridIndex - startingDayOfWeek + 1;
    }
    return null;
  };

  // Calculer le nombre de lignes nécessaires (max 6 semaines)
  const totalCells = startingDayOfWeek + daysInMonth;
  const rows = Math.ceil(totalCells / 7);
  const maxCells = rows * 7; // Nombre total de cellules dans la grille

  // Créer le tableau final de cellules pour la grille
  // Chaque cellule contient soit le numéro du jour (si dans le mois), soit null
  const finalCalendarCells: (number | null)[] = [];
  for (let i = 0; i < maxCells; i++) {
    finalCalendarCells.push(getDayNumber(i));
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
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {t('calendar:daily')}
            </button>
            <button
              type="button"
              onClick={() => onViewTypeChange('monthly')}
              className={`px-4 py-2 text-sm font-medium rounded-r-lg border-t border-r border-b ${
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
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
            aria-label={t('calendar:previousMonth')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            {monthNames[month - 1]} {year}
          </h2>

          <button
            onClick={() => navigateMonth('next')}
            className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
            aria-label={t('calendar:nextMonth')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {(year !== currentYear || month !== currentMonth) && (
            <button
              onClick={goToToday}
              className="ml-4 px-4 py-2 text-sm bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              {t('calendar:today')}
            </button>
          )}
        </div>

        {/* Espaceur à droite pour équilibrer */}
        {onViewTypeChange && <div className="w-[160px]"></div>}
      </div>

      {/* Calendrier */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        {/* En-têtes des jours */}
        <div className="grid grid-cols-7 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
          {dayNames.map((dayName, index) => (
            <div
              key={index}
              className={`px-2 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300 ${
                index < 6 ? 'border-r border-gray-200 dark:border-gray-600' : ''
              } ${index === 6 ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
            >
              {dayName}
            </div>
          ))}
        </div>

        {/* Grille du calendrier */}
        <div>
          {Array.from({ length: rows }).map((_, rowIndex) => {
            // Utiliser finalCalendarCells qui garantit que les jours hors du mois sont null
            const weekCells = finalCalendarCells.slice(rowIndex * 7, (rowIndex + 1) * 7);
            
            // Calculer le PnL total et le nombre de trades pour cette semaine (ligne)
            // Ne compter que les jours qui font partie du mois en cours (day !== null)
            const weeklyStats = weekCells.reduce((acc: { pnl: number; tradeCount: number }, day) => {
              if (day !== null) {
                const dayData = dailyDataMap.get(day);
                return {
                  pnl: acc.pnl + (dayData?.pnl || 0),
                  tradeCount: acc.tradeCount + (dayData?.trade_count || 0)
                };
              }
              return acc;
            }, { pnl: 0, tradeCount: 0 });
            const weeklyPnl = weeklyStats.pnl;
            const weeklyTradeCount = weeklyStats.tradeCount;

            return (
              <div key={rowIndex} className={`grid grid-cols-7 ${rowIndex > 0 ? 'border-t border-gray-200 dark:border-gray-700' : ''}`}>
                {weekCells.map((day, colIndex) => {
                  const isSaturday = colIndex === 6;
                  
                  // Si le jour est null (hors mois), afficher une cellule grisée
                  // Mais si c'est un samedi, afficher quand même le solde hebdomadaire
                  if (day === null) {
                    if (isSaturday) {
                      // Pour les samedis hors du mois, afficher le solde hebdomadaire dans une cellule grisée
                      return (
                        <div
                          key={colIndex}
                          className="h-32 p-2 bg-gray-200 dark:bg-gray-700"
                        >
                          <div className="flex flex-col h-full justify-end items-center mt-auto">
                            {weeklyPnl !== 0 && (
                              <div className={`text-base font-semibold text-center ${getPnlColor(weeklyPnl)}`}>
                                {formatPnl(weeklyPnl)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    // Pour les autres jours hors du mois, cellule grisée vide
                    return (
                      <div
                        key={colIndex}
                        className={`h-32 bg-gray-200 dark:bg-gray-700 ${colIndex < 6 ? 'border-r border-gray-300 dark:border-gray-600' : ''}`}
                      />
                    );
                  }

                  // À ce point, on sait que day n'est pas null et est dans les limites du mois
                  const dayNumber = day as number;
                  const dayData = dailyDataMap.get(dayNumber);
                  const pnl = dayData?.pnl || 0;
                  const tradeCount = dayData?.trade_count || 0;
                  const isToday = year === currentYear && month === currentMonth && dayNumber === currentDay;

                  return (
                    <div
                      key={colIndex}
                      className={`h-32 p-2 ${colIndex < 6 ? 'border-r border-gray-200 dark:border-gray-700' : ''} ${
                        isSaturday 
                          ? `bg-blue-50 dark:bg-blue-900/30 ${weeklyPnl > 0 ? 'bg-green-50 dark:bg-green-900/20' : weeklyPnl < 0 ? 'bg-red-50 dark:bg-red-900/20' : ''}`
                          : `${getDayBgColor(dayNumber, pnl)} ${isToday ? 'ring-2 ring-blue-500 dark:ring-blue-400 ring-inset' : ''}`
                      }`}
                    >
                      {isSaturday ? (
                        // Colonne Samedi : afficher le numéro du jour, le badge de trades et le PnL hebdomadaire
                        <div className="flex flex-col h-full">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-sm font-medium ${isToday ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-700 dark:text-gray-300'}`}>
                              {dayNumber}
                            </span>
                            {weeklyTradeCount > 0 && (
                              <Tooltip 
                                content={`${weeklyTradeCount} ${weeklyTradeCount > 1 ? t('calendar:trades') : t('calendar:trade')} (${t('calendar:totalWeek')})`} 
                                position="top"
                              >
                                <span className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded-full cursor-help">
                                  {weeklyTradeCount}
                                </span>
                              </Tooltip>
                            )}
                          </div>
                          <div className="flex flex-col h-full justify-end items-center mt-auto">
                            {weeklyPnl !== 0 && (
                              <div className={`text-base font-semibold text-center ${getPnlColor(weeklyPnl)}`}>
                                {formatPnl(weeklyPnl)}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        // Autres colonnes : affichage normal avec numéro du jour, badge et PnL
                        <div className="flex flex-col h-full relative">
                          {/* Pastille de statut de stratégie - centrée dans la cellule */}
                          {tradeCount > 0 && dayData?.strategy_compliance_status && dayData.strategy_compliance_status !== 'unknown' && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <Tooltip 
                                content={
                                  dayData.strategy_compliance_status === 'compliant' ? t('calendar:strategyRespected') :
                                  dayData.strategy_compliance_status === 'non_compliant' ? t('calendar:strategyNotRespected') :
                                  dayData.strategy_compliance_status === 'partial' ? t('calendar:strategyPartiallyRespected') :
                                  ''
                                }
                                position="top"
                              >
                                <div
                                  className={`w-5 h-5 rounded-full ${getStrategyStatusColor(dayData.strategy_compliance_status)} cursor-help pointer-events-auto ${
                                    dayData.strategy_compliance_status === 'compliant' ? 'animate-pulse' : ''
                                  }`}
                                />
                              </Tooltip>
                            </div>
                          )}
                          <div className="flex items-center justify-between mb-1 flex-wrap gap-1 z-10">
                            <span className={`text-sm font-medium ${isToday ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-700 dark:text-gray-300'}`}>
                              {dayNumber}
                            </span>
                            <div className="flex items-center gap-1 flex-wrap">
                              {/* Actions pour les jours avec trades */}
                              {tradeCount > 0 && (
                                <>
                                  <Tooltip content={t('calendar:viewDayTrades')} position="top">
                                    <button
                                      onClick={() => handleTradesClick(dayNumber)}
                                      className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors flex-shrink-0"
                                      aria-label={t('calendar:viewTrades')}
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                    </button>
                                  </Tooltip>
                                  <Tooltip content={t('calendar:manageStrategyCompliance')} position="top">
                                    <button
                                      onClick={() => handleStrategyClick(dayNumber)}
                                      className="p-1 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-400 transition-colors flex-shrink-0"
                                      aria-label={t('calendar:manageStrategy')}
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                    </button>
                                  </Tooltip>
                                </>
                              )}
                              {/* Badge du nombre de trades en dernier */}
                              {tradeCount > 0 && (
                                <Tooltip 
                                  content={`${tradeCount} ${tradeCount > 1 ? t('calendar:trades') : t('calendar:trade')}`} 
                                  position="top"
                                >
                                  <span className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded-full cursor-help flex-shrink-0">
                                    {tradeCount}
                                  </span>
                                </Tooltip>
                              )}
                            </div>
                          </div>

                          {pnl !== 0 && (
                            <div className={`text-base font-semibold mt-auto ${getPnlColor(pnl)} z-10`}>
                              {formatPnl(pnl)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Ligne supplémentaire avec le total mensuel dans la colonne Samedi */}
          <div className="grid grid-cols-7 bg-gray-100 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
            <div className="col-span-6 px-4 py-3 font-semibold text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600">
              {t('calendar:total')} {monthNames[month - 1]} {year}
            </div>
            <div className={`px-4 py-3 font-bold text-center ${getPnlColor(monthlyPnlForSaturday)}`}>
              {formatPnl(monthlyPnlForSaturday)}
            </div>
          </div>
        </div>
      </div>

      {/* Modales */}
      {selectedDateForTrades && (
        <DayTradesModal
          open={true}
          date={selectedDateForTrades}
          onClose={handleCloseTradesModal}
          tradingAccount={tradingAccount}
          onStrategyClick={handleStrategyClickFromTrades}
        />
      )}

      {selectedDateForStrategy && (
        <StrategyComplianceModal
          open={true}
          date={selectedDateForStrategy}
          onClose={handleCloseStrategyModal}
          tradingAccount={tradingAccount}
        />
      )}
    </div>
  );
};

export default DailyView;

