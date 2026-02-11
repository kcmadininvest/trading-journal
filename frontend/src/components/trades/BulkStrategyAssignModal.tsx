import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { tradesService } from '../../services/trades';
import { positionStrategiesService, PositionStrategy } from '../../services/positionStrategies';
import { CustomSelect } from '../common/CustomSelect';
import { useTranslation as useI18nTranslation } from 'react-i18next';

interface BulkStrategyAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedTradeIds: number[];
}

export const BulkStrategyAssignModal: React.FC<BulkStrategyAssignModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  selectedTradeIds,
}) => {
  const { t } = useI18nTranslation();
  const [strategies, setStrategies] = useState<PositionStrategy[]>([]);
  const [loadingStrategies, setLoadingStrategies] = useState(false);
  const [selectedStrategyId, setSelectedStrategyId] = useState<number | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStrategies = useCallback(async () => {
    setLoadingStrategies(true);
    try {
      const list = await positionStrategiesService.list({ 
        status: 'active',
        is_current: true 
      });
      setStrategies(list);
    } catch {
      setStrategies([]);
      setError(t('trades:bulkAssignStrategy.loadError', { defaultValue: 'Erreur lors du chargement des stratégies' }));
    } finally {
      setLoadingStrategies(false);
    }
  }, [t]);

  useEffect(() => {
    if (isOpen) {
      loadStrategies();
      setSelectedStrategyId(null);
      setError(null);
    }
  }, [isOpen, loadStrategies]);

  const strategyOptions = useMemo(() => [
    { value: null, label: t('trades:bulkAssignStrategy.noStrategy', { defaultValue: 'Aucune stratégie' }) },
    ...strategies.map(strategy => ({
      value: strategy.id,
      label: `${strategy.title}${strategy.version > 1 ? ` (v${strategy.version})` : ''}`
    }))
  ], [strategies, t]);

  const handleAssign = async () => {
    setIsAssigning(true);
    setError(null);

    try {
      const result = await tradesService.bulkAssignStrategy(selectedTradeIds, selectedStrategyId);
      
      if (result.success) {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || t('trades:bulkAssignStrategy.error', { defaultValue: 'Erreur lors de l\'assignation' }));
    } finally {
      setIsAssigning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />
        
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {t('trades:bulkAssignStrategy.title', { defaultValue: 'Assigner une stratégie' })}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              disabled={isAssigning}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {t('trades:bulkAssignStrategy.description', { 
                count: selectedTradeIds.length,
                defaultValue: `Sélectionnez une stratégie à assigner aux ${selectedTradeIds.length} trades sélectionnés`
              })}
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('trades:bulkAssignStrategy.strategyLabel', { defaultValue: 'Stratégie' })}
              </label>
              <CustomSelect
                options={strategyOptions}
                value={selectedStrategyId}
                onChange={(value) => setSelectedStrategyId(value as number | null)}
                placeholder={t('trades:bulkAssignStrategy.selectStrategy', { defaultValue: 'Sélectionner une stratégie' })}
                disabled={loadingStrategies || isAssigning}
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isAssigning}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('common:cancel', { defaultValue: 'Annuler' })}
            </button>
            <button
              onClick={handleAssign}
              disabled={isAssigning || loadingStrategies}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isAssigning && (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {t('trades:bulkAssignStrategy.assign', { defaultValue: 'Assigner' })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
