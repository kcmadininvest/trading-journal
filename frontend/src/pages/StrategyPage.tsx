import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { tradesService, TopStepTrade } from '../services/trades';
import TradesStrategyModal from '../components/Strategy/TradesStrategyModal';
import StrategyRespectChart from '../components/Strategy/StrategyRespectChart';
import WinRateByStrategyChart from '../components/Strategy/WinRateByStrategyChart';
import SessionWinRateChart from '../components/Strategy/SessionWinRateChart';
import EmotionsChart from '../components/Strategy/EmotionsChart';

interface DailyData {
  date: string;
  pnl: number;
  trade_count: number;
}

interface WeeklyData {
  week: number;
  pnl: number;
  trade_count: number;
}

interface CalendarData {
  daily_data: DailyData[];
  weekly_data: WeeklyData[];
  monthly_total: number;
  year: number;
  month: number;
}



function StrategyPage() {
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true); // État de chargement initial
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showTradesModal, setShowTradesModal] = useState(false);
  const [dayTrades, setDayTrades] = useState<TopStepTrade[]>([]);
  const [strategyData, setStrategyData] = useState<{ [date: string]: any }>({});
  const [isUpdatingStrategy, setIsUpdatingStrategy] = useState(false);

  const fetchStrategyData = useCallback(async (year: number, month: number) => {
    try {
      // Récupérer les données de stratégie pour chaque jour du mois
      // const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      
      const strategyPromises = [];
      for (let day = 1; day <= endDate.getDate(); day++) {
        const date = new Date(year, month - 1, day);
        const dateStr = date.toISOString().split('T')[0];
        strategyPromises.push(
          tradesService.getTradeStrategiesByDate(dateStr)
            .then(strategies => ({ date: dateStr, strategies }))
            .catch(() => ({ date: dateStr, strategies: [] }))
        );
      }
      
      const results = await Promise.all(strategyPromises);
      const strategyMap: { [date: string]: any } = {};
      
      results.forEach(({ date, strategies }) => {
        if (strategies.length > 0) {
          const respectedCount = strategies.filter((s: any) => s.strategy_respected === true).length;
          const totalCount = strategies.length;
          
          // Séparer les trades respectés et non respectés avec leurs PnL, TP et émotions
          const respectedTrades = strategies
            .filter((s: any) => s.strategy_respected === true)
            .map((s: any) => ({ 
              pnl: parseFloat(s.trade_info?.net_pnl || 0),
              tp1_reached: s.tp1_reached || false,
              tp2_plus_reached: s.tp2_plus_reached || false,
              dominant_emotions: s.dominant_emotions || []
            }));
          
          const notRespectedTrades = strategies
            .filter((s: any) => s.strategy_respected === false)
            .map((s: any) => ({ 
              pnl: parseFloat(s.trade_info?.net_pnl || 0),
              tp1_reached: s.tp1_reached || false,
              tp2_plus_reached: s.tp2_plus_reached || false,
              dominant_emotions: s.dominant_emotions || []
            }));
          
          strategyMap[date] = {
            total: totalCount,
            respected: respectedCount,
            notRespected: totalCount - respectedCount,
            percentage: totalCount > 0 ? (respectedCount / totalCount) * 100 : 0,
            respectedTrades,
            notRespectedTrades
          };
        }
      });
      
      setStrategyData(strategyMap);
    } catch (error) {
      console.error('Erreur lors du chargement des données de stratégie:', error);
    }
  }, []);

  const fetchCalendarData = useCallback(async (year: number, month: number) => {
    try {
      setLoading(true);
      const data = await tradesService.getCalendarData(year, month);
      setCalendarData(data);
      
      // Récupérer les données de stratégie pour le mois
      await fetchStrategyData(year, month);
    } catch (error) {
      // Erreur silencieuse lors du chargement des données du calendrier
      console.error('Erreur lors du chargement des données du calendrier:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchStrategyData]);

  useEffect(() => {
    // Charger les données du calendrier au montage
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    fetchCalendarData(year, month);
  }, [currentDate, fetchCalendarData]);


  // Fonction pour mettre à jour les données de stratégie de manière transparente
  const updateStrategyDataSilently = async (year: number, month: number) => {
    try {
      setIsUpdatingStrategy(true);
      await fetchStrategyData(year, month);
    } catch (error) {
      console.error('Erreur lors de la mise à jour des données de stratégie:', error);
    } finally {
      setIsUpdatingStrategy(false);
    }
  };

  useEffect(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    fetchCalendarData(year, month);
  }, [currentDate, fetchCalendarData]);

  // Écouter les événements de mise à jour des trades pour recharger le calendrier
  useEffect(() => {
    const handleTradesUpdated = () => {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      fetchCalendarData(year, month);
    };

    window.addEventListener('trades:updated', handleTradesUpdated);
    return () => window.removeEventListener('trades:updated', handleTradesUpdated);
  }, [currentDate, fetchCalendarData]);

  const { dailyData, monthlyTotal } = useMemo(() => {
    if (!calendarData) {
      return { dailyData: [], monthlyTotal: 0 };
    }

    return {
      dailyData: calendarData.daily_data,
      monthlyTotal: calendarData.monthly_total
    };
  }, [calendarData]);

  // Générer le calendrier
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    
    const days = [];
    
    // Ajouter les jours du mois précédent
    const prevMonth = new Date(year, month - 1, 0);
    for (let i = firstDayOfWeek; i > 0; i--) {
      days.push({
        day: prevMonth.getDate() - i + 1,
        isCurrentMonth: false,
        date: new Date(year, month - 1, prevMonth.getDate() - i + 1)
      });
    }
    
    // Ajouter les jours du mois courant
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        day,
        isCurrentMonth: true,
        date: new Date(year, month, day)
      });
    }
    
    // Ajouter les jours du mois suivant
    const totalDays = days.length;
    const completeWeeks = Math.ceil(totalDays / 7);
    
    if (completeWeeks < 6) {
      const daysInLastWeek = totalDays % 7;
      if (daysInLastWeek > 0) {
        const remainingDays = 7 - daysInLastWeek;
        for (let day = 1; day <= remainingDays; day++) {
          days.push({
            day,
            isCurrentMonth: false,
            date: new Date(year, month + 1, day)
          });
        }
      }
    }
    
    return days;
  }, [currentDate]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getResponsiveTextSize = (amount: number) => {
    const formattedAmount = formatCurrency(amount);
    const length = formattedAmount.length;
    
    if (length > 8) return 'text-sm';
    if (length > 6) return 'text-base';
    if (length > 4) return 'text-lg';
    return 'text-xl';
  };

  const getDayData = (day: number) => {
    return dailyData.find(d => parseInt(d.date) === day);
  };

  const getStrategyIndicator = (day: number) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const date = new Date(year, month - 1, day);
    
    // Utiliser le formatage manuel pour éviter les problèmes de fuseau horaire
    const yearStr = date.getFullYear();
    const monthStr = String(date.getMonth() + 1).padStart(2, '0');
    const dayStr = String(date.getDate()).padStart(2, '0');
    const dateStr = `${yearStr}-${monthStr}-${dayStr}`;
    
    const data = strategyData[dateStr];
    if (!data) return null;
    
    // Logique binaire : si au moins un trade n'est pas respecté, la stratégie n'est pas respectée
    const isRespected = data.respected === data.total && data.total > 0;
    
    return {
      isRespected,
      color: isRespected ? 'bg-blue-500' : 'bg-gray-500',
      text: isRespected ? 'Stratégie respectée' : 'Stratégie non respectée'
    };
  };


  const isToday = (dayInfo: any) => {
    const today = new Date();
    return dayInfo.isCurrentMonth && 
           dayInfo.date.getDate() === today.getDate() &&
           dayInfo.date.getMonth() === today.getMonth() &&
           dayInfo.date.getFullYear() === today.getFullYear();
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayClick = async (dayInfo: any) => {
    if (dayInfo.isCurrentMonth) {
      setSelectedDate(dayInfo.date);
      
      // Récupérer les trades pour cette date
      const year = dayInfo.date.getFullYear();
      const month = String(dayInfo.date.getMonth() + 1).padStart(2, '0');
      const day = String(dayInfo.date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      try {
        // Récupérer les trades pour cette date
        const trades = await tradesService.getTrades({
          trade_day: dateStr
        });
        
        setDayTrades(Array.isArray(trades) ? trades : []);
        setShowTradesModal(true);
      } catch (error) {
        console.error('Erreur lors du chargement des trades:', error);
        setDayTrades([]);
        setShowTradesModal(true);
      }
    }
  };

  const handleSaveTradeStrategies = async (strategies: any[]) => {
    try {
      // Sauvegarder toutes les stratégies en une fois
      await tradesService.bulkCreateTradeStrategies(strategies);
      
      // Fermer la modale immédiatement
      setShowTradesModal(false);
      setDayTrades([]);
      
      // Mettre à jour les données de stratégie de manière transparente
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      await updateStrategyDataSilently(year, month);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des stratégies:', error);
    }
  };

  const handleDeleteTrade = async (tradeId: number) => {
    try {
      // Supprimer le trade
      await tradesService.deleteTrade(tradeId);
      
      // Recharger les trades pour cette date
      if (selectedDate) {
        const dateStr = selectedDate.toISOString().split('T')[0];
        const trades = await tradesService.getTrades({
          trade_day: dateStr
        });
        setDayTrades(Array.isArray(trades) ? trades : []);
        
        // Si plus de trades, fermer la modale
        if (Array.isArray(trades) && trades.length === 0) {
          setShowTradesModal(false);
          setDayTrades([]);
        }
      }
      
      // Mettre à jour les données de stratégie de manière transparente
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      await updateStrategyDataSilently(year, month);
    } catch (error) {
      console.error('Erreur lors de la suppression du trade:', error);
      throw error; // Re-throw pour que la modale puisse afficher l'erreur
    }
  };




  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const weekDays = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  // Écran de chargement initial
  if (loading && !calendarData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Chargement des données de stratégie...</p>
          <p className="text-gray-500 text-sm mt-2">Récupération des trades et analyses</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50">
      <div className="max-w-full mx-auto">
        {/* En-tête */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Stratégie de Trading</h1>
          <p className="text-gray-600">Planifiez et suivez vos stratégies de trading avec le calendrier intégré</p>
        </div>

        {/* Navigation du calendrier */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigateMonth('prev')}
              className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <h2 className="text-2xl font-bold text-gray-900">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            
            <button
              onClick={() => navigateMonth('next')}
              className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="text-sm text-gray-600">P/L Mensuel:</div>
            <div className={`text-2xl font-bold ${monthlyTotal >= 0 ? 'text-blue-600' : 'text-gray-600'}`}>
              {formatCurrency(monthlyTotal)}
            </div>
            {/* Indicateur de mise à jour en cours */}
            {isUpdatingStrategy && (
              <div className="flex items-center space-x-1 text-sm text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>Mise à jour...</span>
              </div>
            )}
          </div>
          
          <button
            onClick={goToToday}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Aujourd'hui
          </button>
        </div>

        {/* Layout principal : Graphiques + Calendrier + Graphique Sessions */}
        <div className="flex flex-col xl:flex-row gap-6">
          {/* Graphiques de gauche */}
          <div className="w-full xl:w-96 xl:flex-shrink-0 flex flex-col space-y-4">
            {/* Graphique de respect de la stratégie */}
            <div className="flex-1">
              <StrategyRespectChart strategyData={strategyData} />
            </div>
            
            {/* Graphique de win rate par stratégie */}
            <div className="flex-1">
              <WinRateByStrategyChart strategyData={strategyData} />
            </div>
          </div>
          
          {/* Calendrier */}
          <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* En-têtes */}
            <div className="grid grid-cols-7 border-b border-gray-200">
              {weekDays.map((day, index) => (
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
                      onClick={() => handleDayClick(dayInfo)}
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
          </div>
          
          {/* Graphiques de droite */}
          <div className="w-full xl:w-96 xl:flex-shrink-0 flex flex-col space-y-4">
            {/* Graphique de sessions gagnantes */}
            <div className="flex-1">
              <SessionWinRateChart strategyData={strategyData} />
            </div>
            
            {/* Graphique d'émotions dominantes */}
            <div className="flex-1">
              <EmotionsChart strategyData={strategyData} />
            </div>
          </div>
        </div>

        {/* Modal pour les trades et stratégies */}
        <TradesStrategyModal
          isOpen={showTradesModal}
          onClose={() => {
            setShowTradesModal(false);
            setDayTrades([]);
          }}
          trades={dayTrades}
          selectedDate={selectedDate ? (() => {
            const year = selectedDate.getFullYear();
            const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
            const day = String(selectedDate.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          })() : ''}
          onSave={handleSaveTradeStrategies}
          onDeleteTrade={handleDeleteTrade}
        />
      </div>
    </div>
  );
}

export default StrategyPage;
