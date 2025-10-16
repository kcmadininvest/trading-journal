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
import Tooltip from '../components/common/Tooltip';

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
        borderWidth: 2,
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
            return [
              `P/L: ${globalFormatCurrency(pnl)}`,
              `Trades: ${tradeCount}`,
              `P/L moyen: ${globalFormatCurrency(tradeCount > 0 ? pnl / tradeCount : 0)}`
            ];
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
                        <Tooltip 
                          content={
                            <div>
                              Mesure la relation entre le nombre de trades et le P/L quotidien.
                              <br />
                              • +1 = relation parfaite positive
                              <br />
                              • -1 = relation parfaite négative  
                              <br />
                              • 0 = aucune relation
                            </div>
                          }
                          placement="bottom"
                        >
                          <svg className="w-4 h-4 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                          </svg>
                        </Tooltip>
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
                Graphique de Drawdown
              </h2>
              <Tooltip 
                content={
                  <div>
                    <strong>Qu'est-ce que le Drawdown ?</strong>
                    <br />
                    Mesure la baisse maximale de votre capital par rapport au pic de performance.
                    <br /><br />
                    • <strong>Ligne à 0</strong> = Vous êtes à votre meilleur niveau
                    <br />
                    • <strong>Ligne rouge</strong> = Vous avez perdu par rapport à votre pic
                    <br />
                    • <strong>Plus c'est haut</strong> = Plus vous êtes loin de votre meilleur niveau
                  </div>
                }
                placement="bottom"
              >
                <svg className="w-5 h-5 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </Tooltip>
            </div>
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
