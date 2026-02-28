import React, { useEffect, useState } from 'react';
import TradeContextForm from '../components/analytics/TradeContextForm';
import TradeSetupForm from '../components/analytics/TradeSetupForm';
import SessionContextForm from '../components/analytics/SessionContextForm';
import TradeExecutionForm from '../components/analytics/TradeExecutionForm';
import analyticsService from '../services/analyticsService';
import {
  TradeContextFormData,
  TradeSetupFormData,
  SessionContextFormData,
  TradeExecutionFormData,
} from '../types/analytics';

type TabType = 'context' | 'setup' | 'session' | 'execution';

const TradeAnalyticsDetailPage: React.FC = () => {
  const [tradeId, setTradeId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('context');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const [contextData, setContextData] = useState<TradeContextFormData | null>(null);
  const [setupData, setSetupData] = useState<TradeSetupFormData | null>(null);
  const [sessionData, setSessionContextFormData] = useState<SessionContextFormData | null>(null);
  const [executionData, setExecutionData] = useState<TradeExecutionFormData | null>(null);

  // Récupérer le tradeId depuis le hash
  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/trade-analytics\/(\d+)/);
    if (match) {
      setTradeId(parseInt(match[1], 10));
    }
  }, []);

  // Charger les données existantes
  useEffect(() => {
    if (!tradeId) return;

    let cancelled = false;
    
    setLoadingData(true);
    setError(null);
    
    analyticsService.getTradeAnalytics(tradeId)
      .then(data => {
        if (cancelled) return;
        
        if (data.context) {
          const { id, trade, created_at, updated_at, trend_alignment, ...contextFormData } = data.context as any;
          setContextData(contextFormData);
        }
        if (data.setup) {
          const { id, trade, created_at, updated_at, ...setupFormData } = data.setup as any;
          setSetupData(setupFormData);
        }
        if (data.session_context) {
          const { id, trade, created_at, updated_at, ...sessionFormData } = data.session_context as any;
          setSessionContextFormData(sessionFormData);
        }
        if (data.execution) {
          const { id, trade, created_at, updated_at, followed_trading_plan, ...executionFormData } = data.execution as any;
          setExecutionData(executionFormData);
        }
      })
      .catch(err => {
        if (cancelled) return;
        if (!err.message.includes('404')) {
          setError('Erreur lors du chargement des données');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingData(false);
        }
      });
    
    return () => {
      cancelled = true;
    };
  }, [tradeId]);

  const handleContextSubmit = (data: TradeContextFormData) => {
    setContextData(data);
    setActiveTab('setup');
  };

  const handleSetupSubmit = (data: TradeSetupFormData) => {
    setSetupData(data);
    setActiveTab('session');
  };

  const handleSessionSubmit = (data: SessionContextFormData) => {
    setSessionContextFormData(data);
    setActiveTab('execution');
  };

  const handleExecutionSubmit = async (data: TradeExecutionFormData) => {
    if (!tradeId) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Convertir les FormData en format API
      const contextForApi = contextData ? {
        ...contextData,
        distance_from_key_level: contextData.distance_from_key_level?.toString(),
      } : undefined;

      const executionForApi = {
        ...data,
        partial_exit_percentage: data.partial_exit_percentage?.toString(),
      };

      await analyticsService.bulkCreateAnalytics({
        trade_id: tradeId,
        context: contextForApi as any,
        setup: setupData as any,
        session_context: sessionData as any,
        execution: executionForApi as any,
      });

      setExecutionData(data);
      setSuccess(true);
      setTimeout(() => {
        window.history.back();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setLoading(false);
    }
  };

  const handleContextChange = (data: TradeContextFormData) => {
    setContextData(data);
  };

  const handleSetupChange = (data: TradeSetupFormData) => {
    setSetupData(data);
  };

  const handleSessionChange = (data: SessionContextFormData) => {
    setSessionContextFormData(data);
  };

  const handleClose = () => {
    window.history.back();
  };

  if (!tradeId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Trade non trouvé</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'context' as TabType, label: 'Contexte Marché', completed: !!contextData },
    { id: 'setup' as TabType, label: 'Setup', completed: !!setupData },
    { id: 'session' as TabType, label: 'Session', completed: !!sessionData },
    { id: 'execution' as TabType, label: 'Exécution', completed: !!executionData },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="px-3 sm:px-6 py-3 sm:py-5 border-b border-gray-200 dark:border-gray-700 flex items-start sm:items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 flex-shrink-0 gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-600 dark:bg-blue-500 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
              Données Analytiques
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
              Trade #{tradeId} - Analyse détaillée
            </p>
          </div>
        </div>
        <button
          onClick={handleClose}
          disabled={loading}
          className="w-8 h-8 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-colors disabled:opacity-50 flex-shrink-0"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="px-3 sm:px-6 pt-3 sm:pt-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex space-x-1 overflow-x-auto scrollbar-hide">
          {tabs.map((tab, index) => {
            const previousTab = index > 0 ? tabs[index - 1] : null;
            const canAccess = !previousTab || previousTab.completed;
            const isDisabled = loading || !canAccess;
            
            return (
              <button
                key={tab.id}
                onClick={() => canAccess && setActiveTab(tab.id)}
                disabled={isDisabled}
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-blue-600 dark:bg-blue-500 text-white'
                    : tab.completed
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
                    : canAccess
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={!canAccess ? 'Complétez l\'onglet précédent pour accéder à celui-ci' : ''}
              >
                {tab.label}
                {tab.completed && <span className="ml-1 sm:ml-2">✓</span>}
                {!canAccess && <span className="ml-1 sm:ml-2">🔒</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 bg-gray-50 dark:bg-gray-900">
        {/* Info */}
        <div className="mb-3 sm:mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-xs sm:text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium mb-1">Champs obligatoires</p>
              <p>Les champs marqués d'un <span className="text-red-500 font-bold">*</span> sont obligatoires pour passer à l'étape suivante.</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-3 sm:mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs sm:text-sm text-red-700 dark:text-red-300 break-words">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-3 sm:mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-xs sm:text-sm text-green-700 dark:text-green-300">
            ✓ Données analytiques enregistrées avec succès !
          </div>
        )}

        {activeTab === 'context' && !loadingData && (
          <TradeContextForm
            key={`context-${tradeId}-${contextData ? 'loaded' : 'empty'}`}
            initialData={contextData || undefined}
            onSubmit={handleContextSubmit}
            onChange={handleContextChange}
            onCancel={handleClose}
          />
        )}

        {activeTab === 'setup' && !loadingData && (
          <TradeSetupForm
            key={`setup-${tradeId}-${setupData ? 'loaded' : 'empty'}`}
            initialData={setupData || undefined}
            onSubmit={handleSetupSubmit}
            onChange={handleSetupChange}
            onCancel={() => setActiveTab('context')}
          />
        )}

        {activeTab === 'session' && !loadingData && (
          <SessionContextForm
            key={`session-${tradeId}-${sessionData ? 'loaded' : 'empty'}`}
            initialData={sessionData || undefined}
            onSubmit={handleSessionSubmit}
            onChange={handleSessionChange}
            onCancel={() => setActiveTab('setup')}
          />
        )}

        {activeTab === 'execution' && !loadingData && (
          <TradeExecutionForm
            key={`execution-${tradeId}-${executionData ? 'loaded' : 'empty'}`}
            initialData={executionData || undefined}
            onSubmit={handleExecutionSubmit}
            onCancel={() => setActiveTab('session')}
          />
        )}
      </div>

      {/* Footer - Loading */}
      {loading && (
        <div className="px-3 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-b-2 border-blue-600 dark:border-blue-400"></div>
            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Enregistrement en cours...</span>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default TradeAnalyticsDetailPage;
