import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar as ChartBar } from 'react-chartjs-2';
import { useTheme } from '../../hooks/useTheme';
import { useWindowWidth } from '../../hooks/useWindowWidth';
import { ChartTooltipResetContainer } from '../charts/ChartTooltipResetContainer';
import { ChartHelpTooltip } from '../charts/ChartHelpTooltip';
import {
  CHART_FONT_FAMILY,
  buildHorizontalBarChartTooltipPlugin,
  horizontalBarChartInteraction,
  type ChartColors,
} from '../../utils/chartConfig';
import { maskValue } from '../../hooks/usePrivacySettings';

interface AvgWinVsLossBarChartProps {
  avgWin: number | null | undefined;
  avgLoss: number | null | undefined;
  currencySymbol: string;
  formatCurrency: (value: number, currencySymbol?: string) => string;
  chartColors: ChartColors;
  hideMoney?: boolean;
}

export const AvgWinVsLossBarChart: React.FC<AvgWinVsLossBarChartProps> = ({
  avgWin,
  avgLoss,
  currencySymbol,
  formatCurrency,
  chartColors,
  hideMoney = false,
}) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const windowWidth = useWindowWidth();
  const isDark = theme === 'dark';

  const hasData = avgWin != null && avgLoss != null && (avgWin > 0 || avgLoss < 0);

  const chartData = useMemo(() => {
    const winValue = Math.abs(avgWin ?? 0);
    const lossValue = Math.abs(avgLoss ?? 0);

    return {
      labels: [
        t('statistics:tradesAnalysis.averageWin'),
        t('statistics:tradesAnalysis.averageLoss'),
      ],
      datasets: [
        {
          data: [winValue, lossValue],
          backgroundColor: [
            isDark ? 'rgba(59, 130, 246, 0.85)' : 'rgba(59, 130, 246, 0.75)',
            isDark ? 'rgba(236, 72, 153, 0.85)' : 'rgba(236, 72, 153, 0.75)',
          ],
          borderColor: [isDark ? '#60a5fa' : '#3b82f6', isDark ? '#f472b6' : '#ec4899'],
          borderWidth: 0,
          borderRadius: 6,
        },
      ],
    };
  }, [avgWin, avgLoss, isDark, t]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y' as const,
      interaction: horizontalBarChartInteraction,
      animation: { duration: 0 },
      plugins: {
        legend: { display: false },
        datalabels: { display: false },
        tooltip: buildHorizontalBarChartTooltipPlugin(chartColors, {
          callbacks: {
            title: (items: { dataIndex: number }[]) => {
              const index = items[0]?.dataIndex ?? 0;
              return index === 0
                ? t('statistics:tradesAnalysis.averageWin')
                : t('statistics:tradesAnalysis.averageLoss');
            },
            label: (context: { parsed: { x: number }; dataIndex: number }) => {
              const raw = context.parsed.x ?? 0;
              const signed = context.dataIndex === 1 ? -raw : raw;
              return hideMoney
                ? maskValue(null, currencySymbol)
                : formatCurrency(signed, currencySymbol);
            },
          },
        }),
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: chartColors.grid, drawBorder: false },
          ticks: {
            color: chartColors.textSecondary,
            font: { family: CHART_FONT_FAMILY, size: windowWidth < 640 ? 10 : 11 },
            callback: (value: string | number) => {
              const num = typeof value === 'number' ? value : parseFloat(String(value));
              if (hideMoney) return maskValue(null, currencySymbol);
              return formatCurrency(num, currencySymbol);
            },
          },
        },
        y: {
          grid: { display: false },
          ticks: {
            color: chartColors.text,
            font: { family: CHART_FONT_FAMILY, size: windowWidth < 640 ? 11 : 12 },
          },
        },
      },
    }),
    [chartColors, currencySymbol, formatCurrency, hideMoney, t, windowWidth]
  );

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <div className="mr-2 h-6 w-1 rounded-full bg-gradient-to-b from-blue-500 to-pink-500" />
        <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 sm:text-lg">
          {t('statistics:charts.avgWinVsLoss.title')}
        </h3>
        <ChartHelpTooltip content={t('statistics:charts.avgWinVsLoss.tooltip')} />
      </div>
      {!hasData ? (
        <div className="flex h-48 items-center justify-center sm:h-56">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('statistics:charts.noData', { defaultValue: 'Aucune donnée disponible' })}
          </p>
        </div>
      ) : (
        <ChartTooltipResetContainer className="relative h-48 sm:h-56">
          <ChartBar data={chartData} options={chartOptions} />
        </ChartTooltipResetContainer>
      )}
    </div>
  );
};
