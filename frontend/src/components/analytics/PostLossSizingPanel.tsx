import React, { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import TooltipComponent from '../ui/Tooltip';
import { ChartTooltipResetContainer } from '../charts/ChartTooltipResetContainer';
import { CHART_FONT_FAMILY, buildChartTooltipPlugin, type ChartColors } from '../../utils/chartConfig';
import type {
  PostLossSizingBaseline,
  PostLossSizingData,
  PostTradeSizingI18nPrefix,
  PostWinSizingData,
} from '../../hooks/useStatistics';
import { PostTradeSizingKpiBar } from './PostTradeSizingKpiBar';

type SizeCategory = 'larger' | 'equal' | 'smaller';

const CATEGORIES: SizeCategory[] = ['larger', 'equal', 'smaller'];

type QualityLevel = 'good' | 'neutral' | 'bad';

const CATEGORY_QUALITY: Record<SizeCategory, QualityLevel> = {
  larger: 'bad',
  equal: 'neutral',
  smaller: 'good',
};

const QUALITY_BADGE_CLASS: Record<QualityLevel, string> = {
  good: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800',
  neutral: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-700/40 dark:text-gray-200 dark:border-gray-600',
  bad: 'bg-pink-50 text-pink-800 border-pink-200 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-800',
};

const INTERPRETATION_DESC_KEY: Record<SizeCategory, 'largerDesc' | 'equalDesc' | 'smallerDesc'> = {
  larger: 'largerDesc',
  equal: 'equalDesc',
  smaller: 'smallerDesc',
};

/** Palette alignée sur TradesDistributionChart (rgba + bordures). */
const DOUGHNUT_SEGMENT_STYLES = {
  larger: {
    background: { light: 'rgba(236, 72, 153, 0.7)', dark: 'rgba(236, 72, 153, 0.8)' },
    border: { light: '#ec4899', dark: '#f472b6' },
    legend: { light: 'rgba(236, 72, 153, 0.7)', dark: 'rgba(236, 72, 153, 0.8)' },
  },
  equal: {
    background: { light: 'rgba(156, 163, 175, 0.7)', dark: 'rgba(156, 163, 175, 0.8)' },
    border: { light: '#6b7280', dark: '#9ca3af' },
    legend: { light: 'rgba(156, 163, 175, 0.7)', dark: 'rgba(156, 163, 175, 0.8)' },
  },
  smaller: {
    background: { light: 'rgba(59, 130, 246, 0.7)', dark: 'rgba(59, 130, 246, 0.8)' },
    border: { light: '#3b82f6', dark: '#60a5fa' },
    legend: { light: 'rgba(59, 130, 246, 0.7)', dark: 'rgba(59, 130, 246, 0.8)' },
  },
} as const;

type VsReferenceTitleKey = 'vsLosingTrade' | 'vsWinningTrade';
type VsReferenceTooltipKey = 'vsLosingTradeTooltip' | 'vsWinningTradeTooltip';

interface PostTradeSizingPanelProps {
  data: PostLossSizingData | PostWinSizingData | null | undefined;
  referenceBaseline: PostLossSizingBaseline;
  i18nPrefix: PostTradeSizingI18nPrefix;
  vsReferenceTitleKey: VsReferenceTitleKey;
  vsReferenceTooltipKey: VsReferenceTooltipKey;
  chartColors: ChartColors;
  isDark: boolean;
  formatNumber: (value: number, digits?: number) => string;
  privacyMask?: (value: string) => string;
  showHeader?: boolean;
  hideAggregatedMoney?: boolean;
}

const InterpretationScale: React.FC<{ isDark: boolean; i18nPrefix: PostTradeSizingI18nPrefix }> = ({
  isDark,
  i18nPrefix,
}) => {
  const { t } = useTranslation('analytics');

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
        {t(`${i18nPrefix}.interpretationScale.title`)}
      </h3>
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
        {t(`${i18nPrefix}.interpretationScale.intro`)}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {CATEGORIES.map((cat) => {
          const quality = CATEGORY_QUALITY[cat];
          return (
            <div
              key={cat}
              className="flex gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3"
            >
              <span
                className="mt-1 h-3 w-3 flex-shrink-0 rounded-full"
                style={{
                  backgroundColor: isDark
                    ? DOUGHNUT_SEGMENT_STYLES[cat].legend.dark
                    : DOUGHNUT_SEGMENT_STYLES[cat].legend.light,
                }}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {t(`${i18nPrefix}.${cat}`)}
                  </span>
                  <span
                    className={`inline-flex text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${QUALITY_BADGE_CLASS[quality]}`}
                  >
                    {t(`${i18nPrefix}.interpretationScale.quality.${quality}`)}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  {t(`${i18nPrefix}.interpretationScale.${INTERPRETATION_DESC_KEY[cat]}`)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface BaselineSectionProps {
  title: string;
  tooltip: string;
  baseline: PostLossSizingBaseline;
  sampleSize: number;
  i18nPrefix: PostTradeSizingI18nPrefix;
  chartColors: ChartColors;
  isDark: boolean;
  formatNumber: PostTradeSizingPanelProps['formatNumber'];
  privacyMask?: PostTradeSizingPanelProps['privacyMask'];
  hideAggregatedMoney?: boolean;
}

const BaselineSection: React.FC<BaselineSectionProps> = ({
  title,
  tooltip,
  baseline,
  sampleSize,
  i18nPrefix,
  chartColors,
  isDark,
  formatNumber,
  privacyMask,
  hideAggregatedMoney = false,
}) => {
  const { t } = useTranslation('analytics');

  const percentages = useMemo(
    () => CATEGORIES.map((cat) => baseline[cat].pct),
    [baseline]
  );

  const chartData = useMemo(() => {
    const labels = CATEGORIES.map((cat) => t(`${i18nPrefix}.${cat}`));
    const values = CATEGORIES.map((cat) => baseline[cat].count);
    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: CATEGORIES.map((cat) =>
            isDark ? DOUGHNUT_SEGMENT_STYLES[cat].background.dark : DOUGHNUT_SEGMENT_STYLES[cat].background.light
          ),
          borderColor: CATEGORIES.map((cat) =>
            isDark ? DOUGHNUT_SEGMENT_STYLES[cat].border.dark : DOUGHNUT_SEGMENT_STYLES[cat].border.light
          ),
          borderWidth: 0,
        },
      ],
    };
  }, [baseline, isDark, i18nPrefix, t]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        datalabels: {
          display: true,
          color: () => '#ffffff',
          font: {
            family: CHART_FONT_FAMILY,
            weight: 600,
            size: 14,
          },
          formatter: (value: number, context: { dataIndex: number }) => {
            if (!value) return '';
            const pct = percentages[context.dataIndex];
            return `${formatNumber(pct, 1)}%`;
          },
        },
        legend: {
          display: false,
        },
        tooltip: {
          ...buildChartTooltipPlugin(chartColors, 'barStackedLike', undefined, {
            padding: 12,
            callbacks: {
              label: (context: { label?: string; parsed: number; dataIndex: number }) => {
                const label = context.label || '';
                const value = context.parsed;
                const pct = percentages[context.dataIndex];
                return [
                  `${label}: ${value}`,
                  `${t(`${i18nPrefix}.pct`)}: ${formatNumber(pct, 1)}%`,
                ];
              },
            },
          }),
        },
      },
    }),
    [chartColors, percentages, formatNumber, i18nPrefix, t]
  );

  if (sampleSize === 0) {
    return null;
  }

  const mask = (v: string) => (privacyMask ? privacyMask(v) : v);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 flex flex-col">
      <div className="flex items-start gap-2 mb-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        <TooltipComponent content={tooltip} position="top">
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-help">
            <svg className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </TooltipComponent>
      </div>
      <ChartTooltipResetContainer className="h-48 sm:h-56 mb-4" style={{ position: 'relative' }}>
        <Doughnut data={chartData} options={chartOptions} />
      </ChartTooltipResetContainer>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="pb-2 pr-2 font-medium">{t(`${i18nPrefix}.pct`)}</th>
              <th className="pb-2 pr-2 font-medium">{t(`${i18nPrefix}.count`)}</th>
              {!hideAggregatedMoney ? (
                <th className="pb-2 pr-2 font-medium">
                  <span className="inline-flex items-center gap-1">
                    {t(`${i18nPrefix}.avgPnl`)}
                    <TooltipComponent content={t(`${i18nPrefix}.avgPnlTooltip`)} position="top">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-200/80 dark:bg-gray-600 cursor-help">
                        <svg className="h-3 w-3 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                    </TooltipComponent>
                  </span>
                </th>
              ) : null}
              <th className="pb-2 font-medium">{t(`${i18nPrefix}.winRate`)}</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map((cat) => {
              const row = baseline[cat];
              return (
                <tr
                  key={cat}
                  className="border-b border-gray-100 dark:border-gray-700/80 last:border-0"
                >
                  <td className="py-2 pr-2 text-gray-800 dark:text-gray-200">
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-2 align-middle"
                      style={{
                        backgroundColor: isDark
                          ? DOUGHNUT_SEGMENT_STYLES[cat].legend.dark
                          : DOUGHNUT_SEGMENT_STYLES[cat].legend.light,
                      }}
                    />
                    {t(`${i18nPrefix}.${cat}`)} ({formatNumber(row.pct, 1)}%)
                  </td>
                  <td className="py-2 pr-2 text-gray-700 dark:text-gray-300">{row.count}</td>
                  {!hideAggregatedMoney ? (
                    <td className="py-2 pr-2 text-gray-700 dark:text-gray-300">
                      {mask(formatNumber(row.avg_pnl, 2))}
                    </td>
                  ) : null}
                  <td className="py-2 text-gray-700 dark:text-gray-300">
                    {formatNumber(row.win_rate, 1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const PostTradeSizingPanel: React.FC<PostTradeSizingPanelProps> = ({
  data,
  referenceBaseline,
  i18nPrefix,
  vsReferenceTitleKey,
  vsReferenceTooltipKey,
  chartColors,
  isDark,
  formatNumber,
  privacyMask,
  showHeader = true,
  hideAggregatedMoney = false,
}) => {
  const { t } = useTranslation('analytics');

  if (!data || data.sample_size === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center text-gray-500 dark:text-gray-400">
        {t(`${i18nPrefix}.noData`)}
      </div>
    );
  }

  const larger = referenceBaseline.larger;

  return (
    <div className="space-y-6">
      {showHeader && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t(`${i18nPrefix}.title`)}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t(`${i18nPrefix}.subtitle`)}</p>
        </div>
      )}

      {hideAggregatedMoney ? (
        <p className="text-sm text-amber-800 dark:text-amber-200/90">
          {t('multiCurrency.partialTabNote')}
        </p>
      ) : null}

      <PostTradeSizingKpiBar
        i18nPrefix={i18nPrefix}
        sampleSize={data.sample_size}
        skippedCrossInstrument={data.skipped_cross_instrument}
        skippedUnknownContract={data.skipped_unknown_contract}
        larger={larger}
        formatNumber={formatNumber}
        privacyMask={privacyMask}
        hideAggregatedMoney={hideAggregatedMoney}
      />

      <InterpretationScale isDark={isDark} i18nPrefix={i18nPrefix} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <BaselineSection
          title={t(`${i18nPrefix}.${vsReferenceTitleKey}`)}
          tooltip={t(`${i18nPrefix}.${vsReferenceTooltipKey}`)}
          baseline={referenceBaseline}
          sampleSize={data.sample_size}
          i18nPrefix={i18nPrefix}
          chartColors={chartColors}
          isDark={isDark}
          formatNumber={formatNumber}
          privacyMask={privacyMask}
          hideAggregatedMoney={hideAggregatedMoney}
        />
        <BaselineSection
          title={t(`${i18nPrefix}.vsMedian`)}
          tooltip={t(`${i18nPrefix}.vsMedianTooltip`, { count: data.median_lookback })}
          baseline={data.vs_median}
          sampleSize={data.median_sample_size}
          i18nPrefix={i18nPrefix}
          chartColors={chartColors}
          isDark={isDark}
          formatNumber={formatNumber}
          privacyMask={privacyMask}
          hideAggregatedMoney={hideAggregatedMoney}
        />
      </div>
    </div>
  );
};

interface PostLossSizingPanelProps {
  data: PostLossSizingData | null | undefined;
  chartColors: ChartColors;
  isDark: boolean;
  formatNumber: (value: number, digits?: number) => string;
  privacyMask?: (value: string) => string;
  showHeader?: boolean;
  hideAggregatedMoney?: boolean;
}

export const PostLossSizingPanel: React.FC<PostLossSizingPanelProps> = ({
  data,
  ...panelProps
}) => (
  <PostTradeSizingPanel
    {...panelProps}
    data={data}
    referenceBaseline={data?.vs_losing_trade ?? emptyBaseline()}
    i18nPrefix="postLossSizing"
    vsReferenceTitleKey="vsLosingTrade"
    vsReferenceTooltipKey="vsLosingTradeTooltip"
  />
);

interface PostWinSizingPanelProps {
  data: PostWinSizingData | null | undefined;
  chartColors: ChartColors;
  isDark: boolean;
  formatNumber: (value: number, digits?: number) => string;
  privacyMask?: (value: string) => string;
  showHeader?: boolean;
  hideAggregatedMoney?: boolean;
}

export const PostWinSizingPanel: React.FC<PostWinSizingPanelProps> = ({
  data,
  ...panelProps
}) => (
  <PostTradeSizingPanel
    {...panelProps}
    data={data}
    referenceBaseline={data?.vs_winning_trade ?? emptyBaseline()}
    i18nPrefix="postWinSizing"
    vsReferenceTitleKey="vsWinningTrade"
    vsReferenceTooltipKey="vsWinningTradeTooltip"
  />
);

function emptyBaseline(): PostLossSizingBaseline {
  const empty = { count: 0, pct: 0, total_pnl: 0, avg_pnl: 0, win_rate: 0 };
  return { larger: empty, equal: empty, smaller: empty };
}
