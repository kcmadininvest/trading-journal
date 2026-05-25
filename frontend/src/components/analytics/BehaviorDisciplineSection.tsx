import React from 'react';
import { useTranslation } from 'react-i18next';
import { BehaviorDisciplineMetricCard } from './BehaviorDisciplineMetricCard';
import type {
  BehaviorDisciplineData,
  RevengeTradingData,
  SizingDisciplineData,
} from '../../hooks/useStatistics';

export type BehaviorDisciplineSectionKind = 'revenge' | 'sizing';

interface BehaviorDisciplineSectionProps {
  kind: BehaviorDisciplineSectionKind;
  data: BehaviorDisciplineData | undefined;
  formatNumber: (value: number, digits?: number) => string;
}

function InterpretationLine({
  message,
  variant = 'warning',
}: {
  message: string;
  variant?: 'warning' | 'positive';
}) {
  const isPositive = variant === 'positive';
  return (
    <div
      className={`flex items-start gap-2 mt-3 text-sm ${
        isPositive
          ? 'text-green-900 dark:text-green-200'
          : 'text-amber-900 dark:text-amber-200'
      }`}
    >
      <svg
        className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
          isPositive
            ? 'text-green-600 dark:text-green-400'
            : 'text-amber-600 dark:text-amber-400'
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <p>{message}</p>
    </div>
  );
}

function RevengeContent({
  revenge,
  formatNumber,
}: {
  revenge: RevengeTradingData;
  formatNumber: (value: number, digits?: number) => string;
}) {
  const { t } = useTranslation('analytics');

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <BehaviorDisciplineMetricCard
          label={t('behaviorDiscipline.revenge.tradesAfterNegativeDay')}
          value={formatNumber(revenge.avg_trades_after_negative_day, 1)}
          unit={t('behaviorDiscipline.revenge.tradesPerDay')}
          tone="negative"
        />
        <BehaviorDisciplineMetricCard
          label={t('behaviorDiscipline.revenge.tradesAfterPositiveDay')}
          value={formatNumber(revenge.avg_trades_after_positive_day, 1)}
          unit={t('behaviorDiscipline.revenge.tradesPerDay')}
          tone="positive"
        />
      </div>
      {revenge.pct_increase != null && revenge.pct_increase > 0 ? (
        <InterpretationLine
          message={t('behaviorDiscipline.revenge.alert', {
            pct: formatNumber(revenge.pct_increase, 0),
          })}
        />
      ) : revenge.pct_increase != null && revenge.pct_increase < 0 ? (
        <InterpretationLine
          variant="positive"
          message={t('behaviorDiscipline.revenge.alertFavorable', {
            pct: formatNumber(Math.abs(revenge.pct_increase), 0),
          })}
        />
      ) : null}
    </>
  );
}

function SizingContent({
  sizing,
  formatNumber,
}: {
  sizing: SizingDisciplineData;
  formatNumber: (value: number, digits?: number) => string;
}) {
  const { t } = useTranslation('analytics');

  const badge =
    sizing.pct_larger_on_losers != null && sizing.pct_larger_on_losers > 0
      ? t('behaviorDiscipline.sizing.badge', {
          pct: formatNumber(sizing.pct_larger_on_losers, 0),
        })
      : undefined;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <BehaviorDisciplineMetricCard
          label={t('behaviorDiscipline.sizing.avgWinningSize')}
          value={formatNumber(sizing.avg_size_winning_trades, 2)}
          tone="positive"
        />
        <BehaviorDisciplineMetricCard
          label={t('behaviorDiscipline.sizing.avgLosingSize')}
          value={formatNumber(sizing.avg_size_losing_trades, 2)}
          tone="negative"
          badge={badge}
        />
      </div>
      {sizing.pct_larger_on_losers != null && sizing.pct_larger_on_losers > 0 ? (
        <InterpretationLine
          message={t('behaviorDiscipline.sizing.alert', {
            pct: formatNumber(sizing.pct_larger_on_losers, 0),
          })}
        />
      ) : sizing.pct_larger_on_losers != null && sizing.pct_larger_on_losers < 0 ? (
        <InterpretationLine
          variant="positive"
          message={t('behaviorDiscipline.sizing.alertFavorable', {
            pct: formatNumber(Math.abs(sizing.pct_larger_on_losers), 0),
          })}
        />
      ) : null}
    </>
  );
}

export const BehaviorDisciplineSection: React.FC<BehaviorDisciplineSectionProps> = ({
  kind,
  data,
  formatNumber,
}) => {
  const { t } = useTranslation('analytics');

  const sectionData = kind === 'revenge' ? data?.revenge_trading : data?.sizing_discipline;
  const titleKey =
    kind === 'revenge' ? 'behaviorDiscipline.revenge.title' : 'behaviorDiscipline.sizing.title';
  const subtitleKey =
    kind === 'revenge'
      ? 'behaviorDiscipline.revenge.subtitle'
      : 'behaviorDiscipline.sizing.subtitle';
  const noDataKey = 'behaviorDiscipline.noData';

  if (!sectionData?.has_sufficient_data) {
    return (
      <section className="mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
          {t(titleKey)}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t(noDataKey)}</p>
      </section>
    );
  }

  return (
    <section className="mb-6">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300 mb-1">
        {t(titleKey)}
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{t(subtitleKey)}</p>
      {kind === 'revenge' && data?.revenge_trading ? (
        <RevengeContent revenge={data.revenge_trading} formatNumber={formatNumber} />
      ) : null}
      {kind === 'sizing' && data?.sizing_discipline ? (
        <SizingContent sizing={data.sizing_discipline} formatNumber={formatNumber} />
      ) : null}
    </section>
  );
};
