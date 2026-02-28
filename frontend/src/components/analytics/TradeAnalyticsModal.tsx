import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import TradeContextForm from './TradeContextForm';
import TradeSetupForm from './TradeSetupForm';
import SessionContextForm from './SessionContextForm';
import TradeExecutionForm from './TradeExecutionForm';
import analyticsService from '../../services/analyticsService';
import {
  TradeContextFormData,
  TradeSetupFormData,
  SessionContextFormData,
  TradeExecutionFormData,
} from '../../types/analytics';

interface TradeAnalyticsModalProps {
  tradeId: number;
  onClose: () => void;
  onSuccess?: () => void;
}

type TabType = 'context' | 'setup' | 'session' | 'execution';

const TradeAnalyticsModal: React.FC<TradeAnalyticsModalProps> = ({
  tradeId,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('context');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const [contextData, setContextData] = useState<TradeContextFormData | null>(null);
  const [setupData, setSetupData] = useState<TradeSetupFormData | null>(null);
  const [sessionData, setSessionContextFormData] = useState<SessionContextFormData | null>(null);
  const [executionData, setExecutionData] = useState<TradeExecutionFormData | null>(null);

  // Charger les données existantes lors de l'ouverture
  useEffect(() => {
    let cancelled = false;
    
    setLoadingData(true);
    setError(null);
    
    analyticsService.getTradeAnalytics(tradeId)
      .then(data => {
        if (cancelled) {
          return;
        }
        
        // Transformer les données pour enlever les champs non nécessaires aux formulaires
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
        
        console.error('Erreur lors du chargement des analytics:', err);
        // Ne pas afficher d'erreur si les données n'existent pas encore
        if (!err.message.includes('404')) {
          setError(t('analytics:tradeAnalytics.error'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingData(false);
        }
      });
    
    // Cleanup lors du démontage
    return () => {
      cancelled = true;
      setContextData(null);
      setSetupData(null);
      setSessionContextFormData(null);
      setExecutionData(null);
      setActiveTab('context');
      setError(null);
      setSuccess(false);
    };
  }, [tradeId, t]);

  // La modale est toujours "ouverte" quand elle est rendue

  const handleContextSubmit = (data: TradeContextFormData) => {
    setContextData(data);
    setActiveTab('setup');
  };

  const handleContextChange = (data: TradeContextFormData) => {
    setContextData(data);
  };

  const handleSetupSubmit = (data: TradeSetupFormData) => {
    setSetupData(data);
    setActiveTab('session');
  };

  const handleSetupChange = (data: TradeSetupFormData) => {
    setSetupData(data);
  };

  const handleSessionSubmit = (data: SessionContextFormData) => {
    setSessionContextFormData(data);
    setActiveTab('execution');
  };

  const handleSessionChange = (data: SessionContextFormData) => {
    setSessionContextFormData(data);
  };

  // Fonctions de conversion pour l'API
  const convertContextForAPI = (data: TradeContextFormData | null) => {
    if (!data) return undefined;
    return {
      ...data,
      distance_from_key_level: data.distance_from_key_level?.toString() || null,
    };
  };

  const convertExecutionForAPI = (data: TradeExecutionFormData) => {
    return {
      ...data,
      partial_exit_percentage: data.partial_exit_percentage?.toString() || null,
      slippage_points: data.slippage_points?.toString() || null,
    };
  };

  const handleExecutionSubmit = async (data: TradeExecutionFormData) => {
    setExecutionData(data);
    setLoading(true);
    setError(null);

    try {
      await analyticsService.bulkCreateAnalytics({
        trade_id: tradeId,
        context: convertContextForAPI(contextData) as any,
        setup: setupData || undefined,
        session_context: sessionData || undefined,
        execution: convertExecutionForAPI(data) as any,
      });

      setSuccess(true);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || t('analytics:tradeAnalytics.error'));
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'context' as TabType, label: t('analytics:tradeAnalytics.tabs.context'), completed: !!contextData },
    { id: 'setup' as TabType, label: t('analytics:tradeAnalytics.tabs.setup'), completed: !!setupData },
    { id: 'session' as TabType, label: t('analytics:tradeAnalytics.tabs.session'), completed: !!sessionData },
    { id: 'execution' as TabType, label: t('analytics:tradeAnalytics.tabs.execution'), completed: !!executionData },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white dark:bg-gray-800 w-full max-w-5xl rounded-xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-3 sm:px-6 py-3 sm:py-5 border-b border-gray-200 dark:border-gray-700 flex items-start sm:items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-t-xl flex-shrink-0 gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-600 dark:bg-blue-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
                {t('analytics:tradeAnalytics.title')}
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                Trade #{tradeId} - {t('analytics:tradeAnalytics.title')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
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
              // Vérifier si l'onglet précédent est complété
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
                  title={!canAccess ? t('analytics:tradeAnalytics.completePreviousTab', { defaultValue: 'Complétez l\'onglet précédent pour accéder à celui-ci' }) : ''}
                >
                  {tab.label}
                  {tab.completed && (
                    <span className="ml-1 sm:ml-2">✓</span>
                  )}
                  {!canAccess && (
                    <span className="ml-1 sm:ml-2">🔒</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 bg-gray-50 dark:bg-gray-900">
          {/* Info sur les champs obligatoires */}
          <div className="mb-3 sm:mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-xs sm:text-sm text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-1">{t('analytics:tradeAnalytics.requiredFields', { defaultValue: 'Champs obligatoires' })}</p>
                <p>{t('analytics:tradeAnalytics.requiredFieldsInfo', { defaultValue: 'Les champs marqués d\'un * sont obligatoires pour passer à l\'étape suivante.' })}</p>
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
              ✓ {t('analytics:tradeAnalytics.success')}
            </div>
          )}

          {activeTab === 'context' && !loadingData && (
            <TradeContextForm
              key={`context-${tradeId}-${contextData ? 'loaded' : 'empty'}`}
              initialData={contextData || undefined}
              onSubmit={handleContextSubmit}
              onChange={handleContextChange}
              onCancel={onClose}
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
          <div className="px-3 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-b-xl">
            <div className="flex items-center justify-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 sm:h-6 sm:w-6 border-b-2 border-blue-600 dark:border-blue-400"></div>
              <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">{t('analytics:tradeAnalytics.saving')}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TradeAnalyticsModal;
