import React, { useState, useEffect } from 'react';
import { tradesService } from '../services/trades';
import { Scatter } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';
import { globalTooltipConfig, formatCurrency as globalFormatCurrency } from '../config/chartConfig';
import HourlyPerformanceChart from '../components/charts/HourlyPerformanceChart';
import PnlTradesCorrelationChart from '../components/charts/PnlTradesCorrelationChart';
import DrawdownChart from '../components/charts/DrawdownChart';

// Enregistrer les composants Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend
);


interface HourlyData {
  hour: number;
  pnl: number;
  trade_count: number;
}

interface DrawdownData {
  date: string;
  pnl: number;
  cumulative_pnl: number;
  drawdown: number;
}

interface HourlyPerformanceData {
  hourly_data: HourlyData[];
}

function AnalyticsPage() {
  const [hourlyData, setHourlyData] = useState<HourlyPerformanceData | null>(null);
  const [correlationData, setCorrelationData] = useState<any>(null);
  const [drawdownData, setDrawdownData] = useState<DrawdownData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const [hourly, correlation, drawdown] = await Promise.all([
        tradesService.getHourlyPerformance(),
        tradesService.getPnlTradesCorrelation(),
        tradesService.getDrawdownData()
      ]);
      setHourlyData(hourly);
      setCorrelationData(correlation);
      setDrawdownData(drawdown.drawdown_data || []);
    } catch (error) {
      // Erreur silencieuse lors du chargement des données d'analyses
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const formatCurrency = globalFormatCurrency;


  // Préparer les données du graphique en nuage de points
  const chartData = hourlyData ? {
    datasets: [
      {
        label: 'Performance par heure',
        data: hourlyData.hourly_data
          .filter(item => item.trade_count > 0) // Seulement les heures avec des trades
          .map(item => ({
            x: item.hour,
            y: item.pnl,
            tradeCount: item.trade_count
          })),
        backgroundColor: hourlyData.hourly_data
          .filter(item => item.trade_count > 0)
          .map(item => 
            item.pnl >= 0 ? '#3b82f6' : '#6b7280'
          ),
        borderColor: hourlyData.hourly_data
          .filter(item => item.trade_count > 0)
          .map(item => 
            item.pnl >= 0 ? '#1d4ed8' : '#4b5563'
          ),
        borderWidth: 0,
        pointRadius: 12,
        pointHoverRadius: 16
      }
    ]
  } : null;

  // Calculer la plage d'heures avec des trades
  const getHourRange = () => {
    if (!hourlyData) return { min: 0, max: 23.5 };
    
    const hoursWithTrades = hourlyData.hourly_data
      .filter(item => item.trade_count > 0)
      .map(item => item.hour);
    
    if (hoursWithTrades.length === 0) return { min: 0, max: 23.5 };
    
    const minHour = Math.min(...hoursWithTrades);
    const maxHour = Math.max(...hoursWithTrades);
    
    // Ajouter une marge de 0.5 heure (30 minutes) de chaque côté pour le contexte
    return {
      min: Math.max(0, minHour - 0.5),
      max: Math.min(23.5, maxHour + 0.5)
    };
  };

  const hourRange = getHourRange();

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        ...globalTooltipConfig,
        callbacks: {
          title: function(context: any) {
            const value = context[0].parsed.x;
            const hour = Math.floor(value);
            const minutes = (value - hour) * 60;
            if (minutes === 0) {
              return `${hour}h`;
            } else {
              return `${hour}h${minutes.toString().padStart(2, '0')}`;
            }
          },
          label: function(context: any) {
            const pnl = context.parsed.y;
            const dataIndex = context.dataIndex;
            const originalData = hourlyData?.hourly_data.filter(item => item.trade_count > 0)[dataIndex];
            const tradeCount = originalData?.trade_count || 0;
            return `${globalFormatCurrency(pnl)} (${tradeCount} trades, moy: ${globalFormatCurrency(tradeCount > 0 ? pnl / tradeCount : 0)})`;
          }
        }
      },
      datalabels: {
        display: false
      }
    },
    scales: {
      x: {
        type: 'linear' as const,
        title: {
          display: true,
          text: 'Heure de la journée',
          font: {
            size: 14,
            weight: 'bold' as const
          }
        },
        min: hourRange.min,
        max: hourRange.max,
        ticks: {
          stepSize: 0.5,
          callback: function(value: any) {
            const hour = Math.floor(value);
            const minutes = (value - hour) * 60;
            if (minutes === 0) {
              return `${hour}h`;
            } else {
              return `${hour}h${minutes.toString().padStart(2, '0')}`;
            }
          },
          font: {
            size: 12
          }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          lineWidth: 0.5
        },
        border: {
          width: 1
        }
      },
      y: {
        title: {
          display: true,
          text: 'P/L (USD)',
          font: {
            size: 14,
            weight: 'bold' as const
          }
        },
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Chargement des analyses...</div>
      </div>
    );
  }


  return (
    <div className="p-4 bg-gray-50">
      <div className="w-full">
        {/* En-tête avec statistiques de corrélation */}
        <div className="mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Analyses Détaillées</h1>
              <p className="text-gray-600">Métriques avancées de performance et statistiques de trading</p>
            </div>
            
            {/* Statistiques de corrélation */}
            {correlationData?.correlation_data && (() => {
              const data = correlationData.correlation_data;
              const n = data.length;
              const sumX = data.reduce((sum: number, item: any) => sum + item.trade_count, 0);
              const sumY = data.reduce((sum: number, item: any) => sum + item.pnl, 0);
              const sumXY = data.reduce((sum: number, item: any) => sum + item.trade_count * item.pnl, 0);
              const sumX2 = data.reduce((sum: number, item: any) => sum + item.trade_count * item.trade_count, 0);
              const sumY2 = data.reduce((sum: number, item: any) => sum + item.pnl * item.pnl, 0);
              
              const correlation = (n * sumXY - sumX * sumY) / 
                Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
              
              const avgTradesPerDay = sumX / n;
              const avgPnlPerDay = sumY / n;
              
              return (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-gray-500 font-medium mb-1 flex items-center justify-center gap-1">
                        Corrélation
                        <div className="relative group">
                          <svg className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {/* Infobulle */}
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-4 py-3 bg-white/95 backdrop-blur-sm text-gray-800 text-sm rounded-xl shadow-lg border border-gray-200/50 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-50 font-sans antialiased">
                            <div className="font-semibold mb-2 text-gray-900">Corrélation :</div>
                            <div className="space-y-1">
                              <div><span className="text-green-600 font-semibold">+1 :</span> <span className="text-sm font-normal">Relation parfaite positive</span></div>
                              <div><span className="text-orange-600 font-semibold">-1 :</span> <span className="text-sm font-normal">Relation parfaite négative</span></div>
                              <div><span className="text-gray-600 font-semibold">0 :</span> <span className="text-sm font-normal">Aucune relation</span></div>
                            </div>
                            {/* Flèche */}
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-white/95"></div>
                          </div>
                        </div>
                      </div>
                      <div className={`text-sm font-bold ${
                        correlation > 0.3 ? 'text-green-600' : 
                        correlation < -0.3 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {isNaN(correlation) ? '0.000' : correlation.toFixed(3)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-500 font-medium mb-1">Trades Moyens/Jour</div>
                      <div className="text-sm font-bold text-blue-600">
                        {avgTradesPerDay.toFixed(1)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-500 font-medium mb-1">P/L Moyen/Jour</div>
                      <div className={`text-sm font-bold ${
                        avgPnlPerDay >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(avgPnlPerDay)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-500 font-medium mb-1">Jours Analysés</div>
                      <div className="text-sm font-bold text-gray-700">
                        {n}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Section des graphiques principaux */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          {/* Graphique de performance par heure (nuage de points) */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Performance par Heure (Nuage de Points)
              <div className="relative group">
                <svg className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {/* Infobulle */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-4 py-3 bg-white/95 backdrop-blur-sm text-gray-800 text-sm rounded-xl shadow-lg border border-gray-200/50 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-20 font-sans antialiased">
                  <div className="font-semibold mb-2 text-gray-900">Performance par Heure (Nuage de Points) :</div>
                  <div className="space-y-1">
                    <div><span className="text-blue-600 font-semibold">Chaque point :</span> <span className="text-sm font-normal">Une heure avec des trades</span></div>
                    <div><span className="text-blue-600 font-semibold">Axe X :</span> <span className="text-sm font-normal">Heure de la journée</span></div>
                    <div><span className="text-blue-600 font-semibold">Axe Y :</span> <span className="text-sm font-normal">P/L généré</span></div>
                    <div><span className="text-blue-600 font-semibold">Points bleus :</span> <span className="text-sm font-normal">Profits, <span className="text-gray-600 font-semibold">Points gris :</span> Pertes</span></div>
                  </div>
                  {/* Flèche */}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-white/95"></div>
                </div>
              </div>
            </h2>
            <div className="h-80">
              {chartData ? (
                <Scatter data={chartData} options={chartOptions} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Aucune donnée disponible
                </div>
              )}
            </div>
          </div>

          {/* Graphique de corrélation P/L vs Nombre de trades */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Corrélation P/L vs Nombre de Trades
              <div className="relative group">
                <svg className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {/* Infobulle */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-4 py-3 bg-white/95 backdrop-blur-sm text-gray-800 text-sm rounded-xl shadow-lg border border-gray-200/50 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-20 font-sans antialiased">
                  <div className="font-semibold mb-2 text-gray-900">Corrélation P/L vs Nombre de Trades :</div>
                  <div className="space-y-1">
                    <div><span className="text-blue-600 font-semibold">Chaque point :</span> <span className="text-sm font-normal">Un jour de trading</span></div>
                    <div><span className="text-green-600 font-semibold">Corrélation positive :</span> <span className="text-sm font-normal">Plus de trades = plus de profits</span></div>
                    <div><span className="text-orange-600 font-semibold">Corrélation négative :</span> <span className="text-sm font-normal">La qualité prime sur la quantité</span></div>
                  </div>
                  {/* Flèche */}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-white/95"></div>
                </div>
              </div>
            </h2>
            <div className="h-80">
              {correlationData?.correlation_data ? (
                <PnlTradesCorrelationChart data={correlationData.correlation_data} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Aucune donnée disponible
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Graphiques de performance par heure (barres) et drawdown */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Graphique de performance par heure (barres) */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Performance par Heure (Barres)
              <div className="relative group">
                <svg className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {/* Infobulle */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-4 py-3 bg-white/95 backdrop-blur-sm text-gray-800 text-sm rounded-xl shadow-lg border border-gray-200/50 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-20 font-sans antialiased">
                  <div className="font-semibold mb-2 text-gray-900">Performance par Heure (Barres) :</div>
                  <div className="space-y-1">
                    <div><span className="text-green-600 font-semibold">Chaque barre :</span> <span className="text-sm font-normal">Une heure avec des trades</span></div>
                    <div><span className="text-blue-600 font-semibold">Barres bleues :</span> <span className="text-sm font-normal">Profits</span></div>
                    <div><span className="text-gray-600 font-semibold">Barres grises :</span> <span className="text-sm font-normal">Pertes</span></div>
                    <div><span className="text-green-600 font-semibold">Objectif :</span> <span className="text-sm font-normal">Identifier vos heures les plus rentables</span></div>
                  </div>
                  {/* Flèche */}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-white/95"></div>
                </div>
              </div>
            </h2>
            <div className="h-80">
              {hourlyData?.hourly_data ? (
                <HourlyPerformanceChart data={hourlyData.hourly_data} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Aucune donnée disponible
                </div>
              )}
            </div>
          </div>

          {/* Graphique de Drawdown */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
              Graphique de Drawdown
              <div className="relative group">
                <svg className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {/* Infobulle */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-4 py-3 bg-white/95 backdrop-blur-sm text-gray-800 text-sm rounded-xl shadow-lg border border-gray-200/50 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-20 font-sans antialiased">
                  <div className="font-semibold mb-2 text-gray-900">Qu'est-ce que le Drawdown ?</div>
                  <div className="space-y-1">
                    <div><span className="text-green-600 font-semibold">Ligne à 0 :</span> <span className="text-sm font-normal">Vous êtes à votre meilleur niveau</span></div>
                    <div><span className="text-orange-600 font-semibold">Ligne rouge :</span> <span className="text-sm font-normal">Vous avez perdu par rapport à votre pic</span></div>
                    <div><span className="text-orange-600 font-semibold">Plus c'est haut :</span> <span className="text-sm font-normal">Plus vous êtes loin de votre meilleur niveau</span></div>
                  </div>
                  {/* Flèche */}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-white/95"></div>
                </div>
              </div>
            </h2>
            <div className="h-80">
              {drawdownData.length > 0 && drawdownData.some(item => item.drawdown > 0) ? (
                <DrawdownChart data={drawdownData} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  {drawdownData.length > 0 ? 'Aucun drawdown détecté - Performance constante !' : 'Aucune donnée disponible'}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default AnalyticsPage;