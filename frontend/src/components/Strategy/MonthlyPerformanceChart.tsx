import React, { useState, useEffect, useMemo } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { tradesService } from '../../services/trades';
import { formatCurrency } from '../../config/chartConfig';

// Enregistrer les composants Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface MonthlyData {
  date: string;
  pnl: number;
  trade_count: number;
}

interface MonthlyPerformanceChartProps {
  year: number;
  month: number;
}

const MonthlyPerformanceChart: React.FC<MonthlyPerformanceChartProps> = ({ year, month }) => {
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  useEffect(() => {
    const fetchMonthlyData = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await tradesService.getCalendarData(year, month);
        setMonthlyData(data.daily_data || []);
      } catch (err) {
        setError('Erreur lors du chargement des données mensuelles');
        console.error('Error fetching monthly data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMonthlyData();
  }, [year, month]);

  // Calculer les statistiques du mois
  const monthlyStats = useMemo(() => {
    if (monthlyData.length === 0) {
      return {
        totalPnl: 0,
        totalTrades: 0,
        winningDays: 0,
        losingDays: 0,
        bestDay: 0,
        worstDay: 0,
        avgDailyPnl: 0,
        winRate: 0
      };
    }

    const totalPnl = monthlyData.reduce((sum, day) => sum + day.pnl, 0);
    const totalTrades = monthlyData.reduce((sum, day) => sum + day.trade_count, 0);
    const winningDays = monthlyData.filter(day => day.pnl > 0).length;
    const losingDays = monthlyData.filter(day => day.pnl < 0).length;
    const bestDay = Math.max(...monthlyData.map(day => day.pnl));
    const worstDay = Math.min(...monthlyData.map(day => day.pnl));
    const avgDailyPnl = totalPnl / monthlyData.length;
    const winRate = (winningDays / monthlyData.length) * 100;

    return {
      totalPnl,
      totalTrades,
      winningDays,
      losingDays,
      bestDay,
      worstDay,
      avgDailyPnl,
      winRate
    };
  }, [monthlyData]);

  // Données pour le graphique P/L cumulé (ligne uniquement)
  const cumulativeChartData = useMemo(() => {
    if (monthlyData.length === 0) return null;

    const labels = monthlyData.map(day => {
      const date = new Date(day.date);
      return `${date.getDate()}/${date.getMonth() + 1}`;
    });

    const cumulativeData = monthlyData.reduce((acc, day, index) => {
      const prevCumulative = index === 0 ? 0 : acc[index - 1];
      acc.push(prevCumulative + day.pnl);
      return acc;
    }, [] as number[]);

    return {
      labels,
      datasets: [
        {
          label: 'P/L Cumulé',
          data: cumulativeData,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2
        }
      ]
    };
  }, [monthlyData]);

  // Données pour le graphique P/L journalier (barres)
  const dailyPnlChartData = useMemo(() => {
    if (monthlyData.length === 0) return null;

    const labels = monthlyData.map(day => {
      const date = new Date(day.date);
      return `${date.getDate()}/${date.getMonth() + 1}`;
    });

    const pnlData = monthlyData.map(day => day.pnl);

    return {
      labels,
      datasets: [
        {
          label: 'P/L Journalier',
          data: pnlData,
          backgroundColor: pnlData.map(pnl => pnl >= 0 ? '#10b981' : '#ef4444'),
          borderColor: pnlData.map(pnl => pnl >= 0 ? '#059669' : '#dc2626'),
          borderWidth: 1,
          borderRadius: 2
        }
      ]
    };
  }, [monthlyData]);

  // Données pour le graphique de nombre de trades
  const tradesChartData = useMemo(() => {
    if (monthlyData.length === 0) return null;

    const labels = monthlyData.map(day => {
      const date = new Date(day.date);
      return `${date.getDate()}/${date.getMonth() + 1}`;
    });

    return {
      labels,
      datasets: [
        {
          label: 'Nombre de Trades',
          data: monthlyData.map(day => day.trade_count),
          backgroundColor: '#8b5cf6',
          borderColor: '#7c3aed',
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    };
  }, [monthlyData]);

  const cumulativeChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1f2937',
        bodyColor: '#374151',
        borderColor: 'rgba(229, 231, 235, 0.5)',
        borderWidth: 1,
        cornerRadius: 12,
        callbacks: {
          label: function(context: any) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${formatCurrency(value)}`;
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Jour du mois'
        }
      },
      y: {
        type: 'linear' as const,
        display: true,
        title: {
          display: true,
          text: 'P/L Cumulé ($)'
        },
        ticks: {
          callback: function(value: any) {
            return formatCurrency(value);
          }
        }
      }
    }
  };

  const dailyPnlChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1f2937',
        bodyColor: '#374151',
        borderColor: 'rgba(229, 231, 235, 0.5)',
        borderWidth: 1,
        cornerRadius: 12,
        callbacks: {
          label: function(context: any) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${formatCurrency(value)}`;
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Jour du mois'
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'P/L Journalier ($)'
        },
        ticks: {
          callback: function(value: any) {
            return formatCurrency(value);
          }
        }
      }
    }
  };

  const tradesChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1f2937',
        bodyColor: '#374151',
        borderColor: 'rgba(229, 231, 235, 0.5)',
        borderWidth: 1,
        cornerRadius: 12
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Jour du mois'
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Nombre de Trades'
        },
        beginAtZero: true,
        ticks: {
          stepSize: 1
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center text-red-600">
          <p className="text-lg font-medium mb-2">Erreur de chargement</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (monthlyData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-lg font-medium mb-2">Aucune donnée pour ce mois</p>
          <p className="text-sm">Aucun trade enregistré pour {monthNames[month - 1]} {year}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistiques du mois */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-center">
            <div className={`text-2xl font-bold ${monthlyStats.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(monthlyStats.totalPnl)}
            </div>
            <div className="text-sm text-gray-600">P/L Total</div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {monthlyStats.totalTrades}
            </div>
            <div className="text-sm text-gray-600">Trades Total</div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {Math.round(monthlyStats.winRate)}%
            </div>
            <div className="text-sm text-gray-600">Jours Gagnants</div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-center">
            <div className={`text-2xl font-bold ${monthlyStats.avgDailyPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(monthlyStats.avgDailyPnl)}
            </div>
            <div className="text-sm text-gray-600">P/L Moyen/Jour</div>
          </div>
        </div>
      </div>

      {/* Graphiques de performance journalière */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* P/L cumulé */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            📈 P/L Cumulé - {monthNames[month - 1]} {year}
          </h3>
          <div className="h-80">
            {cumulativeChartData && (
              <Line data={cumulativeChartData} options={cumulativeChartOptions} />
            )}
          </div>
        </div>

        {/* P/L journalier */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            📊 P/L Journalier
          </h3>
          <div className="h-80">
            {dailyPnlChartData && (
              <Bar data={dailyPnlChartData} options={dailyPnlChartOptions} />
            )}
          </div>
        </div>
      </div>

      {/* Graphique de nombre de trades */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          📊 Nombre de Trades par Jour
        </h3>
        <div className="h-64">
          {tradesChartData && (
            <Bar data={tradesChartData} options={tradesChartOptions} />
          )}
        </div>
      </div>

      {/* Statistiques détaillées */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📋 Résumé des Performances</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Meilleur jour:</span>
              <span className={`font-medium ${monthlyStats.bestDay >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(monthlyStats.bestDay)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Pire jour:</span>
              <span className={`font-medium ${monthlyStats.worstDay >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(monthlyStats.worstDay)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Jours gagnants:</span>
              <span className="font-medium text-green-600">{monthlyStats.winningDays}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Jours perdants:</span>
              <span className="font-medium text-red-600">{monthlyStats.losingDays}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Métriques Clés</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Trades par jour:</span>
              <span className="font-medium text-blue-600">
                {(monthlyStats.totalTrades / monthlyData.length).toFixed(1)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">P/L par trade:</span>
              <span className={`font-medium ${monthlyStats.totalPnl / monthlyStats.totalTrades >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(monthlyStats.totalPnl / monthlyStats.totalTrades)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Taux de réussite:</span>
              <span className="font-medium text-green-600">
                {Math.round(monthlyStats.winRate)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Jours actifs:</span>
              <span className="font-medium text-blue-600">
                {monthlyData.filter(day => day.trade_count > 0).length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlyPerformanceChart;