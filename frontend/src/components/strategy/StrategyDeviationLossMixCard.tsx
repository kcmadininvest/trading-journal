import React, { useCallback, useMemo } from 'react';
import type { ChartOptions, TooltipItem } from 'chart.js';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '../../hooks/usePreferences';
import { maskValue } from '../../hooks/usePrivacySettings';
import { useTheme } from '../../hooks/useTheme';
import { formatCurrency as formatCurrencyUtil, formatNumber as formatNumberUtil } from '../../utils/numberFormat';
import { ChartHelpTooltip } from '../charts/ChartHelpTooltip';
import { ChartTooltipResetContainer } from '../charts/ChartTooltipResetContainer';
import { MemoizedDoughnut as Doughnut } from './charts/MemoizedCharts';
import {
  CHART_FONT_FAMILY,
  buildChartTooltipPlugin,
  STRATEGY_CHART_SECTION_SHELL_CLASS,
  type ChartColors,
} from '../../utils/chartConfig';
import { hasDeviationLossMix, type GainIfStrategyStats } from '../../hooks/useStrategyDisciplineInsights';
import type { StrategyDrillDownFilters, StrategyDrillDownRequest } from '../../utils/strategyDrillDown';

const RESIDUE_EPSILON = 0.01;

const SLICE_COLORS = {
  preventable: { light: '#d97706', dark: '#fbbf24' },
  confirmed: { light: '#e11d48', dark: '#fb7185' },
  unanswered: { light: '#64748b', dark: '#94a3b8' },
} as const;

interface StrategyDeviationLossMixCardProps {
  stats: GainIfStrategyStats | null | undefined;
  currencySymbol: string;
  chartColors: ChartColors;
  hideProfitLoss?: boolean;
  isMobile?: boolean;
  className?: string;
  onDrillDown?: (request: StrategyDrillDownRequest) => void;
}

interface LossPart {
  key: keyof typeof SLICE_COLORS;
  labelKey: string;
  titleKey: string;
  amount: number;
  sharePct: number;
  filters: StrategyDrillDownFilters;
}

function clampResidue(value: number): number {
  return Math.abs(value) < RESIDUE_EPSILON ? 0 : value;
}

export const StrategyDeviationLossMixCard: React.FC<StrategyDeviationLossMixCardProps> = React.memo(
  ({
    stats,
    currencySymbol,
    chartColors,
    hideProfitLoss = false,
    isMobile = false,
    className = '',
    onDrillDown,
  }) => {
    const { t } = useTranslation();
    const { preferences } = usePreferences();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const formatMoney = useCallback(
      (value: number) => {
        if (hideProfitLoss) return maskValue(value, currencySymbol);
        return formatCurrencyUtil(value, currencySymbol, preferences.number_format, 2);
      },
      [hideProfitLoss, currencySymbol, preferences.number_format]
    );

    const formatPct = useCallback(
      (value: number) => formatNumberUtil(value, 1, preferences.number_format),
      [preferences.number_format]
    );

    const total = stats?.losing_trades_pnl ?? 0;
    const preventable = clampResidue(stats?.would_have_won_pnl ?? 0);
    const confirmed = clampResidue(stats?.would_have_lost_pnl ?? 0);
    const unanswered = clampResidue(total - (stats?.would_have_won_pnl ?? 0) - (stats?.would_have_lost_pnl ?? 0));

    const parts: LossPart[] = useMemo(() => {
      const shareOfLoss = (amount: number) => {
        if (total === 0 || amount === 0) return 0;
        return (amount / total) * 100;
      };
      return [
        {
          key: 'preventable',
          labelKey: 'strategies:insights.preventableLosses',
          titleKey: 'strategies:drillDown.wouldHaveWonTrades',
          amount: preventable,
          sharePct: shareOfLoss(preventable),
          filters: { pnl_outcome: 'loss', gain_if_strategy_respected: true },
        },
        {
          key: 'confirmed',
          labelKey: 'strategies:insights.lossMixConfirmed',
          titleKey: 'strategies:drillDown.wouldHaveLostTrades',
          amount: confirmed,
          sharePct: shareOfLoss(confirmed),
          filters: { pnl_outcome: 'loss', gain_if_strategy_respected: false },
        },
        {
          key: 'unanswered',
          labelKey: 'strategies:insights.unansweredTrades',
          titleKey: 'strategies:drillDown.unansweredGainTrades',
          amount: unanswered,
          sharePct: shareOfLoss(unanswered),
          filters: { pnl_outcome: 'loss', gain_if_strategy_respected__isnull: true },
        },
      ];
    }, [preventable, confirmed, unanswered, total]);

    const ringParts = parts.filter((part) => part.sharePct > 0);

    const openPart = useCallback(
      (part: LossPart) => {
        if (!onDrillDown) return;
        onDrillDown({
          title: t(part.titleKey),
          filters: { strategy_respected: false, ...part.filters },
        });
      },
      [onDrillDown, t]
    );

    const chartOptions = useMemo<ChartOptions<'doughnut'>>(
      () => ({
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        onHover: (event, elements) => {
          const canvas = event.native?.target as HTMLCanvasElement | undefined;
          if (canvas) canvas.style.cursor = elements.length && onDrillDown ? 'pointer' : 'default';
        },
        onClick: (_event, elements) => {
          const index = elements[0]?.index;
          if (index == null || !onDrillDown) return;
          const part = ringParts[index];
          if (part) openPart(part);
        },
        plugins: {
          legend: { display: false },
          datalabels: {
            display: (context) => {
              if (hideProfitLoss) return false;
              const value = Number(context.dataset.data[context.dataIndex] ?? 0);
              const sum = (context.dataset.data as number[]).reduce((acc, item) => acc + Number(item), 0);
              if (!value || sum <= 0) return false;
              return (value / sum) * 100 >= 8;
            },
            color: '#ffffff',
            font: {
              family: CHART_FONT_FAMILY,
              weight: 600,
              size: isMobile ? 11 : 13,
            },
            formatter: (value: number, context) => {
              const sum = (context.dataset.data as number[]).reduce((acc, item) => acc + Number(item), 0);
              const pct = sum > 0 ? (Number(value) / sum) * 100 : 0;
              return `${formatPct(pct)}%`;
            },
          },
          tooltip: {
            ...buildChartTooltipPlugin(chartColors, 'barStackedLike', undefined, {
              callbacks: {
                label: (context: TooltipItem<'doughnut'>) => {
                  const part = ringParts[context.dataIndex];
                  if (!part) return '';
                  return `${t(part.labelKey)}: ${formatMoney(part.amount)} (${formatPct(part.sharePct)}%)`;
                },
              },
            }),
          },
        },
      }),
      [chartColors, formatMoney, formatPct, hideProfitLoss, isMobile, onDrillDown, openPart, ringParts, t]
    );

    const sliceColor = (key: LossPart['key']) => (isDark ? SLICE_COLORS[key].dark : SLICE_COLORS[key].light);

    const header = (
      <div className="mb-1 flex shrink-0 items-center gap-1.5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 sm:text-base">
          {t('strategies:insights.lossMixTitle')}
        </h3>
        <ChartHelpTooltip content={t('strategies:insights.lossMixTooltip')} />
      </div>
    );

    if (!hasDeviationLossMix(stats)) {
      return (
        <div className={`${STRATEGY_CHART_SECTION_SHELL_CLASS} flex h-full min-h-0 flex-col ${className}`}>
          {header}
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <p className="text-center text-sm text-gray-600 dark:text-gray-400">
              {t('strategies:insights.lossMixNoLosses')}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className={`${STRATEGY_CHART_SECTION_SHELL_CLASS} flex h-full min-h-0 flex-col ${className}`}>
        {header}
        <p className="mb-2 shrink-0 text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
          {t('strategies:insights.lossMixSubtitle')}
        </p>
        <div className="flex min-h-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="relative min-h-[9rem] w-full min-w-0 flex-1 [container-type:size] sm:h-full sm:min-h-0">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative aspect-square h-[min(100cqw,100cqh)] w-[min(100cqw,100cqh)] max-w-full">
                <ChartTooltipResetContainer className="absolute inset-0 h-full w-full">
                  <Doughnut
                    data={{
                      labels: ringParts.map((part) => t(part.labelKey)),
                      datasets: [
                        {
                          data: hideProfitLoss
                            ? ringParts.map(() => 1)
                            : ringParts.map((part) => Math.abs(part.amount)),
                          backgroundColor: ringParts.map((part) => sliceColor(part.key)),
                          borderWidth: 0,
                          hoverOffset: 4,
                        },
                      ],
                    }}
                    options={chartOptions}
                  />
                </ChartTooltipResetContainer>
                <div className="pointer-events-none absolute inset-[22%] flex items-center justify-center px-1 text-center">
                  <span className="text-xs font-semibold tabular-nums leading-tight text-gray-900 dark:text-gray-100 sm:text-sm">
                    {formatMoney(total)}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <ul className="flex shrink-0 flex-col justify-center gap-2 sm:w-[48%]">
            {parts.map((part) => {
              const interactive = Boolean(onDrillDown);
              const color = sliceColor(part.key);
              const body = (
                <span className="flex items-start gap-2">
                  <span
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={
                      part.sharePct > 0
                        ? { backgroundColor: color }
                        : { boxShadow: `inset 0 0 0 1.5px ${color}` }
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-snug text-gray-800 dark:text-gray-100">
                      {t(part.labelKey)}
                    </span>
                    <span className="block whitespace-nowrap text-xs tabular-nums text-gray-600 dark:text-gray-300">
                      {formatMoney(part.amount)}
                      <span className="text-gray-400 dark:text-gray-500"> · </span>
                      {formatPct(part.sharePct)}%
                    </span>
                  </span>
                </span>
              );
              return (
                <li key={part.key}>
                  {interactive ? (
                    <button
                      type="button"
                      className="w-full rounded-md py-0.5 text-left hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 dark:hover:bg-white/5 dark:focus-visible:ring-blue-500/50"
                      onClick={() => openPart(part)}
                    >
                      {body}
                    </button>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }
);

StrategyDeviationLossMixCard.displayName = 'StrategyDeviationLossMixCard';
