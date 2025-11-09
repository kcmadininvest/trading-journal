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
  return (
    <div className={`bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-6 ${className}`}>
      <div className="flex flex-col lg:flex-row items-center justify-between space-y-4 lg:space-y-0 lg:space-x-6">
        {/* Informations de pagination */}
        {showInfo && (
          <div className="flex-shrink-0">
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

        {/* Navigation de pagination */}
        <div className="flex-shrink-0">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
            maxVisiblePages={5}
          />
        </div>

        {/* Sélecteur de taille de page */}
        {showPageSizeSelector && onPageSizeChange && (
          <div className="flex-shrink-0">
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
