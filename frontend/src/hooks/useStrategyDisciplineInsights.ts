import { useMemo, useRef, type MutableRefObject } from 'react';
import type { ChartOptions, TooltipItem } from 'chart.js';
import type { Context as DataLabelsContext } from 'chartjs-plugin-datalabels/types/context';
import {
  buildChartTooltipPlugin,
  CHART_FONT_FAMILY,
  type ChartColors,
} from '../utils/chartConfig';

export interface GainIfStrategyStats {
  total_not_respected: number;
  total_answered: number;
  unanswered: number;
  would_have_won: number;
  would_have_lost: number;
  would_have_won_pct: number | null;
  would_have_lost_pct: number | null;
}

export interface EmotionCountRow {
  emotion: string;
  count: number;
}

export interface EmotionsByRespect {
  respected: EmotionCountRow[];
  not_respected: EmotionCountRow[];
}

export interface ComplianceCompletionStats {
  total_trades: number;
  evaluated_trades: number;
  unevaluated_trades: number;
  trade_completion_rate_pct: number | null;
  total_trading_days: number;
  days_fully_evaluated: number;
  days_partially_unevaluated: number;
  day_completion_rate_pct: number | null;
}

interface UseStrategyDisciplineInsightsParams {
  statistics: {
    statistics?: {
      gain_if_strategy_stats?: GainIfStrategyStats;
      emotions_by_respect?: EmotionsByRespect;
      compliance_completion_stats?: ComplianceCompletionStats;
    };
  } | null;
  isLoading: boolean;
  getEmotionLabel: (emotion: string) => string;
  t: (key: string, options?: Record<string, unknown>) => string;
  chartColors: ChartColors;
  formatNumber: (value: number, digits?: number) => string;
  isMobile: boolean;
  onEmotionBarClickRef?: MutableRefObject<((emotion: string, respected: boolean) => void) | null>;
}

const TOP_EMOTIONS_LIMIT = 6;

const SMALL_BAR_PIXEL_THRESHOLD = 20;

