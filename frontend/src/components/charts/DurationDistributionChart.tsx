import React, { useMemo } from 'react';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

import { Bar } from 'react-chartjs-2';
import { useBarChartConfig } from '../../hooks/useChartConfig';
import { chartColors } from '../../config/chartConfig';
import ChartCard from '../common/ChartCard';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  ChartDataLabels
);

interface DurationBin {
  label: string;
  successful: number;
  unsuccessful: number;
}

interface DurationDistributionChartProps {
  bins: DurationBin[];
}

function DurationDistributionChart({ bins }: DurationDistributionChartProps) {
  // Prepare chart data
  const chartData = useMemo(() => {
    const labels = bins.map(bin => bin.label);
    const successfulData = bins.map(bin => bin.successful);
    const unsuccessfulData = bins.map(bin => bin.unsuccessful);

    return {
      labels,
      datasets: [
        {
          label: 'Gagnants',
          data: successfulData,
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: '#3b82f6',
          borderWidth: 0,
          borderRadius: 0,
          borderSkipped: false,
        },
        {
          label: 'Perdants',
          data: unsuccessfulData,
          backgroundColor: 'rgba(209, 213, 219, 0.8)',
          borderColor: chartColors.gray[300],
          borderWidth: 0,
          borderRadius: 0,
          borderSkipped: false,
        }
      ]
    };
  }, [bins]);

  // Calculer la valeur maximale pour l'axe Y avec marge
  const maxYValue = useMemo(() => {
    if (bins.length === 0) return undefined;
    const maxValue = Math.max(...bins.map(bin => bin.successful + bin.unsuccessful));
    // Ajouter 10% de marge en haut
    return Math.ceil(maxValue * 1.10);
  }, [bins]);

  // Use global chart configuration
  const { options } = useBarChartConfig({
    layout: {
      padding: {
        bottom: 0  // Espace pour les labels sous l'axe X
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 15,
          font: {
            size: 12
          }
        }
      },
      datalabels: {
        display: true,
        color: function(context: any) {
          // Blanc pour les gagnants (bleu), noir pour les perdants (gris)
          const datasetIndex = context.datasetIndex;
          return datasetIndex === 0 ? '#ffffff' : '#1f2937';
        },
        font: {
          weight: 600,
          size: 13,
        },
        formatter: function(value: number) {
          // Afficher la valeur seulement si elle est supérieure à 0
          return value > 0 ? value.toString() : '';
        },
      }
    },
    scales: {
      x: {
        stacked: true,
        grid: {
          display: false
        },
        ticks: {
          padding: 8  // Aligne avec le graphique "Évolution des Gains et Pertes Journalière"
        }
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: {
          color: chartColors.gray[200]
        }
      }
    },
    elements: {
      bar: {
        borderRadius: 0
      }
    },
    animation: {
      duration: 1000,
      easing: 'easeInOutQuart' as const
    }
  });

  // Ajouter la valeur max à l'axe Y après la configuration de base
  const finalOptions = useMemo(() => ({
    ...options,
    scales: {
      ...options.scales,
      y: {
        ...(options.scales?.y as any),
        max: maxYValue,
      },
    },
  }), [options, maxYValue]);

  return (
    <ChartCard
      title={(
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-gray-900">RÉPARTITION DES TRADES PAR DURÉE</h3>
        </div>
      )}
      height={420}
    >
      {bins.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-500">
          Pas de données disponibles
        </div>
      ) : (
        <Bar data={chartData} options={finalOptions} />
      )}
    </ChartCard>
  );
}

export default DurationDistributionChart;
