import React, { useId, useMemo } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';

interface PageSizeSelectorProps {
  currentSize: number;
  onSizeChange: (size: number) => void;
  options?: number[];
  className?: string;
}

const PageSizeSelector: React.FC<PageSizeSelectorProps> = ({
  currentSize,
  onSizeChange,
  options = [5, 10, 25, 50, 100],
  className = '',
}) => {
  const { t } = useI18nTranslation();
  const selectId = useId();

  // S'assurer que currentSize est dans les options, sinon l'ajouter
  const allOptions = useMemo(() => {
    const optsSet = new Set(options);
    const sorted = optsSet.has(currentSize) 
      ? [...options].sort((a, b) => a - b)
      : [...options, currentSize].sort((a, b) => a - b);
    return sorted.map(size => ({ value: size, label: size.toString() }));
  }, [options, currentSize]);

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <div className="flex items-center space-x-2">
        <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
        <label htmlFor={selectId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('common:pagination.itemsPerPage')}
        </label>
      </div>

      <div className="relative">
        <select
          id={selectId}
          value={currentSize}
          onChange={(e) => onSizeChange(Number(e.target.value))}
          className="w-24 cursor-pointer appearance-none rounded-md border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        >
          {allOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span
          className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2"
          aria-hidden
        >
          <svg
            className="h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </div>
    </div>
  );
};

export default PageSizeSelector;
