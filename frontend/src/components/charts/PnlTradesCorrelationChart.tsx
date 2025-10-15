import React, { useMemo } from 'react';
import { Scatter } from 'react-chartjs-2';
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

interface CorrelationDataPoint {
  date: string;
  pnl: number;
  trade_count: number;
  avg_pnl_per_trade: number;
}

interface PnlTradesCorrelationChartProps {
  data: CorrelationDataPoint[];
}

function PnlTradesCorrelationChart({ data }: PnlTradesCorrelationChartProps) {
  const hasData = Array.isArray(data) && data.length > 0;

  const chartData = useMemo(() => {
    if (!hasData) return null;

    return {
      datasets: [
        {
          label: 'P/L vs Nombre de Trades',
          data: data.map(item => ({
            x: item.trade_count,
            y: item.pnl,
            date: item.date,
            avgPnlPerTrade: item.avg_pnl_per_trade
          })),
          backgroundColor: data.map(item => 
            item.pnl >= 0 ? '#3b82f6' : '#6b7280'
          ),
          borderColor: data.map(item => 
            item.pnl >= 0 ? '#1d4ed8' : '#4b5563'
          ),
          borderWidth: 2,
          pointRadius: 8,
          pointHoverRadius: 12
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
            const date = context[0].raw.date;
            return new Date(date).toLocaleDateString('fr-FR');
          },
          label: function(context: any) {
            const pnl = context.parsed.y;
            const tradeCount = context.parsed.x;
            const avgPnlPerTrade = context.raw.avgPnlPerTrade;
            return [
              `P/L: ${formatCurrency(pnl)}`,
              `Trades: ${tradeCount}`,
              `P/L moyen: ${formatCurrency(avgPnlPerTrade)}`
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
          text: 'Nombre de Trades par Jour',
          font: {
            size: 14,
            weight: 'bold' as const
          }
        },
        ticks: {
          stepSize: 1,
          font: {
            size: 12
          }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          lineWidth: 0.5
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
            size: 12
          }
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          lineWidth: 0.5
        }
      }
    }
  }), []);


  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Pas assez de données pour afficher le graphique
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <Scatter data={chartData!} options={chartOptions} />
    </div>
  );
}

export default PnlTradesCorrelationChart;
