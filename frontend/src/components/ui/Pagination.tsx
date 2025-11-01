import React from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showFirstLast?: boolean;
  showPrevNext?: boolean;
  maxVisiblePages?: number;
  className?: string;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  showFirstLast = true,
  showPrevNext = true,
  maxVisiblePages = 5,
  className = '',
}) => {
  const { t } = useI18nTranslation();
  // Si il n'y a qu'une page ou moins, ne pas afficher la pagination
  if (totalPages <= 1) {
    return null;
  }

  // Calculer les pages à afficher
  const getVisiblePages = () => {
    const pages: (number | string)[] = [];
    const halfVisible = Math.floor(maxVisiblePages / 2);
    
    let startPage = Math.max(1, currentPage - halfVisible);
    let endPage = Math.min(totalPages, currentPage + halfVisible);
    
    // Ajuster si on est proche du début ou de la fin
    if (currentPage <= halfVisible) {
      endPage = Math.min(totalPages, maxVisiblePages);
    }
    if (currentPage >= totalPages - halfVisible) {
      startPage = Math.max(1, totalPages - maxVisiblePages + 1);
    }
    
    // Ajouter les pages visibles
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    // Ajouter les ellipses si nécessaire
    if (startPage > 1) {
      if (startPage > 2) {
        pages.unshift('...');
      }
      pages.unshift(1);
    }
    
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pages.push('...');
      }
      pages.push(totalPages);
    }
    
    return pages;
  };

  const visiblePages = getVisiblePages();

  const handlePageClick = (page: number | string) => {
    if (typeof page === 'number') {
      onPageChange(page);
    }
  };

  const getButtonClasses = (page: number | string, isActive = false) => {
    const baseClasses = 'relative inline-flex items-center justify-center w-10 h-10 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
    const activeClasses = 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg transform scale-105 focus:ring-blue-500';
    const inactiveClasses = 'bg-white text-gray-700 border border-gray-300 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:text-gray-900 hover:border-gray-400 hover:shadow-md focus:ring-blue-500';
    const disabledClasses = 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed';
    
    if (typeof page === 'string') {
      return `${baseClasses} ${disabledClasses}`;
    }
    
    if (isActive) {
      return `${baseClasses} ${activeClasses}`;
    }
    
    return `${baseClasses} ${inactiveClasses}`;
  };

  return (
    <div className={`flex items-center justify-center space-x-1 ${className}`}>
      {/* Premier page */}
      {showFirstLast && currentPage > 1 && (
        <button
          onClick={() => handlePageClick(1)}
          className="relative inline-flex items-center justify-center w-10 h-10 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-l-lg hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:text-gray-900 hover:border-gray-400 hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label={t('common:pagination.firstPage')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Page précédente */}
      {showPrevNext && currentPage > 1 && (
        <button
          onClick={() => handlePageClick(currentPage - 1)}
          className="relative inline-flex items-center justify-center w-10 h-10 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:text-gray-900 hover:border-gray-400 hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label={t('common:pagination.previousPage')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Pages numérotées */}
      {visiblePages.map((page, index) => (
        <button
          key={index}
          onClick={() => handlePageClick(page)}
          className={getButtonClasses(page, page === currentPage)}
          disabled={typeof page === 'string'}
          aria-label={typeof page === 'number' ? t('common:pagination.pageNumber', { number: page }) : undefined}
          aria-current={page === currentPage ? 'page' : undefined}
        >
          {page}
        </button>
      ))}

      {/* Page suivante */}
      {showPrevNext && currentPage < totalPages && (
        <button
          onClick={() => handlePageClick(currentPage + 1)}
          className="relative inline-flex items-center justify-center w-10 h-10 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:text-gray-900 hover:border-gray-400 hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label={t('common:pagination.nextPage')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Dernière page */}
      {showFirstLast && currentPage < totalPages && (
        <button
          onClick={() => handlePageClick(totalPages)}
          className="relative inline-flex items-center justify-center w-10 h-10 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-r-lg hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:text-gray-900 hover:border-gray-400 hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label={t('common:pagination.lastPage')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default Pagination;
