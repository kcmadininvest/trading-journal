import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MetricCard } from './MetricCard';
import Tooltip from '../ui/Tooltip';
import { TradeOutcomeSeriesStrip } from '../trading/TradeOutcomeSeriesStrip';
import { maskValue } from '../../hooks/usePrivacySettings';
import type { TradeOutcomeSeriesItem } from '../../utils/computeRollingPeakWinRate';
import type { PnlDisplayMode } from '../../utils/pnlDisplay';
import type { DateFormatType } from '../../utils/dateFormat';
import type { NumberFormatType } from '../../utils/numberFormat';
import { WIN_RATE_ROLLING_WINDOW } from '../../utils/tradingSampleThresholds';

export interface StatisticsOutcomeSeriesCardProps {
  series: TradeOutcomeSeriesItem[];
  currencySymbol: string;
  pnlDisplayMode: PnlDisplayMode;
  numberFormat: NumberFormatType;
  dateFormat: DateFormatType;
  timezone: string;
  hideMoney?: boolean;
}

const TOOLTIP_ICON = (
  <svg
    className="block h-3.5 w-3.5 shrink-0 cursor-help text-gray-400 dark:text-gray-500"
    fill="currentColor"
    viewBox="0 0 20 20"
    aria-hidden
  >
    <path
      fillRule="evenodd"
      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
      clipRule="evenodd"
    />
  </svg>
);

export const StatisticsOutcomeSeriesCard: React.FC<StatisticsOutcomeSeriesCardProps> = ({
  series,
  currencySymbol,
  pnlDisplayMode,
  numberFormat,
  dateFormat,
  timezone,
  hideMoney = false,
}) => {
  const { t } = useTranslation();

  const summaryLabel = useMemo(() => {
    if (series.length === 0) {
      return t('statistics:advancedAnalysis.outcomeSeriesEmpty', {
        defaultValue: 'Aucun trade sur cette période.',
      });
    }
    const wins = series.filter((item) => item.letter === 'W').length;
    const losses = series.filter((item) => item.letter === 'L').length;
    const breakEvens = series.filter((item) => item.letter === 'B').length;
    return t('statistics:advancedAnalysis.outcomeSeriesSummary', {
      wins,
      losses,
      breakEvens,
      defaultValue: '{{wins}}G · {{losses}}P · {{breakEvens}}BE',
    });
  }, [series, t]);

  const tooltip = (
    <Tooltip
      content={t('statistics:advancedAnalysis.outcomeSeriesTooltip', {
        count: WIN_RATE_ROLLING_WINDOW,
        defaultValue:
          'Résultats de vos {{count}} derniers trades dans la période filtrée, du plus ancien (gauche) au plus récent (droite).',
      })}
      position="bottom"
      className="shrink-0 items-center leading-none"
      contentClassName="whitespace-pre-line block max-w-xs"
    >
      {TOOLTIP_ICON}
    </Tooltip>
  );

  const headerBadge =
    series.length > 0 ? (
      <span className="inline-flex w-fit items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium tabular-nums text-gray-600 dark:bg-gray-700 dark:text-gray-300">
        {hideMoney ? maskValue(null) : summaryLabel}
      </span>
    ) : null;

  return (
    <MetricCard
      title={t('statistics:advancedAnalysis.outcomeSeriesTitle', {
        defaultValue: 'Forme récente',
      })}
      titleAddon={tooltip}
      headerAction={headerBadge}
      fillHeight
      icon={
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 10h16M4 14h16M4 18h16"
          />
        </svg>
      }
    >
      {series.length > 0 ? (
        <TradeOutcomeSeriesStrip
          series={series}
          pnlDisplayMode={pnlDisplayMode}
          currencySymbol={currencySymbol}
          numberFormat={numberFormat}
          dateFormat={dateFormat}
          timezone={timezone}
          hideMoney={hideMoney}
          showLegend={false}
          highlightLatest={false}
          centered
          className="min-w-0 space-y-0"
        />
      ) : (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">{summaryLabel}</p>
      )}
    </MetricCard>
  );
};
