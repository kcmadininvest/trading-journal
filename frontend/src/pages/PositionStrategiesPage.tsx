import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { positionStrategiesService, PositionStrategy } from '../services/positionStrategies';
import PositionStrategyCard from '../components/PositionStrategy/PositionStrategyCard';
import FlexibleStrategyModal from '../components/PositionStrategy/FlexibleStrategyModal';
import PositionStrategyVersionModal from '../components/PositionStrategy/PositionStrategyVersionModal';
import PrintModal from '../components/PositionStrategy/PrintModal';
import StrategyReadMode from '../components/PositionStrategy/StrategyReadMode';

function PositionStrategiesPage() {
  const [strategies, setStrategies] = useState<PositionStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showReadMode, setShowReadMode] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<PositionStrategy | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [operationLoading, setOperationLoading] = useState<{[key: string]: boolean}>({});

  const loadStrategies = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterStatus !== 'all') {
        params.status = filterStatus;
      }
      if (searchQuery) {
        params.search = searchQuery;
      }
      
      const data = await positionStrategiesService.getStrategies(params);
      setStrategies(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erreur lors du chargement des stratégies:', error);
      toast.error('Erreur lors du chargement des stratégies');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, searchQuery]);

  useEffect(() => {
    loadStrategies();
  }, [loadStrategies]);

  const handleCreateStrategy = useCallback(async (data: any) => {
    try {
      await positionStrategiesService.createStrategy(data);
      toast.success('Stratégie créée avec succès');
      setShowCreateModal(false);
      loadStrategies();
    } catch (error) {
      console.error('Erreur lors de la création:', error);
      toast.error('Erreur lors de la création de la stratégie');
    }
  }, [loadStrategies]);

  const handleUpdateStrategy = useCallback(async (id: number, data: any) => {
    try {
      await positionStrategiesService.updateStrategy(id, data);
      toast.success('Stratégie mise à jour avec succès');
      setShowEditModal(false);
      setSelectedStrategy(null);
      loadStrategies();
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      toast.error('Erreur lors de la mise à jour de la stratégie');
    }
  }, [loadStrategies]);

  const handleDeleteStrategy = useCallback(async (id: number) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette stratégie ?')) {
      return;
    }

    setOperationLoading(prev => ({ ...prev, [`delete-${id}`]: true }));
    try {
      await positionStrategiesService.deleteStrategy(id);
      toast.success('Stratégie supprimée avec succès');
      loadStrategies();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      toast.error('Erreur lors de la suppression de la stratégie');
    } finally {
      setOperationLoading(prev => ({ ...prev, [`delete-${id}`]: false }));
    }
  }, [loadStrategies]);

  const handleDuplicateStrategy = useCallback(async (id: number) => {
    setOperationLoading(prev => ({ ...prev, [`duplicate-${id}`]: true }));
    try {
      await positionStrategiesService.duplicateStrategy(id);
      toast.success('Stratégie dupliquée avec succès');
      loadStrategies();
    } catch (error) {
      console.error('Erreur lors de la duplication:', error);
      toast.error('Erreur lors de la duplication de la stratégie');
    } finally {
      setOperationLoading(prev => ({ ...prev, [`duplicate-${id}`]: false }));
    }
  }, [loadStrategies]);

  const handleShowVersions = useCallback((strategy: PositionStrategy) => {
    setSelectedStrategy(strategy);
    setShowVersionModal(true);
  }, []);

  const handleShowPrint = useCallback((strategy: PositionStrategy) => {
    setSelectedStrategy(strategy);
    setShowPrintModal(true);
  }, []);

  const handleReadMode = useCallback((strategy: PositionStrategy) => {
    setSelectedStrategy(strategy);
    setShowReadMode(true);
  }, []);

  const handleEditStrategy = useCallback((strategy: PositionStrategy) => {
    setSelectedStrategy(strategy);
    setShowEditModal(true);
  }, []);

  const filteredStrategies = (strategies || []).filter(strategy => {
    if (filterStatus !== 'all' && strategy.status !== filterStatus) {
      return false;
    }
    if (searchQuery && !strategy.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !strategy.description.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Mes Stratégies de Position</h1>
              <p className="text-gray-600 mt-2">Gérez vos stratégies de trading avec historique des versions</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nouvelle Stratégie
            </button>
          </div>

          {/* Filters and Search */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Rechercher une stratégie..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tous les statuts</option>
                <option value="draft">Brouillons</option>
                <option value="active">Actives</option>
                <option value="archived">Archivées</option>
              </select>
            </div>
          </div>
        </div>

        {/* Strategies Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredStrategies.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune stratégie trouvée</h3>
            <p className="text-gray-500 mb-4">
              {searchQuery || filterStatus !== 'all' 
                ? 'Aucune stratégie ne correspond à vos critères de recherche.'
                : 'Commencez par créer votre première stratégie de position.'
              }
            </p>
            {!searchQuery && filterStatus === 'all' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
              >
                Créer ma première stratégie
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStrategies.map((strategy) => (
              <PositionStrategyCard
                key={strategy.id}
                strategy={strategy}
                onEdit={handleEditStrategy}
                onDelete={handleDeleteStrategy}
                onDuplicate={handleDuplicateStrategy}
                onShowVersions={handleShowVersions}
                onShowPrint={handleShowPrint}
                onReadMode={handleReadMode}
                loadingStates={{
                  delete: operationLoading[`delete-${strategy.id}`] || false,
                  duplicate: operationLoading[`duplicate-${strategy.id}`] || false
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <FlexibleStrategyModal
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreateStrategy}
        />
      )}

      {showEditModal && selectedStrategy && (
        <FlexibleStrategyModal
          strategy={selectedStrategy}
          onClose={() => {
            setShowEditModal(false);
            setSelectedStrategy(null);
          }}
          onSave={(data) => handleUpdateStrategy(selectedStrategy.id, data)}
        />
      )}

      {showVersionModal && selectedStrategy && (
        <PositionStrategyVersionModal
          strategy={selectedStrategy}
          onClose={() => {
            setShowVersionModal(false);
            setSelectedStrategy(null);
          }}
          onRestoreVersion={async (versionId) => {
            try {
              await positionStrategiesService.restoreVersion(selectedStrategy.id, versionId);
              toast.success('Version restaurée avec succès');
              setShowVersionModal(false);
              setSelectedStrategy(null);
              loadStrategies();
            } catch (error) {
              console.error('Erreur lors de la restauration:', error);
              toast.error('Erreur lors de la restauration de la version');
            }
          }}
        />
      )}

      {showPrintModal && selectedStrategy && (
        <PrintModal
          strategy={selectedStrategy}
          onClose={() => {
            setShowPrintModal(false);
            setSelectedStrategy(null);
          }}
        />
      )}

      {showReadMode && selectedStrategy && (
        <StrategyReadMode
          strategyId={selectedStrategy.id}
          onClose={() => {
            setShowReadMode(false);
            setSelectedStrategy(null);
          }}
        />
      )}
    </div>
  );
}

export default PositionStrategiesPage;
