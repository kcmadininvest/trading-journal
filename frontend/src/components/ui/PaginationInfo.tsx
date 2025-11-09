import React from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';

interface PaginationInfoProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  startIndex: number;
  endIndex: number;
  className?: string;
}

const PaginationInfo: React.FC<PaginationInfoProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  startIndex,
  endIndex,
  className = '',
}) => {
  const { t } = useI18nTranslation();

  if (totalItems === 0) {
    return (
      <div className={`flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 ${className}`}>
        <div className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
        <span>{t('common:pagination.noItems')}</span>
      </div>
    );
  }

  const actualEndIndex = Math.min(endIndex, totalItems);
  const showingText = totalItems <= itemsPerPage 
    ? totalItems === 1
      ? t('common:pagination.showingAll', { count: totalItems })
      : t('common:pagination.showingAllPlural', { count: totalItems })
    : t('common:pagination.showingRange', { start: startIndex + 1, end: actualEndIndex, total: totalItems });

  return (
    <div className={`flex items-center space-x-4 text-sm ${className}`}>
      {/* Informations principales */}
      <div className="flex items-center space-x-2">
        <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full"></div>
        <span className="font-medium text-gray-700 dark:text-gray-300">{showingText}</span>
      </div>
      
      {/* Séparateur */}
      <div className="w-px h-4 bg-gray-300 dark:bg-gray-600"></div>
      
      {/* Informations de page */}
      <div className="flex items-center space-x-2">
        <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="text-gray-600 dark:text-gray-400">
          {t('common:pagination.page')} <span className="font-semibold text-gray-900 dark:text-gray-100">{currentPage}</span> {t('common:pagination.of')} <span className="font-semibold text-gray-900 dark:text-gray-100">{totalPages}</span>
        </span>
      </div>
    </div>
  );
};

export default PaginationInfo;
