import React, { useMemo } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { CustomSelect } from '../common/CustomSelect';

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
        <label htmlFor="page-size" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('common:pagination.itemsPerPage')}
        </label>
      </div>
      
      <div className="relative">
        <CustomSelect
          value={currentSize}
          onChange={(value) => onSizeChange(value as number)}
          options={allOptions}
          className="w-20"
        />
      </div>
    </div>
  );
};

export default PageSizeSelector;
