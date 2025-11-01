import React, { useMemo } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { CustomSelect } from '../common/CustomSelect';

interface TradesFiltersProps {
  values: {
    contract: string;
    type: '' | 'Long' | 'Short';
    start_date: string;
    end_date: string;
    profitable: '' | 'true' | 'false';
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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-5 mb-4">
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center">
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
        <input
          type="date"
          value={values.start_date}
          onChange={(e) => onChange({ start_date: e.target.value })}
          className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="date"
          value={values.end_date}
          onChange={(e) => onChange({ end_date: e.target.value })}
          className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <CustomSelect
          value={values.profitable}
          onChange={(value) => onChange({ profitable: value as '' | 'true' | 'false' })}
          options={profitableOptions}
        />
        <div className="w-full">
          <button onClick={onReset} className="w-full inline-flex items-center justify-center border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors">{t('trades:reset')}</button>
        </div>
      </div>
    </div>
  );
};


