import { useState, useCallback } from 'react';
import { tradesService } from '../../../services/trades';
import { useLogger } from '../../../hooks/useLogger';
import api from '../../../services/api';
import { 
  StrategyDataMap, 
  GlobalStrategyData, 
  StrategyLoadingState, 
  UseStrategyDataReturn 
} from '../types/strategy.types';

export const useStrategyData = (): UseStrategyDataReturn => {
  const logger = useLogger('useStrategyData');
  
  // États pour les données de stratégie
  const [strategyData, setStrategyData] = useState<StrategyDataMap>({});
  const [globalStrategyData, setGlobalStrategyData] = useState<GlobalStrategyData>({
    total: 0,
    respected: 0,
    notRespected: 0,
    percentage: 0
  });
  
  // États de chargement
  const [loading, setLoading] = useState<StrategyLoadingState>({
    calendar: false,
    strategy: false,
    global: false
  });

  // Fonction pour charger les données de stratégie par mois
  const fetchStrategyData = useCallback(async (year: number, month: number, accountId?: number) => {
    logger.debug('🚀 [STRATEGY] fetchStrategyData appelé avec:', { year, month, accountId });
    
    try {
      setLoading(prev => ({ ...prev, strategy: true }));
      
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
      const strategyMap: StrategyDataMap = {};
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
      setLoading(prev => ({ ...prev, strategy: false }));
      logger.debug('🏁 [STRATEGY] Chargement terminé');
    }
  }, [logger]);

  // Fonction pour charger les données globales de stratégie
  const fetchGlobalStrategyData = useCallback(async (accountId?: number) => {
    try {
      setLoading(prev => ({ ...prev, global: true }));
      
      // Vérifier l'authentification avant de faire l'appel API
      const token = localStorage.getItem('access_token');
      if (!token) {
        logger.warn('❌ [STRATEGY] Pas de token d\'authentification pour les données globales');
        setLoading(prev => ({ ...prev, global: false }));
        return;
      }
      
      const params = new URLSearchParams();
      if (accountId) {
        params.append('trading_account', accountId.toString());
      }
      const response = await api.get(`/trades/trade-strategies/?${params.toString()}`);
      
      // Gérer la pagination - l'API peut retourner {results: [...]} ou directement [...]
      const strategies = response.data.results || response.data;
      
      // Calculer le pourcentage global
      const totalStrategies = strategies.length;
      const respectedStrategies = strategies.filter((s: any) => s.strategy_respected === true).length;
      
      // Créer un objet avec les données globales
      const globalData: GlobalStrategyData = {
        total: totalStrategies,
        respected: respectedStrategies,
        notRespected: totalStrategies - respectedStrategies,
        percentage: totalStrategies > 0 ? (respectedStrategies / totalStrategies) * 100 : 0
      };
      
      setGlobalStrategyData(globalData);
      logger.debug('✅ [STRATEGY] Données globales chargées:', globalData);
    } catch (error) {
      logger.error('❌ [STRATEGY] Erreur lors du chargement des données globales de stratégie:', error);
    } finally {
      setLoading(prev => ({ ...prev, global: false }));
    }
  }, [logger]);

  // Fonction pour mettre à jour les données de stratégie de manière transparente
  const updateStrategyDataSilently = useCallback(async (year: number, month: number, accountId?: number) => {
    try {
      logger.debug('🔄 [STRATEGY] Mise à jour silencieuse des données de stratégie');
      await fetchStrategyData(year, month, accountId);
    } catch (error) {
      logger.error('❌ [STRATEGY] Erreur lors de la mise à jour des données de stratégie:', error);
    }
  }, [fetchStrategyData, logger]);

  return {
    strategyData,
    globalStrategyData,
    loading,
    fetchStrategyData,
    fetchGlobalStrategyData,
    updateStrategyDataSilently
  };
};
