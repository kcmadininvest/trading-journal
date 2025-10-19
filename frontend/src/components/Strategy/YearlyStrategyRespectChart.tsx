import React, { useState, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { tradesService } from '../../services/trades';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ChartDataLabels);

interface YearlyStrategyRespectChartProps {
  year: number;
  isLoading?: boolean;
}

const YearlyStrategyRespectChart: React.FC<YearlyStrategyRespectChartProps> = ({ year, isLoading = false }) => {
  const [strategyData, setStrategyData] = useState<{ [month: string]: any }>({});
  const [loading, setLoading] = useState(true);

  // const monthNames = [
  //   'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun',
  //   'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'
  // ];

  useEffect(() => {
    const fetchYearlyStrategyData = async () => {
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
          const respectedTrades: any[] = [];
          const notRespectedTrades: any[] = [];
          
          monthTrades.forEach(trade => {
            const strategyInfo = strategies.find((s: any) => s.trade === trade.id);
            if (strategyInfo && strategyInfo.strategy_respected === true) {
              respectedTrades.push(trade);
            } else if (strategyInfo && strategyInfo.strategy_respected === false) {
              notRespectedTrades.push(trade);
            } else {
              // Trades sans données de stratégie - on les considère comme non respectés par défaut
              notRespectedTrades.push(trade);
            }
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
        console.error('Error fetching yearly strategy data:', error);
        setStrategyData({});
      } finally {
        setLoading(false);
      }
    };

    fetchYearlyStrategyData();
  }, [year]);

  // Calculer les données globales de l'année (même format que StrategyRespectChart)
  const chartData = React.useMemo(() => {
    let totalTrades = 0;
    let respectedTrades = 0;
    const monthPercentages: number[] = [];

    Object.values(strategyData).forEach((monthData: any) => {
      const monthTotal = monthData.totalTrades || 0;
      const monthRespected = monthData.respectedTrades.length || 0;
      
      totalTrades += monthTotal;
      respectedTrades += monthRespected;
      
      // Calculer le pourcentage pour ce mois si il y a des trades
      if (monthTotal > 0) {
        const monthPercentage = (monthRespected / monthTotal) * 100;
        monthPercentages.push(monthPercentage);
      }
    });

    const notRespectedTrades = totalTrades - respectedTrades;
    const respectPercentage = totalTrades > 0 ? (respectedTrades / totalTrades) * 100 : 0;
    const notRespectPercentage = totalTrades > 0 ? (notRespectedTrades / totalTrades) * 100 : 0;
    
    // Calculer la moyenne des pourcentages par mois (régularité)
    const averageMonthlyPercentage = monthPercentages.length > 0 
      ? monthPercentages.reduce((sum, pct) => sum + pct, 0) / monthPercentages.length 
      : 0;

    return {
      totalTrades,
      respectedTrades,
      notRespectedTrades,
      respectPercentage,
      notRespectPercentage,
      averageMonthlyPercentage,
      monthsWithData: monthPercentages.length
    };
  }, [strategyData]);

  const data = {
    labels: ['Respectée', 'Non respectée'],
    datasets: [
      {
        data: [chartData.respectPercentage, chartData.notRespectPercentage],
        backgroundColor: ['#3b82f6', '#6b7280'], // blue-500 et gray-500 du calendrier
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
            const total = chartData.totalTrades;
            const count = label === 'Respectée' ? chartData.respectedTrades : chartData.notRespectedTrades;
            return `${value.toFixed(1)}% (${count}/${total} trades)`;
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
              // Arrondir à l'entier le plus proche pour éviter les décimales
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
  const totalTrades = chartData.totalTrades;
  // const respectRate = chartData.respectPercentage;

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

  if (totalTrades === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="text-lg font-semibold mb-2">Aucune donnée pour {year}</p>
          <p className="text-sm">Aucun trade enregistré pour cette année.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full flex flex-col">
      {/* En-tête */}
      <div className="mb-4">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold text-gray-900">Respect de la Stratégie</h3>
          <div className="relative group">
            <svg className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {/* Infobulle */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-4 py-3 bg-white/95 backdrop-blur-sm text-gray-800 text-sm rounded-xl shadow-lg border border-gray-200/50 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-20 font-sans antialiased">
              <div className="font-semibold mb-2 text-gray-900">Différence entre les métriques :</div>
              <div className="space-y-1">
                <div><span className="font-medium text-blue-600">Taux global :</span> Trades respectés / Total trades</div>
                <div><span className="font-medium text-green-600">Régularité :</span> Moyenne des % mensuels</div>
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
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xl lg:text-2xl font-bold text-blue-600">
              {Math.round(chartData.respectPercentage)}%
            </div>
            <div className="text-xs text-gray-500">Taux global</div>
          </div>
          <div>
            <div className="text-xl lg:text-2xl font-bold text-green-600">
              {Math.round(chartData.averageMonthlyPercentage)}%
            </div>
            <div className="text-xs text-gray-500">Régularité</div>
          </div>
          <div>
            <div className="text-xl lg:text-2xl font-bold text-gray-600">
              {Math.round(chartData.notRespectPercentage)}%
            </div>
            <div className="text-xs text-gray-500">Non respectée</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default YearlyStrategyRespectChart;