import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import { formatDateTimeShort, type DateFormatType } from '../../utils/dateFormat';
import { formatNumber, type NumberFormatType } from '../../utils/numberFormat';
import { CHART_FONT_FAMILY } from '../../utils/chartConfig';
import type { EquityPoint } from '../../services/backtestJournal';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Filler, Tooltip, Legend);

interface Props {
  points: EquityPoint[];
  dateFormat: DateFormatType;
  timezone: string;
  numberFormat: NumberFormatType;
  mode: 'equity' | 'drawdown';
}

export function BacktestEquityChart({
  points,
  dateFormat,
  timezone,
  numberFormat,
  mode,
}: Props) {
  const { t } = useTranslation('backtestJournal');
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const data = useMemo(() => {
    const labels = points.map((point) =>
      formatDateTimeShort(point.market_datetime, dateFormat, timezone)
    );
    const values =
      mode === 'equity'
        ? points.map((point) => point.cumulative_r ?? 0)
        : points.map((point) => point.drawdown_r ?? 0);
    const color = mode === 'equity' ? (isDark ? '#34d399' : '#059669') : isDark ? '#f87171' : '#dc2626';
    return {
      labels,
      datasets: [
        {
          label: mode === 'equity' ? t('equityTaken') : t('drawdown'),
          data: values,
          borderColor: color,
          backgroundColor: isDark ? 'rgba(52, 211, 153, 0.12)' : 'rgba(5, 150, 105, 0.12)',
          fill: true,
          tension: 0.25,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
        },
      ],
    };
  }, [points, dateFormat, timezone, mode, isDark, t]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      plugins: {
        legend: { display: false },
        datalabels: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: { parsed: { y: number } }) =>
              formatNumber(ctx.parsed.y, 2, numberFormat),
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: isDark ? '#9ca3af' : '#6b7280',
            font: { family: CHART_FONT_FAMILY },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
          },
          grid: { display: false },
        },
        y: {
          ticks: {
            color: isDark ? '#9ca3af' : '#6b7280',
            font: { family: CHART_FONT_FAMILY },
            callback: (value: string | number) => formatNumber(Number(value), 2, numberFormat),
          },
          grid: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
        },
      },
    }),
    [isDark, numberFormat]
  );

  if (!points.length) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        {t('emptyObservations')}
      </div>
    );
  }

  return (
    <div className="h-56">
      <Line data={data} options={options as never} />
    </div>
  );
}
