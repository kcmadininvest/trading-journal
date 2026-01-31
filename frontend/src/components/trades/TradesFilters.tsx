import React, { useMemo } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { CustomSelect } from '../common/CustomSelect';
import { DateInput } from '../common/DateInput';

interface TradesFiltersProps {
  values: {
    contract: string;
    type: '' | 'Long' | 'Short';
    start_date: string;
    end_date: string;
    profitable: '' | 'true' | 'false';
    has_strategy: '' | 'true' | 'false';
  };
  instruments?: string[];
  onChange: (next: Partial<TradesFiltersProps['values']>) => void;
  onReset: () => void;
}

export const TradesFilters: React.FC<TradesFiltersProps> = ({ values, instruments = [], onChange, onReset }) => {
  const { t } = useI18nTranslation();
  
  const contractOptions = useMemo(() => [
    { value: '', label: t('trades:filters.instrument') },
    ...instruments.map((it) => ({ value: it, label: it }))
  ], [instruments, t]);

  const typeOptions = useMemo(() => [
    { value: '', label: t('trades:filters.type') },
    { value: 'Long', label: t('trades:long') },
    { value: 'Short', label: t('trades:short') }
  ], [t]);

  const profitableOptions = useMemo(() => [
    { value: '', label: t('trades:filters.pnl') },
    { value: 'true', label: t('trades:filters.winners') },
    { value: 'false', label: t('trades:filters.losers') }
  ], [t]);

  const strategyOptions = useMemo(() => [
    { value: '', label: t('trades:filters.strategy', { defaultValue: 'Stratégie' }) },
    { value: 'true', label: t('trades:filters.withStrategy', { defaultValue: 'Avec stratégie' }) },
    { value: 'false', label: t('trades:filters.withoutStrategy', { defaultValue: 'Sans stratégie' }) }
  ], [t]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 md:p-5 mb-4 sm:mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 items-end">
        <CustomSelect
          value={values.contract}
          onChange={(value) => onChange({ contract: value as string })}
          options={contractOptions}
        />
        <CustomSelect
          value={values.type}
          onChange={(value) => onChange({ type: value as '' | 'Long' | 'Short' })}
          options={typeOptions}
        />
        <DateInput
          value={values.start_date}
          onChange={(value) => onChange({ start_date: value })}
          className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <DateInput
          value={values.end_date}
          onChange={(value) => onChange({ end_date: value })}
          className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <CustomSelect
          value={values.profitable}
          onChange={(value) => onChange({ profitable: value as '' | 'true' | 'false' })}
          options={profitableOptions}
        />
        <CustomSelect
          value={values.has_strategy}
          onChange={(value) => onChange({ has_strategy: value as '' | 'true' | 'false' })}
          options={strategyOptions}
        />
        <div className="w-full flex items-end">
          <button
            onClick={onReset}
            className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            {t('trades:reset')}
          </button>
        </div>
      </div>
    </div>
  );
};


