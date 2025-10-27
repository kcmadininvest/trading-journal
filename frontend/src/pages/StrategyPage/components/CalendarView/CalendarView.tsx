import React, { useMemo } from 'react';
import { CalendarViewProps } from '../../types/strategy.types';
import CalendarNavigation from './CalendarNavigation';
import CalendarGrid from './CalendarGrid';
import ChartsContainer from '../Charts/ChartsContainer';

const CalendarView: React.FC<CalendarViewProps> = ({
  currentDate,
  calendarData,
  strategyData,
  loading,
  selectedAccount,
  onNavigateMonth,
  onGoToToday,
  onDayClick
}) => {
  // Générer les données du calendrier
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

  // Calculer le total mensuel
  const monthlyTotal = useMemo(() => {
    return calendarData?.monthly_total || 0;
  }, [calendarData]);

  // Fonction pour obtenir les données d'un jour
  const getDayData = (day: number) => {
    return calendarData?.daily_data?.find(d => parseInt(d.date) === day);
  };

  // Fonction pour obtenir l'indicateur de stratégie
  const getStrategyIndicator = (day: number) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const date = new Date(year, month - 1, day);
    
    const yearStr = date.getFullYear();
    const monthStr = String(date.getMonth() + 1).padStart(2, '0');
    const dayStr = String(date.getDate()).padStart(2, '0');
    const dateStr = `${yearStr}-${monthStr}-${dayStr}`;
    
    const data = strategyData[dateStr];
    
    if (!data) {
      return null;
    }
    
    const isRespected = data.respected === data.total && data.total > 0;
    
    return {
      isRespected,
      color: isRespected ? 'bg-blue-500' : 'bg-gray-500',
      text: isRespected ? 'Stratégie respectée' : 'Stratégie non respectée'
    };
  };

  // Fonction pour formater la devise
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: selectedAccount?.currency || 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Fonction pour obtenir la taille responsive du texte
  const getResponsiveTextSize = (amount: number) => {
    const formattedAmount = formatCurrency(amount);
    const length = formattedAmount.length;
    
    if (length > 8) return 'text-sm';
    if (length > 6) return 'text-base';
    if (length > 4) return 'text-lg';
    return 'text-xl';
  };

  return (
    <>
      {/* Navigation du calendrier */}
      <CalendarNavigation
        currentDate={currentDate}
        monthlyTotal={monthlyTotal}
        onNavigateMonth={onNavigateMonth}
        onGoToToday={onGoToToday}
        isUpdatingStrategy={loading.strategy}
      />

      {/* Layout principal : Graphiques + Calendrier + Graphiques */}
      <div className="flex flex-col xl:flex-row gap-6">
        {/* Graphiques de gauche */}
        <div className="w-full xl:w-96 xl:flex-shrink-0 flex flex-col space-y-4">
          <ChartsContainer
            strategyData={strategyData}
            isLoading={loading.strategy}
            type="monthly"
          />
        </div>

        {/* Calendrier */}
        <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <CalendarGrid
            calendarDays={calendarDays}
            calendarData={calendarData}
            strategyData={strategyData}
            getDayData={getDayData}
            getStrategyIndicator={getStrategyIndicator}
            formatCurrency={formatCurrency}
            getResponsiveTextSize={getResponsiveTextSize}
            onDayClick={onDayClick}
          />
        </div>
        
        {/* Graphiques de droite */}
        <div className="w-full xl:w-96 xl:flex-shrink-0 flex flex-col space-y-4">
          <ChartsContainer
            strategyData={strategyData}
            isLoading={loading.strategy}
            type="monthly"
            position="right"
          />
        </div>
      </div>
    </>
  );
};

export default CalendarView;
