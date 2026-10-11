import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChartSection } from '../common/ChartSection';
import type { EmotionShareColumn, EmotionsByRespectShares } from '../../hooks/useStrategyDisciplineInsights';

interface StrategyEmotionsByRespectChartProps {
  data: EmotionsByRespectShares;
  title: string;
  tooltip: string;
  formatNumber: (value: number, digits?: number) => string;
  onSelect?: (emotion: string, respected: boolean) => void;
  className?: string;
}

export const StrategyEmotionsByRespectChart: React.FC<StrategyEmotionsByRespectChartProps> = React.memo(
  ({ data, title, tooltip, formatNumber, onSelect, className = '' }) => {
    const { t } = useTranslation();

    return (
      <ChartSection title={title} tooltip={tooltip} fillHeight className={`h-full min-h-0 ${className}`}>
        <div className="grid h-full min-h-0 flex-1 grid-cols-2 items-stretch gap-3 sm:gap-5">
          <EmotionShareList
            column={data.respected}
            heading={t('strategies:compliance.respected')}
            tone="respected"
            formatNumber={formatNumber}
            onSelect={onSelect}
          />
          <EmotionShareList
            column={data.notRespected}
            heading={t('strategies:compliance.notRespected')}
            tone="notRespected"
            formatNumber={formatNumber}
            onSelect={onSelect}
          />
        </div>
      </ChartSection>
    );
  }
);

function EmotionShareList({
  column,
  heading,
  tone,
  formatNumber,
  onSelect,
}: {
  column: EmotionShareColumn;
  heading: string;
  tone: 'respected' | 'notRespected';
  formatNumber: (value: number, digits?: number) => string;
  onSelect?: (emotion: string, respected: boolean) => void;
}) {
  const { t } = useTranslation();
  const barClass =
    tone === 'respected' ? 'bg-blue-500 dark:bg-blue-400' : 'bg-pink-500 dark:bg-pink-400';
  const headingClass =
    tone === 'respected'
      ? 'text-blue-700 dark:text-blue-300'
      : 'text-pink-700 dark:text-pink-300';

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="shrink-0">
        <div className={`text-sm font-semibold ${headingClass}`}>{heading}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {t('strategies:insights.emotionsDeclaredShare')}
          {column.totalOccurrences > 0 && (
            <span className="tabular-nums">
              {' '}
              · {formatNumber(column.totalOccurrences, 0)}
            </span>
          )}
        </div>
        {column.sampleTooSmall && (
          <p className="mt-1 text-xs leading-snug text-amber-700 dark:text-amber-400">
            {t('strategies:insights.emotionsSampleTooSmall')}
          </p>
        )}
      </div>

      {column.rows.length === 0 ? (
        <p className="flex flex-1 items-center text-sm text-gray-500 dark:text-gray-400">
          {t('strategies:insights.emotionsNone')}
        </p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col justify-between gap-3 py-1">
          {column.rows.map((row) => {
            const interactive = Boolean(onSelect);
            const content = (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 text-sm leading-snug text-gray-800 dark:text-gray-100">
                    {row.label}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-gray-600 dark:text-gray-300">
                    {formatNumber(row.count, 0)} · {formatNumber(row.sharePct, 1)}%
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700 sm:h-3">
                  <div
                    className={`h-full rounded-full ${barClass}`}
                    style={{ width: `${Math.min(100, Math.max(0, row.sharePct))}%` }}
                  />
                </div>
              </>
            );

            return (
              <li key={row.emotion} className="flex min-w-0 flex-col justify-center">
                {interactive ? (
                  <button
                    type="button"
                    className="w-full rounded-md py-0.5 text-left hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 dark:hover:bg-white/5 dark:focus-visible:ring-blue-500/50"
                    onClick={() => onSelect?.(row.emotion, column.respected)}
                  >
                    {content}
                  </button>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

StrategyEmotionsByRespectChart.displayName = 'StrategyEmotionsByRespectChart';
