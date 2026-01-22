import React from 'react';
import Pagination from './Pagination';
import PaginationInfo from './PaginationInfo';
import PageSizeSelector from './PageSizeSelector';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  startIndex: number;
  endIndex: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  showPageSizeSelector?: boolean;
  pageSizeOptions?: number[];
  showInfo?: boolean;
  className?: string;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  startIndex,
  endIndex,
  onPageChange,
  onPageSizeChange,
  showPageSizeSelector = true,
  pageSizeOptions = [5, 10, 25, 50, 100],
  showInfo = true,
  className = '',
}) => {
  if (!pageSizeOptions || pageSizeOptions.length === 0) {
    pageSizeOptions = [5, 10, 20, 25, 50, 100];
  }

  // Toujours afficher le conteneur si on a des items ou si le sélecteur de taille est activé
  const shouldShow = totalItems > 0 || (showPageSizeSelector && onPageSizeChange);

  if (!shouldShow) {
    return null;
  }

  const showPaginationInfo = showInfo && totalItems > 0;
  const showPaginationNav = totalPages > 1;
  const showPageSelector = showPageSizeSelector && onPageSizeChange;

  return (
    <div className={`bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-6 ${className}`}>
      <div className="flex flex-col lg:flex-row lg:flex-wrap items-center lg:items-center justify-center lg:justify-between gap-4 lg:gap-6 w-full">
        {/* Informations de pagination */}
        {showPaginationInfo && (
          <div className="w-full lg:w-auto">
            <PaginationInfo
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              startIndex={startIndex}
              endIndex={endIndex}
            />
          </div>
        )}

        {/* Navigation de pagination - seulement si plus d'une page */}
        {showPaginationNav && (
          <div className="w-full lg:w-auto">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={onPageChange}
              maxVisiblePages={5}
            />
          </div>
        )}

        {/* Sélecteur de taille de page - toujours visible si activé */}
        {showPageSelector && (
          <div className="w-full lg:w-auto flex justify-center lg:justify-end">
            <PageSizeSelector
              currentSize={itemsPerPage}
              onSizeChange={onPageSizeChange}
              options={pageSizeOptions}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PaginationControls;
