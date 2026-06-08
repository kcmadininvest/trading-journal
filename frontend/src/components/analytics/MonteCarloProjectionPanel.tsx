import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '../../hooks/usePreferences';
import { useMonteCarloProjection } from '../../hooks/useMonteCarloProjection';
import { formatCurrency, formatNumber } from '../../utils/numberFormat';
import {
  ANALYTICS_CHART_BODY_CLASS,
  ANALYTICS_CHART_HEADER_CLASS,
  buildChartTooltipPlugin,
  CHART_FONT_FAMILY,
  getChartSvgFontSizes,
  type ChartColors,
} from '../../utils/chartConfig';
import { ChartTooltipResetContainer } from '../charts/ChartTooltipResetContainer';
import { ChartHelpTooltip } from '../charts/ChartHelpTooltip';
import {
  computeTargetRiskUnits,
  estimateWeeks,
  MONTE_CARLO_DEFAULTS,
} from '../../utils/monteCarloSimulation';
import { buildMonteCarloNarrative } from '../../utils/monteCarloNarrative';
import type { LanguageType } from '../../utils/dateFormat';
import { NumberInputStepper } from '../common/NumberInputStepper';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  ChartTooltip,
  ChartLegend,
  Filler,
);

interface MonteCarloProjectionPanelProps {
  accountId: number | null | undefined;
  currentBalance: number;
  currencySymbol: string;
  chartColors: ChartColors;
  hideProfitLoss?: boolean;
  defaultTarget?: number | null;
  enabled: boolean;
}

const SCENARIO_COLORS = {
  optimistic: '#34d399',
  median: '#818cf8',
  prudent: '#fbbf24',
  target: '#34d399',
  danger: '#fb7185',
} as const;

type MilestoneColorStop = { t: number; h: number; s: number; l: number };

const MILESTONE_COLOR_STOPS: MilestoneColorStop[] = [
  { t: 0, h: 234, s: 89, l: 67 },
  { t: 0.45, h: 199, s: 89, l: 58 },
  { t: 1, h: 158, s: 64, l: 52 },
];

const PANEL_CARD_CLASS =
  'bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700';

const CHARTS_ROW_CARD_CLASS = `${PANEL_CARD_CLASS} p-5 flex flex-col h-full min-h-[400px]`;

const MONTE_CARLO_NUMBER_INPUT_CLASS =
  'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 py-2.5 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500';

/** Bornes Y arrondies + pas régulier (évite des ticks comme 675 ou 5616 en bord d'axe). */
function computeNiceMoneyAxisBounds(
  values: number[],
  targetTicks = 6,
): { min: number; max: number; stepSize: number } {
  if (values.length === 0) {
    return { min: 0, max: 1000, stepSize: 200 };
  }

  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const span = dataMax - dataMin;
  const padding = Math.max(span * 0.06, 50);
  const effectiveMin = Math.max(0, dataMin - padding);
  const effectiveMax = dataMax + padding;
  const effectiveRange = effectiveMax - effectiveMin;

  let step = effectiveRange / targetTicks;
  if (step === 0 || !Number.isFinite(step)) {
    step = Math.max(Math.abs(effectiveMax), 100) / targetTicks;
  }

  const magnitude = 10 ** Math.floor(Math.log10(step));
  const normalized = step / magnitude;
  let niceStep: number;
  if (normalized <= 1) niceStep = 1;
  else if (normalized <= 2) niceStep = 2;
  else if (normalized <= 5) niceStep = 5;
  else niceStep = 10;

  const stepSize = niceStep * magnitude;
  let roundedMin = Math.floor(effectiveMin / stepSize) * stepSize;
  let roundedMax = Math.ceil(effectiveMax / stepSize) * stepSize;

  while (roundedMin > effectiveMin) roundedMin -= stepSize;
  while (roundedMax < effectiveMax) roundedMax += stepSize;

  return { min: Math.max(0, roundedMin), max: roundedMax, stepSize };
}

const SCENARIO_LEGEND = [
  { key: 'optimistic', color: SCENARIO_COLORS.optimistic, dash: false },
  { key: 'median', color: SCENARIO_COLORS.median, dash: true },
  { key: 'prudent', color: SCENARIO_COLORS.prudent, dash: true },
] as const;

