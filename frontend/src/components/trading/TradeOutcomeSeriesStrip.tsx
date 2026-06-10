import React from 'react';
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
  className,
}) => {
  const { t } = useTranslation(['dashboard', 'statistics']);

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

  return (
    <div className={clsx('space-y-2', className)}>
      <div className={clsx('overflow-x-auto pb-1', centered && 'flex justify-center')}>
        <div
          className="flex min-w-min items-center gap-1"
          role="list"
          aria-label={t('statistics:advancedAnalysis.outcomeSeriesAria', {
            defaultValue: 'Série des résultats des trades',
          })}
        >
          {series.map((item, index) => {
            const isLatest = index === series.length - 1;
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
                    'inline-flex shrink-0 items-center justify-center rounded font-semibold tabular-nums transition-transform',
                    LETTER_STYLES[item.letter].chip,
                    compact
                      ? 'h-5 min-w-[1.375rem] px-1 text-[11px]'
                      : 'h-6 min-w-[1.5rem] px-1.5 text-xs',
                    highlightLatest &&
                      isLatest &&
                      'scale-110 ring-2 ring-gray-900/70 ring-offset-1 dark:ring-white/80 dark:ring-offset-gray-800',
                  )}
                >
                  {item.letter}
                </span>
              </Tooltip>
            );
          })}
        </div>
      </div>

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