export function useStrategyDisciplineInsights({
  statistics,
  isLoading,
  getEmotionLabel,
  t,
  chartColors,
  formatNumber,
  isMobile,
  onEmotionBarClickRef,
}: UseStrategyDisciplineInsightsParams) {
  const formatNumberRef = useRef(formatNumber);
  formatNumberRef.current = formatNumber;
  const emotionKeysRef = useRef<string[]>([]);
  const onEmotionBarClickRefLocal = useRef(onEmotionBarClickRef);
  onEmotionBarClickRefLocal.current = onEmotionBarClickRef;

  const totalOccurrencesRef = useRef(0);
  const gainStats = statistics?.statistics?.gain_if_strategy_stats ?? null;
  const completionStats = statistics?.statistics?.compliance_completion_stats ?? null;

  const emotionsByRespectChart = useMemo(() => {
    if (isLoading) return null;
    const bucket = statistics?.statistics?.emotions_by_respect;
    if (!bucket) return null;

    const totals = new Map<string, { respected: number; notRespected: number }>();
    for (const row of bucket.respected ?? []) {
      totals.set(row.emotion, { respected: row.count, notRespected: 0 });
    }
    for (const row of bucket.not_respected ?? []) {
      const current = totals.get(row.emotion) ?? { respected: 0, notRespected: 0 };
      current.notRespected = row.count;
      totals.set(row.emotion, current);
    }

    if (totals.size === 0) return null;

    const ranked = [...totals.entries()]
      .sort(
        (a, b) =>
          b[1].respected + b[1].notRespected - (a[1].respected + a[1].notRespected)
      )
      .slice(0, TOP_EMOTIONS_LIMIT);

    const hasAnyCount = ranked.some(
      ([, counts]) => counts.respected > 0 || counts.notRespected > 0
    );
    if (!hasAnyCount) return null;

    const totalOccurrences = ranked.reduce(
      (sum, [, counts]) => sum + counts.respected + counts.notRespected,
      0
    );
    totalOccurrencesRef.current = totalOccurrences;
    const emotionKeys = ranked.map(([emotion]) => emotion);
    emotionKeysRef.current = emotionKeys;

    return {
      labels: ranked.map(([emotion]) => getEmotionLabel(emotion)),
      emotionKeys,
      datasets: [
        {
          label: t('strategies:respected'),
          data: ranked.map(([, counts]) => counts.respected),
          backgroundColor: 'rgba(59, 130, 246, 0.85)',
          borderColor: '#3b82f6',
          borderWidth: 0,
          borderRadius: 4,
        },
        {
          label: t('strategies:notRespected'),
          data: ranked.map(([, counts]) => counts.notRespected),
          backgroundColor: 'rgba(236, 72, 153, 0.85)',
          borderColor: '#ec4899',
          borderWidth: 0,
          borderRadius: 4,
        },
      ],
      totalOccurrences,
    };
  }, [statistics?.statistics?.emotions_by_respect, getEmotionLabel, isLoading, t]);

  const emotionsByRespectOptions = useMemo<ChartOptions<'bar'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      onClick: (_event, elements) => {
        if (!elements.length) return;
        const { datasetIndex, index } = elements[0];
        const emotion = emotionKeysRef.current[index];
        if (!emotion) return;
        const handler = onEmotionBarClickRefLocal.current;
        handler?.current?.(emotion, datasetIndex === 0);
      },
      onHover: (event, elements) => {
        const canvas = event.native?.target as HTMLElement | undefined;
        if (canvas) {
          canvas.style.cursor = elements.length > 0 ? 'pointer' : 'default';
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: chartColors.textSecondary,
            usePointStyle: true,
            boxWidth: 8,
            font: {
              family: CHART_FONT_FAMILY,
              size: isMobile ? 10 : 12,
            },
          },
        },
        datalabels: {
          display: (context: DataLabelsContext) => {
            const value = context.dataset.data[context.dataIndex];
            return typeof value === 'number' && value > 0;
          },
          color: (context: DataLabelsContext) => {
            const value = context.dataset.data[context.dataIndex] as number;
            const yScale = context.chart.scales.y;
            const barHeight =
              yScale.getPixelForValue(value) - yScale.getPixelForValue(0);
            if (barHeight < SMALL_BAR_PIXEL_THRESHOLD) {
              return chartColors.textSecondary;
            }
            return '#ffffff';
          },
          font: {
            family: CHART_FONT_FAMILY,
            weight: 600,
            size: isMobile ? 10 : 12,
          },
          formatter: (value: number) =>
            value > 0 ? formatNumberRef.current(value, 0) : '',
          anchor: (context: DataLabelsContext) => {
            const value = context.dataset.data[context.dataIndex] as number;
            const yScale = context.chart.scales.y;
            const barHeight =
              yScale.getPixelForValue(value) - yScale.getPixelForValue(0);
            return barHeight < SMALL_BAR_PIXEL_THRESHOLD ? 'end' : 'center';
          },
          align: (context: DataLabelsContext) => {
            const value = context.dataset.data[context.dataIndex] as number;
            const yScale = context.chart.scales.y;
            const barHeight =
              yScale.getPixelForValue(value) - yScale.getPixelForValue(0);
            return barHeight < SMALL_BAR_PIXEL_THRESHOLD ? 'end' : 'center';
          },
          clamp: true,
        },
        tooltip: {
          ...buildChartTooltipPlugin(chartColors, 'lineMultiSeries', undefined, {
            callbacks: {
              title: (items: TooltipItem<'bar'>[]) => items[0]?.label ?? '',
              label: (item: TooltipItem<'bar'>) => {
                const value = item.parsed.y ?? 0;
                const datasetLabel = item.dataset.label ?? '';
                const total = totalOccurrencesRef.current;
                const percentage = total > 0 ? (value / total) * 100 : 0;
                const fn = formatNumberRef.current;
                return `${datasetLabel}: ${fn(value, 0)} (${fn(percentage, 1)}%)`;
              },
            },
          }),
        },
      },
      scales: {
        x: {
          stacked: false,
          ticks: {
            color: chartColors.textSecondary,
            maxRotation: 45,
            minRotation: 0,
            font: {
              family: CHART_FONT_FAMILY,
              size: isMobile ? 10 : 12,
            },
          },
          grid: { display: false },
          border: {
            color: chartColors.border,
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: chartColors.textSecondary,
            precision: 0,
            font: {
              family: CHART_FONT_FAMILY,
              size: isMobile ? 10 : 12,
            },
          },
          grid: {
            color: chartColors.grid,
            lineWidth: 1,
          },
          border: {
            color: chartColors.border,
            display: false,
          },
        },
      },
    }),
    [chartColors, isMobile]
  );

  const hasGainInsight =
    gainStats != null &&
    (gainStats.total_answered > 0 || gainStats.total_not_respected > 0);
  const hasEmotionsInsight = emotionsByRespectChart != null;
  const hasCompletionInsight =
    completionStats != null && completionStats.total_trades > 0;

  return {
    gainStats,
    completionStats,
    emotionsByRespectChart,
    emotionsByRespectOptions,
    hasGainInsight,
    hasEmotionsInsight,
    hasCompletionInsight,
    hasAnyInsight: hasGainInsight || hasEmotionsInsight || hasCompletionInsight,
  };
}
