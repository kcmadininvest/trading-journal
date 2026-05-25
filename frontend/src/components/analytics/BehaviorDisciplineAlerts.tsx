import React from 'react';
import { useTranslation } from 'react-i18next';
import type { BehaviorDisciplineData } from '../../hooks/useStatistics';

interface BehaviorDisciplineAlertsProps {
  data: BehaviorDisciplineData | undefined;
  formatNumber: (value: number, digits?: number) => string;
}

export const BehaviorDisciplineAlerts: React.FC<BehaviorDisciplineAlertsProps> = ({
  data,
  formatNumber,
}) => {
  const { t } = useTranslation('analytics');

  if (!data) {
    return null;
  }

  const revengeWarning = data.revenge_trading.alert_level === 'warning';
  const sizingWarning = data.sizing_discipline.alert_level === 'warning';

  if (!revengeWarning && !sizingWarning) {
    return null;
  }

  const summaries: string[] = [];

  if (
    revengeWarning &&
    data.revenge_trading.has_sufficient_data &&
    data.revenge_trading.pct_increase != null
  ) {
    summaries.push(
      t('behaviorDiscipline.alerts.revengeSummary', {
        afterLoss: formatNumber(data.revenge_trading.avg_trades_after_negative_day, 1),
        afterWin: formatNumber(data.revenge_trading.avg_trades_after_positive_day, 1),
        pct: formatNumber(data.revenge_trading.pct_increase, 0),
      }),
    );
  }

  if (
    sizingWarning &&
    data.sizing_discipline.has_sufficient_data &&
    data.sizing_discipline.pct_larger_on_losers != null
  ) {
    summaries.push(
      t('behaviorDiscipline.alerts.sizingSummary', {
        pct: formatNumber(data.sizing_discipline.pct_larger_on_losers, 0),
      }),
    );
  }

  if (summaries.length === 0) {
    return null;
  }

  return (
    <section className="mb-6 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-900/20 p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
        {t('behaviorDiscipline.alerts.title')}
      </h2>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
        {summaries.length > 1
          ? t('behaviorDiscipline.alerts.intro')
          : t('behaviorDiscipline.alerts.introOne')}
      </p>
      <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300 list-disc list-inside">
        {summaries.map((text, index) => (
          <li key={index}>{text}</li>
        ))}
      </ul>
    </section>
  );
};