function milestoneColor(pct: number): string {
  const ratio = Math.min(Math.max(pct / 100, 0), 1);
  let lower = MILESTONE_COLOR_STOPS[0];
  let upper = MILESTONE_COLOR_STOPS[MILESTONE_COLOR_STOPS.length - 1];

  for (let i = 0; i < MILESTONE_COLOR_STOPS.length - 1; i += 1) {
    if (ratio >= MILESTONE_COLOR_STOPS[i].t && ratio <= MILESTONE_COLOR_STOPS[i + 1].t) {
      lower = MILESTONE_COLOR_STOPS[i];
      upper = MILESTONE_COLOR_STOPS[i + 1];
      break;
    }
  }

  const span = upper.t - lower.t || 1;
  const local = (ratio - lower.t) / span;
  const h = lower.h + (upper.h - lower.h) * local;
  const s = lower.s + (upper.s - lower.s) * local;
  const l = lower.l + (upper.l - lower.l) * local;
  return `hsl(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%)`;
}

export const MonteCarloProjectionPanel: React.FC<MonteCarloProjectionPanelProps> = ({
  accountId,
  currentBalance,
  currencySymbol,
  chartColors,
  hideProfitLoss = false,
  defaultTarget = null,
  enabled,
}) => {
  const { t } = useTranslation();
  const { preferences } = usePreferences();
  const [targetInput, setTargetInput] = useState<string>('');
  const [sizingEnabled, setSizingEnabled] = useState(false);
  const [sizingExpanded, setSizingExpanded] = useState(false);
  const [lotsInput, setLotsInput] = useState<string>('1');
  const [pointValueInput, setPointValueInput] = useState<string>('2');

  useEffect(() => {
    if (defaultTarget != null && defaultTarget > currentBalance) {
      setTargetInput(String(Math.round(defaultTarget)));
    }
  }, [defaultTarget, currentBalance]);

  const parsedTarget = useMemo(() => {
    const trimmed = targetInput.trim();
    if (!trimmed) return null;
    const value = Number(trimmed);
    return Number.isFinite(value) ? value : null;
  }, [targetInput]);

  const parsedLots = useMemo(() => {
    const trimmed = lotsInput.trim();
    if (!trimmed) return null;
    const value = Number(trimmed);
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [lotsInput]);

  const parsedPointValue = useMemo(() => {
    const trimmed = pointValueInput.trim();
    if (!trimmed) return null;
    const value = Number(trimmed);
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [pointValueInput]);

  const {
    dailyStats,
    exposureInputs,
    exposureRatio,
    isExposureAdjusted,
    simulation,
    curves,
    milestones,
    isLoadingData,
    isSimulating,
    dataError,
    warning,
    validationError,
  } = useMonteCarloProjection({
    accountId,
    currentBalance,
    targetBalance: parsedTarget,
    enabled,
    sizingEnabled,
    targetLots: parsedLots,
    targetPointValue: parsedPointValue,
  });

  const targetRiskUnits = useMemo(() => {
    if (parsedLots == null || parsedPointValue == null) return null;
    return computeTargetRiskUnits(parsedLots, parsedPointValue);
  }, [parsedLots, parsedPointValue]);

  const chartFontSizes = useMemo(
    () => getChartSvgFontSizes(preferences.font_size),
    [preferences.font_size],
  );

  const formatMoney = useMemo(
    () => (value: number, digits = 0) => {
      if (hideProfitLoss) return '••••';
      return formatCurrency(value, currencySymbol, preferences.number_format, digits);
    },
    [hideProfitLoss, currencySymbol, preferences.number_format],
  );

  const formatDayCount = useCallback(
    (days: number | null) => {
      if (days == null || days < 0) return '—';
      const value = formatNumber(Math.round(days), 0, preferences.number_format);
      return `~${value} ${t('analytics:monteCarlo.days')}`;
    },
    [preferences.number_format, t],
  );

  const formatWeekCount = useCallback(
    (days: number | null) => {
      const weeks = estimateWeeks(days, dailyStats?.tradingDaysPerWeek ?? 1);
      if (weeks == null || weeks < 1) return '—';
      const value = formatNumber(weeks, 0, preferences.number_format);
      return `~${value} ${t('analytics:monteCarlo.weeks')}`;
    },
    [dailyStats?.tradingDaysPerWeek, preferences.number_format, t],
  );

  const dangerThreshold = currentBalance * MONTE_CARLO_DEFAULTS.DANGER_THRESHOLD_RATIO;

  const chartData = useMemo(() => {
    if (!curves || parsedTarget == null) return null;

    return {
      labels: curves.labels.map((day) => day),
      datasets: [
        {
          label: t('analytics:monteCarlo.scenarios.optimistic'),
          data: curves.optimistic,
          borderColor: SCENARIO_COLORS.optimistic,
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          pointRadius: 0,
          pointHitRadius: 8,
          tension: 0.05,
          order: 1,
        },
        {
          label: t('analytics:monteCarlo.scenarios.median'),
          data: curves.median,
          borderColor: SCENARIO_COLORS.median,
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [6, 3],
          pointRadius: 0,
          pointHitRadius: 8,
          tension: 0.05,
          order: 2,
        },
        {
          label: t('analytics:monteCarlo.scenarios.prudent'),
          data: curves.prudent,
          borderColor: SCENARIO_COLORS.prudent,
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [3, 3],
          pointRadius: 0,
          pointHitRadius: 8,
          tension: 0.05,
          order: 3,
        },
        {
          label: t('analytics:monteCarlo.targetLine'),
          data: curves.labels.map(() => parsedTarget),
          borderColor: `${SCENARIO_COLORS.target}99`,
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderDash: [6, 4],
          pointRadius: 0,
          pointHitRadius: 0,
          tension: 0,
          order: 4,
        },
        {
          label: t('analytics:monteCarlo.dangerLine'),
          data: curves.labels.map(() => dangerThreshold),
          borderColor: `${SCENARIO_COLORS.danger}99`,
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderDash: [6, 4],
          pointRadius: 0,
          pointHitRadius: 0,
          tension: 0,
          order: 5,
        },
      ],
    };
  }, [curves, parsedTarget, dangerThreshold, t]);

  const yAxisBounds = useMemo(() => {
    if (!curves || parsedTarget == null) {
      return computeNiceMoneyAxisBounds([currentBalance, dangerThreshold]);
    }

    return computeNiceMoneyAxisBounds([
      currentBalance,
      parsedTarget,
      dangerThreshold,
      ...curves.optimistic,
      ...curves.median,
      ...curves.prudent,
    ]);
  }, [curves, currentBalance, dangerThreshold, parsedTarget]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      interaction: { mode: 'index' as const, intersect: false },
      plugins: {
        datalabels: { display: false },
        legend: { display: false },
        tooltip: buildChartTooltipPlugin(chartColors, 'lineMultiSeries', { enabled: true }, {
          filter: (item: { datasetIndex?: number }) => (item.datasetIndex ?? 0) < 3,
          callbacks: {
            title: (items: Array<{ dataIndex: number }>) => {
              const index = items[0]?.dataIndex ?? 0;
              return t('analytics:monteCarlo.dayLabel', {
                day: formatNumber(index, 0, preferences.number_format),
              });
            },
            label: (context: { dataset: { label?: string }; parsed: { y: number | null } }) => {
              const value = context.parsed.y;
              if (value == null) return '';
              return `${context.dataset.label}: ${formatMoney(value)}`;
            },
          },
        }),
      },
      scales: {
        x: {
          grid: { color: chartColors.grid, drawOnChartArea: true },
          ticks: {
            color: chartColors.textSecondary,
            font: { family: CHART_FONT_FAMILY, size: chartFontSizes.axis },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 10,
            callback: (_value: string | number, index: number) => {
              const day = curves?.labels[index];
              if (day == null) return '';
              return day % 20 === 0 ? `J${day}` : '';
            },
          },
        },
        y: {
          min: yAxisBounds.min,
          max: yAxisBounds.max,
          grid: { color: chartColors.grid },
          ticks: {
            color: chartColors.textSecondary,
            font: { family: CHART_FONT_FAMILY, size: chartFontSizes.axis },
            stepSize: yAxisBounds.stepSize,
            callback: (value: string | number) => formatMoney(Number(value)),
          },
        },
      },
    }),
    [chartColors, chartFontSizes, curves?.labels, formatMoney, preferences.number_format, t, yAxisBounds],
  );

  const formattedSimCount = formatNumber(
    MONTE_CARLO_DEFAULTS.N_SIMULATIONS,
    0,
    preferences.number_format,
  );

  const narrative = useMemo(() => {
    if (!simulation || parsedTarget == null || !dailyStats) return null;

    return buildMonteCarloNarrative({
      simulation,
      currentBalance,
      targetBalance: parsedTarget,
      nextMilestone: milestones[0] ?? null,
      mu: dailyStats.mu,
      sigma: dailyStats.sigma,
      tradingDaysPerWeek: dailyStats.tradingDaysPerWeek,
      tradingDayCount: dailyStats.tradingDayCount,
      isExposureAdjusted,
      exposureRatio,
      language: preferences.language as LanguageType,
      t,
      formatNumber: (value, digits = 2) => formatNumber(value, digits, preferences.number_format),
      formatTarget: (value) => formatMoney(value),
      formatMoney,
      formatDayCount,
      formatWeekCount,
    });
  }, [
    simulation,
    currentBalance,
    parsedTarget,
    milestones,
    dailyStats,
    isExposureAdjusted,
    exposureRatio,
    preferences.language,
    preferences.number_format,
    t,
    formatMoney,
    formatDayCount,
    formatWeekCount,
  ]);

  const summaryCards = [
    {
      key: 'median',
      title: t('analytics:monteCarlo.cards.median'),
      tooltip: t('analytics:monteCarlo.cards.medianTooltip'),
      hint: t('analytics:monteCarlo.cards.medianHint'),
      days: simulation?.median ?? null,
      color: SCENARIO_COLORS.median,
    },
    {
      key: 'optimistic',
      title: t('analytics:monteCarlo.cards.optimistic'),
      tooltip: t('analytics:monteCarlo.cards.optimisticTooltip'),
      hint: t('analytics:monteCarlo.cards.optimisticHint'),
      days: simulation?.p25 ?? null,
      color: SCENARIO_COLORS.optimistic,
    },
    {
      key: 'prudent',
      title: t('analytics:monteCarlo.cards.prudent'),
      tooltip: t('analytics:monteCarlo.cards.prudentTooltip'),
      hint: t('analytics:monteCarlo.cards.prudentHint'),
      days: simulation?.p75 ?? null,
      color: SCENARIO_COLORS.prudent,
    },
    {
      key: 'probability',
      title: `${t('analytics:monteCarlo.cards.probability')} (${t('analytics:monteCarlo.cards.probabilitySims', { simCount: formattedSimCount })})`,
      tooltip: t('analytics:monteCarlo.cards.probabilityTooltip', { simCount: formattedSimCount }),
      days: null,
      probability: simulation?.successRate ?? null,
      color: '#818cf8',
    },
  ];

  if (!accountId) {
    return (
      <div className={`${PANEL_CARD_CLASS} p-6`}>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('analytics:monteCarlo.noAccount')}
        </p>
      </div>
    );
  }

  const isBusy = isLoadingData || isSimulating;

  return (
    <div className="space-y-5">
      {/* Panneau de contrôle compact */}
      <div className={`${PANEL_CARD_CLASS} overflow-hidden`}>
        <div className={`${ANALYTICS_CHART_HEADER_CLASS} px-5 pt-5 pb-0`}>
          <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-blue-600 rounded-full mr-3" />
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            {t('analytics:monteCarlo.title')}
          </h3>
          <ChartHelpTooltip content={t('analytics:monteCarlo.tooltip')} />
        </div>

        <div className="px-5 py-4 flex flex-col xl:flex-row xl:items-stretch gap-5">
          <div className="xl:w-72 shrink-0">
            <label
              htmlFor="monte-carlo-target"
              className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5"
            >
              {t('analytics:monteCarlo.targetLabel')}
            </label>
            <div className="relative">
              {currencySymbol && (
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500">
                  {currencySymbol}
                </span>
              )}
              <NumberInputStepper
                id="monte-carlo-target"
                min={currentBalance + 1}
                step={1}
                digits={0}
                value={targetInput}
                onChange={setTargetInput}
                placeholder={t('analytics:monteCarlo.targetPlaceholder')}
                inputClassName={`${MONTE_CARLO_NUMBER_INPUT_CLASS} ${currencySymbol ? 'pl-9' : 'pl-3'}`}
              />
            </div>
            {validationError === 'targetTooLow' && (
              <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                {t('analytics:monteCarlo.errors.targetTooLow')}
              </p>
            )}
          </div>

          <div className="hidden xl:block w-px bg-gray-200 dark:bg-gray-700 shrink-0" />

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 px-4 py-3">
              <p className="text-xs text-indigo-600 dark:text-indigo-300 font-medium">
                {t('analytics:monteCarlo.currentBalance')}
              </p>
              <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                {formatMoney(currentBalance)}
              </p>
            </div>
            {dailyStats && (
              <>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 px-4 py-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('analytics:monteCarlo.muLabel')}</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                    {formatMoney(dailyStats.mu)}
                    <span className="text-xs font-normal text-gray-500 dark:text-gray-400">/j</span>
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 px-4 py-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('analytics:monteCarlo.sigmaLabel')}</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                    {formatMoney(dailyStats.sigma)}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 px-4 py-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('analytics:monteCarlo.daysPerWeekLabel')}</p>
                  <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                    {formatNumber(dailyStats.tradingDaysPerWeek, 1, preferences.number_format)}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="px-5 pb-4 border-t border-gray-100 dark:border-gray-700/80">
          <div
            className={`mt-4 rounded-xl border-2 transition-all duration-200 ${
              sizingEnabled
                ? 'border-indigo-300 dark:border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/25 shadow-sm'
                : 'border-dashed border-indigo-200 dark:border-indigo-700/70 bg-gradient-to-br from-indigo-50/90 via-white to-sky-50/50 dark:from-indigo-950/40 dark:via-gray-900/30 dark:to-sky-950/20 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md'
            }`}
          >
            <div className="flex items-start sm:items-center gap-2 px-4 py-3.5">
              {!sizingEnabled ? (
                <button
                  type="button"
                  onClick={() => {
                    setSizingEnabled(true);
                    setSizingExpanded(true);
                  }}
                  aria-label={t('analytics:monteCarlo.sizing.enable')}
                  className="flex flex-1 items-start sm:items-center gap-3 min-w-0 text-left cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 rounded-lg"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 transition-colors group-hover:bg-indigo-200 dark:bg-indigo-900/60 dark:text-indigo-300 dark:group-hover:bg-indigo-800/70"
                    aria-hidden
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                      />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {t('analytics:monteCarlo.sizing.sectionTitle')}
                      </p>
                      <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700 dark:bg-indigo-900/70 dark:text-indigo-200">
                        {t('analytics:monteCarlo.sizing.optionalBadge')}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      {t('analytics:monteCarlo.sizing.sectionTeaser')}
                    </p>
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSizingExpanded((prev) => !prev)}
                  aria-expanded={sizingExpanded}
                  aria-label={
                    sizingExpanded
                      ? t('analytics:monteCarlo.sizing.collapseDetails')
                      : t('analytics:monteCarlo.sizing.expandDetails')
                  }
                  className="flex flex-1 items-start sm:items-center gap-3 min-w-0 text-left cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 rounded-lg"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-white"
                    aria-hidden
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                      />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {t('analytics:monteCarlo.sizing.sectionTitle')}
                    </p>
                    <p className="mt-0.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      {sizingExpanded
                        ? t('analytics:monteCarlo.sizing.sectionActive')
                        : targetRiskUnits != null && parsedLots != null && parsedPointValue != null
                          ? t('analytics:monteCarlo.sizing.sectionCollapsed', {
                              lots: formatNumber(parsedLots, 2, preferences.number_format),
                              pointValue: formatNumber(parsedPointValue, 2, preferences.number_format),
                              exposure: formatNumber(targetRiskUnits, 2, preferences.number_format),
                            })
                          : t('analytics:monteCarlo.sizing.sectionActive')}
                    </p>
                  </div>
                </button>
              )}

              {sizingEnabled && (
                <button
                  type="button"
                  onClick={() => setSizingExpanded((prev) => !prev)}
                  aria-expanded={sizingExpanded}
                  aria-label={
                    sizingExpanded
                      ? t('analytics:monteCarlo.sizing.collapseDetails')
                      : t('analytics:monteCarlo.sizing.expandDetails')
                  }
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  <svg
                    className={`h-4 w-4 transition-transform duration-200 ${sizingExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}

              <button
                type="button"
                role="switch"
                aria-checked={sizingEnabled}
                aria-label={t('analytics:monteCarlo.sizing.enable')}
                onClick={() => {
                  setSizingEnabled((prev) => {
                    const next = !prev;
                    if (next) {
                      setSizingExpanded(true);
                    } else {
                      setSizingExpanded(false);
                    }
                    return next;
                  });
                }}
                className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2 rounded-lg p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800"
              >
                <span className="hidden sm:inline text-xs font-medium text-indigo-600 dark:text-indigo-300">
                  {sizingEnabled
                    ? t('analytics:monteCarlo.sizing.toggleOff')
                    : t('analytics:monteCarlo.sizing.toggleOn')}
                </span>
                <span
                  className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                    sizingEnabled ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                      sizingEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </span>
              </button>
            </div>

            {sizingEnabled && sizingExpanded && (
            <div
              className="space-y-3 border-t border-indigo-200/80 dark:border-indigo-800/60 px-4 pb-4 pt-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
                <div>
                  <label
                    htmlFor="monte-carlo-lots"
                    className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5"
                  >
                    {t('analytics:monteCarlo.sizing.lotsLabel')}
                  </label>
                  <NumberInputStepper
                    id="monte-carlo-lots"
                    min={0.01}
                    step={0.01}
                    digits={2}
                    value={lotsInput}
                    onChange={setLotsInput}
                    inputClassName={`${MONTE_CARLO_NUMBER_INPUT_CLASS} pl-3 py-2`}
                  />
                </div>
                <div>
                  <label
                    htmlFor="monte-carlo-point-value"
                    className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5"
                  >
                    {t('analytics:monteCarlo.sizing.pointValueLabel')}
                  </label>
                  <NumberInputStepper
                    id="monte-carlo-point-value"
                    min={0.01}
                    step={0.01}
                    digits={2}
                    value={pointValueInput}
                    onChange={setPointValueInput}
                    placeholder="2"
                    inputClassName={`${MONTE_CARLO_NUMBER_INPUT_CLASS} pl-3 py-2`}
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t('analytics:monteCarlo.sizing.hintMNQ')}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-sm">
                {targetRiskUnits != null && (
                  <p className="text-gray-700 dark:text-gray-300">
                    <span className="text-gray-500 dark:text-gray-400">
                      {t('analytics:monteCarlo.sizing.targetExposure')}:
                    </span>{' '}
                    <span className="font-semibold tabular-nums">
                      {formatNumber(targetRiskUnits, 2, preferences.number_format)}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400"> $/pt</span>
                  </p>
                )}
                {exposureInputs?.medianRiskUnits != null && (
                  <p className="text-gray-700 dark:text-gray-300">
                    <span className="text-gray-500 dark:text-gray-400">
                      {t('analytics:monteCarlo.sizing.historicalMedian')}:
                    </span>{' '}
                    <span className="font-semibold tabular-nums">
                      {formatNumber(exposureInputs.medianRiskUnits, 2, preferences.number_format)}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400"> $/pt</span>
                  </p>
                )}
              </div>

              {isExposureAdjusted && (
                <p className="text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg px-3 py-2">
                  {exposureRatio === 1
                    ? t('analytics:monteCarlo.sizing.ratioNeutral')
                    : t('analytics:monteCarlo.sizing.ratioApplied', {
                        ratio: formatNumber(exposureRatio, 2, preferences.number_format),
                      })}
                </p>
              )}

              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('analytics:monteCarlo.sizing.assumptionNote')}
              </p>
            </div>
            )}
          </div>
        </div>

        {isBusy && (
          <div className="px-5 pb-4 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            {t('analytics:monteCarlo.loading')}
          </div>
        )}
      </div>

      {dataError && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {t('analytics:monteCarlo.errors.loadFailed')}
        </div>
      )}

      {warning === 'insufficientData' && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          {t('analytics:monteCarlo.errors.insufficientData')}
        </div>
      )}

      {warning === 'negativeMu' && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          {t('analytics:monteCarlo.errors.negativeMu')}
        </div>
      )}

      {warning === 'insufficientExposureData' && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          {t('analytics:monteCarlo.sizing.errors.insufficientExposureData')}
        </div>
      )}

      {!warning && !validationError && simulation && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {summaryCards.map((card) => (
            <div
              key={card.key}
              className={`${PANEL_CARD_CLASS} p-4 border-t-[3px]`}
              style={{ borderTopColor: card.color }}
            >
              <div className="flex items-start gap-1.5">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 leading-tight flex-1 min-w-0">
                  {card.title}
                </p>
                {card.tooltip ? (
                  <ChartHelpTooltip content={card.tooltip} position="top" />
                ) : null}
              </div>
              {card.key === 'probability' ? (
                <>
                  <p className="mt-2 text-2xl font-bold tabular-nums" style={{ color: card.color }}>
                    {card.probability != null
                      ? `${formatNumber(card.probability, 1, preferences.number_format)}%`
                      : '—'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {t('analytics:monteCarlo.probabilityHint')}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-xl font-bold tabular-nums" style={{ color: card.color }}>
                    {formatDayCount(card.days)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                    {card.hint ?? formatWeekCount(card.days)}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {chartData && milestones.length > 0 && !warning && !validationError && (
        <div className="space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
          <div className={CHARTS_ROW_CARD_CLASS}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-1 h-5 bg-gradient-to-b from-indigo-400 to-emerald-400 rounded-full shrink-0" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                {t('analytics:monteCarlo.chartTitle')}
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mb-3">
              {SCENARIO_LEGEND.map((item) => (
                <span key={item.key} className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                  <svg width="16" height="6" aria-hidden className="shrink-0">
                    <line
                      x1="0"
                      y1="3"
                      x2="16"
                      y2="3"
                      stroke={item.color}
                      strokeWidth="2"
                      strokeDasharray={item.dash ? '3 2' : undefined}
                    />
                  </svg>
                  {t(`analytics:monteCarlo.scenarios.${item.key}`)}
                </span>
              ))}
              <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                <span className="inline-block w-4 border-t border-dashed" style={{ borderColor: SCENARIO_COLORS.target }} />
                {t('analytics:monteCarlo.targetLine')}
              </span>
              <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                <span className="inline-block w-4 border-t border-dashed" style={{ borderColor: SCENARIO_COLORS.danger }} />
                {t('analytics:monteCarlo.dangerLine')}
              </span>
            </div>
            <ChartTooltipResetContainer className={`${ANALYTICS_CHART_BODY_CLASS} flex-1 !min-h-[280px] min-h-0`}>
              <Line data={chartData} options={chartOptions} />
            </ChartTooltipResetContainer>
          </div>

          <div className={CHARTS_ROW_CARD_CLASS}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-5 bg-gradient-to-b from-indigo-400 via-sky-400 to-emerald-400 rounded-full shrink-0" />
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                {t('analytics:monteCarlo.milestonesTitle')}
              </h3>
            </div>
            <div className="flex-1 flex flex-col justify-center gap-3 min-h-0">
              {milestones.map((milestone, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[4.5rem_1fr] lg:grid-cols-[5rem_1fr_auto] items-center gap-2 lg:gap-3"
                >
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 tabular-nums">
                    {formatMoney(milestone.balance)}
                  </span>
                  <div className="h-2.5 rounded-full bg-gray-100/80 dark:bg-gray-700/80 overflow-hidden lg:col-span-1">
                    <div
                      className="h-full rounded-full transition-all duration-500 shadow-sm"
                      style={{
                        width: `${milestone.pct}%`,
                        background: `linear-gradient(90deg, ${milestoneColor(Math.max(0, milestone.pct - 18))}, ${milestoneColor(milestone.pct)})`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap col-span-2 lg:col-span-1 lg:text-right">
                    {formatDayCount(milestone.daysEstimate)} · {formatWeekCount(milestone.daysEstimate)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {narrative && narrative.sections.length > 0 && (
          <div className={`${PANEL_CARD_CLASS} p-5 border-l-4 border-l-indigo-400 dark:border-l-indigo-500`}>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
              {t('analytics:monteCarlo.narrative.title')}
            </h3>
            <div className="space-y-4">
              {narrative.sections.map((section, index) => (
                <p
                  key={index}
                  className={`text-sm leading-relaxed ${
                    section.muted
                      ? 'text-gray-500 dark:text-gray-400'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span
                    className={`font-semibold ${
                      section.muted
                        ? 'text-gray-600 dark:text-gray-400'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {t(section.labelKey)} :
                  </span>
                  {' '}
                  {section.text}
                </p>
              ))}
            </div>
          </div>
        )}
        </div>
      )}
    </div>
  );
};
