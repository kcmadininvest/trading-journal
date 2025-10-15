import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { globalTooltipConfig, formatCurrency } from '../../config/chartConfig';

// Enregistrer les composants Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface DrawdownDataPoint {
  date: string;
  pnl: number;
  cumulative_pnl: number;
  drawdown: number;
}

interface DrawdownChartProps {
  data: DrawdownDataPoint[];
}

function DrawdownChart({ data }: DrawdownChartProps) {
  const hasData = Array.isArray(data) && data.length > 0;

  const chartData = useMemo(() => {
    if (!hasData) return null;

    // Filtrer les données pour ne montrer que les drawdowns > 0
    const filteredData = data.filter(item => item.drawdown > 0);

    return {
      labels: filteredData.map(item => new Date(item.date).toLocaleDateString('fr-FR')),
      datasets: [
        {
          label: 'Drawdown',
          data: filteredData.map(item => item.drawdown),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.1,
          pointRadius: 6,
          pointHoverRadius: 8,
          pointBackgroundColor: '#ef4444',
          pointBorderColor: '#dc2626',
          pointBorderWidth: 2,
        }
      ]
    };
  }, [data, hasData]);

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
            const drawdown = context.parsed.y;
            const date = context.label;
            const filteredData = data.filter(item => item.drawdown > 0);
            const dataPoint = filteredData.find(item => 
              new Date(item.date).toLocaleDateString('fr-FR') === date
            );
            
            if (dataPoint) {
              return [
                `Drawdown: ${formatCurrency(drawdown)}`,
                `P/L du jour: ${formatCurrency(dataPoint.pnl)}`,
                `P/L cumulé: ${formatCurrency(dataPoint.cumulative_pnl)}`
              ];
            }
            return [`Drawdown: ${formatCurrency(drawdown)}`];
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
          text: 'Date',
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
          text: 'Drawdown (USD)',
          font: {
            size: 14,
            weight: 'bold' as const
          }
        },
        beginAtZero: true,
        ticks: {
          font: {
            size: 11
          },
          callback: function(value: any) {
            return formatCurrency(value);
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
  }), [data]);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Pas assez de données pour afficher le graphique
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <Line data={chartData!} options={chartOptions} />
    </div>
  );
}

export default DrawdownChart;
