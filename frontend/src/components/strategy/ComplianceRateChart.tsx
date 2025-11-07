import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { DailyCompliance } from '../../services/tradeStrategies';
import { formatDate } from '../../utils/dateFormat';
import { usePreferences } from '../../hooks/usePreferences';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

interface ComplianceRateChartProps {
  dailyCompliance: DailyCompliance[];
}

export const ComplianceRateChart: React.FC<ComplianceRateChartProps> = ({
  dailyCompliance,
}) => {
  const { t } = useTranslation();
  const { preferences } = usePreferences();

  // Limiter à 30 derniers jours pour la lisibilité
  const recentData = dailyCompliance.slice(-30);

  const data = {
    labels: recentData.map(d => formatDate(d.date, preferences.date_format, false)),
    datasets: [
      {
        label: t('strategy:compliance.rate', { defaultValue: 'Taux de respect (%)' }),
        data: recentData.map(d => d.compliance_rate),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
      },
      title: {
        display: true,
        text: t('strategy:compliance.evolution', { defaultValue: 'Évolution du taux de respect' }),
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const index = context.dataIndex;
            const dayData = recentData[index];
            return [
              `${t('strategy:compliance.rate', { defaultValue: 'Taux de respect' })}: ${dayData.compliance_rate.toFixed(1)}%`,
              `${dayData.respected} / ${dayData.total} ${t('strategy:compliance.trades', { defaultValue: 'trades respectés' })}`,
            ];
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          callback: function(value: any) {
            return value + '%';
          },
        },
      },
    },
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="h-64">
        <Line data={data} options={options} />
      </div>
    </div>
  );
};

