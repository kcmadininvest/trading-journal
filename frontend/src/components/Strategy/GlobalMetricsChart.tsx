import React, { useState, useEffect, useMemo } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
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
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface CapitalEvolutionData {
  date: string;
  pnl: number;
  cumulative: number;
  is_positive: boolean;
}

interface WeekdayPerformanceData {
  weekday: string;
  total_pnl: number;
  trade_count: number;
  win_rate: number;
}

interface TradingMetrics {
  risk_reward_ratio: number;
  profit_factor: number;
  max_drawdown: number;
  win_rate: number;
  recovery_factor: number;
  expectancy: number;
  sharpe_ratio: number;
}

const GlobalMetricsChart: React.FC = () => {
  const [capitalEvolution, setCapitalEvolution] = useState<CapitalEvolutionData[]>([]);
  const [weekdayPerformance, setWeekdayPerformance] = useState<WeekdayPerformanceData[]>([]);
  const [tradingMetrics, setTradingMetrics] = useState<TradingMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGlobalData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const [capitalData, weekdayData, metricsData] = await Promise.all([
          tradesService.getCapitalEvolution(),
          tradesService.getWeekdayPerformance(),
          tradesService.getTradingMetrics()
        ]);
        
        setCapitalEvolution(capitalData || []);
        setWeekdayPerformance(weekdayData || []);
        setTradingMetrics(metricsData || null);
      } catch (err) {
        setError('Erreur lors du chargement des données globales');
        console.error('Error fetching global data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchGlobalData();
  }, []);

  // Données pour le graphique d'évolution du capital (ligne uniquement)
  const capitalChartData = useMemo(() => {
    if (capitalEvolution.length === 0) return null;

    const labels = capitalEvolution.map(item => item.date);
    const cumulativeData = capitalEvolution.map(item => item.cumulative);

    return {
      labels,
      datasets: [
        {
          label: 'Capital Cumulé',
          data: cumulativeData,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointBackgroundColor: '#3b82f6',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2
        }
      ]
    };
  }, [capitalEvolution]);

  // Données pour le graphique P/L journalier (barres)
  const dailyPnlChartData = useMemo(() => {
    if (capitalEvolution.length === 0) return null;

    const labels = capitalEvolution.map(item => item.date);
    const dailyPnlData = capitalEvolution.map(item => item.pnl);

    return {
      labels,
      datasets: [
        {
          label: 'P/L Journalier',
          data: dailyPnlData,
          backgroundColor: dailyPnlData.map((_, index) => 
            capitalEvolution[index].is_positive ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)'
          ),
          borderColor: dailyPnlData.map((_, index) => 
            capitalEvolution[index].is_positive ? '#10b981' : '#ef4444'
          ),
          borderWidth: 1,
          borderRadius: 2
        }
      ]
    };
  }, [capitalEvolution]);

  // Données pour le graphique de performance par jour de la semaine (P/L uniquement)
  const weekdayPnlChartData = useMemo(() => {
    if (weekdayPerformance.length === 0) return null;

    const labels = weekdayPerformance.map(item => item.weekday);
    const pnlData = weekdayPerformance.map(item => item.total_pnl);

    return {
      labels,
      datasets: [
        {
          label: 'P/L Total',
          data: pnlData,
          backgroundColor: pnlData.map(pnl => pnl >= 0 ? '#10b981' : '#ef4444'),
          borderColor: pnlData.map(pnl => pnl >= 0 ? '#059669' : '#dc2626'),
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    };
  }, [weekdayPerformance]);

  // Données pour le graphique de nombre de trades par jour de la semaine
  const weekdayTradesChartData = useMemo(() => {
    if (weekdayPerformance.length === 0) return null;

    const labels = weekdayPerformance.map(item => item.weekday);
    const tradeCountData = weekdayPerformance.map(item => item.trade_count);

    return {
      labels,
      datasets: [
        {
          label: 'Nombre de Trades',
          data: tradeCountData,
          backgroundColor: '#8b5cf6',
          borderColor: '#7c3aed',
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    };
  }, [weekdayPerformance]);

  // Données pour le graphique de répartition des performances
  const performanceDistributionData = useMemo(() => {
    if (capitalEvolution.length === 0) return null;

    const positiveDays = capitalEvolution.filter(item => item.pnl > 0).length;
    const negativeDays = capitalEvolution.filter(item => item.pnl < 0).length;
    const neutralDays = capitalEvolution.filter(item => item.pnl === 0).length;

    return {
      labels: ['Jours Gagnants', 'Jours Perdants', 'Jours Neutres'],
      datasets: [
        {
          data: [positiveDays, negativeDays, neutralDays],
          backgroundColor: ['#10b981', '#ef4444', '#6b7280'],
          borderColor: ['#059669', '#dc2626', '#4b5563'],
          borderWidth: 2
        }
      ]
    };
  }, [capitalEvolution]);

  const capitalChartOptions = {
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
          text: 'Date'
        }
      },
      y: {
        type: 'linear' as const,
        display: true,
        title: {
          display: true,
          text: 'Capital Cumulé ($)'
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
          text: 'Date'
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

  const weekdayPnlChartOptions = {
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
          text: 'Jour de la Semaine'
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'P/L Total ($)'
        },
        ticks: {
          callback: function(value: any) {
            return formatCurrency(value);
          }
        }
      }
    }
  };

  const weekdayTradesChartOptions = {
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
          text: 'Jour de la Semaine'
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

  const distributionChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
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
            const label = context.label || '';
            const value = context.parsed;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value} jours (${percentage}%)`;
          }
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        ))}
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

  if (capitalEvolution.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-lg font-medium mb-2">Aucune donnée globale disponible</p>
          <p className="text-sm">Aucun trade enregistré pour afficher les métriques globales</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Métriques de trading globales */}
      {tradingMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {tradingMetrics.win_rate.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Taux de Réussite</div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {tradingMetrics.profit_factor.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">Profit Factor</div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {tradingMetrics.risk_reward_ratio.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">Risk/Reward</div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(tradingMetrics.max_drawdown)}
              </div>
              <div className="text-sm text-gray-600">Max Drawdown</div>
            </div>
          </div>
        </div>
      )}

      {/* Graphiques d'évolution du capital */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Évolution du capital cumulé */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            📈 Évolution du Capital Cumulé
          </h3>
          <div className="h-80">
            {capitalChartData && (
              <Line data={capitalChartData} options={capitalChartOptions} />
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

      {/* Graphiques côte à côte */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* P/L par jour de la semaine */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            📅 P/L par Jour de la Semaine
          </h3>
          <div className="h-80">
            {weekdayPnlChartData && (
              <Bar data={weekdayPnlChartData} options={weekdayPnlChartOptions} />
            )}
          </div>
        </div>

        {/* Répartition des performances */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            🎯 Répartition des Performances
          </h3>
          <div className="h-80">
            {performanceDistributionData && (
              <Doughnut data={performanceDistributionData} options={distributionChartOptions} />
            )}
          </div>
        </div>
      </div>

      {/* Graphique des trades par jour de la semaine */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          📊 Nombre de Trades par Jour de la Semaine
        </h3>
        <div className="h-80">
          {weekdayTradesChartData && (
            <Bar data={weekdayTradesChartData} options={weekdayTradesChartOptions} />
          )}
        </div>
      </div>

      {/* Métriques avancées */}
      {tradingMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Métriques Avancées</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Expectancy:</span>
                <span className={`font-medium ${tradingMetrics.expectancy >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(tradingMetrics.expectancy)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Recovery Factor:</span>
                <span className="font-medium text-blue-600">
                  {tradingMetrics.recovery_factor.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Sharpe Ratio:</span>
                <span className="font-medium text-purple-600">
                  {tradingMetrics.sharpe_ratio.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Statistiques Globales</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total des jours:</span>
                <span className="font-medium text-blue-600">{capitalEvolution.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Jours gagnants:</span>
                <span className="font-medium text-green-600">
                  {capitalEvolution.filter(item => item.pnl > 0).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Jours perdants:</span>
                <span className="font-medium text-red-600">
                  {capitalEvolution.filter(item => item.pnl < 0).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Capital final:</span>
                <span className={`font-medium ${capitalEvolution[capitalEvolution.length - 1]?.cumulative >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(capitalEvolution[capitalEvolution.length - 1]?.cumulative || 0)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 Performance par Jour</h3>
            <div className="space-y-3">
              {weekdayPerformance.map((day, index) => (
                <div key={index} className="flex justify-between">
                  <span className="text-gray-600">{day.weekday}:</span>
                  <div className="text-right">
                    <div className={`font-medium ${day.total_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(day.total_pnl)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {day.trade_count} trades ({day.win_rate.toFixed(1)}%)
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalMetricsChart;