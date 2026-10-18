import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type {
  StrategyEdgeConfidence,
  StrategyEdgeOverviewItem,
  StrategyEdgeStatusValue,
} from '../../services/tradeStrategies';
import { usePreferences } from '../../hooks/usePreferences';
import { formatCurrency as formatCurrencyUtil, formatNumber as formatNumberUtil } from '../../utils/numberFormat';
import { maskValue } from '../../hooks/usePrivacySettings';
import {
  VERDICT_BADGE_CLASSES,
  VERDICT_CARD_CLASSES,
  VERDICT_TEXT_CLASSES,
  type GaugeVerdictLevel,
} from '../../utils/getGaugeVerdict';

const RELIABLE_MIN = 50;
const ACTIONABLE_MIN = 20;
/** ~28 px/s en pas entiers — lisible, sans subpixel. */
const MARQUEE_PX_PER_TICK = 1;
const MARQUEE_TICK_MS = 36;
const MARQUEE_GAP_PX = 64;

interface StrategyEdgeOverviewPanelProps {
  items: StrategyEdgeOverviewItem[];
  loading?: boolean;
  currencySymbol: string;
  hideProfitLoss?: boolean;
  onSelectStrategy: (displayStrategyId: number) => void;
}

function statusToVerdict(status: StrategyEdgeStatusValue): GaugeVerdictLevel {
  if (status === 'present') return 'good';
  if (status === 'fading' || status === 'insufficient') return 'average';
  return 'poor';
}

const CONFIDENCE_BADGE_CLASSES: Record<StrategyEdgeConfidence, string> = {
  low: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  medium: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  high: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
};

/**
 * Bandeau défilant sans CSS transform (évite le shimmer GPU/subpixel).
 * Avance scrollLeft d’1 px à la fois ; reset seamless à la moitié du track.
 */
