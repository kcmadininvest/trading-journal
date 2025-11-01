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
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-sm font-medium text-blue-800 dark:text-blue-300">
            {selectedCount === 1 
              ? t('users:bulkActions.selected', { count: selectedCount })
              : t('users:bulkActions.selectedPlural', { count: selectedCount })
            }
          </span>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={onClearSelection}
            className="px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            {t('users:bulkActions.clearSelection')}
          </button>
          <button
            onClick={onBulkDelete}
            className="px-3 py-1 text-sm bg-red-600 dark:bg-red-500 text-white rounded hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
          >
            {t('users:bulkActions.deleteSelection')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkActions;
