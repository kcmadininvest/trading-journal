import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { positionStrategiesService, PositionStrategy } from '../services/positionStrategies';
import PositionStrategyVersionModal from '../components/PositionStrategy/PositionStrategyVersionModal';
import PrintModal from '../components/PositionStrategy/PrintModal';

const ArchivesPage: React.FC = () => {
  const [archives, setArchives] = useState<PositionStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<PositionStrategy | null>(null);

  const loadArchives = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterStatus !== 'all') {
        params.status = filterStatus;
      }
      if (searchQuery) {
        params.search = searchQuery;
      }
      
      const data = await positionStrategiesService.getArchives(params);
      setArchives(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erreur lors du chargement des archives:', error);
      toast.error('Erreur lors du chargement des archives');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, searchQuery]);

  useEffect(() => {
    loadArchives();
  }, [loadArchives]);

  const handleShowVersions = useCallback((strategy: PositionStrategy) => {
    setSelectedStrategy(strategy);
    setShowVersionModal(true);
  }, []);

  const handleShowPrint = useCallback((strategy: PositionStrategy) => {
    setSelectedStrategy(strategy);
    setShowPrintModal(true);
  }, []);

  const handleRestoreVersion = useCallback(async (versionId: number) => {
    if (!selectedStrategy) return;
    
    try {
      await positionStrategiesService.restoreVersion(selectedStrategy.id, versionId);
      toast.success('Version restaurée avec succès');
      setShowVersionModal(false);
      loadArchives();
    } catch (error) {
      console.error('Erreur lors de la restauration:', error);
      toast.error('Erreur lors de la restauration de la version');
    }
  }, [selectedStrategy, loadArchives]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'archived':
        return 'bg-gray-100 text-gray-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'archived':
        return 'Archivée';
      case 'draft':
        return 'Brouillon';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6">
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Archives des Stratégies</h1>
            <p className="text-gray-600">
              Consultez l'historique des versions de vos stratégies de position.
            </p>
          </div>

      {/* Filtres et recherche */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Rechercher dans les archives..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Active</option>
            <option value="archived">Archivée</option>
            <option value="draft">Brouillon</option>
          </select>
        </div>
      </div>

      {/* Statistiques */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-gray-900">{archives.length}</div>
          <div className="text-sm text-gray-600">Total des archives</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-green-600">
            {archives.filter(s => s.status === 'active').length}
          </div>
          <div className="text-sm text-gray-600">Versions actives archivées</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-yellow-600">
            {archives.filter(s => s.status === 'draft').length}
          </div>
          <div className="text-sm text-gray-600">Brouillons archivés</div>
        </div>
      </div>

      {/* Liste des archives */}
      {archives.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg mb-2">Aucune archive trouvée</div>
          <div className="text-gray-400">
            {searchQuery || filterStatus !== 'all' 
              ? 'Essayez de modifier vos critères de recherche'
              : 'Les versions archivées apparaîtront ici'
            }
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {archives.map((strategy) => (
            <div key={strategy.id} className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {strategy.title}
                  </h3>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(strategy.status)}`}>
                      {getStatusLabel(strategy.status)}
                    </span>
                    <span className="text-sm text-gray-500">v{strategy.version}</span>
                  </div>
                </div>
              </div>

              {strategy.description && (
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {strategy.description}
                </p>
              )}

              <div className="mb-4">
                <div className="text-sm text-gray-600">
                  {strategy.strategy_content?.sections && strategy.strategy_content.sections.length > 0 ? (
                    <div className="space-y-1">
                      {strategy.strategy_content.sections.slice(0, 2).map((section, index) => (
                        <div key={index} className="flex items-center">
                          <span className="font-medium">{section.title}:</span>
                          <span className="ml-2">{section.rules.length} règle(s)</span>
                        </div>
                      ))}
                      {strategy.strategy_content.sections.length > 2 && (
                        <div className="text-gray-500 text-xs">
                          +{strategy.strategy_content.sections.length - 2} autre(s) section(s)
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-gray-500">Aucune section définie</div>
                  )}
                </div>
              </div>

              <div className="text-xs text-gray-500 mb-4">
                Créé le {new Date(strategy.created_at).toLocaleDateString('fr-FR')}
                {strategy.version_notes && (
                  <div className="mt-1">
                    <strong>Notes:</strong> {strategy.version_notes}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleShowVersions(strategy)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center justify-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Historique
                </button>
                <button
                  onClick={() => handleShowPrint(strategy)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center justify-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2z" />
                  </svg>
                  Imprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showVersionModal && selectedStrategy && (
        <PositionStrategyVersionModal
          strategy={selectedStrategy}
          onClose={() => {
            setShowVersionModal(false);
            setSelectedStrategy(null);
          }}
          onRestoreVersion={handleRestoreVersion}
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
        </div>
      </div>
    </div>
  );
};

export default ArchivesPage;
