import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { globalTooltipConfig, formatCurrency } from '../../config/chartConfig';

// Enregistrer les composants Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface HourlyDataPoint {
  hour: number;
  pnl: number;
  trade_count: number;
}

interface HourlyPerformanceChartProps {
  data: HourlyDataPoint[];
}

function HourlyPerformanceChart({ data }: HourlyPerformanceChartProps) {
  const hasData = Array.isArray(data) && data.length > 0;

  // Filtrer les données pour ne garder que les heures avec des trades
  const filteredData = useMemo(() => {
    return data.filter(item => item.trade_count > 0);
  }, [data]);

  const chartData = useMemo(() => {
    if (!hasData || filteredData.length === 0) return null;

    // Calculer la plage d'heures avec une marge
    const hours = filteredData.map(item => item.hour);
    const minHour = Math.min(...hours);
    const maxHour = Math.max(...hours);
    const startHour = Math.max(0, minHour - 1);
    const endHour = Math.min(23, maxHour + 1);

    // Créer toutes les heures dans la plage
    const allHours = [];
    for (let h = startHour; h <= endHour; h += 0.5) {
      allHours.push(h);
    }

    const labels = allHours.map(hour => {
      const h = Math.floor(hour);
      const minutes = (hour - h) * 60;
      if (minutes === 0) {
        return `${h}h`;
      } else {
        return `${h}h${minutes.toString().padStart(2, '0')}`;
      }
    });

    const pnlData = allHours.map(hour => {
      const dataPoint = filteredData.find(item => item.hour === hour);
      return dataPoint ? dataPoint.pnl : 0;
    });

    // const tradeCountData = allHours.map(hour => {
    //   const dataPoint = filteredData.find(item => item.hour === hour);
    //   return dataPoint ? dataPoint.trade_count : 0;
    // });

    return {
      labels,
      datasets: [
        {
          label: 'P/L par Heure',
          data: pnlData,
          backgroundColor: pnlData.map(pnl => 
            pnl >= 0 ? '#3b82f6' : '#6b7280'
          ),
          borderColor: pnlData.map(pnl => 
            pnl >= 0 ? '#1d4ed8' : '#4b5563'
          ),
          borderWidth: 0,
          borderRadius: 0,
          borderSkipped: false,
        }
      ]
    };
  }, [filteredData, hasData]);

  const chartOptions = useMemo(() => ({
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
            return context[0].label;
          },
          label: function(context: any) {
            const pnl = context.parsed.y;
            const hour = context.label;
            const dataPoint = filteredData.find(item => {
              const h = Math.floor(item.hour);
              const minutes = (item.hour - h) * 60;
              const formattedHour = minutes === 0 ? `${h}h` : `${h}h${minutes.toString().padStart(2, '0')}`;
              return formattedHour === hour;
            });
            
            if (dataPoint) {
              return `${formatCurrency(pnl)} (${dataPoint.trade_count} trades, moy: ${formatCurrency(pnl / dataPoint.trade_count)})`;
            }
            return `${formatCurrency(pnl)}`;
          }
        }
      },
      datalabels: {
        display: false
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Heure de la journée',
          font: {
            size: 14,
            weight: 'bold' as const
          }
        },
        ticks: {
          font: {
            size: 11
          }
        },
        grid: {
          display: false
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
        ticks: {
          font: {
            size: 11
          }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          lineWidth: 0.5
        }
      }
    },
    animation: {
      duration: 1000,
      easing: 'easeInOutQuart' as const
    }
  }), [filteredData]);


  if (!hasData || filteredData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Pas assez de données pour afficher le graphique
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <Bar data={chartData!} options={chartOptions} />
      
    </div>
  );
}

export default HourlyPerformanceChart;