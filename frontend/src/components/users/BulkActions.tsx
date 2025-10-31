import React from 'react';

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
  if (selectedCount === 0) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-sm font-medium text-blue-800">
            {selectedCount} utilisateur{selectedCount > 1 ? 's' : ''} sélectionné{selectedCount > 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={onClearSelection}
            className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
          >
            Annuler la sélection
          </button>
          <button
            onClick={onBulkDelete}
            className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Supprimer sélection
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkActions;
