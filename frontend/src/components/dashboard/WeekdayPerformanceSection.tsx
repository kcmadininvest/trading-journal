import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar as ChartBar } from 'react-chartjs-2';
import { buildChartTooltipPlugin, type ChartColors } from '../../utils/chartConfig';
import { ChartTooltipResetContainer } from '../charts/ChartTooltipResetContainer';
import type { PnlDisplayMode } from '../../utils/pnlDisplay';
import {
  WEEKDAY_WIN_RATE_MIN_TRADES,
  type WeekdayPerformanceDay,
} from '../../hooks/useWeekdayPerformance';
import {
  DASHBOARD_PANEL_SHELL_CLASS,
  DASHBOARD_PNL_NEGATIVE_BAR_BG,
  DASHBOARD_PNL_NEGATIVE_BAR_BORDER,
  DASHBOARD_PNL_NEGATIVE_TEXT_CLASS,
  DASHBOARD_PNL_POSITIVE_BAR_BG,
  DASHBOARD_PNL_POSITIVE_BAR_BORDER,
  DASHBOARD_PNL_POSITIVE_TEXT_CLASS,
} from './tickerShell';

const WEEKDAY_PANEL_CLASS = `${DASHBOARD_PANEL_SHELL_CLASS} p-4 sm:p-6`;

export interface WeekdayPerformanceSectionProps {
  weekdayPerformanceData: WeekdayPerformanceDay[];
  pnlDisplayMode: PnlDisplayMode;
  chartColors: ChartColors;
  currencySymbol: string;
  formatCurrency: (value: number, currencySymbol?: string) => string;
  formatNumber: (value: number, digits?: number) => string;
  hideWeekdayChartMoneyValues: boolean;
  windowWidth: number;
  isDark: boolean;
  /** 'pnl' = performance PnL par jour ; 'winrate' = taux de réussite par jour */
  variant: 'pnl' | 'winrate';
}

function computePnlYAxisLimits(values: number[]) {
  if (values.length === 0) return { min: 0, max: 100, stepSize: 20 };

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const effectiveMin = Math.min(minValue, 0);
  const effectiveMax = Math.max(maxValue, 0);
  const effectiveRange = effectiveMax - effectiveMin;

  const targetTicks = 7;
  let step = effectiveRange / targetTicks;

  if (step === 0 || !Number.isFinite(step)) {
    step = Math.max(Math.abs(effectiveMax), Math.abs(effectiveMin), 100) / targetTicks;
  }

  const magnitude = Math.pow(10, Math.floor(Math.log10(step)));
  const normalized = step / magnitude;

  let niceStep: number;
  if (normalized <= 1) niceStep = 1;
  else if (normalized <= 2) niceStep = 2;
  else if (normalized <= 5) niceStep = 5;
  else niceStep = 10;

  const stepSize = niceStep * magnitude;

  let roundedMin = Math.floor(effectiveMin / stepSize) * stepSize;
  let roundedMax = Math.ceil(effectiveMax / stepSize) * stepSize;

  while (roundedMin > minValue) roundedMin -= stepSize;
  while (roundedMax < maxValue) roundedMax += stepSize;

  roundedMin = Math.min(roundedMin, 0);
  roundedMax = Math.max(roundedMax, 0);

  const range = roundedMax - roundedMin;
  const margin = range * 0.05;
  const adjustedMax = roundedMax + margin;
  const finalMax = Math.ceil(adjustedMax / stepSize) * stepSize;

  return { min: roundedMin, max: finalMax, stepSize };
}

