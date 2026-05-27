import React from 'react';
import { useTranslation } from 'react-i18next';
import { BehaviorDisciplineAlerts } from './BehaviorDisciplineAlerts';
import { BehaviorDisciplineSection } from './BehaviorDisciplineSection';
import type { BehaviorDisciplineData } from '../../hooks/useStatistics';

interface BehaviorDisciplinePanelProps {
  data: BehaviorDisciplineData | undefined;
  formatNumber: (value: number, digits?: number) => string;
  showMultiCurrencyNote?: boolean;
}

export const BehaviorDisciplinePanel: React.FC<BehaviorDisciplinePanelProps> = ({
  data,
  formatNumber,
  showMultiCurrencyNote = false,
}) => {
  const { t } = useTranslation('analytics');

  return (
  <div className="space-y-2">
    {showMultiCurrencyNote ? (
      <p className="text-sm text-amber-800 dark:text-amber-200/90 mb-2">
        {t('multiCurrency.partialTabNote')}
      </p>
    ) : null}
    <BehaviorDisciplineAlerts data={data} formatNumber={formatNumber} />
    <BehaviorDisciplineSection kind="revenge" data={data} formatNumber={formatNumber} />
    <BehaviorDisciplineSection kind="sizing" data={data} formatNumber={formatNumber} />
  </div>
  );
};
