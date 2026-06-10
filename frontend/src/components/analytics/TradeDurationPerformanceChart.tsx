import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '../../hooks/usePreferences';
import { useTheme } from '../../hooks/useTheme';
import { ChartHelpTooltip } from '../charts/ChartHelpTooltip';
import { ChartTooltipResetContainer } from '../charts/ChartTooltipResetContainer';
import { formatCurrency, formatNumber, type NumberFormatType } from '../../utils/numberFormat';
import {
  CHART_FONT_FAMILY,
  buildChartTooltipPlugin,
  getChartSvgFontSizes,
  type ChartColors,
} from '../../utils/chartConfig';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend
);

export interface TradeDurationPerformancePoint {
  label: string;
  avgPnl: number;
  winRate: number;
  tradeCount: number;
}

export type BucketedPerformanceChartKey = 'durationPerformance' | 'sizePerformance';

interface TradeDurationPerformanceChartProps {
  data: TradeDurationPerformancePoint[];
  currencySymbol: string;
  chartColors: ChartColors;
  chartKey?: BucketedPerformanceChartKey;
}

function computeNiceAxisMax(maxValue: number, targetTicks = 6): { max: number; stepSize: number } {
  const withPadding = Math.max(maxValue * 1.1, 1);
  const roughStep = Math.max(withPadding / targetTicks, 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalizedStep = roughStep / magnitude;

  let niceNormalizedStep = 1;
  if (normalizedStep <= 1) niceNormalizedStep = 1;
  else if (normalizedStep <= 2) niceNormalizedStep = 2;
  else if (normalizedStep <= 5) niceNormalizedStep = 5;
  else niceNormalizedStep = 10;

  const stepSize = niceNormalizedStep * magnitude;
  const max = Math.ceil(withPadding / stepSize) * stepSize;
  return { max, stepSize };
}

export const TradeDurationPerformanceChart: React.FC<TradeDurationPerformanceChartProps> = ({
  data,
  currencySymbol,
  chartColors,
  chartKey = 'durationPerformance',
}) => {
  const { t } = useTranslation();
  const i18nPrefix = `analytics:charts.${chartKey}`;
  const { preferences } = usePreferences();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const numberFormat: NumberFormatType = preferences.number_format;
  const chartFontSizes = useMemo(
    () => getChartSvgFontSizes(preferences.font_size),
    [preferences.font_size],
  );
  const winRateStroke = '#10B981';

  const labels = useMemo(() => {
    if (chartKey !== 'sizePerformance') {
      return data.map((point) => point.label);
    }
    return data.map((point) => {
      const size = parseFloat(point.label);
      if (!Number.isFinite(size)) {
        return point.label;
      }
      const decimals = Number.isInteger(size) ? 0 : 2;
      return formatNumber(size, decimals, numberFormat);
    });
  }, [chartKey, data, numberFormat]);
  const avgPnlValues = useMemo(() => data.map((point) => point.avgPnl), [data]);
  const winRateValues = useMemo(() => data.map((point) => point.winRate), [data]);

  const avgPnlBarStyles = useMemo(
    () =>
      avgPnlValues.map((pnl) =>
        pnl >= 0
          ? {
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.85)',
              borderColor: isDark ? '#60a5fa' : '#3b82f6',
            }
          : {
              backgroundColor: isDark ? 'rgba(236, 72, 153, 0.8)' : 'rgba(236, 72, 153, 0.7)',
              borderColor: isDark ? '#f472b6' : '#ec4899',
            }
      ),
    [avgPnlValues, isDark]
  );

  const pnlAxis = useMemo(() => {
    if (!avgPnlValues.length) return { max: 100, min: 0, stepSize: 20 };
    const hasNegative = avgPnlValues.some((v) => v < 0);
    const hasPositive = avgPnlValues.some((v) => v > 0);
    const maxAbs = Math.max(...avgPnlValues.map((v) => Math.abs(v)), 0);
    const { max: niceMax, stepSize } = computeNiceAxisMax(maxAbs);
    return {
      max: hasPositive ? niceMax : 0,
      min: hasNegative ? -niceMax : 0,
      stepSize,
    };
  }, [avgPnlValues]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      interaction: { mode: 'index' as const, intersect: false },
      plugins: {
        datalabels: { display: false },
        legend: {
          display: false,
        },
        tooltip: {
          ...buildChartTooltipPlugin(chartColors, 'barStackedLike', undefined, {
            callbacks: {
              title: (items: { label?: string }[]) => items[0]?.label ?? '',
              label: (context: { datasetIndex: number; dataset: { label?: string }; parsed: { y: number }; dataIndex: number }) => {
                const point = data[context.dataIndex];
                if (!point) return '';
                const datasetLabel = context.dataset.label ?? '';
                if (context.datasetIndex === 1) {
                  return `${datasetLabel}: ${formatNumber(point.winRate, 1, numberFormat)} %`;
                }
                return `${datasetLabel}: ${formatCurrency(context.parsed.y, currencySymbol, numberFormat, 2)}`;
              },
              afterBody: (items: { dataIndex: number }[]) => {
                const index = items[0]?.dataIndex;
                if (index == null) return '';
                const count = data[index]?.tradeCount ?? 0;
                return t(`${i18nPrefix}.tradeCount`, {
                  count,
                  countDisplay: formatNumber(count, 0, numberFormat),
                });
              },
            },
          }),
        },
      },
      scales: {
        x: {
          ticks: {
            color: chartColors.textSecondary,
            font: { family: CHART_FONT_FAMILY, size: chartFontSizes.tick },
            maxRotation: 0,
            minRotation: 0,
          },
          grid: { display: false },
          border: { color: chartColors.border },
        },
        y: {
          type: 'linear' as const,
          position: 'left' as const,
          beginAtZero: true,
          min: pnlAxis.min,
          max: pnlAxis.max,
          grid: {
            color: chartColors.grid,
            lineWidth: 1,
          },
          ticks: {
            stepSize: pnlAxis.stepSize,
            color: chartColors.textSecondary,
            font: { family: CHART_FONT_FAMILY, size: chartFontSizes.tick },
            callback: (value: string | number) =>
              formatCurrency(Number(value), currencySymbol, numberFormat, 0),
          },
          border: {
            color: chartColors.border,
            display: false,
          },
          title: { display: false },
        },
        y1: {
          type: 'linear' as const,
          position: 'right' as const,
          min: 0,
          max: 100,
          grace: '12%',
          grid: { drawOnChartArea: false },
          ticks: {
            stepSize: 20,
            maxTicksLimit: 6,
            color: chartColors.textSecondary,
            font: { family: CHART_FONT_FAMILY, size: chartFontSizes.tick },
            callback: (value: string | number) => {
              const num = Number(value);
              if (num > 100) return '';
              return `${formatNumber(num, 0, numberFormat)} %`;
            },
          },
          border: { display: false },
          title: { display: false },
        },
      },
      elements: {
        bar: {
          borderRadius: 0,
        },
        line: {
          borderCapStyle: 'round' as const,
        },
        point: {
          hitRadius: 8,
        },
      },
    }),
    [
      chartColors,
      chartFontSizes.tick,
      currencySymbol,
      data,
      i18nPrefix,
      numberFormat,
      pnlAxis.max,
      pnlAxis.min,
      pnlAxis.stepSize,
      t,
    ]
  );

  if (!data.length) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 min-h-[450px]">
        <div className="flex items-center justify-center h-[320px]">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('analytics:noData', { defaultValue: 'Aucune donnée disponible' })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[450px] flex-col rounded-xl border border-gray-100 bg-white p-6 shadow-lg transition-shadow duration-300 hover:shadow-xl dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-3 flex items-center gap-2">
        <div
          className={`mr-1 h-6 w-1 rounded-full bg-gradient-to-b ${
            chartKey === 'sizePerformance'
              ? 'from-indigo-500 to-indigo-600'
              : 'from-teal-500 to-teal-600'
          }`}
        />
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
          {t(`${i18nPrefix}.title`)}
        </h3>
        <ChartHelpTooltip content={t(`${i18nPrefix}.tooltip`)} />
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: chartColors.text }}>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-5 rounded-full"
            style={{ backgroundColor: winRateStroke }}
            aria-hidden
          />
          {t(`${i18nPrefix}.winRate`)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#3b82f6]" aria-hidden />
          {t(`${i18nPrefix}.avgPnl`, { symbol: currencySymbol })}
        </span>
      </div>
      <ChartTooltipResetContainer className="relative min-h-[320px] flex-1">
        <Chart
          type="bar"
          data={{
            labels,
            datasets: [
              {
                type: 'bar' as const,
                label: t(`${i18nPrefix}.avgPnl`, { symbol: currencySymbol }),
                data: avgPnlValues,
                backgroundColor: avgPnlBarStyles.map((s) => s.backgroundColor),
                borderColor: avgPnlBarStyles.map((s) => s.borderColor),
                borderWidth: 0,
                borderRadius: 0,
                borderSkipped: false,
                yAxisID: 'y',
                order: 2,
              },
              {
                type: 'line' as const,
                label: t(`${i18nPrefix}.winRate`),
                data: winRateValues,
                borderColor: winRateStroke,
                backgroundColor: 'transparent',
                borderWidth: 2.5,
                pointRadius: 0,
                pointHoverRadius: 5,
                pointHoverBorderWidth: 2,
                pointHoverBorderColor: chartColors.background,
                pointHoverBackgroundColor: winRateStroke,
                spanGaps: false,
                tension: 0.25,
                fill: false,
                clip: false,
                yAxisID: 'y1',
                order: 1,
              },
            ],
          }}
          options={chartOptions}
        />
      </ChartTooltipResetContainer>
    </div>
  );
};