export function WeekdayPerformanceSection({
  weekdayPerformanceData,
  pnlDisplayMode,
  chartColors,
  currencySymbol,
  formatCurrency,
  formatNumber,
  hideWeekdayChartMoneyValues,
  windowWidth,
  isDark,
  variant,
}: WeekdayPerformanceSectionProps) {
  const { t } = useTranslation(['dashboard', 'trades', 'common']);

  const hasTrades = weekdayPerformanceData.some((d) => d.trade_count > 0);

  const weekdayChartData = useMemo(() => {
    if (weekdayPerformanceData.length === 0) return null;
    const labels = weekdayPerformanceData.map((d) => d.day);
    const totalPnlValues = weekdayPerformanceData.map((d) => d.total_pnl);

    return {
      labels,
      datasets: [
        {
          label: t('dashboard:pnlTotalWithBasis', {
            basis: t(pnlDisplayMode === 'net' ? 'common:pnlNetShort' : 'common:pnlGrossShort'),
          }),
          data: totalPnlValues,
          backgroundColor: totalPnlValues.map((value) =>
            value >= 0 ? DASHBOARD_PNL_POSITIVE_BAR_BG : DASHBOARD_PNL_NEGATIVE_BAR_BG,
          ),
          borderColor: totalPnlValues.map((value) =>
            value >= 0 ? DASHBOARD_PNL_POSITIVE_BAR_BORDER : DASHBOARD_PNL_NEGATIVE_BAR_BORDER,
          ),
          borderWidth: 0,
          borderRadius: 0,
          borderSkipped: false,
        },
      ],
    };
  }, [weekdayPerformanceData, t, pnlDisplayMode]);

  const weekdayWinRateChartData = useMemo(() => {
    if (weekdayPerformanceData.length === 0) return null;
    const labels = weekdayPerformanceData.map((d) => d.day);
    const winRateValues = weekdayPerformanceData.map((d) => d.win_rate);

    return {
      labels,
      datasets: [
        {
          label: t('dashboard:winRatePercentage'),
          data: winRateValues,
          backgroundColor: DASHBOARD_PNL_POSITIVE_BAR_BG,
          borderColor: DASHBOARD_PNL_POSITIVE_BAR_BORDER,
          borderWidth: 0,
          borderRadius: 0,
          borderSkipped: false,
        },
      ],
    };
  }, [weekdayPerformanceData, t]);

  const weekdayYAxisLimits = useMemo(
    () =>
      weekdayPerformanceData.length > 0
        ? computePnlYAxisLimits(weekdayPerformanceData.map((d) => d.total_pnl))
        : { min: 0, max: 100, stepSize: 20 },
    [weekdayPerformanceData],
  );

  const weekdayStats = useMemo(() => {
    if (weekdayPerformanceData.length === 0) return null;
    const mostActiveDay = weekdayPerformanceData.reduce(
      (max, day) => (day.trade_count > max.trade_count ? day : max),
      weekdayPerformanceData[0],
    );
    const leastActiveDay = weekdayPerformanceData.reduce(
      (min, day) => (day.trade_count < min.trade_count ? day : min),
      weekdayPerformanceData[0],
    );

    const eligibleForWinRate = weekdayPerformanceData.filter(
      (d) => d.trade_count >= WEEKDAY_WIN_RATE_MIN_TRADES,
    );

    let bestWinRateDay: WeekdayPerformanceDay | null = null;
    let worstWinRateDay: WeekdayPerformanceDay | null = null;

    if (eligibleForWinRate.length > 0) {
      bestWinRateDay = eligibleForWinRate.reduce(
        (max, day) => (day.win_rate > max.win_rate ? day : max),
        eligibleForWinRate[0],
      );
      worstWinRateDay = eligibleForWinRate.reduce(
        (min, day) => (day.win_rate < min.win_rate ? day : min),
        eligibleForWinRate[0],
      );
    }

    return {
      mostActiveDay,
      leastActiveDay,
      bestWinRateDay,
      worstWinRateDay,
      hasWinRateSample: eligibleForWinRate.length > 0,
    };
  }, [weekdayPerformanceData]);

  if (weekdayPerformanceData.length === 0 || !hasTrades || !weekdayChartData || !weekdayWinRateChartData || !weekdayStats) {
    return null;
  }

  const pnlTooltipLines = (index: number, pnlValue: number) => {
    const dayData = weekdayPerformanceData[index];
    const lines = [
      `${t('dashboard:winRatePercentage')}: ${formatNumber(dayData.win_rate, 1)}%`,
      `${t('dashboard:numberOfTrades')}: ${dayData.trade_count}`,
    ];
    if (!hideWeekdayChartMoneyValues) {
      lines.unshift(`${t('dashboard:pnlTotal')}: ${formatCurrency(pnlValue, currencySymbol)}`);
    }
    return lines;
  };

  const winRateTooltipLines = (index: number) => {
    const dayData = weekdayPerformanceData[index];
    const lines = [
      `${t('dashboard:winRatePercentage')}: ${formatNumber(dayData.win_rate, 1)}%`,
      `${t('dashboard:numberOfTrades')}: ${dayData.trade_count}`,
    ];
    if (!hideWeekdayChartMoneyValues) {
      lines.push(`${t('dashboard:pnlTotal')}: ${formatCurrency(dayData.total_pnl, currencySymbol)}`);
    }
    return lines;
  };

  if (variant === 'pnl') {
    return (
      <div className={WEEKDAY_PANEL_CLASS}>
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-bold text-white/90">
              {t('dashboard:weeklyPerformanceTitle')}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-white/60 mb-2">
            <div className="flex items-center gap-1">
              <span>{t('dashboard:mostActive')} :</span>
              <span className={`font-medium ${DASHBOARD_PNL_POSITIVE_TEXT_CLASS}`}>
                {weekdayStats.mostActiveDay.day} ({weekdayStats.mostActiveDay.trade_count}{' '}
                {t('trades:trades')})
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span>{t('dashboard:leastActive')} :</span>
              <span className={`font-medium ${DASHBOARD_PNL_NEGATIVE_TEXT_CLASS}`}>
                {weekdayStats.leastActiveDay.day} ({weekdayStats.leastActiveDay.trade_count}{' '}
                {t('trades:trades')})
              </span>
            </div>
          </div>
        </div>

        <ChartTooltipResetContainer className="h-64 sm:h-80">
          <ChartBar
            key={`weekday-pnl-${pnlDisplayMode}`}
            data={weekdayChartData}
            plugins={[
              {
                id: 'adjustAxis',
                beforeUpdate: (chart: any) => {
                  const yScale = chart.scales.y;
                  if (yScale && weekdayYAxisLimits) {
                    yScale.min = weekdayYAxisLimits.min;
                    yScale.max = weekdayYAxisLimits.max;
                  }
                },
              },
            ]}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  ...buildChartTooltipPlugin(chartColors, 'barStackedLike', {
                    enabled: !hideWeekdayChartMoneyValues,
                  }),
                  callbacks: {
                    label(context: any) {
                      return pnlTooltipLines(context.dataIndex, context.parsed.y);
                    },
                  },
                },
                datalabels: {
                  display(context: any) {
                    if (hideWeekdayChartMoneyValues || windowWidth < 640) return false;
                    const value = context.dataset.data[context.dataIndex];
                    return value !== 0 && Math.abs(value) >= 0.01;
                  },
                  anchor(context: any) {
                    const value = context.dataset.data[context.dataIndex];
                    return value >= 0 ? 'end' : 'start';
                  },
                  align(context: any) {
                    const value = context.dataset.data[context.dataIndex];
                    return value >= 0 ? 'top' : 'bottom';
                  },
                  color: '#e2e8f0',
                  font: {
                    weight: 700,
                    size: windowWidth < 640 ? 11 : 13,
                  },
                  backgroundColor() {
                    if (windowWidth < 640) return 'rgba(15, 23, 42, 0.75)';
                    return 'transparent';
                  },
                  padding: windowWidth < 640 ? 4 : 0,
                  borderRadius: windowWidth < 640 ? 4 : 0,
                  formatter(_value: any, context: any) {
                    const actualValue = context.dataset.data[context.dataIndex] ?? 0;
                    return formatCurrency(actualValue, currencySymbol);
                  },
                  clamp: true,
                },
              },
              scales: {
                x: {
                  grid: { display: false },
                  ticks: { color: 'rgba(255, 255, 255, 0.55)', font: { size: 12 } },
                  border: { color: 'rgba(255, 255, 255, 0.12)' },
                  title: { display: false },
                },
                y: {
                  type: 'linear',
                  display: true,
                  position: 'left',
                  beginAtZero: false,
                  min: weekdayYAxisLimits.min,
                  max: weekdayYAxisLimits.max,
                  grid: {
                    color(context: any) {
                      if (Math.abs(context.tick.value) < 0.0001) {
                        return 'rgba(255, 255, 255, 0.35)';
                      }
                      return 'rgba(255, 255, 255, 0.08)';
                    },
                    lineWidth: 1,
                  },
                  ticks: {
                    display: !hideWeekdayChartMoneyValues,
                    callback(value: number | string) {
                      return formatCurrency(Number(value), currencySymbol);
                    },
                    color: 'rgba(255, 255, 255, 0.55)',
                    font: { size: 11 },
                    stepSize: weekdayYAxisLimits.stepSize,
                    maxTicksLimit: 10,
                    padding: 5,
                  },
                  border: { color: 'rgba(255, 255, 255, 0.12)', display: false },
                },
              },
              animation: { duration: 1000, easing: 'easeInOutQuart' },
            }}
          />
        </ChartTooltipResetContainer>
      </div>
    );
  }

  return (
    <div className={WEEKDAY_PANEL_CLASS}>
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-bold text-white/90">
            {t('dashboard:winRateByWeekdayTitle')}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-white/60 mb-2">
          {weekdayStats.hasWinRateSample && weekdayStats.bestWinRateDay && (
            <div className="flex items-center gap-1">
              <span>{t('dashboard:bestWinRateDay')} :</span>
              <span className={`font-medium ${DASHBOARD_PNL_POSITIVE_TEXT_CLASS}`}>
                {weekdayStats.bestWinRateDay.day} (
                {formatNumber(weekdayStats.bestWinRateDay.win_rate, 1)}% —{' '}
                {weekdayStats.bestWinRateDay.trade_count} {t('trades:trades')})
              </span>
            </div>
          )}
          {weekdayStats.hasWinRateSample && weekdayStats.worstWinRateDay && (
            <div className="flex items-center gap-1">
              <span>{t('dashboard:worstWinRateDay')} :</span>
              <span className={`font-medium ${DASHBOARD_PNL_NEGATIVE_TEXT_CLASS}`}>
                {weekdayStats.worstWinRateDay.day} (
                {formatNumber(weekdayStats.worstWinRateDay.win_rate, 1)}% —{' '}
                {weekdayStats.worstWinRateDay.trade_count} {t('trades:trades')})
              </span>
            </div>
          )}
          {!weekdayStats.hasWinRateSample && (
            <div className="flex items-center gap-1 text-white/50">
              <span>{t('dashboard:weekdayWinRateInsufficientSample', { count: WEEKDAY_WIN_RATE_MIN_TRADES })}</span>
            </div>
          )}
        </div>
      </div>

      <ChartTooltipResetContainer className="h-64 sm:h-80">
        <ChartBar
          key={`weekday-winrate-${pnlDisplayMode}`}
          data={weekdayWinRateChartData}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                ...buildChartTooltipPlugin(chartColors, 'barStackedLike', { enabled: true }),
                callbacks: {
                  label(context: any) {
                    return winRateTooltipLines(context.dataIndex);
                  },
                },
              },
              datalabels: {
                display() {
                  return windowWidth >= 640;
                },
                anchor: 'end' as const,
                align: 'top' as const,
                color: '#e2e8f0',
                font: {
                  weight: 700,
                  size: windowWidth < 640 ? 11 : 13,
                },
                backgroundColor() {
                  if (windowWidth < 640) return 'rgba(15, 23, 42, 0.75)';
                  return 'transparent';
                },
                padding: windowWidth < 640 ? 4 : 0,
                borderRadius: windowWidth < 640 ? 4 : 0,
                formatter(_value: any, context: any) {
                  const actualValue = context.dataset.data[context.dataIndex] ?? 0;
                  return `${formatNumber(actualValue, 1)}%`;
                },
                clamp: true,
              },
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: { color: 'rgba(255, 255, 255, 0.55)', font: { size: 12 } },
                border: { color: 'rgba(255, 255, 255, 0.12)' },
                title: { display: false },
              },
              y: {
                type: 'linear',
                display: true,
                position: 'left',
                beginAtZero: true,
                min: 0,
                max: 100,
                grid: {
                  color: 'rgba(255, 255, 255, 0.08)',
                  lineWidth: 1,
                },
                ticks: {
                  callback(value: number | string) {
                    return `${formatNumber(Number(value), 0)}%`;
                  },
                  color: 'rgba(255, 255, 255, 0.55)',
                  font: { size: 11 },
                  stepSize: 20,
                  maxTicksLimit: 6,
                  padding: 5,
                },
                border: { color: 'rgba(255, 255, 255, 0.12)', display: false },
              },
            },
            animation: { duration: 1000, easing: 'easeInOutQuart' },
          }}
        />
      </ChartTooltipResetContainer>
    </div>
  );
}
