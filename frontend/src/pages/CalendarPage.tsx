import React, { useState, useEffect, useCallback } from 'react';
import MonthlyView from '../components/calendar/MonthlyView';
import DailyView from '../components/calendar/DailyView';
import { AccountSelector } from '../components/accounts/AccountSelector';
import {
  calendarService,
  CalendarMonthResponse,
  CalendarYearlyResponse,
  CalendarWeeklyYearlyResponse,
} from '../services/calendar';

type ViewType = 'daily' | 'monthly';

const CalendarPage: React.FC = () => {
  const [viewType, setViewType] = useState<ViewType>('daily');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);

  // État pour la vue quotidienne
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [dailyData, setDailyData] = useState<CalendarMonthResponse | null>(null);

  // État pour la vue mensuelle
  const [yearlyYear, setYearlyYear] = useState(new Date().getFullYear());
  const [yearlyMonthlyData, setYearlyMonthlyData] = useState<CalendarYearlyResponse | null>(null);
  const [yearlyWeeklyData, setYearlyWeeklyData] = useState<CalendarWeeklyYearlyResponse | null>(null);

  // Charger les données pour la vue quotidienne
  const loadDailyData = useCallback(async () => {
    const tradingAccount = selectedAccount && selectedAccount > 0 ? selectedAccount : undefined;
    setIsLoading(true);
    setError(null);
    try {
      const data = await calendarService.getMonthData(currentYear, currentMonth, tradingAccount);
      setDailyData(data);
    } catch (err) {
      setError('Erreur lors du chargement des données mensuelles');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [currentYear, currentMonth, selectedAccount]);

  // Charger les données pour la vue mensuelle
  const loadYearlyData = useCallback(async (year: number, tradingAccount?: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const [monthlyData, weeklyData] = await Promise.all([
        calendarService.getYearlyMonthlyData(year, tradingAccount),
        calendarService.getYearlyWeeklyData(year, tradingAccount),
      ]);
      setYearlyMonthlyData(monthlyData);
      setYearlyWeeklyData(weeklyData);
    } catch (err) {
      setError('Erreur lors du chargement des données annuelles');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Charger les données quand la vue change ou quand les dates changent
  useEffect(() => {
    const tradingAccount = selectedAccount && selectedAccount > 0 ? selectedAccount : undefined;
    if (viewType === 'daily') {
      loadDailyData();
    } else {
      loadYearlyData(yearlyYear, tradingAccount);
    }
  }, [viewType, currentYear, currentMonth, yearlyYear, selectedAccount, loadDailyData, loadYearlyData]);

  const handleMonthChange = (year: number, month: number) => {
    setCurrentYear(year);
    setCurrentMonth(month);
  };

  const handleYearChange = (year: number) => {
    setYearlyYear(year);
  };

  const handleMonthClick = (month: number) => {
    // Basculer vers la vue quotidienne avec le mois sélectionné
    setCurrentYear(yearlyYear);
    setCurrentMonth(month);
    setViewType('daily');
  };

  return (
    <div className="bg-gray-50 min-h-full">
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {/* Sélecteur de compte */}
        <div className="mb-6">
          <AccountSelector
            value={selectedAccount}
            onChange={setSelectedAccount}
          />
        </div>

        {/* Affichage des erreurs */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Contenu du calendrier */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Chargement...</p>
            </div>
          </div>
        ) : viewType === 'daily' && dailyData ? (
          <DailyView
            year={currentYear}
            month={currentMonth}
            dailyData={dailyData.daily_data}
            weeklyData={dailyData.weekly_data}
            monthlyTotal={dailyData.monthly_total}
            onMonthChange={handleMonthChange}
            viewType={viewType}
            onViewTypeChange={setViewType}
            tradingAccount={selectedAccount ?? undefined}
            onDataRefresh={loadDailyData}
          />
        ) : viewType === 'monthly' && yearlyMonthlyData && yearlyWeeklyData ? (
          <MonthlyView
            year={yearlyYear}
            monthlyData={yearlyMonthlyData.monthly_data}
            weeklyData={yearlyWeeklyData.weekly_data}
            yearlyTotal={yearlyMonthlyData.yearly_total}
            onYearChange={handleYearChange}
            onMonthClick={handleMonthClick}
            viewType={viewType}
            onViewTypeChange={setViewType}
          />
        ) : null}
      </div>
    </div>
  );
};

export default CalendarPage;

