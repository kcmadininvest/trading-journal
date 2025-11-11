import React from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';

interface BulkActionsProps {
  selectedCount: number;
  onBulkDelete: () => void;
  onClearSelection: () => void;
}

const BulkActions: React.FC<BulkActionsProps> = ({
  selectedCount,
  onBulkDelete,
  onClearSelection,
}) => {
  const { t } = useI18nTranslation();
  
  if (selectedCount === 0) return null;

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
        <div className="flex items-center">
          <span className="text-xs sm:text-sm font-medium text-blue-800 dark:text-blue-300">
            {selectedCount === 1 
              ? t('users:bulkActions.selected', { count: selectedCount })
              : t('users:bulkActions.selectedPlural', { count: selectedCount })
            }
          </span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:space-x-2 sm:gap-0">
          <button
            onClick={onClearSelection}
            className="px-3 py-1.5 sm:py-1 text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
          >
            {t('users:bulkActions.clearSelection')}
          </button>
          <button
            onClick={onBulkDelete}
            className="px-3 py-1.5 sm:py-1 text-xs sm:text-sm bg-red-600 dark:bg-red-500 text-white rounded-md hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
          >
            {t('users:bulkActions.deleteSelection')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkActions;