const EdgeHowItWorksMarquee = React.memo(function EdgeHowItWorksMarquee({
  text,
}: {
  text: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const pausedRef = useRef(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;

    const viewport = viewportRef.current;
    const measure = measureRef.current;
    if (!viewport || !measure) return;

    let rafId = 0;
    let lastTick = 0;
    let cancelled = false;

    const loop = (now: number) => {
      if (cancelled) return;
      rafId = requestAnimationFrame(loop);
      if (pausedRef.current) return;
      if (now - lastTick < MARQUEE_TICK_MS) return;
      lastTick = now;

      const half = Math.round(measure.offsetWidth + MARQUEE_GAP_PX);
      if (half <= 0) return;

      const next = viewport.scrollLeft + MARQUEE_PX_PER_TICK;
      viewport.scrollLeft = next >= half ? next - half : next;
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [text, reduceMotion]);

  if (reduceMotion) {
    return (
      <div
        className="mt-2 overflow-hidden rounded-md border border-gray-200 bg-gray-50/90 px-3 py-1.5 dark:border-gray-700 dark:bg-gray-800/60"
        title={text}
      >
        <p className="truncate text-sm text-gray-600 dark:text-gray-400">{text}</p>
      </div>
    );
  }

  return (
    <div
      ref={viewportRef}
      className="mt-2 overflow-x-auto overflow-y-hidden rounded-md border border-gray-200 bg-gray-50/90 px-3 py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] dark:border-gray-700 dark:bg-gray-800/60 [&::-webkit-scrollbar]:hidden"
      title={text}
      onPointerEnter={() => {
        pausedRef.current = true;
      }}
      onPointerLeave={() => {
        pausedRef.current = false;
      }}
    >
      <div className="flex w-max whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
        <span ref={measureRef} className="shrink-0" style={{ paddingRight: MARQUEE_GAP_PX }}>
          {text}
        </span>
        <span className="shrink-0" style={{ paddingRight: MARQUEE_GAP_PX }} aria-hidden>
          {text}
        </span>
      </div>
    </div>
  );
});

export const StrategyEdgeOverviewPanel: React.FC<StrategyEdgeOverviewPanelProps> = React.memo(
  ({ items, loading = false, currencySymbol, hideProfitLoss = false, onSelectStrategy }) => {
    const { t } = useTranslation();
    const { preferences } = usePreferences();
    const [insufficientOpen, setInsufficientOpen] = useState(false);

    const formatNumber = useCallback(
      (value: number, digits: number = 2) => formatNumberUtil(value, digits, preferences.number_format),
      [preferences.number_format]
    );
    const formatCurrency = useCallback(
      (value: number) => formatCurrencyUtil(value, currencySymbol, preferences.number_format, 2),
      [preferences.number_format, currencySymbol]
    );

    const formatMoney = (value: number | null | undefined) => {
      if (value == null || !Number.isFinite(value)) {
        return t('strategies:edgeStatus.na');
      }
      if (hideProfitLoss) {
        return maskValue(null, currencySymbol);
      }
      return formatCurrency(value);
    };

    const { reliable, preliminary, insufficient } = useMemo(() => {
      const r: StrategyEdgeOverviewItem[] = [];
      const p: StrategyEdgeOverviewItem[] = [];
      const i: StrategyEdgeOverviewItem[] = [];
      for (const item of items) {
        if (item.sample_size >= RELIABLE_MIN && item.status !== 'insufficient') {
          r.push(item);
        } else if (item.sample_size >= ACTIONABLE_MIN && item.status !== 'insufficient') {
          p.push(item);
        } else {
          i.push(item);
        }
      }
      return { reliable: r, preliminary: p, insufficient: i };
    }, [items]);

    if (loading && items.length === 0) {
      return (
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700/50" />
          <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700/50" />
        </div>
      );
    }

    if (!loading && items.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-800/40 px-4 py-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('strategies:edgeOverview.empty')}
          </p>
        </div>
      );
    }

    const renderRow = (item: StrategyEdgeOverviewItem) => {
      const verdict = statusToVerdict(item.status);
      const confidence = item.confidence ?? null;
      const uncertainty = item.trailing_uncertainty;
      const uncertaintyLabel =
        uncertainty && !hideProfitLoss
          ? t('strategies:edgeStatus.uncertaintyBand', {
              low: formatCurrency(uncertainty.low),
              high: formatCurrency(uncertainty.high),
            })
          : null;

      return (
        <div
          key={item.root_id}
          className={clsx(
            'w-full rounded-lg border px-4 py-3 text-left shadow-sm',
            VERDICT_CARD_CLASSES[verdict]
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{item.title}</p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {t('strategies:edgeOverview.versions', { count: item.version_count })}
                {' · '}
                {t(
                  item.basis === 'all'
                    ? 'strategies:edgeOverview.sampleAll'
                    : 'strategies:edgeOverview.sampleRespected',
                  {
                    count: item.sample_size,
                    formatted: formatNumber(item.sample_size, 0),
                  }
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {confidence ? (
                <span
                  className={clsx(
                    'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                    CONFIDENCE_BADGE_CLASSES[confidence]
                  )}
                >
                  {t(`strategies:edgeStatus.confidence.${confidence}`)}
                </span>
              ) : null}
              <span
                className={clsx(
                  'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                  VERDICT_BADGE_CLASSES[verdict]
                )}
              >
                {t(`strategies:edgeStatus.status.${item.status}`)}
              </span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:items-end">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t('strategies:edgeStatus.baseline')}
              </p>
              <p className={clsx('mt-0.5 font-bold tabular-nums', VERDICT_TEXT_CLASSES[verdict])}>
                {formatMoney(item.baseline_expectancy)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t('strategies:edgeStatus.trailing', { count: item.trailing_window || 30 })}
              </p>
              <p className={clsx('mt-0.5 font-bold tabular-nums', VERDICT_TEXT_CLASSES[verdict])}>
                {formatMoney(item.trailing_expectancy)}
              </p>
              {uncertaintyLabel ? (
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                  {uncertaintyLabel}
                </p>
              ) : null}
              {item.trailing_sign_uncertain ? (
                <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
                  {t('strategies:edgeStatus.signUncertain')}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t('strategies:edgeStatus.trailingPf')}
              </p>
              <p className={clsx('mt-0.5 font-bold tabular-nums', VERDICT_TEXT_CLASSES[verdict])}>
                {item.trailing_profit_factor_infinite
                  ? t('strategies:edgeStatus.profitFactorInfinite')
                  : item.trailing_profit_factor != null && Number.isFinite(item.trailing_profit_factor)
                    ? formatNumber(item.trailing_profit_factor, 2)
                    : t('strategies:edgeStatus.na')}
              </p>
            </div>
            <div className="col-span-2 flex sm:col-span-1 sm:justify-end sm:pb-0.5">
              <button
                type="button"
                onClick={() => onSelectStrategy(item.display_strategy_id)}
                className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                {t('strategies:edgeOverview.openStats')}
              </button>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('strategies:edgeOverview.title')}
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {t('strategies:edgeOverview.subtitle')}
          </p>
          <EdgeHowItWorksMarquee text={t('strategies:edgeOverview.howItWorks')} />
        </div>

        {reliable.length > 0 ? (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('strategies:edgeOverview.reliableSection', {
                count: reliable.length,
                formatted: formatNumber(reliable.length, 0),
              })}
            </h4>
            {reliable.map(renderRow)}
          </div>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('strategies:edgeOverview.noReliable')}
          </p>
        )}

        {preliminary.length > 0 ? (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('strategies:edgeOverview.preliminarySection', {
                count: preliminary.length,
                formatted: formatNumber(preliminary.length, 0),
              })}
            </h4>
            {preliminary.map(renderRow)}
          </div>
        ) : null}

        {insufficient.length > 0 ? (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setInsufficientOpen((o) => !o)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              <span>
                {t('strategies:edgeOverview.insufficientSection', {
                  count: insufficient.length,
                  formatted: formatNumber(insufficient.length, 0),
                })}
              </span>
              <svg
                className={clsx('h-4 w-4 transition-transform', insufficientOpen && 'rotate-180')}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {insufficientOpen ? (
              <div className="space-y-3 border-t border-gray-200 px-4 py-3 dark:border-gray-700">
                {insufficient.map(renderRow)}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }
);

StrategyEdgeOverviewPanel.displayName = 'StrategyEdgeOverviewPanel';
