import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { tradesService, TopStepTrade } from '../services/trades';
import { TradingAccount } from '../types';
import { useLogger } from '../hooks/useLogger';
import { tradingAccountService } from '../services/tradingAccountService';
import TradesStrategyModal from '../components/Strategy/TradesStrategyModal';

// Hooks personnalisés
import { useStrategyData } from './StrategyPage/hooks/useStrategyData';
import { useCalendarData } from './StrategyPage/hooks/useCalendarData';
import { useStrategyNavigation } from './StrategyPage/hooks/useStrategyNavigation';

// Composants
import StrategyHeader from './StrategyPage/components/StrategyHeader';
import StrategyTabs from './StrategyPage/components/StrategyTabs';
import CalendarView from './StrategyPage/components/CalendarView/CalendarView';
import GlobalView from './StrategyPage/components/GlobalView/GlobalView';

// Types (StrategyTab non utilisé, supprimé)

const StrategyPage: React.FC = () => {
  const logger = useLogger('StrategyPage');
  
  // États locaux
  const [selectedAccount, setSelectedAccount] = useState<TradingAccount | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showTradesModal, setShowTradesModal] = useState(false);
  const [dayTrades, setDayTrades] = useState<TopStepTrade[]>([]);
  const [hasInitialDataLoaded, setHasInitialDataLoaded] = useState(false);
  const [isLoadingInProgress, setIsLoadingInProgress] = useState(false);

  // Hooks personnalisés
  const {
    activeTab,
    currentDate,
    currentYear,
    setActiveTab,
    setCurrentDate,
    navigateMonth,
    navigateYear,
    goToToday,
    goToCurrentYear
  } = useStrategyNavigation();

  const {
    strategyData,
    globalStrategyData,
    loading: strategyLoading,
    fetchStrategyData,
    fetchGlobalStrategyData,
    updateStrategyDataSilently
  } = useStrategyData();

  const {
    calendarData,
    loading: calendarLoading,
    fetchCalendarData
  } = useCalendarData();

  // Stabiliser selectedAccount pour éviter les re-renders inutiles
  const stableSelectedAccount = useMemo(() => selectedAccount, [selectedAccount]);

  // Chargement automatique du compte par défaut si aucun compte n'est sélectionné
  useEffect(() => {
    if (!stableSelectedAccount && !isLoadingInProgress) {
      logger.debug('⏸️ [STRATEGY] Aucun compte sélectionné, tentative de récupération automatique');
      
      const tryLoadDefaultAccount = async () => {
        try {
          // Vérifier l'authentification avant de faire des appels API
          const token = localStorage.getItem('access_token');
          if (!token) {
            logger.warn('❌ [STRATEGY] Pas de token d\'authentification, arrêt du chargement');
            setHasInitialDataLoaded(true);
            return;
          }
          
          const accounts = await tradingAccountService.getAccounts();
          const defaultAccount = accounts.find((acc: any) => acc.is_default);
          if (defaultAccount) {
            logger.debug('Récupération automatique du compte par défaut:', defaultAccount.name);
            setSelectedAccount(defaultAccount);
          } else {
            logger.warn('Aucun compte par défaut trouvé');
            setHasInitialDataLoaded(true);
          }
        } catch (error) {
          logger.warn('Erreur lors de la récupération du compte par défaut:', error);
          setHasInitialDataLoaded(true);
        }
      };
      
      // Ajouter un petit délai pour s'assurer que l'app est complètement chargée
      setTimeout(tryLoadDefaultAccount, 1000);
    }
  }, [stableSelectedAccount, isLoadingInProgress, logger]);

  // Chargement initial quand un compte est sélectionné pour la première fois
  useEffect(() => {
    if (stableSelectedAccount && !hasInitialDataLoaded && !isLoadingInProgress) {
      logger.debug('Chargement initial des données pour le compte:', stableSelectedAccount.name);
      
      const loadInitialData = async () => {
        try {
          setIsLoadingInProgress(true);
          const year = currentDate.getFullYear();
          const month = currentDate.getMonth() + 1;
          
          logger.debug('Chargement des données pour:', { year, month, accountId: stableSelectedAccount.id });
          
          // Charger les données de manière séquentielle pour éviter les timeouts
          await fetchCalendarData(year, month, stableSelectedAccount.id);
          await fetchGlobalStrategyData(stableSelectedAccount.id);
          await fetchStrategyData(year, month, stableSelectedAccount.id);
          
          logger.debug('Données initiales chargées avec succès');
          setHasInitialDataLoaded(true);
        } catch (error) {
          logger.error('Erreur lors du chargement initial:', error);
        } finally {
          setIsLoadingInProgress(false);
        }
      };
      
      loadInitialData();
    }
  }, [stableSelectedAccount, hasInitialDataLoaded, isLoadingInProgress, currentDate, fetchCalendarData, fetchGlobalStrategyData, fetchStrategyData, logger]);

  // Gérer le changement de compte
  useEffect(() => {
    if (stableSelectedAccount && hasInitialDataLoaded) {
      logger.debug('🔄 [STRATEGY] Compte changé, rechargement des données:', {
        accountId: stableSelectedAccount.id,
        accountName: stableSelectedAccount.name
      });
      
      const loadDataForNewAccount = async () => {
        try {
          const year = currentDate.getFullYear();
          const month = currentDate.getMonth() + 1;
          
          // Charger les données de manière séquentielle pour éviter les timeouts
          await fetchCalendarData(year, month, stableSelectedAccount.id);
          await fetchGlobalStrategyData(stableSelectedAccount.id);
          await fetchStrategyData(year, month, stableSelectedAccount.id);
        } catch (error) {
          logger.error('Erreur lors du rechargement pour le nouveau compte:', error);
        }
      };
      
      loadDataForNewAccount();
    }
  }, [stableSelectedAccount?.id, hasInitialDataLoaded, currentDate, fetchCalendarData, fetchGlobalStrategyData, fetchStrategyData, logger]);

  // Écouter les événements de mise à jour des trades
  useEffect(() => {
    const handleTradesUpdated = () => {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      fetchCalendarData(year, month, stableSelectedAccount?.id);
      fetchGlobalStrategyData(stableSelectedAccount?.id);
    };

    window.addEventListener('trades:updated', handleTradesUpdated);
    return () => {
      window.removeEventListener('trades:updated', handleTradesUpdated);
    };
  }, [currentDate, fetchCalendarData, fetchGlobalStrategyData, stableSelectedAccount?.id]);

  // Handlers pour les actions
  const handleDayClick = useCallback(async (dayInfo: any) => {
    if (dayInfo.isCurrentMonth) {
      setSelectedDate(dayInfo.date);
      
      const year = dayInfo.date.getFullYear();
      const month = String(dayInfo.date.getMonth() + 1).padStart(2, '0');
      const day = String(dayInfo.date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      try {
        const trades = await tradesService.getTrades(stableSelectedAccount?.id, {
          trade_day: dateStr
        });
        
        setDayTrades(Array.isArray(trades) ? trades : []);
        setShowTradesModal(true);
      } catch (error) {
        logger.error('Erreur lors du chargement des trades:', error);
        setDayTrades([]);
        setShowTradesModal(true);
      }
    }
  }, [stableSelectedAccount?.id, logger]);

  const handleSaveTradeStrategies = useCallback(async (strategies: any[]) => {
    try {
      await tradesService.bulkCreateTradeStrategies(strategies);
      
      setShowTradesModal(false);
      setDayTrades([]);
      
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      await updateStrategyDataSilently(year, month, stableSelectedAccount?.id);
      
      window.dispatchEvent(new CustomEvent('trades:updated'));
    } catch (error) {
      logger.error('Erreur lors de la sauvegarde des stratégies:', error);
    }
  }, [currentDate, stableSelectedAccount?.id, updateStrategyDataSilently, logger]);

  const handleDeleteTrade = useCallback(async (tradeId: number) => {
    try {
      await tradesService.deleteTrade(tradeId);
      
      if (selectedDate) {
        const dateStr = selectedDate.toISOString().split('T')[0];
        const trades = await tradesService.getTrades(stableSelectedAccount?.id, {
          trade_day: dateStr
        });
        setDayTrades(Array.isArray(trades) ? trades : []);
        
        if (Array.isArray(trades) && trades.length === 0) {
          setShowTradesModal(false);
          setDayTrades([]);
        }
      }
      
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      await updateStrategyDataSilently(year, month, stableSelectedAccount?.id);
    } catch (error) {
      logger.error('Erreur lors de la suppression du trade:', error);
      throw error;
    }
  }, [selectedDate, stableSelectedAccount?.id, currentDate, updateStrategyDataSilently, logger]);

  const handleMonthClick = useCallback((month: number, year: number) => {
    setActiveTab('calendar');
    setCurrentDate(new Date(year, month - 1, 1));
  }, [setActiveTab, setCurrentDate]);

  // États de chargement combinés
  const loading = {
    calendar: calendarLoading,
    strategy: strategyLoading.strategy,
    global: strategyLoading.global
  };

  // Écran de chargement initial
  if (calendarLoading && !calendarData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Chargement des données de stratégie...</p>
          <p className="text-gray-500 text-sm mt-2">Récupération des trades et analyses</p>
        </div>
      </div>
    );
  }

  // Écran quand aucun compte n'est sélectionné
  if (!stableSelectedAccount) {
    return (
      <div className="pt-1 px-6 pb-6 bg-gray-50">
        <div className="max-w-full mx-auto">
          <StrategyHeader
            selectedAccount={selectedAccount}
            onAccountChange={setSelectedAccount}
            globalStrategyData={globalStrategyData}
            isGlobalStrategyDataLoading={loading.global}
          />

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 mb-4">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Sélectionnez un compte de trading
              </h3>
              <p className="text-gray-600 mb-4">
                Pour afficher vos stratégies de trading, veuillez sélectionner un compte de trading dans le menu ci-dessus.
              </p>
              <div className="text-sm text-gray-500">
                <p className="mb-2">Si vous n'avez pas encore de compte de trading :</p>
                <ol className="list-decimal list-inside space-y-1 text-left max-w-md mx-auto">
                  <li>Allez dans le menu <strong>"Comptes de Trading"</strong> dans la barre latérale</li>
                  <li>Cliquez sur <strong>"Nouveau compte"</strong></li>
                  <li>Remplissez le formulaire et marquez-le comme <strong>"Compte par défaut"</strong></li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-1 px-6 pb-6 bg-gray-50">
      <div className="max-w-full mx-auto">
        <StrategyHeader
          selectedAccount={stableSelectedAccount}
          onAccountChange={setSelectedAccount}
          globalStrategyData={globalStrategyData}
          isGlobalStrategyDataLoading={loading.global}
        />

        <StrategyTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Contenu conditionnel selon l'onglet actif */}
        {activeTab === 'calendar' && (
          <CalendarView
            currentDate={currentDate}
            calendarData={calendarData}
            strategyData={strategyData}
            loading={loading}
            selectedAccount={stableSelectedAccount}
            onNavigateMonth={navigateMonth}
            onGoToToday={goToToday}
            onDayClick={handleDayClick}
          />
        )}

        {activeTab === 'global' && (
          <GlobalView
            currentYear={currentYear}
            selectedAccount={stableSelectedAccount}
            loading={loading}
            hasInitialDataLoaded={hasInitialDataLoaded}
            onNavigateYear={navigateYear}
            onGoToCurrentYear={goToCurrentYear}
            onMonthClick={handleMonthClick}
          />
        )}

        {/* Modal pour les trades et stratégies */}
        <TradesStrategyModal
          isOpen={showTradesModal}
          onClose={() => {
            setShowTradesModal(false);
            setDayTrades([]);
          }}
          trades={dayTrades}
          selectedDate={selectedDate ? (() => {
            const year = selectedDate.getFullYear();
            const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
            const day = String(selectedDate.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          })() : ''}
          onSave={handleSaveTradeStrategies}
          onDeleteTrade={handleDeleteTrade}
        />
      </div>
    </div>
  );
};

export default StrategyPage;
