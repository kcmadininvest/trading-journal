import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { tradesService, TopStepTrade } from '../services/trades';
import TradingAccountSelector from '../components/TradingAccount/TradingAccountSelector';
import { TradingAccount } from '../types';
import { useSelectedAccountCurrency } from '../hooks/useSelectedAccountCurrency';
import { useLogger } from '../hooks/useLogger';
import TradesStrategyModal from '../components/Strategy/TradesStrategyModal';
import StrategyRespectChart from '../components/Strategy/StrategyRespectChart';
import WinRateByStrategyChart from '../components/Strategy/WinRateByStrategyChart';
import SessionWinRateChart from '../components/Strategy/SessionWinRateChart';
import EmotionsChart from '../components/Strategy/EmotionsChart';
// import GlobalMetricsChart from '../components/Strategy/GlobalMetricsChart';
// import StrategyDistributionChart from '../components/Strategy/StrategyDistributionChart';
import YearlyCalendar from '../components/Strategy/YearlyCalendar';
import YearlyStrategyRespectChart from '../components/Strategy/YearlyStrategyRespectChart';
import YearlyWinRateByStrategyChart from '../components/Strategy/YearlyWinRateByStrategyChart';
import YearlySessionWinRateChart from '../components/Strategy/YearlySessionWinRateChart';
import YearlyEmotionsChart from '../components/Strategy/YearlyEmotionsChart';
import StrategyProgressBar from '../components/Strategy/StrategyProgressBar';
import api from '../services/api';
import { tradingAccountService } from '../services/tradingAccountService';

interface DailyData {
  date: string;
  pnl: number;
  trade_count: number;
}

interface WeeklyData {
  week: number;
  pnl: number;
  trade_count: number;
}

interface CalendarData {
  daily_data: DailyData[];
  weekly_data: WeeklyData[];
  monthly_total: number;
  year: number;
  month: number;
}



