import React, { useMemo } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import Tooltip from '../ui/Tooltip';
import type { TradeOutcomeSeriesItem } from '../../utils/computeRollingPeakWinRate';
import { getTradeDisplayPnlValue, type PnlDisplayMode } from '../../utils/pnlDisplay';
import { formatDateTimeShort, type DateFormatType } from '../../utils/dateFormat';
import { formatCurrencyWithSign, type NumberFormatType } from '../../utils/numberFormat';

const LETTER_STYLES: Record<
  TradeOutcomeSeriesItem['letter'],
  { chip: string; legend: string }
> = {
  W: {
    chip: 'bg-blue-500 text-white dark:bg-blue-400',
    legend: 'text-blue-500 dark:text-blue-400',
  },
  L: {
    chip: 'bg-pink-500 text-white dark:bg-pink-400',
    legend: 'text-pink-500 dark:text-pink-400',
  },
  B: {
    chip: 'bg-gray-400 text-white dark:bg-gray-500',
    legend: 'text-gray-600 dark:text-gray-300',
  },
};

export type TradeOutcomeSeriesLayout = 'scroll' | 'grid';
export type TradeOutcomeSeriesDisplayOrder = 'oldestFirst' | 'newestFirst';

export interface TradeOutcomeSeriesStripProps {
  series: TradeOutcomeSeriesItem[];
  pnlDisplayMode: PnlDisplayMode;
  currencySymbol?: string;
  numberFormat: NumberFormatType;
  dateFormat: DateFormatType;
  timezone: string;
  hideMoney?: boolean;
  compact?: boolean;
  showLegend?: boolean;
  highlightLatest?: boolean;
  centered?: boolean;
  layout?: TradeOutcomeSeriesLayout;
  displayOrder?: TradeOutcomeSeriesDisplayOrder;
  gridClassName?: string;
  /** Limite le nombre de lignes (ex. 2 → 10 colonnes pour 20 trades). */
  maxGridRows?: number;
  className?: string;
}

export const TradeOutcomeSeriesStrip: React.FC<TradeOutcomeSeriesStripProps> = ({
  series,
  pnlDisplayMode,
  currencySymbol = '',
  numberFormat,
  dateFormat,
  timezone,
  hideMoney = false,
  compact = false,
  showLegend = true,
  highlightLatest = false,
  centered = false,
  layout = 'scroll',
  displayOrder = 'oldestFirst',
  gridClassName = 'grid-cols-5 gap-1 sm:grid-cols-10',
  maxGridRows,
  className,
}) => {
  const { t } = useTranslation(['dashboard', 'statistics']);

  const visibleSeries = useMemo(
    () => (displayOrder === 'newestFirst' ? [...series].reverse() : series),
    [series, displayOrder],
  );

  const gridColumnCount =
    layout === 'grid' && maxGridRows != null && maxGridRows > 0
      ? Math.ceil(visibleSeries.length / maxGridRows)
      : null;

  if (series.length === 0) {
    return (
      <p className="text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
        {t('statistics:advancedAnalysis.outcomeSeriesEmpty', {
          defaultValue: 'Aucun trade sur cette période.',
        })}
      </p>
    );
  }

  const legendItems: Array<{ letter: TradeOutcomeSeriesItem['letter']; label: string }> = [
    {
      letter: 'W',
      label: t('statistics:advancedAnalysis.outcomeSeriesWin', { defaultValue: 'Gain' }),
    },
    {
      letter: 'L',
      label: t('statistics:advancedAnalysis.outcomeSeriesLoss', { defaultValue: 'Perte' }),
    },
    {
      letter: 'B',
      label: t('statistics:advancedAnalysis.outcomeSeriesBreakEven', { defaultValue: 'Breakeven' }),
    },
  ];

  const chipClassName = clsx(
    'inline-flex shrink-0 items-center justify-center rounded font-semibold tabular-nums transition-[opacity,box-shadow]',
    maxGridRows != null
      ? 'h-4 min-w-0 w-full px-0 text-[9px] leading-none'
      : compact
        ? 'h-5 min-w-[1.375rem] px-1 text-[11px]'
        : 'h-6 min-w-[1.5rem] px-1.5 text-xs',
  );

  const getChipHighlightClass = (isLatest: boolean) => {
    if (!highlightLatest) return null;
    if (isLatest) {
      return maxGridRows != null
        ? 'opacity-100 shadow-sm ring-1 ring-inset ring-white/55 dark:ring-white/25'
        : 'opacity-100 shadow-md ring-2 ring-inset ring-white/50 dark:ring-white/20';
    }
    return 'opacity-40 saturate-[0.85] dark:opacity-35';
  };

  const renderChip = (item: TradeOutcomeSeriesItem, index: number) => {
    const isLatest =
      displayOrder === 'newestFirst' ? index === 0 : index === visibleSeries.length - 1;
    const pnl = getTradeDisplayPnlValue(item.trade, pnlDisplayMode);
    const enteredAt = item.trade.entered_at;
    const tooltipLines = [
      enteredAt
        ? formatDateTimeShort(enteredAt, dateFormat, timezone)
        : t('statistics:advancedAnalysis.outcomeSeriesNoDate', {
            defaultValue: 'Date inconnue',
          }),
      hideMoney || pnl == null
        ? '***'
        : formatCurrencyWithSign(pnl, currencySymbol, numberFormat, 2),
    ];

    return (
      <Tooltip
        key={`${enteredAt ?? 'na'}-${index}`}
        content={tooltipLines.join('\n')}
        position="top"
        contentClassName="whitespace-pre-line block"
      >
        <span
          role="listitem"
          aria-label={`${item.letter} — ${tooltipLines.join(', ')}`}
          className={clsx(
            chipClassName,
            LETTER_STYLES[item.letter].chip,
            layout === 'grid' && 'w-full',
            getChipHighlightClass(isLatest),
          )}
        >
          {item.letter}
        </span>
      </Tooltip>
    );
  };

  const listAriaLabel = t('statistics:advancedAnalysis.outcomeSeriesAria', {
    defaultValue: 'Série des résultats des trades',
  });

  return (
    <div className={clsx('space-y-2', className)}>
      {layout === 'grid' ? (
        <div
          className={clsx(
            'grid gap-0.5',
            gridColumnCount == null && gridClassName,
            centered && gridColumnCount == null && 'mx-auto max-w-3xl',
          )}
          style={
            gridColumnCount != null
              ? {
                  gridTemplateColumns: `repeat(${gridColumnCount}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${Math.min(maxGridRows!, visibleSeries.length)}, minmax(0, 1fr))`,
                }
              : undefined
          }
          role="list"
          aria-label={listAriaLabel}
        >
          {visibleSeries.map((item, index) => renderChip(item, index))}
        </div>
      ) : (
        <div className={clsx('overflow-x-auto pb-1', centered && 'flex justify-center')}>
          <div className="flex min-w-min items-center gap-1" role="list" aria-label={listAriaLabel}>
            {visibleSeries.map((item, index) => renderChip(item, index))}
          </div>
        </div>
      )}

      {showLegend ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          {legendItems.map((item) => (
            <span key={item.letter} className="inline-flex items-center gap-1">
              <span
                className={clsx(
                  'inline-flex h-4 min-w-[1rem] items-center justify-center rounded px-1 text-[10px] font-semibold text-white',
                  LETTER_STYLES[item.letter].chip,
                )}
              >
                {item.letter}
              </span>
              <span className={LETTER_STYLES[item.letter].legend}>{item.label}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};
