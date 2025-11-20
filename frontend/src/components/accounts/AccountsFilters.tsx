import React, { useMemo } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { CustomSelect } from '../common/CustomSelect';

interface AccountsFiltersProps {
  values: {
    account_type: '' | 'topstep' | 'ibkr' | 'ninjatrader' | 'tradovate' | 'other';
    status: '' | 'active' | 'inactive';
    search: string;
  };
  onChange: (next: Partial<AccountsFiltersProps['values']>) => void;
  onReset: () => void;
}

export const AccountsFilters: React.FC<AccountsFiltersProps> = ({ values, onChange, onReset }) => {
  const { t } = useI18nTranslation();
  
  const accountTypeOptions = useMemo(() => [
    { value: '', label: t('accounts:filters.type', { defaultValue: 'Type de compte' }) },
    { value: 'topstep', label: t('accounts:accountTypes.topstep') },
    { value: 'ibkr', label: t('accounts:accountTypes.ibkr') },
    { value: 'ninjatrader', label: t('accounts:accountTypes.ninjatrader') },
    { value: 'tradovate', label: t('accounts:accountTypes.tradovate') },
    { value: 'other', label: t('accounts:accountTypes.other') }
  ], [t]);

  const statusOptions = useMemo(() => [
    { value: '', label: t('accounts:filters.status', { defaultValue: 'Statut' }) },
    { value: 'active', label: t('accounts:status.active') },
    { value: 'inactive', label: t('accounts:status.inactive') }
  ], [t]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 md:p-5 mb-4 sm:mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
            {t('accounts:filters.search', { defaultValue: 'Rechercher' })}
          </label>
          <input
            type="text"
            value={values.search}
            onChange={(e) => onChange({ search: e.target.value })}
            placeholder={t('accounts:filters.searchPlaceholder', { defaultValue: 'Nom, ID broker...' })}
            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <CustomSelect
          value={values.account_type}
          onChange={(value) => onChange({ account_type: value as AccountsFiltersProps['values']['account_type'] })}
          options={accountTypeOptions}
        />
        <CustomSelect
          value={values.status}
          onChange={(value) => onChange({ status: value as AccountsFiltersProps['values']['status'] })}
          options={statusOptions}
        />
        <div className="w-full flex items-end">
          <button
            onClick={onReset}
            className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
          >
            {t('accounts:filters.reset', { defaultValue: 'Réinitialiser' })}
          </button>
        </div>
      </div>
    </div>
  );
};

