import React, { useState, useEffect, useMemo } from 'react';
import { tradesService } from '../../services/trades';
import { formatCurrency } from '../../config/chartConfig';

interface MonthlyData {
  month: number;
  year: number;
  pnl: number;
  trade_count: number;
}

interface YearlyCalendarProps {
  year: number;
  selectedAccount?: { id: number } | null;
  onMonthClick?: (month: number, year: number) => void;
  isLoading?: boolean;
  currency?: string;
}

const YearlyCalendar: React.FC<YearlyCalendarProps> = ({ year, selectedAccount, onMonthClick, isLoading = false, currency = 'USD' }) => {

  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  useEffect(() => {
    // Éviter les rechargements si les données sont déjà chargées
    if (monthlyData.length > 0 && !loading) {
      return;
    }

    const fetchYearlyData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const accountId = selectedAccount?.id;
        
        const monthlyPromises = [];
        for (let month = 1; month <= 12; month++) {
          monthlyPromises.push(
            tradesService.getCalendarData(year, month, accountId)
              .then(data => ({
                month,
                year,
                pnl: data.monthly_total || 0,
                trade_count: data.daily_data?.reduce((sum: number, day: any) => sum + day.trade_count, 0) || 0
              }))
              .catch(() => ({
                month,
                year,
                pnl: 0,
                trade_count: 0
              }))
          );
        }
        
        const results = await Promise.all(monthlyPromises);
        setMonthlyData(results);
      } catch (err) {
        setError('Erreur lors du chargement des données annuelles');
        console.error('Error fetching yearly data:', err);
      } finally {
        setLoading(false);
      }
    };

    // Délai pour éviter les rechargements multiples
    const timeoutId = setTimeout(() => {
      fetchYearlyData();
    }, 100);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [year, selectedAccount?.id, loading, monthlyData.length]);

  // Calculer les statistiques de l'année
  const yearlyStats = useMemo(() => {
    if (monthlyData.length === 0) {
      return {
        totalPnl: 0,
        totalTrades: 0,
        winningMonths: 0,
        losingMonths: 0,
        bestMonth: 0,
        worstMonth: 0,
        avgMonthlyPnl: 0,
        winRate: 0
      };
    }

    const totalPnl = monthlyData.reduce((sum, month) => sum + month.pnl, 0);
    const totalTrades = monthlyData.reduce((sum, month) => sum + month.trade_count, 0);
    const winningMonths = monthlyData.filter(month => month.pnl > 0).length;
    const losingMonths = monthlyData.filter(month => month.pnl < 0).length;
    const bestMonth = Math.max(...monthlyData.map(month => month.pnl));
    const worstMonth = Math.min(...monthlyData.map(month => month.pnl));
    const avgMonthlyPnl = totalPnl / monthlyData.length;
    const winRate = (winningMonths / monthlyData.length) * 100;

    return {
      totalPnl,
      totalTrades,
      winningMonths,
      losingMonths,
      bestMonth,
      worstMonth,
      avgMonthlyPnl,
      winRate
    };
  }, [monthlyData]);

  const handleMonthClick = (month: number) => {
    if (onMonthClick) {
      onMonthClick(month, year);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <div className="text-sm text-gray-600">Chargement du calendrier annuel...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden h-full flex items-center justify-center">
        <div className="text-center text-red-600">
          <p className="text-lg font-medium mb-2">Erreur de chargement</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex flex-col">
      {/* En-tête avec statistiques de l'année */}
      <div className="bg-gray-50 border-b border-gray-200 p-4 flex-shrink-0 relative z-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            Année {year}
          </h2>
          <div className="flex items-center space-x-6 text-base">
            <div className="text-center">
              <div className={`text-xl font-bold ${yearlyStats.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(yearlyStats.totalPnl, currency)}
              </div>
              <div className="text-gray-600 text-sm">P/L Total</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-blue-600">
                {yearlyStats.totalTrades}
              </div>
              <div className="text-gray-600 text-sm">Trades</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-green-600">
                {Math.round(yearlyStats.winRate)}%
              </div>
              <div className="flex items-center justify-center space-x-1">
                <span className="text-gray-600 text-sm">Mois Positifs</span>
                <div className="relative group">
                  <svg className="w-3 h-3 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {/* Infobulle */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-4 py-3 bg-white/95 backdrop-blur-sm text-gray-800 text-sm rounded-xl shadow-lg border border-gray-200/50 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-20 font-sans antialiased">
                    <div className="font-semibold mb-1 text-gray-900">Mois Positifs</div>
                    <div className="text-gray-600">Pourcentage de mois avec P/L positif</div>
                    {/* Flèche */}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-white/95"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grille des mois */}
      <div className="grid grid-cols-3 gap-1 p-4 flex-1 overflow-auto rounded-b-lg">
        {monthNames.map((monthName, index) => {
          const monthNumber = index + 1;
          const monthData = monthlyData.find(m => m.month === monthNumber);
          const pnl = monthData?.pnl || 0;
          const tradeCount = monthData?.trade_count || 0;
          const isPositive = pnl >= 0;
          const isCurrentMonth = new Date().getMonth() === index && new Date().getFullYear() === year;

          return (
            <div
              key={monthNumber}
              className={`border border-gray-200 rounded-lg p-2 cursor-pointer hover:bg-gray-50 transition-colors flex flex-col justify-center ${
                isCurrentMonth ? 'bg-blue-50 border-blue-200' : ''
              }`}
              onClick={() => handleMonthClick(monthNumber)}
            >
              <div className="text-center">
                {/* Nom du mois */}
                <div className={`text-sm font-medium mb-2 ${isCurrentMonth ? 'text-blue-600 font-bold' : 'text-gray-900'}`}>
                  {monthName}
                </div>
                
                {/* P/L du mois */}
                <div className={`text-base font-bold mb-2 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(pnl, currency)}
                </div>
                
                {/* Nombre de trades */}
                <div className="text-sm text-gray-500">
                  {tradeCount} trade{tradeCount > 1 ? 's' : ''}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Statistiques détaillées en bas */}
      <div className="bg-gray-50 border-t border-gray-200 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-sm">
          <div>
            <div className={`font-medium ${yearlyStats.bestMonth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(yearlyStats.bestMonth, currency)}
            </div>
            <div className="text-gray-600">Meilleur mois</div>
          </div>
          <div>
            <div className={`font-medium ${yearlyStats.worstMonth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(yearlyStats.worstMonth, currency)}
            </div>
            <div className="text-gray-600">Pire mois</div>
          </div>
          <div>
            <div className={`font-medium ${yearlyStats.avgMonthlyPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(yearlyStats.avgMonthlyPnl, currency)}
            </div>
            <div className="text-gray-600">P/L moyen/mois</div>
          </div>
          <div>
            <div className="font-medium text-blue-600">
              {yearlyStats.winningMonths}/{yearlyStats.losingMonths}
            </div>
            <div className="flex items-center justify-center space-x-1">
              <span className="text-gray-600">Ratio Gagnants/Perdants</span>
              <div className="relative group">
                <svg className="w-3 h-3 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {/* Infobulle */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-4 py-3 bg-white/95 backdrop-blur-sm text-gray-800 text-sm rounded-xl shadow-lg border border-gray-200/50 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-20 font-sans antialiased">
                  <div className="font-semibold mb-1 text-gray-900">Ratio Gagnants/Perdants</div>
                  <div className="text-gray-600">Nombre de mois positifs / Nombre de mois négatifs</div>
                  {/* Flèche */}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-white/95"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default YearlyCalendar;