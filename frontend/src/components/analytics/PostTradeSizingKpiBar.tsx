import React from 'react';
import { useTranslation } from 'react-i18next';
import TooltipComponent from '../ui/Tooltip';
import { GAUGE_CONFIGS, MetricGauge } from '../statistics/MetricGauge';
import type { PostLossSizingCategory, PostTradeSizingI18nPrefix } from '../../hooks/useStatistics';
import {
  evaluateLargerPct,
  LARGER_PCT_BADGE_CLASS,
  LARGER_PCT_THRESHOLDS,
  LARGER_PCT_VALUE_CLASS,
} from '../../utils/postTradeSizingEvaluation';

/** Aligné sur AccountIndicatorsGrid / AccountSummaryCard */
const SUMMARY_SHELL_CLASS = 'bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4';
const BAR_GROUP_CLASS =
  'flex h-full min-w-0 w-full flex-col gap-3 xl:flex-row xl:items-stretch xl:gap-0 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-colors duration-150';

function BarSeparator({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`mx-0 min-h-0 w-px shrink-0 self-stretch bg-gray-200 dark:bg-gray-600 ${className}`}
    />
  );
}

function winRateValueClass(rate: number): string {
  if (rate >= 50) return 'text-blue-600 dark:text-blue-400';
  if (rate >= 40) return 'text-orange-600 dark:text-orange-400';
  return 'text-pink-600 dark:text-pink-400';
}

function avgPnlValueClass(pnl: number): string {
  if (pnl > 0) return 'text-blue-600 dark:text-blue-400';
  if (pnl < 0) return 'text-pink-600 dark:text-pink-400';
  return 'text-gray-900 dark:text-gray-100';
}

interface PostTradeSizingKpiBarProps {
  i18nPrefix: PostTradeSizingI18nPrefix;
  sampleSize: number;
  skippedCrossInstrument?: number;
  skippedUnknownContract?: number;
  larger: PostLossSizingCategory;
  formatNumber: (value: number, digits?: number) => string;
  privacyMask?: (value: string) => string;
  hideAggregatedMoney?: boolean;
}

export const PostTradeSizingKpiBar: React.FC<PostTradeSizingKpiBarProps> = ({
  i18nPrefix,
  sampleSize,
  skippedCrossInstrument = 0,
  skippedUnknownContract = 0,
  larger,
  formatNumber,
  privacyMask,
  hideAggregatedMoney = false,
}) => {
  const { t } = useTranslation('analytics');
  const mask = (v: string) => (privacyMask ? privacyMask(v) : v);
  const largerQuality = evaluateLargerPct(larger.pct);
  const largerPctTooltip = [
    t(`${i18nPrefix}.largerPctKpiTooltip`),
    t(`${i18nPrefix}.interpretationScale.kpiThresholds`, {
      good: LARGER_PCT_THRESHOLDS.goodMax,
      neutral: LARGER_PCT_THRESHOLDS.neutralMax,
    }),
    t(`${i18nPrefix}.interpretationScale.kpiVerdict.${largerQuality}`),
    t(`${i18nPrefix}.interpretationScale.kpiHint`),
  ].join('\n\n');

  const labelClass =
    'flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400';

  return (
    <div className={SUMMARY_SHELL_CLASS}>
      <div className={BAR_GROUP_CLASS}>
        {/* Cas analysés */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={labelClass}>
            {t(`${i18nPrefix}.sampleSize`)}
            <TooltipComponent content={t(`${i18nPrefix}.sampleSizeTooltip`)} position="top">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-gray-200/80 dark:bg-gray-600 cursor-help">
                <svg className="h-3 w-3 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            </TooltipComponent>
          </span>
          <span className="text-xl font-semibold tabular-nums text-gray-900 dark:text-gray-100">
            {sampleSize}
          </span>
        </div>

        <BarSeparator className="hidden xl:block xl:mx-4" />
        <div className="border-t border-gray-200 dark:border-gray-600 xl:hidden" aria-hidden />

        {/* Taille augmentée */}
        <div className="flex min-w-0 flex-[1.35] flex-col gap-1.5">
          <span className={labelClass}>
            <span className="truncate">{t(`${i18nPrefix}.largerPctKpi`)}</span>
            <TooltipComponent content={largerPctTooltip} position="top">
              <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-200/80 dark:bg-gray-600 cursor-help">
                <svg className="h-3 w-3 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
            </TooltipComponent>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xl font-semibold tabular-nums ${LARGER_PCT_VALUE_CLASS[largerQuality]}`}>
              {formatNumber(larger.pct, 1)}%
            </span>
            <span
              className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${LARGER_PCT_BADGE_CLASS[largerQuality]}`}
            >
              {t(`${i18nPrefix}.interpretationScale.quality.${largerQuality}`)}
            </span>
          </div>
          <MetricGauge
            label=""
            value={larger.pct}
            config={GAUGE_CONFIGS.largerPctAfterTrade}
            formatValue={(val) => `${formatNumber(val, 1)}%`}
            showLabels={false}
            size="sm"
            compactBar
          />
        </div>

        {hideAggregatedMoney ? (
          <>
            <BarSeparator className="hidden xl:block xl:mx-4" />
            <div className="border-t border-gray-200 dark:border-gray-600 xl:hidden" aria-hidden />
          </>
        ) : (
          <>
            <BarSeparator className="hidden xl:block xl:mx-4" />
            <div className="border-t border-gray-200 dark:border-gray-600 xl:hidden" aria-hidden />

            {/* PnL moyen */}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className={labelClass}>
                {t(`${i18nPrefix}.avgPnlAfterLarger`)}
                <TooltipComponent content={t(`${i18nPrefix}.avgPnlAfterLargerTooltip`)} position="top">
                  <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-200/80 dark:bg-gray-600 cursor-help">
                    <svg className="h-3 w-3 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                </TooltipComponent>
              </span>
              <span className={`text-xl font-semibold tabular-nums ${avgPnlValueClass(larger.avg_pnl)}`}>
                {mask(formatNumber(larger.avg_pnl, 2))}
              </span>
            </div>

            <BarSeparator className="hidden xl:block xl:mx-4" />
            <div className="border-t border-gray-200 dark:border-gray-600 xl:hidden" aria-hidden />
          </>
        )}

        {/* Win rate */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={labelClass}>{t(`${i18nPrefix}.winRateAfterLarger`)}</span>
          <span className={`text-xl font-semibold tabular-nums ${winRateValueClass(larger.win_rate)}`}>
            {formatNumber(larger.win_rate, 1)}%
          </span>
        </div>
      </div>

      {(skippedCrossInstrument > 0 || skippedUnknownContract > 0 || sampleSize < 15) && (
        <div className="mt-2 space-y-1 px-1">
          {skippedCrossInstrument > 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t(`${i18nPrefix}.skippedCrossInstrument`, { count: skippedCrossInstrument })}
            </p>
          )}
          {skippedUnknownContract > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t(`${i18nPrefix}.skippedUnknownContract`, { count: skippedUnknownContract })}
            </p>
          )}
          {sampleSize < 15 && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t(`${i18nPrefix}.interpretationScale.limitedSample`, { count: sampleSize })}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
