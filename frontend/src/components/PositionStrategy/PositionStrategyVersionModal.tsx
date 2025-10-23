import React, { useState, useEffect, useCallback } from 'react';
import { PositionStrategy, PositionStrategyVersion, positionStrategiesService } from '../../services/positionStrategies';

interface PositionStrategyVersionModalProps {
  strategy: PositionStrategy;
  onClose: () => void;
  onRestoreVersion: (versionId: number) => void;
}

const PositionStrategyVersionModal: React.FC<PositionStrategyVersionModalProps> = ({
  strategy,
  onClose,
  onRestoreVersion,
}) => {
  const [versions, setVersions] = useState<PositionStrategyVersion[]>([]);
  const [loading, setLoading] = useState(true);
  // const [selectedVersion, setSelectedVersion] = useState<PositionStrategyVersion | null>(null);
  // const [showVersionDetails, setShowVersionDetails] = useState(false);

  const loadVersions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await positionStrategiesService.getStrategyVersions(strategy.id);
      setVersions(data);
    } catch (error) {
      console.error('Erreur lors du chargement des versions:', error);
    } finally {
      setLoading(false);
    }
  }, [strategy.id]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  const handleRestoreVersion = (version: PositionStrategyVersion) => {
    if (window.confirm(`Êtes-vous sûr de vouloir restaurer la version ${version.version} ?`)) {
      onRestoreVersion(version.id);
    }
  };

  // const handleViewVersion = (version: PositionStrategyVersion) => {
  //   setSelectedVersion(version);
  //   setShowVersionDetails(true);
  // };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Historique des versions</h2>
            <p className="text-gray-600 mt-1">{strategy.title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune version trouvée</h3>
              <p className="text-gray-500">Cette stratégie n'a pas encore d'historique de versions.</p>
            </div>
          ) : (
            <div className="p-6">
              <div className="space-y-4">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className={`border rounded-lg p-4 transition-colors duration-200 ${
                      version.is_current
                        ? 'border-blue-200 bg-blue-50'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-semibold text-gray-900">
                              Version {version.version}
                            </span>
                            {version.is_current && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                                Actuelle
                              </span>
                            )}
                            {version.is_latest_version && !version.is_current && (
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                                Dernière
                              </span>
                            )}
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            version.status === 'active' ? 'bg-green-100 text-green-800' :
                            version.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {version.status === 'active' ? 'Active' :
                             version.status === 'draft' ? 'Brouillon' :
                             'Archivée'}
                          </span>
                        </div>

                        <div className="text-sm text-gray-600 mb-2">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>Créée le {formatDate(version.created_at)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              <span>Modifiée le {formatDate(version.updated_at)}</span>
                            </div>
                          </div>
                        </div>

                        {version.version_notes && (
                          <div className="text-sm text-gray-700 bg-gray-50 rounded-md p-3 mb-3">
                            <span className="font-medium">Notes de version:</span>
                            <p className="mt-1">{version.version_notes}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 ml-4">
                        {/* <button
                          onClick={() => handleViewVersion(version)}
                          className="px-3 py-1 text-blue-600 hover:text-blue-700 text-sm font-medium border border-blue-200 rounded-md hover:bg-blue-50 transition-colors duration-200"
                        >
                          Voir
                        </button> */}
                        {!version.is_current && (
                          <button
                            onClick={() => handleRestoreVersion(version)}
                            className="px-3 py-1 text-green-600 hover:text-green-700 text-sm font-medium border border-green-200 rounded-md hover:bg-green-50 transition-colors duration-200"
                          >
                            Restaurer
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default PositionStrategyVersionModal;
