import React, { useState, useEffect } from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { tradesService } from '../../services/trades';

ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels);

interface YearlyEmotionsChartProps {
  year: number;
  isLoading?: boolean;
}

const YearlyEmotionsChart: React.FC<YearlyEmotionsChartProps> = ({ year, isLoading = false }) => {
  const [emotionsData, setEmotionsData] = useState<{ [emotion: string]: number }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchYearlyEmotionsData = async () => {
      try {
        setLoading(true);
        setEmotionsData({});
        
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
        const emotionMap: { [month: string]: any } = {};
        
        for (let month = 1; month <= 12; month++) {
          const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
          
          // Filtrer les trades du mois
          const monthTrades = yearTrades.filter(trade => {
            const tradeDate = new Date(trade.entered_at);
            return tradeDate.getMonth() + 1 === month;
          });
          
          // Analyser les émotions en utilisant les données de TradeStrategy
          const respectedTrades: Array<{ dominant_emotions: string[] }> = [];
          const notRespectedTrades: Array<{ dominant_emotions: string[] }> = [];
          
          monthTrades.forEach(trade => {
            const strategyInfo = strategies.find((s: any) => s.trade === trade.id);
            if (strategyInfo) {
              const tradeWithEmotions = {
                dominant_emotions: strategyInfo.dominant_emotions || []
              };
              
              if (strategyInfo.strategy_respected === true) {
                respectedTrades.push(tradeWithEmotions);
              } else if (strategyInfo.strategy_respected === false) {
                notRespectedTrades.push(tradeWithEmotions);
              } else {
                // Trades sans données de stratégie - on les considère comme non respectés par défaut
                notRespectedTrades.push(tradeWithEmotions);
              }
            } else {
              // Trades sans données de stratégie - générer une émotion basée sur le P/L
              const pnl = parseFloat(trade.net_pnl.toString());
              let emotion = 'Neutre';
              if (pnl > 50) {
                emotion = 'Confiant';
              } else if (pnl > 20) {
                emotion = 'Optimiste';
              } else if (pnl > 0) {
                emotion = 'Satisfait';
              } else if (pnl > -20) {
                emotion = 'Prudent';
              } else if (pnl > -50) {
                emotion = 'Inquiet';
              } else {
                emotion = 'Frustré';
              }
              
              notRespectedTrades.push({
                dominant_emotions: [emotion]
              });
            }
          });
          
          if (monthTrades.length > 0) {
            emotionMap[monthKey] = {
              respectedTrades,
              notRespectedTrades,
              totalTrades: monthTrades.length
            };
          }
        }
        
        setEmotionsData(emotionMap);
      } catch (error) {
        console.error('Error fetching yearly emotions data:', error);
        setEmotionsData({});
      } finally {
        setLoading(false);
      }
    };

    fetchYearlyEmotionsData();
  }, [year]);

  // Calculer les données d'émotions dominantes (même format que EmotionsChart)
  const chartData = React.useMemo(() => {
    const emotionCounts: { [key: string]: number } = {};
    let totalEmotions = 0;

    Object.values(emotionsData).forEach((monthData: any) => {
      // Vérifier les trades respectés
      if (monthData.respectedTrades && Array.isArray(monthData.respectedTrades)) {
        monthData.respectedTrades.forEach((trade: any) => {
          if (trade.dominant_emotions && Array.isArray(trade.dominant_emotions)) {
            trade.dominant_emotions.forEach((emotion: string) => {
              emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
              totalEmotions++;
            });
          }
        });
      }
      
      // Vérifier les trades non respectés
      if (monthData.notRespectedTrades && Array.isArray(monthData.notRespectedTrades)) {
        monthData.notRespectedTrades.forEach((trade: any) => {
          if (trade.dominant_emotions && Array.isArray(trade.dominant_emotions)) {
            trade.dominant_emotions.forEach((emotion: string) => {
              emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
              totalEmotions++;
            });
          }
        });
      }
    });

    // Trier les émotions par fréquence et prendre les 8 plus fréquentes
    const sortedEmotions = Object.entries(emotionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);

    const labels = sortedEmotions.map(([emotion]) => emotion);
    const data = sortedEmotions.map(([, count]) => count);

    return {
      labels,
      data,
      totalEmotions,
      emotionCounts
    };
  }, [emotionsData]);

  // Palette de couleurs pour les émotions (plus de couleurs pour le camembert)
  const emotionColors = [
    '#f59e0b', // amber-500
    '#ef4444', // red-500
    '#10b981', // emerald-500
    '#8b5cf6', // violet-500
    '#06b6d4', // cyan-500
    '#f97316', // orange-500
    '#84cc16', // lime-500
    '#ec4899', // pink-500
  ];

  const data = {
    labels: chartData.labels,
    datasets: [
      {
        data: chartData.data,
        backgroundColor: emotionColors.slice(0, chartData.labels.length),
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverBorderWidth: 3,
        hoverBorderColor: '#ffffff',
      }
    ]
  };

  const options = {
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
          size: 12
        },
        formatter: function(value: any, context: any) {
          const emotion = context.chart.data.labels[context.dataIndex];
          const data = context.dataset.data;
          
          // Calculer le pourcentage
          const total = data.reduce((a: number, b: number) => a + b, 0);
          const percentage = (value / total) * 100;
          
          // Afficher seulement les 3 plus grosses valeurs (>= 20%)
          if (percentage >= 20) {
            return emotion;
          }
          return '';
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
            const value = context.parsed;
            const emotion = context.label;
            const count = chartData.emotionCounts[emotion] || 0;
            const percentage = ((value / chartData.totalEmotions) * 100).toFixed(1);
            return `${percentage}% (${count} occurrence${count > 1 ? 's' : ''})`;
          }
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
  const totalEmotions = chartData.totalEmotions;

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

  // Vérifier si nous avons des données d'émotions
  const hasEmotionData = Object.values(emotionsData).some((monthData: any) => 
    (monthData.respectedTrades && Array.isArray(monthData.respectedTrades) && 
     monthData.respectedTrades.some((trade: any) => trade.dominant_emotions && trade.dominant_emotions.length > 0)) ||
    (monthData.notRespectedTrades && Array.isArray(monthData.notRespectedTrades) && 
     monthData.notRespectedTrades.some((trade: any) => trade.dominant_emotions && trade.dominant_emotions.length > 0))
  );

  if (!hasEmotionData) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="text-lg font-semibold mb-2">Aucune donnée d'émotion pour {year}</p>
          <p className="text-sm">Ajoutez des émotions pour voir le graphique.</p>
        </div>
      </div>
    );
  }

  if (chartData.totalEmotions === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="text-lg font-semibold mb-2">Aucune donnée d'émotion pour {year}</p>
          <p className="text-sm">Ajoutez des émotions pour voir le graphique.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full flex flex-col">
      {/* En-tête */}
      <div className="mb-4">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold text-gray-900">Émotions Dominantes</h3>
          <div className="relative group">
            <svg className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {/* Infobulle */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-4 py-3 bg-white/95 backdrop-blur-sm text-gray-800 text-sm rounded-xl shadow-lg border border-gray-200/50 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-20 font-sans antialiased">
              <div className="font-semibold mb-2 text-gray-900">Émotions basées sur P/L :</div>
              <div className="space-y-1">
                <div><span className="font-medium text-green-500">Confiant :</span> P/L &gt; 50$</div>
                <div><span className="font-medium text-lime-500">Optimiste :</span> P/L 20-50$</div>
                <div><span className="font-medium text-blue-500">Satisfait :</span> P/L 0-20$</div>
                <div><span className="font-medium text-gray-500">Neutre :</span> P/L = 0$</div>
                <div><span className="font-medium text-yellow-500">Prudent :</span> P/L -20 à 0$</div>
                <div><span className="font-medium text-orange-500">Inquiet :</span> P/L -50 à -20$</div>
                <div><span className="font-medium text-red-500">Frustré :</span> P/L &lt; -50$</div>
              </div>
              {/* Flèche */}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-white/95"></div>
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          {totalEmotions} émotion{totalEmotions > 1 ? 's' : ''} analysée{totalEmotions > 1 ? 's' : ''}
        </p>
      </div>

      {/* Graphique */}
      <div className="flex-1 min-h-0">
        <div className="h-full">
          <Pie data={data} options={options} />
        </div>
      </div>
    </div>
  );
};

export default YearlyEmotionsChart;