function StrategyPage() {
  const logger = useLogger('StrategyPage');
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true); // État de chargement initial
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showTradesModal, setShowTradesModal] = useState(false);
  
  logger.debug('🏗️ [STRATEGY] Composant StrategyPage initialisé');
  const [dayTrades, setDayTrades] = useState<TopStepTrade[]>([]);
  const [strategyData, setStrategyData] = useState<{ [date: string]: any }>({});
  const [selectedAccount, setSelectedAccount] = useState<TradingAccount | null>(null);
  const selectedCurrency = useSelectedAccountCurrency(selectedAccount);
  
  // Stabiliser selectedAccount pour éviter les re-renders inutiles
  const stableSelectedAccount = useMemo(() => selectedAccount, [selectedAccount?.id]);
  
  logger.debug('📊 [STRATEGY] État de selectedAccount:', {
    selectedAccount: stableSelectedAccount,
    selectedAccountId: stableSelectedAccount?.id,
    selectedAccountName: stableSelectedAccount?.name,
    hasSelectedAccount: !!stableSelectedAccount
  });
  
  // Debug supplémentaire pour comprendre le problème
  console.log('🔍 [STRATEGY] Debug account selection:', {
    selectedAccount: selectedAccount,
    stableSelectedAccount: stableSelectedAccount,
    selectedAccountId: selectedAccount?.id,
    stableSelectedAccountId: stableSelectedAccount?.id,
    hasSelectedAccount: !!selectedAccount,
    hasStableSelectedAccount: !!stableSelectedAccount
  });
  const [isUpdatingStrategy, setIsUpdatingStrategy] = useState(false);
  const [isStrategyDataLoading, setIsStrategyDataLoading] = useState(false);
  const [hasInitialDataLoaded, setHasInitialDataLoaded] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isLoadingInProgress, setIsLoadingInProgress] = useState(false);
  const [lastSelectedAccount, setLastSelectedAccount] = useState<number | undefined>(undefined);
  
  // État pour les données globales de stratégie
  const [globalStrategyData, setGlobalStrategyData] = useState<{ [date: string]: any }>({});
  const [isGlobalStrategyDataLoading, setIsGlobalStrategyDataLoading] = useState(false);
  
  // Nouvel état pour les onglets
  const [activeTab, setActiveTab] = useState<'calendar' | 'global'>('calendar');
  
  // État pour l'année courante dans la vue globale
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const fetchStrategyData = useCallback(async (year: number, month: number, accountId?: number) => {
    logger.debug('🚀 [STRATEGY] fetchStrategyData appelé avec:', { year, month, accountId });
    try {
      setIsStrategyDataLoading(true);
      
      // Vérifier l'authentification
      const token = localStorage.getItem('access_token');
      if (!token) {
        logger.warn('❌ [STRATEGY] Pas de token d\'authentification, arrêt du chargement');
        setStrategyData({});
        return;
      }
      
      logger.debug('🚀 [STRATEGY] Début du chargement des données de stratégie');
      logger.debug(`📅 [STRATEGY] Paramètres: year=${year}, month=${month}, accountId=${accountId}`);
      
      // Charger les stratégies jour par jour pour le mois courant
      const strategyMap: { [date: string]: any } = {};
      const endDate = new Date(year, month, 0); // Dernier jour du mois
      
      logger.debug(`📅 [STRATEGY] Mois: ${month}, Dernier jour: ${endDate.getDate()}`);
      
      // Créer les promesses pour chaque jour du mois
      const dayPromises = [];
      for (let day = 1; day <= endDate.getDate(); day++) {
        const date = new Date(year, month - 1, day);
        const dateStr = date.toISOString().split('T')[0];
        
        logger.debug(`📅 [STRATEGY] Préparation requête pour ${dateStr}`);
        
        dayPromises.push(
          tradesService.getTradeStrategiesByDate(dateStr, accountId)
            .then(strategies => {
              logger.debug(`✅ [STRATEGY] ${dateStr}: ${strategies?.length || 0} stratégies chargées`);
              if (strategies && strategies.length > 0) {
                logger.debug(`📊 [STRATEGY] ${dateStr}: Détail des stratégies:`, strategies);
              }
              return { date: dateStr, strategies };
            })
            .catch(error => {
              logger.warn(`❌ [STRATEGY] Erreur pour ${dateStr}:`, error);
              logger.warn(`🔍 [STRATEGY] Détail de l'erreur:`, {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data
              });
              return { date: dateStr, strategies: [] };
            })
        );
      }
      
      logger.debug(`⏳ [STRATEGY] Attente de ${dayPromises.length} requêtes...`);
      
      // Attendre toutes les requêtes
      const results = await Promise.all(dayPromises);
      
      logger.debug(`📊 [STRATEGY] Résultats reçus pour ${results.length} jours`);
      
      // Traiter les résultats
      let totalStrategies = 0;
      let totalRespected = 0;
      
      results.forEach(({ date, strategies }) => {
        logger.debug(`📅 [STRATEGY] Traitement ${date}: ${strategies?.length || 0} stratégies`);
        
        if (strategies && strategies.length > 0) {
          totalStrategies += strategies.length;
          
          const respectedCount = strategies.filter((s: any) => s.strategy_respected === true).length;
          const totalCount = strategies.length;
          totalRespected += respectedCount;
          
          logger.debug(`📊 [STRATEGY] ${date}: ${respectedCount}/${totalCount} stratégies respectées`);
          
          // Séparer les trades respectés et non respectés avec leurs métadonnées
          const respectedTrades = strategies
            .filter((s: any) => s.strategy_respected === true)
            .map((s: any) => ({ 
              pnl: parseFloat(s.trade_info?.net_pnl || 0),
              tp1_reached: s.tp1_reached || false,
              tp2_plus_reached: s.tp2_plus_reached || false,
              dominant_emotions: s.dominant_emotions || []
            }));
          
          const notRespectedTrades = strategies
            .filter((s: any) => s.strategy_respected === false)
            .map((s: any) => ({ 
              pnl: parseFloat(s.trade_info?.net_pnl || 0),
              tp1_reached: s.tp1_reached || false,
              tp2_plus_reached: s.tp2_plus_reached || false,
              dominant_emotions: s.dominant_emotions || []
            }));
          
          strategyMap[date] = {
            total: totalCount,
            respected: respectedCount,
            notRespected: totalCount - respectedCount,
            percentage: totalCount > 0 ? (respectedCount / totalCount) * 100 : 0,
            respectedTrades,
            notRespectedTrades
          };
          
          logger.debug(`📈 [STRATEGY] ${date}: Données calculées:`, {
            total: totalCount,
            respected: respectedCount,
            percentage: strategyMap[date].percentage,
            respectedTradesCount: respectedTrades.length,
            notRespectedTradesCount: notRespectedTrades.length
          });
        } else {
          logger.debug(`📅 [STRATEGY] ${date}: Aucune stratégie trouvée`);
        }
      });
      
      logger.debug(`📊 [STRATEGY] Résumé global: ${totalRespected}/${totalStrategies} stratégies respectées`);
      logger.debug(`📊 [STRATEGY] Résultat final strategyMap:`, strategyMap);
      logger.debug(`📊 [STRATEGY] Nombre de jours avec données: ${Object.keys(strategyMap).length}`);
      
      setStrategyData(strategyMap);
      
      // Vérifier si les données sont suffisantes pour les graphiques
      if (Object.keys(strategyMap).length === 0) {
        logger.warn('⚠️ [STRATEGY] Aucune donnée de stratégie trouvée pour les graphiques');
      } else {
        logger.info(`✅ [STRATEGY] Données chargées avec succès: ${Object.keys(strategyMap).length} jours`);
      }
    } catch (error: any) {
      logger.error('❌ [STRATEGY] Erreur lors du chargement des données de stratégie:', error);
      logger.error('🔍 [STRATEGY] Détail de l\'erreur:', {
        message: error.message,
        stack: error.stack,
        response: error.response?.data
      });
      setStrategyData({});
    } finally {
      setIsStrategyDataLoading(false);
      logger.debug('🏁 [STRATEGY] Chargement terminé');
    }
  }, [stableSelectedAccount?.id, logger, currentDate]); // Added logger to dependencies

  const fetchCalendarData = useCallback(async (year: number, month: number) => {
    try {
      setLoading(true);
      const accountId = stableSelectedAccount?.id;
      const data = await tradesService.getCalendarData(year, month, accountId);
      setCalendarData(data);
      
      // Récupérer les données de stratégie pour le mois
      await fetchStrategyData(year, month, accountId);
    } catch (error) {
      // Erreur silencieuse lors du chargement des données du calendrier
      console.error('Erreur lors du chargement des données du calendrier:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchStrategyData, stableSelectedAccount]);

  const fetchGlobalStrategyData = useCallback(async () => {
    try {
      setIsGlobalStrategyDataLoading(true);
      const params = new URLSearchParams();
      if (stableSelectedAccount?.id) {
        params.append('trading_account', stableSelectedAccount.id.toString());
      }
      const response = await api.get(`/trades/trade-strategies/?${params.toString()}`);
      
      // Gérer la pagination - l'API peut retourner {results: [...]} ou directement [...]
      const strategies = response.data.results || response.data;
      
      // Calculer le pourcentage global
      const totalStrategies = strategies.length;
      const respectedStrategies = strategies.filter((s: any) => s.strategy_respected === true).length;
      
      // Créer un objet avec les données globales
      const globalData = {
        total: totalStrategies,
        respected: respectedStrategies,
        notRespected: totalStrategies - respectedStrategies,
        percentage: totalStrategies > 0 ? (respectedStrategies / totalStrategies) * 100 : 0
      };
      
      // Stocker dans globalStrategyData pour la compatibilité avec le composant
      setGlobalStrategyData({ 'global': globalData });
    } catch (error) {
      console.error('Erreur lors du chargement des données globales de stratégie:', error);
    } finally {
      setIsGlobalStrategyDataLoading(false);
    }
  }, [stableSelectedAccount]);

  // Fonction pour mettre à jour les données de stratégie de manière transparente
  const updateStrategyDataSilently = async (year: number, month: number) => {
    try {
      setIsUpdatingStrategy(true);
      const accountId = stableSelectedAccount?.id;
      await fetchStrategyData(year, month, accountId);
    } catch (error) {
      console.error('Erreur lors de la mise à jour des données de stratégie:', error);
    } finally {
      setIsUpdatingStrategy(false);
    }
  };

  // Chargement automatique du compte par défaut si aucun compte n'est sélectionné
  useEffect(() => {
    if (!stableSelectedAccount && !isLoadingInProgress) {
      logger.debug('⏸️ [STRATEGY] Aucun compte sélectionné, tentative de récupération automatique');
      
      const tryLoadDefaultAccount = async () => {
        try {
          const accounts = await tradingAccountService.getAccounts();
          const defaultAccount = accounts.find((acc: any) => acc.is_default);
          if (defaultAccount) {
            console.log('🔄 [STRATEGY] Récupération automatique du compte par défaut:', defaultAccount.name);
            setSelectedAccount(defaultAccount);
          } else {
            console.log('⚠️ [STRATEGY] Aucun compte par défaut trouvé');
            setHasInitialDataLoaded(true);
          }
        } catch (error) {
          console.warn('⚠️ [STRATEGY] Erreur lors de la récupération du compte par défaut:', error);
          setHasInitialDataLoaded(true);
        }
      };
      
      tryLoadDefaultAccount();
    }
  }, [stableSelectedAccount, isLoadingInProgress]);

  // Gérer le changement de compte séparément
  useEffect(() => {
    console.log('🔄 [STRATEGY] useEffect account change triggered:', {
      stableSelectedAccount: stableSelectedAccount,
      hasInitialDataLoaded: hasInitialDataLoaded,
      accountId: stableSelectedAccount?.id,
      accountName: stableSelectedAccount?.name
    });
    
    if (stableSelectedAccount && hasInitialDataLoaded) {
      logger.debug('🔄 [STRATEGY] Compte changé, rechargement des données:', {
        accountId: stableSelectedAccount.id,
        accountName: stableSelectedAccount.name
      });
      
      // Recharger les données pour le nouveau compte
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      
      const loadDataForNewAccount = async () => {
        try {
          await Promise.all([
            fetchCalendarData(year, month),
            fetchGlobalStrategyData(),
            fetchStrategyData(year, month, stableSelectedAccount.id)
          ]);
        } catch (error) {
          console.error('Erreur lors du rechargement pour le nouveau compte:', error);
        }
      };
      
      loadDataForNewAccount();
    }
  }, [stableSelectedAccount?.id]); // Seulement quand l'ID du compte change

  // Chargement initial quand un compte est sélectionné pour la première fois
  useEffect(() => {
    if (stableSelectedAccount && !hasInitialDataLoaded && !isLoadingInProgress) {
      console.log('🚀 [STRATEGY] Chargement initial des données pour le compte:', stableSelectedAccount.name);
      
      const loadInitialData = async () => {
        try {
          setIsLoadingInProgress(true);
          const year = currentDate.getFullYear();
          const month = currentDate.getMonth() + 1;
          
          console.log('📅 [STRATEGY] Chargement des données pour:', { year, month, accountId: stableSelectedAccount.id });
          
          await Promise.all([
            fetchCalendarData(year, month),
            fetchGlobalStrategyData(),
            fetchStrategyData(year, month, stableSelectedAccount.id)
          ]);
          
          console.log('✅ [STRATEGY] Données initiales chargées avec succès');
          setHasInitialDataLoaded(true);
          setLastSelectedAccount(stableSelectedAccount.id);
        } catch (error) {
          console.error('❌ [STRATEGY] Erreur lors du chargement initial:', error);
        } finally {
          setIsLoadingInProgress(false);
        }
      };
      
      loadInitialData();
    }
  }, [stableSelectedAccount?.id, hasInitialDataLoaded, isLoadingInProgress]);

  // Écouter les événements de mise à jour des trades pour recharger le calendrier
  useEffect(() => {
    const handleTradesUpdated = () => {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      fetchCalendarData(year, month);
      fetchGlobalStrategyData(); // Mettre à jour les données globales de stratégie
    };

    window.addEventListener('trades:updated', handleTradesUpdated);
    return () => {
      window.removeEventListener('trades:updated', handleTradesUpdated);
      // Nettoyer les timeouts au démontage
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, loadingTimeout]); // Retiré fetchCalendarData des dépendances


  const { dailyData, monthlyTotal } = useMemo(() => {
    if (!calendarData) {
      return { dailyData: [], monthlyTotal: 0 };
    }

    return {
      dailyData: calendarData.daily_data,
      monthlyTotal: calendarData.monthly_total
    };
  }, [calendarData]);

  // Générer le calendrier
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    
    const days = [];
    
    // Ajouter les jours du mois précédent
    const prevMonth = new Date(year, month - 1, 0);
    for (let i = firstDayOfWeek; i > 0; i--) {
      days.push({
        day: prevMonth.getDate() - i + 1,
        isCurrentMonth: false,
        date: new Date(year, month - 1, prevMonth.getDate() - i + 1)
      });
    }
    
    // Ajouter les jours du mois courant
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        day,
        isCurrentMonth: true,
        date: new Date(year, month, day)
      });
    }
    
    // Ajouter les jours du mois suivant
    const totalDays = days.length;
    const completeWeeks = Math.ceil(totalDays / 7);
    
    if (completeWeeks < 6) {
      const daysInLastWeek = totalDays % 7;
      if (daysInLastWeek > 0) {
        const remainingDays = 7 - daysInLastWeek;
        for (let day = 1; day <= remainingDays; day++) {
          days.push({
            day,
            isCurrentMonth: false,
            date: new Date(year, month + 1, day)
          });
        }
      }
    }
    
    return days;
  }, [currentDate]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: selectedAccount?.currency || 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getResponsiveTextSize = (amount: number) => {
    const formattedAmount = formatCurrency(amount);
    const length = formattedAmount.length;
    
    if (length > 8) return 'text-sm';
    if (length > 6) return 'text-base';
    if (length > 4) return 'text-lg';
    return 'text-xl';
  };

  const getDayData = (day: number) => {
    return dailyData.find(d => parseInt(d.date) === day);
  };

  const getStrategyIndicator = (day: number) => {
    logger.debug(`🔍 [INDICATOR] getStrategyIndicator appelé pour le jour ${day}`);
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const date = new Date(year, month - 1, day);
    
    // Utiliser le formatage manuel pour éviter les problèmes de fuseau horaire
    const yearStr = date.getFullYear();
    const monthStr = String(date.getMonth() + 1).padStart(2, '0');
    const dayStr = String(date.getDate()).padStart(2, '0');
    const dateStr = `${yearStr}-${monthStr}-${dayStr}`;
    
    logger.debug(`📅 [INDICATOR] Date formatée: ${dateStr}`);
    logger.debug(`📊 [INDICATOR] strategyData disponible:`, {
      keys: Object.keys(strategyData),
      hasDataForDate: !!strategyData[dateStr],
      dataForDate: strategyData[dateStr]
    });
    
    const data = strategyData[dateStr];
    
    if (!data) {
      logger.debug(`❌ [INDICATOR] Aucune donnée pour ${dateStr}, retour null`);
      return null;
    }
    
    // Logique binaire : si au moins un trade n'est pas respecté, la stratégie n'est pas respectée
    const isRespected = data.respected === data.total && data.total > 0;
    
    logger.debug(`📈 [INDICATOR] Calcul pour ${dateStr}:`, {
      respected: data.respected,
      total: data.total,
      isRespected,
      percentage: data.percentage
    });
    
    const result = {
      isRespected,
      color: isRespected ? 'bg-blue-500' : 'bg-gray-500',
      text: isRespected ? 'Stratégie respectée' : 'Stratégie non respectée'
    };
    
    logger.debug(`✅ [INDICATOR] Résultat pour ${dateStr}:`, result);
    
    return result;
  };


  const isToday = (dayInfo: any) => {
    const today = new Date();
    return dayInfo.isCurrentMonth && 
           dayInfo.date.getDate() === today.getDate() &&
           dayInfo.date.getMonth() === today.getMonth() &&
           dayInfo.date.getFullYear() === today.getFullYear();
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Navigation par année pour la vue globale
  const navigateYear = (direction: 'prev' | 'next') => {
    const newYear = direction === 'prev' ? currentYear - 1 : currentYear + 1;
    setCurrentYear(newYear);
  };

  const goToCurrentYear = () => {
    setCurrentYear(new Date().getFullYear());
  };

  const handleDayClick = async (dayInfo: any) => {
    if (dayInfo.isCurrentMonth) {
      setSelectedDate(dayInfo.date);
      
      // Récupérer les trades pour cette date
      const year = dayInfo.date.getFullYear();
      const month = String(dayInfo.date.getMonth() + 1).padStart(2, '0');
      const day = String(dayInfo.date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      try {
        // Récupérer les trades pour cette date
        const trades = await tradesService.getTrades(selectedAccount?.id, {
          trade_day: dateStr
        });
        
        setDayTrades(Array.isArray(trades) ? trades : []);
        setShowTradesModal(true);
      } catch (error) {
        console.error('Erreur lors du chargement des trades:', error);
        setDayTrades([]);
        setShowTradesModal(true);
      }
    }
  };

  const handleSaveTradeStrategies = async (strategies: any[]) => {
    try {
      // Sauvegarder toutes les stratégies en une fois
      await tradesService.bulkCreateTradeStrategies(strategies);
      
      // Fermer la modale immédiatement
      setShowTradesModal(false);
      setDayTrades([]);
      
      // Mettre à jour les données de stratégie de manière transparente
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      await updateStrategyDataSilently(year, month);
      
      // Déclencher l'événement pour notifier les autres composants
      window.dispatchEvent(new CustomEvent('trades:updated'));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des stratégies:', error);
    }
  };

  const handleDeleteTrade = async (tradeId: number) => {
    try {
      // Supprimer le trade
      await tradesService.deleteTrade(tradeId);
      
      // Recharger les trades pour cette date
      if (selectedDate) {
        const dateStr = selectedDate.toISOString().split('T')[0];
        const trades = await tradesService.getTrades(selectedAccount?.id, {
          trade_day: dateStr
        });
        setDayTrades(Array.isArray(trades) ? trades : []);
        
        // Si plus de trades, fermer la modale
        if (Array.isArray(trades) && trades.length === 0) {
          setShowTradesModal(false);
          setDayTrades([]);
        }
      }
      
      // Mettre à jour les données de stratégie de manière transparente
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      await updateStrategyDataSilently(year, month);
    } catch (error) {
      console.error('Erreur lors de la suppression du trade:', error);
      throw error; // Re-throw pour que la modale puisse afficher l'erreur
    }
  };




  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const weekDays = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  // Écran de chargement initial
  if (loading && !calendarData) {
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
          {/* En-tête */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Stratégie de Trading</h1>
              <p className="text-gray-600">Planifiez et suivez vos stratégies de trading avec le calendrier intégré</p>
            </div>
          </div>

          {/* Sélecteur de compte de trading */}
          <div className="flex justify-between items-center mb-6">
            <TradingAccountSelector
              selectedAccountId={selectedAccount?.id}
              onAccountChange={setSelectedAccount}
              className="flex items-center space-x-2"
            />
          </div>

          {/* Message d'information */}
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
        {/* En-tête */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Stratégie de Trading</h1>
            <p className="text-gray-600">Planifiez et suivez vos stratégies de trading avec le calendrier intégré</p>
          </div>
          
          {/* Barre de progression du respect global de la stratégie */}
          <div className="flex-shrink-0">
            <StrategyProgressBar
              respectPercentage={globalStrategyData.global?.percentage || 0}
              totalTrades={globalStrategyData.global?.total || 0}
              respectedTrades={globalStrategyData.global?.respected || 0}
              isLoading={isGlobalStrategyDataLoading}
            />
          </div>
        </div>

        {/* Sélecteur de compte de trading */}
        <div className="flex justify-between items-center mb-6">
          <TradingAccountSelector
            selectedAccountId={selectedAccount?.id}
            onAccountChange={setSelectedAccount}
            className="flex items-center space-x-2"
          />
          {stableSelectedAccount && (
            <div className="text-sm text-gray-600">
              Stratégies pour le compte "{stableSelectedAccount.name}"
            </div>
          )}
        </div>

        {/* Onglets de navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('calendar')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'calendar'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Calendrier</span>
                </div>
              </button>
              
              
              <button
                onClick={() => setActiveTab('global')}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'global'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span>Vue globale</span>
                </div>
              </button>
            </nav>
          </div>
        </div>


        {/* Contenu conditionnel selon l'onglet actif */}
        {activeTab === 'calendar' && (
          <>
            {/* Navigation du calendrier - seulement visible pour l'onglet calendrier */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigateMonth('prev')}
                  className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                <h2 className="text-2xl font-bold text-gray-900">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h2>
                
                <button
                  onClick={() => navigateMonth('next')}
                  className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="text-sm text-gray-600">P/L Mensuel:</div>
                <div className={`text-2xl font-bold ${monthlyTotal >= 0 ? 'text-blue-600' : 'text-gray-600'}`}>
                  {formatCurrency(monthlyTotal)}
                </div>
                {/* Indicateur de mise à jour en cours */}
                {isUpdatingStrategy && (
                  <div className="flex items-center space-x-1 text-sm text-blue-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span>Mise à jour...</span>
                  </div>
                )}
              </div>
              
              <button
                onClick={goToToday}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Aujourd'hui
              </button>
            </div>

            {/* Layout principal : Graphiques + Calendrier + Graphique Sessions */}
            <div className="flex flex-col xl:flex-row gap-6">
          {/* Graphiques de gauche */}
          <div className="w-full xl:w-96 xl:flex-shrink-0 flex flex-col space-y-4">
            {/* Graphique de respect de la stratégie */}
            <div className="flex-1">
              <StrategyRespectChart strategyData={strategyData} isLoading={isStrategyDataLoading} />
            </div>
            
            {/* Graphique de win rate par stratégie */}
            <div className="flex-1">
              <WinRateByStrategyChart strategyData={strategyData} isLoading={isStrategyDataLoading} />
            </div>
        </div>

        {/* Calendrier */}
          <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* En-têtes */}
            <div className="grid grid-cols-7 border-b border-gray-200">
              {weekDays.map((day, index) => (
                <div key={day} className="p-3 text-center text-sm font-medium text-gray-600 bg-gray-50">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Indicateur de chargement initial si pas de données */}
            {!calendarData && (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <div className="text-sm text-gray-600">Chargement du calendrier...</div>
                </div>
              </div>
            )}

            {/* Grille du calendrier - seulement si les données sont disponibles */}
            {calendarData && (
              <div className="grid grid-cols-7">
                {calendarDays.map((dayInfo, index) => {
                  const dayData = dayInfo.isCurrentMonth ? getDayData(dayInfo.day) : null;
                  const today = isToday(dayInfo);
                  const isSaturday = index % 7 === 6; // Samedi est le 7ème jour (index 6)
                  
                  // Calculer le total de la semaine pour les samedis
                  let weekTotal = 0;
                  let weekTradeCount = 0;
                  let hasCurrentMonthDays = false;
                  
                  if (isSaturday) {
                    const weekStart = Math.floor(index / 7) * 7;
                    const weekEnd = Math.min(weekStart + 7, calendarDays.length);
                    const weekDays = calendarDays.slice(weekStart, weekEnd);
                    
                    weekDays.forEach(weekDayInfo => {
                      if (weekDayInfo.isCurrentMonth) {
                        hasCurrentMonthDays = true;
                        const weekDayData = getDayData(weekDayInfo.day);
                        if (weekDayData) {
                          weekTotal += weekDayData.pnl;
                          weekTradeCount += weekDayData.trade_count;
                        }
                      }
                    });
                  }
                  
                  return (
                    <div 
                      key={index} 
                      className={`border-r border-b border-gray-200 min-h-[140px] p-2 cursor-pointer hover:bg-gray-50 transition-colors ${today ? 'bg-violet-50 border-violet-200' : ''} ${isSaturday ? 'bg-violet-50' : ''}`}
                      onClick={() => handleDayClick(dayInfo)}
                    >
                      {dayInfo.isCurrentMonth ? (
                        <div className="h-full flex flex-col">
                          <div className={`text-base font-medium mb-1 ${today ? 'text-violet-600 font-bold' : 'text-gray-900'}`}>
                            {dayInfo.day}
                          </div>
                          
                          {/* Section pour les sessions de stratégie */}
                          <div className="flex-1 space-y-1">
                            {(() => {
                              const indicator = getStrategyIndicator(dayInfo.day);
                              if (indicator) {
                                return (
                                  <div className="flex flex-col items-center justify-center space-y-1">
                                    <div 
                                      className={`w-8 h-8 rounded-full ${indicator.color}`}
                                      title={indicator.text}
                                    ></div>
                                    <div className="text-sm text-center leading-tight">
                                      <div className={`font-medium ${indicator.isRespected ? 'text-blue-600' : 'text-gray-600'}`}>
                                        {indicator.isRespected ? 'Respectée' : 'Non respectée'}
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>

                          {/* Données de trading ou total de semaine pour samedi */}
                          {isSaturday ? (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                              <div className="text-xs text-gray-600 mb-1">Total semaine</div>
                              {hasCurrentMonthDays && weekTradeCount > 0 ? (
                                <>
                                  <div className={`${getResponsiveTextSize(weekTotal)} font-bold ${weekTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(weekTotal)}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {weekTradeCount} trade{weekTradeCount > 1 ? 's' : ''}
                                  </div>
                                </>
                              ) : (
                                <div className="text-sm text-gray-400">$0.00</div>
                              )}
                            </div>
                          ) : (
                            dayData && dayData.trade_count > 0 && (
                              <div className="mt-2 pt-2 border-t border-gray-100">
                                <div className={`${getResponsiveTextSize(dayData.pnl)} font-bold ${dayData.pnl >= 0 ? 'text-blue-600' : 'text-gray-600'}`}>
                                  {formatCurrency(dayData.pnl)}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {dayData.trade_count} trade{dayData.trade_count > 1 ? 's' : ''}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <div className="text-base text-gray-300">{dayInfo.day}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Graphiques de droite */}
          <div className="w-full xl:w-96 xl:flex-shrink-0 flex flex-col space-y-4">
            {/* Graphique de sessions gagnantes */}
            <div className="flex-1">
              {(() => {
                logger.debug('📊 [CHARTS] Rendu SessionWinRateChart avec:', {
                  strategyDataKeys: Object.keys(strategyData),
                  strategyDataLength: Object.keys(strategyData).length,
                  isLoading: isStrategyDataLoading,
                  hasData: Object.keys(strategyData).length > 0,
                  strategyDataContent: strategyData
                });
                logger.debug('📊 [CHARTS] État complet de strategyData:', strategyData);
                return <SessionWinRateChart strategyData={strategyData} isLoading={isStrategyDataLoading} />;
              })()}
            </div>
            
            {/* Graphique d'émotions dominantes */}
            <div className="flex-1">
              {(() => {
                logger.debug('📊 [CHARTS] Rendu EmotionsChart avec:', {
                  strategyDataKeys: Object.keys(strategyData),
                  strategyDataLength: Object.keys(strategyData).length,
                  isLoading: isStrategyDataLoading,
                  hasData: Object.keys(strategyData).length > 0
                });
                return <EmotionsChart strategyData={strategyData} isLoading={isStrategyDataLoading} />;
              })()}
            </div>
          </div>
        </div>
          </>
        )}


        {/* Onglet Vue globale */}
        {activeTab === 'global' && (
          <>
            {/* Navigation de l'année - seulement visible pour l'onglet global */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigateYear('prev')}
                  className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                <h2 className="text-2xl font-bold text-gray-900">
                  Année {currentYear}
                </h2>
                
                <button
                  onClick={() => navigateYear('next')}
                  className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              
              <button
                onClick={goToCurrentYear}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Année Courante
              </button>
            </div>

            {/* Layout principal : Graphiques + Calendrier Annuel + Graphiques */}
            <div className="flex flex-col xl:flex-row gap-6">
              {/* Graphiques de gauche */}
              <div className="w-full xl:w-96 xl:flex-shrink-0 flex flex-col space-y-4">
                {/* Graphique de respect de la stratégie */}
                <div className="flex-1">
                  {hasInitialDataLoaded && <YearlyStrategyRespectChart year={currentYear} selectedAccount={selectedAccount} isLoading={isStrategyDataLoading} />}
                </div>
                
                {/* Graphique de win rate par stratégie */}
                <div className="flex-1">
                  {hasInitialDataLoaded && <YearlyWinRateByStrategyChart year={currentYear} selectedAccount={selectedAccount} isLoading={isStrategyDataLoading} />}
                </div>
              </div>
              
              {/* Calendrier Annuel */}
              <div className="flex-1">
                {hasInitialDataLoaded && stableSelectedAccount && (
                  <YearlyCalendar 
                    key={`calendar-${stableSelectedAccount.id}-${currentYear}`}
                    year={currentYear} 
                    selectedAccount={stableSelectedAccount}
                    currency={selectedCurrency}
                    onMonthClick={(month, year) => {
                      setActiveTab('calendar');
                      setCurrentDate(new Date(year, month - 1, 1));
                    }}
                  />
                )}
              </div>
              
              {/* Graphiques de droite */}
              <div className="w-full xl:w-96 xl:flex-shrink-0 flex flex-col space-y-4">
                {/* Graphique de sessions gagnantes */}
                <div className="flex-1">
                  {hasInitialDataLoaded && <YearlySessionWinRateChart year={currentYear} selectedAccount={selectedAccount} isLoading={isStrategyDataLoading} />}
                </div>
                
                {/* Graphique d'émotions dominantes */}
                <div className="flex-1">
                  {hasInitialDataLoaded && <YearlyEmotionsChart year={currentYear} selectedAccount={selectedAccount} isLoading={isStrategyDataLoading} />}
                </div>
              </div>
            </div>
          </>
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
}

export default StrategyPage;