import React from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels);

interface EmotionsChartProps {
  strategyData: { [date: string]: any };
}

const EmotionsChart: React.FC<EmotionsChartProps> = ({ strategyData }) => {
  // Calculer les données d'émotions dominantes
  const chartData = React.useMemo(() => {
    const emotionCounts: { [key: string]: number } = {};
    let totalEmotions = 0;

    Object.values(strategyData).forEach((dayData: any) => {
      // Vérifier les trades respectés
      if (dayData.respectedTrades && Array.isArray(dayData.respectedTrades)) {
        dayData.respectedTrades.forEach((trade: any) => {
          if (trade.dominant_emotions && Array.isArray(trade.dominant_emotions)) {
            trade.dominant_emotions.forEach((emotion: string) => {
              emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
              totalEmotions++;
            });
          }
        });
      }
      
      // Vérifier les trades non respectés
      if (dayData.notRespectedTrades && Array.isArray(dayData.notRespectedTrades)) {
        dayData.notRespectedTrades.forEach((trade: any) => {
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
  }, [strategyData]);

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

  // Vérifier si nous avons des données d'émotions
  const hasEmotionData = Object.values(strategyData).some((dayData: any) => 
    (dayData.respectedTrades && Array.isArray(dayData.respectedTrades) && 
     dayData.respectedTrades.some((trade: any) => trade.dominant_emotions && trade.dominant_emotions.length > 0)) ||
    (dayData.notRespectedTrades && Array.isArray(dayData.notRespectedTrades) && 
     dayData.notRespectedTrades.some((trade: any) => trade.dominant_emotions && trade.dominant_emotions.length > 0))
  );

  if (!hasEmotionData) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="text-lg font-semibold mb-2">Données d'émotions non disponibles</p>
          <p className="text-sm">Les émotions dominantes ne sont pas encore chargées.</p>
        </div>
      </div>
    );
  }

  if (chartData.totalEmotions === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="text-lg font-semibold mb-2">Aucune donnée d'émotion pour ce mois</p>
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
              <div className="font-semibold mb-2 text-gray-900">Répartition des émotions :</div>
              <div className="space-y-1">
                <div>Camembert des émotions dominantes ressenties pendant vos trades</div>
                <div className="text-xs text-gray-600">Top 8 émotions les plus fréquentes</div>
              </div>
              {/* Flèche */}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-white/95"></div>
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          {chartData.totalEmotions} émotion{chartData.totalEmotions > 1 ? 's' : ''} analysée{chartData.totalEmotions > 1 ? 's' : ''}
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

export default EmotionsChart;
