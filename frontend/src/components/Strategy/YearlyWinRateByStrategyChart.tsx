import React, { useState, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { tradesService } from '../../services/trades';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartDataLabels);

interface YearlyWinRateByStrategyChartProps {
  year: number;
  isLoading?: boolean;
}

const YearlyWinRateByStrategyChart: React.FC<YearlyWinRateByStrategyChartProps> = ({ year, isLoading = false }) => {
  const [strategyData, setStrategyData] = useState<{ [strategy: string]: any }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchYearlyWinRateData = async () => {
      try {
        setLoading(true);
        setStrategyData({});
        
        // Récupérer les données une seule fois
        const [trades, strategies] = await Promise.all([
          tradesService.getTrades(),
          tradesService.getTradeStrategies()
        ]);
        
        // Filtrer les trades de l'année
        const yearTrades = trades.filter(trade => {
          const tradeDate = new Date(trade.entered_at);
          return tradeDate.getFullYear() === year;
        });
        
        // Organiser les données par mois
        const strategyMap: { [month: string]: any } = {};
        
        for (let month = 1; month <= 12; month++) {
          const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
          
          // Filtrer les trades du mois
          const monthTrades = yearTrades.filter(trade => {
            const tradeDate = new Date(trade.entered_at);
            return tradeDate.getMonth() + 1 === month;
          });
          
          // Analyser le respect des stratégies en utilisant les données de TradeStrategy
          const respectedTrades: Array<{ pnl: number }> = [];
          const notRespectedTrades: Array<{ pnl: number }> = [];
          
          monthTrades.forEach(trade => {
            const strategyInfo = strategies.find((s: any) => s.trade === trade.id);
            const tradeWithPnl = {
              pnl: parseFloat(trade.net_pnl.toString())
            };
            
            if (strategyInfo && strategyInfo.strategy_respected === true) {
              respectedTrades.push(tradeWithPnl);
            } else if (strategyInfo && strategyInfo.strategy_respected === false) {
              notRespectedTrades.push(tradeWithPnl);
            }
            // Ne pas inclure les trades sans données de stratégie dans les calculs de win rate
          });
          
          if (monthTrades.length > 0) {
            strategyMap[monthKey] = {
              respectedTrades,
              notRespectedTrades,
              totalTrades: monthTrades.length
            };
          }
        }
        
        setStrategyData(strategyMap);
      } catch (error) {
        console.error('Error fetching yearly win rate data:', error);
        setStrategyData({});
      } finally {
        setLoading(false);
      }
    };

    fetchYearlyWinRateData();
  }, [year]);

  // Calculer les données globales de l'année (même format que WinRateByStrategyChart)
  const chartData = React.useMemo(() => {
    let respectedTrades = 0;
    let respectedWinningTrades = 0;
    let notRespectedTrades = 0;
    let notRespectedWinningTrades = 0;

    Object.values(strategyData).forEach((monthData: any) => {
      // Utiliser les données disponibles dans strategyData
      if (monthData.respectedTrades && Array.isArray(monthData.respectedTrades)) {
        monthData.respectedTrades.forEach((trade: any) => {
          respectedTrades++;
          if (trade.pnl && trade.pnl > 0) {
            respectedWinningTrades++;
          }
        });
      }

      if (monthData.notRespectedTrades && Array.isArray(monthData.notRespectedTrades)) {
        monthData.notRespectedTrades.forEach((trade: any) => {
          notRespectedTrades++;
          if (trade.pnl && trade.pnl > 0) {
            notRespectedWinningTrades++;
          }
        });
      }
    });

    const respectedWinRate = respectedTrades > 0 ? (respectedWinningTrades / respectedTrades) * 100 : 0;
    const notRespectedWinRate = notRespectedTrades > 0 ? (notRespectedWinningTrades / notRespectedTrades) * 100 : 0;

    return {
      respectedTrades,
      respectedWinningTrades,
      notRespectedTrades,
      notRespectedWinningTrades,
      respectedWinRate,
      notRespectedWinRate
    };
  }, [strategyData]);

  const data = {
    labels: ['Respectée', 'Non respectée'],
    datasets: [
      {
        data: [chartData.respectedWinRate, chartData.notRespectedWinRate],
        backgroundColor: ['#3b82f6', '#6b7280'], // blue-500 et gray-500 (mêmes couleurs que l'autre graphique)
        borderWidth: 0,
        borderRadius: 0,
        borderSkipped: false,
      }
    ]
  };

  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      datalabels: {
        display: true,
        color: 'white',
        font: {
          weight: 'bold' as const,
          size: 14
        },
        formatter: function(value: any, context: any) {
          return Math.round(value) + '%';
        }
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        titleColor: '#1f2937',
        bodyColor: '#374151',
        borderColor: 'rgba(229, 231, 235, 0.5)',
        borderWidth: 1,
        cornerRadius: 12,
        displayColors: false,
        titleFont: {
          family: 'system-ui, -apple-system, sans-serif',
          size: 14,
          weight: 'bold' as const
        },
        bodyFont: {
          family: 'system-ui, -apple-system, sans-serif',
          size: 13,
          weight: 'normal' as const
        },
        padding: 12,
        callbacks: {
          title: function(context: any) {
            return context[0]?.label || '';
          },
          label: function(context: any) {
            const label = context.label || '';
            const value = context.parsed.x;
            const isRespected = label === 'Respectée';
            const totalTrades = isRespected ? chartData.respectedTrades : chartData.notRespectedTrades;
            const winningTrades = isRespected ? chartData.respectedWinningTrades : chartData.notRespectedWinningTrades;
            return `${value.toFixed(1)}% (${winningTrades}/${totalTrades} trades gagnants)`;
          }
        }
      }
    },
    scales: {
      x: {
        beginAtZero: true,
        max: 100,
        grid: {
          display: false
        },
        ticks: {
          callback: function(value: any) {
            return Math.round(value) + '%';
          },
          stepSize: 10,
          maxTicksLimit: 6
        }
      },
      y: {
        grid: {
          display: false
        }
      }
    },
    animation: {
      duration: 800,
      easing: 'easeOutQuart' as const,
      delay: (context: any) => context.dataIndex * 100
    }
  };

  // Calculer les statistiques globales (utiliser chartData au lieu de recalculer)
  const totalTrades = chartData.respectedTrades + chartData.notRespectedTrades;

  if (isLoading || loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full">
        <div className="h-8 bg-gray-200 rounded animate-pulse mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>
        </div>
        <div className="mt-6 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-sm text-gray-600">Chargement...</span>
        </div>
      </div>
    );
  }

  // Vérifier si nous avons des données de trades détaillées
  const hasDetailedTradeData = Object.values(strategyData).some((monthData: any) => 
    (monthData.respectedTrades && Array.isArray(monthData.respectedTrades)) ||
    (monthData.notRespectedTrades && Array.isArray(monthData.notRespectedTrades))
  );

  if (!hasDetailedTradeData) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="text-lg font-semibold mb-2">Aucune donnée de win rate pour {year}</p>
          <p className="text-sm">Ajoutez des trades avec gains pour voir le graphique.</p>
        </div>
      </div>
    );
  }

  if (chartData.respectedTrades === 0 && chartData.notRespectedTrades === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="text-lg font-semibold mb-2">Aucune donnée de win rate pour {year}</p>
          <p className="text-sm">Ajoutez des trades avec gains pour voir le graphique.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full flex flex-col">
      {/* En-tête */}
      <div className="mb-4">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold text-gray-900">Taux de Réussite par Stratégie</h3>
          <div className="relative group">
            <svg className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {/* Infobulle */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-4 py-3 bg-white/95 backdrop-blur-sm text-gray-800 text-sm rounded-xl shadow-lg border border-gray-200/50 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-20 font-sans antialiased">
              <div className="font-semibold mb-2 text-gray-900">Taux de réussite :</div>
              <div className="space-y-1">
                <div>Pourcentage de trades gagnants selon le respect de la stratégie</div>
                <div className="text-xs text-gray-600">Un trade gagnant = P&L positif</div>
              </div>
              {/* Flèche */}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-white/95"></div>
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          {totalTrades} trade{totalTrades > 1 ? 's' : ''} analysé{totalTrades > 1 ? 's' : ''}
        </p>
      </div>

      {/* Graphique */}
      <div className="flex-1 min-h-0">
        <div className="h-full">
          <Bar data={data} options={options} />
        </div>
      </div>

      {/* Statistiques en bas */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-xl lg:text-2xl font-bold text-blue-600">
              {Math.round(chartData.respectedWinRate)}%
            </div>
            <div className="text-xs text-gray-500">Respectée</div>
          </div>
          <div>
            <div className="text-xl lg:text-2xl font-bold text-gray-600">
              {Math.round(chartData.notRespectedWinRate)}%
            </div>
            <div className="text-xs text-gray-500">Non respectée</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default YearlyWinRateByStrategyChart;