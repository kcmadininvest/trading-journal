import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { tradesService, TradeListItem } from '../../services/trades';
import { tradeStrategiesService, TradeStrategy, BulkStrategyData } from '../../services/tradeStrategies';
import { dayStrategyComplianceService, DayStrategyCompliance } from '../../services/dayStrategyCompliance';
import { Tooltip } from '../ui';
import DeleteConfirmModal from '../ui/DeleteConfirmModal';
import { usePreferences } from '../../hooks/usePreferences';
import { formatCurrencyWithSign } from '../../utils/numberFormat';
import { formatDateLong, formatTime } from '../../utils/dateFormat';
import { useTranslation as useI18nTranslation } from 'react-i18next';

interface StrategyComplianceModalProps {
  open: boolean;
  date: string; // YYYY-MM-DD
  onClose: (saved?: boolean) => void;
  tradingAccount?: number;
}

// Liste des clés d'émotions pour le trading
const EMOTION_KEYS = [
  'confiance', 'peur', 'avarice', 'frustration', 'impatience', 'patience',
  'euphorie', 'anxiete', 'colere', 'satisfaction', 'deception', 'calme',
  'stress', 'determination', 'doute', 'excitation', 'lassitude', 'fatigue',
  'panique', 'optimisme'
];

interface TradeWithStrategy extends TradeListItem {
  strategy?: TradeStrategy;
  strategyRespected: boolean | null;
  gainIfStrategyRespected: boolean | null;
  dominantEmotions: string[];
  screenshotUrl: string;
  videoUrl: string;
  tp1Reached: boolean;
  tp2PlusReached: boolean;
  emotionDetails: string;
  possibleImprovements: string;
  sessionRating: number | null;
}

export const StrategyComplianceModal: React.FC<StrategyComplianceModalProps> = ({
  open,
  date,
  onClose,
  tradingAccount,
}) => {
  const { preferences } = usePreferences();
  const { t } = useI18nTranslation();
  const [trades, setTrades] = useState<TradeWithStrategy[]>([]);
  const [isDayWithoutTrades, setIsDayWithoutTrades] = useState(false);
  const [dayCompliance, setDayCompliance] = useState<DayStrategyCompliance | null>(null);
  
  // Obtenir les émotions traduites
  const TRADING_EMOTIONS = useMemo(() => {
    return EMOTION_KEYS.map(key => ({
      value: key,
      label: t(`trades:emotions.${key}`)
    }));
  }, [t]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const isInitialLoad = useRef(true);
  const serverDataRef = useRef<TradeWithStrategy[]>([]); // Garder une référence aux données du serveur
  const serverDayComplianceRef = useRef<DayStrategyCompliance | null>(null); // Garder une référence à la compliance du serveur

  // Clé pour le localStorage basée sur la date et le compte de trading
  const draftKey = useMemo(() => {
    if (!date) return null;
    const accountKey = tradingAccount ? `-${tradingAccount}` : '';
    return `strategy-compliance-draft-${date}${accountKey}`;
  }, [date, tradingAccount]);


  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Charger les trades
      const tradesResponse = await tradesService.list({
        trade_day: date,
        trading_account: tradingAccount ?? undefined,
        page_size: 100,
      });

      // Si aucun trade, c'est un jour sans trade - charger la compliance si elle existe
      if (tradesResponse.results.length === 0) {
        setIsDayWithoutTrades(true);
        try {
          const compliance = await dayStrategyComplianceService.byDate(date, tradingAccount ?? undefined);
          let finalCompliance = compliance;
          
          // Restaurer les données depuis localStorage si disponibles
          if (draftKey) {
            try {
              const draft = localStorage.getItem(draftKey);
              if (draft) {
                const draftData = JSON.parse(draft);
                if (draftData.isDayWithoutTrades && draftData.dayCompliance) {
                  // Fusionner les données du serveur avec le brouillon
                  finalCompliance = {
                    ...(compliance || {
                      id: 0,
                      user: 0,
                      user_username: '',
                      date: date,
                      trading_account: tradingAccount ?? null,
                      trading_account_name: null,
                      strategy_respected: null,
                      dominant_emotions: [],
                      session_rating: null,
                      emotion_details: '',
                      possible_improvements: '',
                      screenshot_url: '',
                      video_url: '',
                      emotions_display: '',
                      created_at: '',
                      updated_at: '',
                    }),
                    ...draftData.dayCompliance,
                  } as DayStrategyCompliance;
                  
                  // Vérifier s'il y a des changements
                  if (compliance) {
                    const hasChanges =
                      finalCompliance.strategy_respected !== compliance.strategy_respected ||
                      JSON.stringify(finalCompliance.dominant_emotions || []) !== JSON.stringify(compliance.dominant_emotions || []) ||
                      (finalCompliance.screenshot_url || '') !== (compliance.screenshot_url || '') ||
                      (finalCompliance.video_url || '') !== (compliance.video_url || '') ||
                      (finalCompliance.emotion_details || '') !== (compliance.emotion_details || '') ||
                      (finalCompliance.possible_improvements || '') !== (compliance.possible_improvements || '') ||
                      finalCompliance.session_rating !== compliance.session_rating;
                    setHasUnsavedChanges(hasChanges);
                  } else {
                    // Nouvelle compliance avec données
                    const hasData = !!(
                      finalCompliance.strategy_respected !== null ||
                      (finalCompliance.dominant_emotions || []).length > 0 ||
                      finalCompliance.session_rating !== null ||
                      finalCompliance.emotion_details ||
                      finalCompliance.possible_improvements ||
                      finalCompliance.screenshot_url ||
                      finalCompliance.video_url
                    );
                    setHasUnsavedChanges(hasData);
                  }
                  
                  setTimeout(() => {
                    isInitialLoad.current = false;
                  }, 100);
                }
              }
            } catch (e) {
              console.warn('Erreur lors de la restauration du brouillon:', e);
            }
          }
          
          if (finalCompliance) {
            setDayCompliance(finalCompliance);
            serverDayComplianceRef.current = compliance || null;
          } else {
            setDayCompliance(null);
            serverDayComplianceRef.current = null;
          }
        } catch (e) {
          // Pas de compliance existante, ce n'est pas grave
          setDayCompliance(null);
          serverDayComplianceRef.current = null;
        }
        setIsLoading(false);
        return;
      }

      // Si des trades existent, c'est le mode normal
      setIsDayWithoutTrades(false);
      setDayCompliance(null);

      // Charger les stratégies existantes
      let strategies: TradeStrategy[] = [];
      try {
        strategies = await tradeStrategiesService.byDate(date, tradingAccount ?? undefined);
      } catch (e) {
        // Pas de stratégies existantes, ce n'est pas grave
      }

      // Créer une map des stratégies par trade_id (l'ID numérique du trade)
      const strategiesMap = new Map<number, TradeStrategy>();
      strategies.forEach((strategy) => {
        // strategy.trade est l'ID numérique du trade TopStepTrade
        strategiesMap.set(strategy.trade, strategy);
      });

      // Combiner les données
      const tradesWithStrategy: TradeWithStrategy[] = tradesResponse.results.map((trade) => {
        const strategy = strategiesMap.get(trade.id);
        return {
          ...trade,
          strategy,
          strategyRespected: strategy?.strategy_respected ?? null,
          gainIfStrategyRespected: strategy?.gain_if_strategy_respected ?? null,
          dominantEmotions: strategy?.dominant_emotions ?? [],
          screenshotUrl: strategy?.screenshot_url ?? '',
          videoUrl: strategy?.video_url ?? '',
          tp1Reached: strategy?.tp1_reached ?? false,
          tp2PlusReached: strategy?.tp2_plus_reached ?? false,
          emotionDetails: strategy?.emotion_details ?? '',
          possibleImprovements: strategy?.possible_improvements ?? '',
          sessionRating: strategy?.session_rating ?? null,
        };
      });

      // Trier du plus ancien au plus récent (par entered_at)
      tradesWithStrategy.sort((a, b) => {
        const dateA = new Date(a.entered_at).getTime();
        const dateB = new Date(b.entered_at).getTime();
        return dateA - dateB;
      });

      // Restaurer les données depuis localStorage si disponibles
      if (draftKey) {
        try {
          const draft = localStorage.getItem(draftKey);
          if (draft) {
            const draftData = JSON.parse(draft);
            // Appliquer les données du brouillon aux trades correspondants
            let hasChanges = false;
            const tradesWithDraft = tradesWithStrategy.map((trade) => {
              const draftTrade = draftData.find((d: any) => d.id === trade.id);
              if (draftTrade) {
                // Vérifier s'il y a des différences avec les données du serveur
                // Normaliser les valeurs null/undefined pour la comparaison
                const draftStrategyRespected = draftTrade.strategyRespected ?? null;
                const serverStrategyRespected = trade.strategyRespected ?? null;
                const draftGainIfStrategyRespected = draftTrade.gainIfStrategyRespected ?? null;
                const serverGainIfStrategyRespected = trade.gainIfStrategyRespected ?? null;
                const draftSessionRating = draftTrade.sessionRating ?? null;
                const serverSessionRating = trade.sessionRating ?? null;
                
                const hasTradeChanges = 
                  draftStrategyRespected !== serverStrategyRespected ||
                  draftGainIfStrategyRespected !== serverGainIfStrategyRespected ||
                  JSON.stringify(draftTrade.dominantEmotions || []) !== JSON.stringify(trade.dominantEmotions || []) ||
                  (draftTrade.screenshotUrl || '') !== (trade.screenshotUrl || '') ||
                  (draftTrade.videoUrl || '') !== (trade.videoUrl || '') ||
                  (draftTrade.tp1Reached || false) !== (trade.tp1Reached || false) ||
                  (draftTrade.tp2PlusReached || false) !== (trade.tp2PlusReached || false) ||
                  (draftTrade.emotionDetails || '') !== (trade.emotionDetails || '') ||
                  (draftTrade.possibleImprovements || '') !== (trade.possibleImprovements || '') ||
                  draftSessionRating !== serverSessionRating;
                
                if (hasTradeChanges) {
                  hasChanges = true;
                }
                
                return {
                  ...trade,
                  strategyRespected: draftTrade.strategyRespected ?? trade.strategyRespected,
                  gainIfStrategyRespected: draftTrade.gainIfStrategyRespected ?? trade.gainIfStrategyRespected,
                  dominantEmotions: draftTrade.dominantEmotions ?? trade.dominantEmotions,
                  screenshotUrl: draftTrade.screenshotUrl ?? trade.screenshotUrl,
                  videoUrl: draftTrade.videoUrl ?? trade.videoUrl,
                  tp1Reached: draftTrade.tp1Reached ?? trade.tp1Reached,
                  tp2PlusReached: draftTrade.tp2PlusReached ?? trade.tp2PlusReached,
                  emotionDetails: draftTrade.emotionDetails ?? trade.emotionDetails,
                  possibleImprovements: draftTrade.possibleImprovements ?? trade.possibleImprovements,
                  sessionRating: draftTrade.sessionRating ?? trade.sessionRating,
                };
              }
              return trade;
            });
            serverDataRef.current = tradesWithStrategy; // Sauvegarder les données du serveur
            setTrades(tradesWithDraft);
            // Ne mettre hasUnsavedChanges à true que s'il y a vraiment des différences
            setHasUnsavedChanges(hasChanges);
            // Utiliser setTimeout pour éviter que le useEffect de sauvegarde auto se déclenche immédiatement
            setTimeout(() => {
              isInitialLoad.current = false;
            }, 100);
            return;
          }
        } catch (e) {
          // Erreur lors de la lecture du localStorage, ignorer et continuer
          console.warn('Erreur lors de la restauration du brouillon:', e);
        }
      }

      serverDataRef.current = tradesWithStrategy; // Sauvegarder les données du serveur
      setTrades(tradesWithStrategy);
      setHasUnsavedChanges(false);
      // Utiliser setTimeout pour éviter que le useEffect de sauvegarde auto se déclenche immédiatement
      setTimeout(() => {
        isInitialLoad.current = false;
      }, 100);
    } catch (e: any) {
      setError(e?.message || t('common:error'));
    } finally {
      setIsLoading(false);
    }
  }, [date, tradingAccount, t, draftKey]);

  // Sauvegarder automatiquement dans localStorage à chaque modification
  useEffect(() => {
    // Ne pas sauvegarder lors du chargement initial
    if (isInitialLoad.current || !draftKey) {
      return;
    }

    // Mode jour sans trade
    if (isDayWithoutTrades) {
      if (!dayCompliance) {
        return;
      }

      // Comparer avec les données du serveur
      const serverCompliance = serverDayComplianceRef.current;
      let hasRealChanges = false;

      if (serverCompliance) {
        const complianceStrategyRespected = dayCompliance.strategy_respected ?? null;
        const serverStrategyRespected = serverCompliance.strategy_respected ?? null;
        const complianceSessionRating = dayCompliance.session_rating ?? null;
        const serverSessionRating = serverCompliance.session_rating ?? null;

        hasRealChanges =
          complianceStrategyRespected !== serverStrategyRespected ||
          JSON.stringify(dayCompliance.dominant_emotions || []) !== JSON.stringify(serverCompliance.dominant_emotions || []) ||
          (dayCompliance.screenshot_url || '') !== (serverCompliance.screenshot_url || '') ||
          (dayCompliance.video_url || '') !== (serverCompliance.video_url || '') ||
          (dayCompliance.emotion_details || '') !== (serverCompliance.emotion_details || '') ||
          (dayCompliance.possible_improvements || '') !== (serverCompliance.possible_improvements || '') ||
          complianceSessionRating !== serverSessionRating;
      } else {
        // Si on n'a pas encore de données serveur, vérifier s'il y a des données
        hasRealChanges = !!(
          dayCompliance.strategy_respected !== null ||
          (dayCompliance.dominant_emotions || []).length > 0 ||
          dayCompliance.session_rating !== null ||
          dayCompliance.emotion_details ||
          dayCompliance.possible_improvements ||
          dayCompliance.screenshot_url ||
          dayCompliance.video_url
        );
      }

      try {
        if (hasRealChanges) {
          localStorage.setItem(draftKey, JSON.stringify({
            isDayWithoutTrades: true,
            dayCompliance: {
              strategy_respected: dayCompliance.strategy_respected,
              dominant_emotions: dayCompliance.dominant_emotions,
              session_rating: dayCompliance.session_rating,
              emotion_details: dayCompliance.emotion_details,
              possible_improvements: dayCompliance.possible_improvements,
              screenshot_url: dayCompliance.screenshot_url,
              video_url: dayCompliance.video_url,
            }
          }));
          setHasUnsavedChanges(true);
        } else {
          localStorage.removeItem(draftKey);
          setHasUnsavedChanges(false);
        }
      } catch (e) {
        console.warn('Erreur lors de la sauvegarde du brouillon:', e);
      }
      return;
    }

    // Mode normal avec trades
    if (trades.length === 0) {
      return;
    }

    // Comparer avec les données du serveur pour voir s'il y a vraiment des changements
    const serverData = serverDataRef.current;
    let hasRealChanges = false;
    
    if (serverData.length > 0) {
      for (let i = 0; i < trades.length; i++) {
        const trade = trades[i];
        const serverTrade = serverData.find(t => t.id === trade.id);
        if (!serverTrade) continue;
        
        // Normaliser les valeurs pour la comparaison
        const tradeStrategyRespected = trade.strategyRespected ?? null;
        const serverStrategyRespected = serverTrade.strategyRespected ?? null;
        const tradeGainIfStrategyRespected = trade.gainIfStrategyRespected ?? null;
        const serverGainIfStrategyRespected = serverTrade.gainIfStrategyRespected ?? null;
        const tradeSessionRating = trade.sessionRating ?? null;
        const serverSessionRating = serverTrade.sessionRating ?? null;
        
        const hasTradeChanges = 
          tradeStrategyRespected !== serverStrategyRespected ||
          tradeGainIfStrategyRespected !== serverGainIfStrategyRespected ||
          JSON.stringify(trade.dominantEmotions || []) !== JSON.stringify(serverTrade.dominantEmotions || []) ||
          (trade.screenshotUrl || '') !== (serverTrade.screenshotUrl || '') ||
          (trade.videoUrl || '') !== (serverTrade.videoUrl || '') ||
          (trade.tp1Reached || false) !== (serverTrade.tp1Reached || false) ||
          (trade.tp2PlusReached || false) !== (serverTrade.tp2PlusReached || false) ||
          (trade.emotionDetails || '') !== (serverTrade.emotionDetails || '') ||
          (trade.possibleImprovements || '') !== (serverTrade.possibleImprovements || '') ||
          tradeSessionRating !== serverSessionRating;
        
        if (hasTradeChanges) {
          hasRealChanges = true;
          break;
        }
      }
    } else {
      // Si on n'a pas encore de données serveur, considérer qu'il y a des changements
      hasRealChanges = true;
    }

    // Préparer les données à sauvegarder (seulement les champs modifiables)
    const draftData = trades.map((trade) => ({
      id: trade.id,
      strategyRespected: trade.strategyRespected,
      gainIfStrategyRespected: trade.gainIfStrategyRespected,
      dominantEmotions: trade.dominantEmotions,
      screenshotUrl: trade.screenshotUrl,
      videoUrl: trade.videoUrl,
      tp1Reached: trade.tp1Reached,
      tp2PlusReached: trade.tp2PlusReached,
      emotionDetails: trade.emotionDetails,
      possibleImprovements: trade.possibleImprovements,
      sessionRating: trade.sessionRating,
    }));

    try {
      if (hasRealChanges) {
        localStorage.setItem(draftKey, JSON.stringify(draftData));
        setHasUnsavedChanges(true);
      } else {
        // Si pas de changements réels, nettoyer le localStorage
        localStorage.removeItem(draftKey);
        setHasUnsavedChanges(false);
      }
    } catch (e) {
      // Erreur lors de l'écriture dans localStorage (quota dépassé, etc.)
      console.warn('Erreur lors de la sauvegarde du brouillon:', e);
    }
  }, [trades, dayCompliance, isDayWithoutTrades, draftKey]);

  useEffect(() => {
    if (open && date) {
      isInitialLoad.current = true;
      setIsDayWithoutTrades(false);
      setDayCompliance(null);
      loadData();
    } else {
      setTrades([]);
      setIsDayWithoutTrades(false);
      setDayCompliance(null);
      setError(null);
      // Ne pas réinitialiser hasUnsavedChanges ici car les données restent dans localStorage
      // Le message réapparaîtra à la réouverture si un brouillon existe
      isInitialLoad.current = true;
    }
  }, [open, date, tradingAccount, loadData]);

  const updateTradeStrategy = (tradeId: number, field: 'strategyRespected' | 'gainIfStrategyRespected' | 'dominantEmotions' | 'screenshotUrl' | 'videoUrl' | 'tp1Reached' | 'tp2PlusReached' | 'emotionDetails' | 'possibleImprovements' | 'sessionRating', value: any) => {
    setTrades((prev) =>
      prev.map((trade) => {
        if (trade.id === tradeId) {
          return {
            ...trade,
            [field]: value,
          };
        }
        return trade;
      })
    );
  };

  const updateDayCompliance = (field: 'strategy_respected' | 'dominant_emotions' | 'screenshot_url' | 'video_url' | 'emotion_details' | 'possible_improvements' | 'session_rating', value: any) => {
    setDayCompliance((prev) => {
      if (!prev) {
        // Créer un nouvel objet si aucun n'existe
        return {
          id: 0,
          user: 0,
          user_username: '',
          date: date,
          trading_account: tradingAccount ?? null,
          trading_account_name: null,
          strategy_respected: null,
          dominant_emotions: [],
          session_rating: null,
          emotion_details: '',
          possible_improvements: '',
          screenshot_url: '',
          video_url: '',
          emotions_display: '',
          created_at: '',
          updated_at: '',
          [field]: value,
        } as DayStrategyCompliance;
      }
      return {
        ...prev,
        [field]: value,
      };
    });
  };

  const toggleEmotion = (tradeId: number | null, emotion: string) => {
    if (isDayWithoutTrades) {
      // Mode jour sans trade
      const currentCompliance = dayCompliance || {
        id: 0,
        user: 0,
        user_username: '',
        date: date,
        trading_account: tradingAccount ?? null,
        trading_account_name: null,
        strategy_respected: null,
        dominant_emotions: [],
        session_rating: null,
        emotion_details: '',
        possible_improvements: '',
        screenshot_url: '',
        video_url: '',
        emotions_display: '',
        created_at: '',
        updated_at: '',
      } as DayStrategyCompliance;
      
      const currentEmotions = currentCompliance.dominant_emotions || [];
      const newEmotions = currentEmotions.includes(emotion)
        ? currentEmotions.filter((e) => e !== emotion)
        : [...currentEmotions, emotion];
      
      updateDayCompliance('dominant_emotions', newEmotions);
    } else {
      // Mode normal avec trades
      const trade = trades.find((t) => t.id === tradeId);
      if (!trade) return;

      const currentEmotions = trade.dominantEmotions || [];
      const newEmotions = currentEmotions.includes(emotion)
        ? currentEmotions.filter((e) => e !== emotion)
        : [...currentEmotions, emotion];

      updateTradeStrategy(tradeId!, 'dominantEmotions', newEmotions);
    }
  };

  const duplicateFirstTradeToAll = () => {
    if (trades.length === 0) return;
    
    const firstTrade = trades[0];
    const dataToDuplicate = {
      strategyRespected: firstTrade.strategyRespected,
      gainIfStrategyRespected: firstTrade.gainIfStrategyRespected,
      dominantEmotions: [...firstTrade.dominantEmotions],
      screenshotUrl: firstTrade.screenshotUrl,
      videoUrl: firstTrade.videoUrl,
          tp1Reached: firstTrade.tp1Reached,
          tp2PlusReached: firstTrade.tp2PlusReached,
          emotionDetails: firstTrade.emotionDetails,
          possibleImprovements: firstTrade.possibleImprovements,
          sessionRating: firstTrade.sessionRating,
        };

    // Appliquer les données du premier trade à tous les autres
    setTrades((prev) =>
      prev.map((trade, index) => {
        if (index === 0) {
          // Garder le premier trade tel quel
          return trade;
        }
        // Dupliquer les données sur les autres trades
        return {
          ...trade,
          strategyRespected: dataToDuplicate.strategyRespected,
          gainIfStrategyRespected: dataToDuplicate.gainIfStrategyRespected,
          dominantEmotions: [...dataToDuplicate.dominantEmotions],
          screenshotUrl: dataToDuplicate.screenshotUrl,
          videoUrl: dataToDuplicate.videoUrl,
          tp1Reached: dataToDuplicate.tp1Reached,
          tp2PlusReached: dataToDuplicate.tp2PlusReached,
          emotionDetails: dataToDuplicate.emotionDetails,
          possibleImprovements: dataToDuplicate.possibleImprovements,
          sessionRating: dataToDuplicate.sessionRating,
        };
      })
    );
  };

  const handleDeleteClick = () => {
    if (!isDayWithoutTrades || !dayCompliance?.id) {
      return;
    }
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!isDayWithoutTrades || !dayCompliance?.id) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await dayStrategyComplianceService.delete(dayCompliance.id);
      
      // Nettoyer le localStorage
      if (draftKey) {
        try {
          localStorage.removeItem(draftKey);
        } catch (e) {
          // Ignorer les erreurs de nettoyage
        }
      }
      
      setHasUnsavedChanges(false);
      isInitialLoad.current = true;
      setDeleteModalOpen(false);
      await loadData();
      
      // Déclencher un événement personnalisé pour notifier les autres composants du changement
      window.dispatchEvent(new CustomEvent('strategy-compliance-updated', {
        detail: { date, tradingAccount }
      }));
      
      onClose(true);
    } catch (e: any) {
      setError(e?.message || t('trades:strategyCompliance.deleteError', { defaultValue: 'Erreur lors de la suppression' }));
      setDeleteModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      // Mode jour sans trade
      if (isDayWithoutTrades) {
        if (!dayCompliance) {
          // Pas de compliance à sauvegarder
          onClose(true);
          return;
        }
        
        // Vérifier s'il y a des données à sauvegarder
        const hasData = 
          dayCompliance.strategy_respected !== null ||
          dayCompliance.dominant_emotions.length > 0 ||
          dayCompliance.session_rating !== null ||
          dayCompliance.emotion_details ||
          dayCompliance.possible_improvements ||
          dayCompliance.screenshot_url ||
          dayCompliance.video_url;
        
        if (!hasData) {
          // Pas de données à sauvegarder
          onClose(true);
          return;
        }
        
        if (dayCompliance.id) {
          // Mettre à jour la compliance existante
          await dayStrategyComplianceService.update(dayCompliance.id, {
            date: date,
            trading_account: tradingAccount ?? null,
            strategy_respected: dayCompliance.strategy_respected,
            dominant_emotions: dayCompliance.dominant_emotions,
            session_rating: dayCompliance.session_rating,
            emotion_details: dayCompliance.emotion_details || '',
            possible_improvements: dayCompliance.possible_improvements || '',
            screenshot_url: dayCompliance.screenshot_url || '',
            video_url: dayCompliance.video_url || '',
          });
        } else {
          // Créer une nouvelle compliance
          await dayStrategyComplianceService.create({
            date: date,
            trading_account: tradingAccount ?? null,
            strategy_respected: dayCompliance.strategy_respected,
            dominant_emotions: dayCompliance.dominant_emotions,
            session_rating: dayCompliance.session_rating,
            emotion_details: dayCompliance.emotion_details || '',
            possible_improvements: dayCompliance.possible_improvements || '',
            screenshot_url: dayCompliance.screenshot_url || '',
            video_url: dayCompliance.video_url || '',
          });
        }
      } else {
        // Mode normal avec trades
        const strategiesToSave: BulkStrategyData[] = trades.map((trade) => ({
          trade_id: trade.topstep_id,
          strategy_respected: trade.strategyRespected,
          gain_if_strategy_respected: trade.gainIfStrategyRespected,
          dominant_emotions: trade.dominantEmotions,
          screenshot_url: trade.screenshotUrl || undefined,
          video_url: trade.videoUrl || undefined,
          tp1_reached: trade.tp1Reached,
          tp2_plus_reached: trade.tp2PlusReached,
          emotion_details: trade.emotionDetails || undefined,
          possible_improvements: trade.possibleImprovements || undefined,
          session_rating: trade.sessionRating !== null ? trade.sessionRating : undefined,
        }));

        await tradeStrategiesService.bulkCreateOrUpdate(strategiesToSave);
      }
      
      // Nettoyer le localStorage après sauvegarde réussie (AVANT de recharger)
      if (draftKey) {
        try {
          localStorage.removeItem(draftKey);
        } catch (e) {
          // Ignorer les erreurs de nettoyage
        }
      }
      
      setHasUnsavedChanges(false);
      isInitialLoad.current = true; // Réinitialiser pour éviter la sauvegarde auto lors du rechargement
      // Recharger les données après la sauvegarde pour avoir les données à jour
      // Le localStorage est déjà nettoyé, donc loadData() ne restaurera pas de brouillon
      await loadData();
      
      // Déclencher un événement personnalisé pour notifier les autres composants du changement
      window.dispatchEvent(new CustomEvent('strategy-compliance-updated', {
        detail: { date, tradingAccount }
      }));
      
      onClose(true);
    } catch (e: any) {
      setError(e?.message || t('trades:strategyCompliance.error'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!open) return null;

  const formatDate = (dateStr: string) => {
    return formatDateLong(dateStr, preferences.date_format, preferences.language, preferences.timezone);
  };

  const formatTimeLocal = (dateStr: string) => {
    return formatTime(dateStr, preferences.timezone, preferences.language);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose(false);
        }
      }}
    >
      <div
        className="bg-white dark:bg-gray-800 w-full max-w-6xl rounded-xl shadow-2xl max-h-[90vh] sm:max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-3 sm:px-6 py-3 sm:py-5 border-b border-gray-200 dark:border-gray-700 flex items-start sm:items-center justify-between bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-t-xl flex-shrink-0 gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-600 dark:bg-purple-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 truncate">{t('trades:strategyCompliance.title')}</h2>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">{formatDate(date)}</p>
                {hasUnsavedChanges && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 flex-shrink-0">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="hidden sm:inline">{t('trades:strategyCompliance.unsavedChanges', { defaultValue: 'Modifications non sauvegardées' })}</span>
                    <span className="sm:hidden">{t('trades:strategyCompliance.unsavedChanges', { defaultValue: 'Non sauvegardé' })}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => onClose(false)}
            disabled={isSaving}
            className="w-8 h-8 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="font-medium text-rose-900 dark:text-rose-300">{t('trades:strategyCompliance.error')}</p>
                <p className="text-sm text-rose-700 dark:text-rose-400 mt-1">{error}</p>
              </div>
            </div>
          ) : isDayWithoutTrades ? (
            // Formulaire pour jour sans trade
            <div className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4 mb-4">
                <p className="text-sm text-blue-900 dark:text-blue-300">
                  {t('trades:strategyCompliance.noTradesForDateWithCompliance')}
                </p>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow">
                {/* Respect de la stratégie */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('trades:strategyCompliance.strategyRespected')}
                  </label>
                  <div className="flex gap-2 sm:gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => updateDayCompliance('strategy_respected', dayCompliance?.strategy_respected === true ? null : true)}
                      className={`px-3 sm:px-4 py-2 rounded-lg border-2 transition-colors flex items-center gap-1.5 sm:gap-2 text-sm ${
                        dayCompliance?.strategy_respected === true
                          ? 'bg-green-600 dark:bg-green-500 text-white border-green-600 dark:border-green-500'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                      }`}
                    >
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {t('trades:yes')}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateDayCompliance('strategy_respected', dayCompliance?.strategy_respected === false ? null : false)}
                      className={`px-3 sm:px-4 py-2 rounded-lg border-2 transition-colors flex items-center gap-1.5 sm:gap-2 text-sm ${
                        dayCompliance?.strategy_respected === false
                          ? 'bg-red-600 dark:bg-red-500 text-white border-red-600 dark:border-red-500'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                      }`}
                    >
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      {t('trades:no')}
                    </button>
                  </div>
                </div>

                {/* Émotions dominantes */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('trades:strategyCompliance.dominantEmotions')}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {TRADING_EMOTIONS.map((emotion) => {
                      const isSelected = (dayCompliance?.dominant_emotions || []).includes(emotion.value);
                      return (
                        <button
                          key={emotion.value}
                          type="button"
                          onClick={() => toggleEmotion(null, emotion.value)}
                          className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm border transition-colors ${
                            isSelected
                              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-700 font-medium'
                              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                          }`}
                        >
                          {emotion.label}
                        </button>
                      );
                    })}
                  </div>
                  {(dayCompliance?.dominant_emotions || []).length > 0 && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {(dayCompliance?.dominant_emotions || []).length === 1 
                        ? t('trades:strategyCompliance.emotionsSelected', { count: (dayCompliance?.dominant_emotions || []).length })
                        : t('trades:strategyCompliance.emotionsSelectedPlural', { count: (dayCompliance?.dominant_emotions || []).length })}
                    </p>
                  )}
                </div>

                {/* Note de session */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('trades:strategyCompliance.sessionRating')}
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => updateDayCompliance('session_rating', dayCompliance?.session_rating === rating ? null : rating)}
                        className={`w-10 h-10 rounded-lg border-2 transition-colors flex items-center justify-center text-sm font-medium ${
                          dayCompliance?.session_rating === rating
                            ? 'bg-purple-600 dark:bg-purple-500 text-white border-purple-600 dark:border-purple-500'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                        }`}
                      >
                        {rating}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Screenshot */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('trades:strategyCompliance.screenshotUrl')}
                  </label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="url"
                      value={dayCompliance?.screenshot_url || ''}
                      onChange={(e) => updateDayCompliance('screenshot_url', e.target.value)}
                      placeholder={t('trades:strategyCompliance.screenshotPlaceholder')}
                      className="flex-1 min-w-0 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    {dayCompliance?.screenshot_url && (
                      <button
                        type="button"
                        onClick={() => window.open(dayCompliance.screenshot_url, '_blank', 'noopener,noreferrer')}
                        className="px-3 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-xs sm:text-sm font-medium flex items-center justify-center gap-2 flex-shrink-0"
                        title={t('trades:strategyCompliance.openScreenshot')}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="hidden sm:inline">{t('trades:strategyCompliance.viewImage')}</span>
                        <span className="sm:hidden">{t('trades:strategyCompliance.viewImage', { defaultValue: 'Voir' })}</span>
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t('trades:strategyCompliance.screenshotDescription')}
                  </p>
                </div>

                {/* Vidéo */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('trades:strategyCompliance.videoUrl')}
                  </label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="url"
                      value={dayCompliance?.video_url || ''}
                      onChange={(e) => updateDayCompliance('video_url', e.target.value)}
                      placeholder={t('trades:strategyCompliance.videoPlaceholder')}
                      className="flex-1 min-w-0 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    {dayCompliance?.video_url && (
                      <button
                        type="button"
                        onClick={() => window.open(dayCompliance.video_url, '_blank', 'noopener,noreferrer')}
                        className="px-3 py-2 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors text-xs sm:text-sm font-medium flex items-center justify-center gap-2 flex-shrink-0"
                        title={t('trades:strategyCompliance.openVideo')}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="hidden sm:inline">{t('trades:strategyCompliance.viewVideo')}</span>
                        <span className="sm:hidden">{t('trades:strategyCompliance.viewVideo', { defaultValue: 'Voir' })}</span>
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t('trades:strategyCompliance.videoDescription')}
                  </p>
                </div>

                {/* Détails des émotions */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('trades:strategyCompliance.emotionDetails')}
                  </label>
                  <textarea
                    value={dayCompliance?.emotion_details || ''}
                    onChange={(e) => updateDayCompliance('emotion_details', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent resize-none"
                    placeholder={t('trades:strategyCompliance.emotionDetailsPlaceholder')}
                  />
                </div>

                {/* Améliorations possibles */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('trades:strategyCompliance.possibleImprovements')}
                  </label>
                  <textarea
                    value={dayCompliance?.possible_improvements || ''}
                    onChange={(e) => updateDayCompliance('possible_improvements', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent resize-none"
                    placeholder={t('trades:strategyCompliance.possibleImprovementsPlaceholder')}
                  />
                </div>
              </div>
            </div>
          ) : trades.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg font-medium">{t('trades:strategyCompliance.noTradesForDate')}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Bouton pour dupliquer le premier trade */}
              {trades.length > 1 && (
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-purple-900 dark:text-purple-300">
                        {t('trades:strategyCompliance.duplicateConfiguration')}
                      </p>
                      <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">
                        {t('trades:strategyCompliance.duplicateDescription')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={duplicateFirstTradeToAll}
                      className="px-3 sm:px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 transition-colors text-xs sm:text-sm font-medium flex items-center justify-center gap-2 flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      {t('trades:strategyCompliance.duplicateToAll')}
                    </button>
                  </div>
                </div>
              )}
              
              {trades.map((trade) => (
                <div key={trade.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow">
                  {/* En-tête du trade */}
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                        <span className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-100 truncate">{trade.contract_name}</span>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${
                            trade.trade_type === 'Long'
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                          }`}
                        >
                          {trade.trade_type}
                        </span>
                        <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">{formatTimeLocal(trade.entered_at)}</span>
                        {trade.net_pnl && (
                          <span
                            className={`text-xs sm:text-sm font-medium flex-shrink-0 ${
                              parseFloat(trade.net_pnl) > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {formatCurrencyWithSign(trade.net_pnl, '', preferences.number_format, 2)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Respect de la stratégie et Take Profit */}
                  <div className="mb-3 sm:mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 items-start">
                      {/* Stratégie respectée */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('trades:strategyCompliance.strategyRespected')}
                        </label>
                        <div className="flex gap-2 sm:gap-3 flex-wrap">
                          <button
                            type="button"
                            onClick={() => updateTradeStrategy(trade.id, 'strategyRespected', trade.strategyRespected === true ? null : true)}
                            className={`px-3 sm:px-4 py-2 rounded-lg border-2 transition-colors flex items-center gap-1.5 sm:gap-2 text-sm ${
                              trade.strategyRespected === true
                                ? 'bg-green-600 dark:bg-green-500 text-white border-green-600 dark:border-green-500'
                                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                            }`}
                          >
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {t('trades:yes')}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateTradeStrategy(trade.id, 'strategyRespected', trade.strategyRespected === false ? null : false)}
                            className={`px-3 sm:px-4 py-2 rounded-lg border-2 transition-colors flex items-center gap-1.5 sm:gap-2 text-sm ${
                              trade.strategyRespected === false
                                ? 'bg-red-600 dark:bg-red-500 text-white border-red-600 dark:border-red-500'
                                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                            }`}
                          >
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            {t('trades:no')}
                          </button>
                        </div>
                      </div>

                      {/* Take Profit atteints - seulement si le trade est profitable */}
                      {trade.net_pnl && parseFloat(trade.net_pnl) > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t('trades:strategyCompliance.takeProfitReached')}
                          </label>
                          <div className="flex gap-2 sm:gap-3 flex-wrap">
                            <button
                              type="button"
                              onClick={() => updateTradeStrategy(trade.id, 'tp1Reached', !trade.tp1Reached)}
                              className={`w-20 sm:w-24 px-3 sm:px-4 py-2 rounded-lg border-2 transition-colors flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm ${
                                trade.tp1Reached
                                  ? 'bg-purple-600 dark:bg-purple-500 text-white border-purple-600 dark:border-purple-500'
                                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                              }`}
                            >
                              {trade.tp1Reached && (
                                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                              {t('trades:strategyCompliance.tp1')}
                            </button>
                            <button
                              type="button"
                              onClick={() => updateTradeStrategy(trade.id, 'tp2PlusReached', !trade.tp2PlusReached)}
                              className={`w-20 sm:w-24 px-3 sm:px-4 py-2 rounded-lg border-2 transition-colors flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm ${
                                trade.tp2PlusReached
                                  ? 'bg-purple-600 dark:bg-purple-500 text-white border-purple-600 dark:border-purple-500'
                                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                              }`}
                            >
                              {trade.tp2PlusReached && (
                                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                              {t('trades:strategyCompliance.tp2Plus')}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Gain si stratégie respectée - seulement si le trade est perdant ET la stratégie n'a pas été respectée */}
                      {trade.strategyRespected === false && trade.net_pnl && parseFloat(trade.net_pnl) <= 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2 flex-wrap">
                            <span className="break-words">{t('trades:strategyCompliance.gainIfStrategyRespected')}</span>
                            <Tooltip 
                              content={t('trades:strategyCompliance.gainIfStrategyRespectedTooltip')} 
                              position="top"
                            >
                              <svg 
                                className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help flex-shrink-0" 
                                fill="none" 
                                viewBox="0 0 24 24" 
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </Tooltip>
                          </label>
                          <div className="flex gap-2 sm:gap-3 flex-wrap">
                            <button
                              type="button"
                              onClick={() => updateTradeStrategy(trade.id, 'gainIfStrategyRespected', trade.gainIfStrategyRespected === true ? null : true)}
                              className={`px-3 sm:px-4 py-2 rounded-lg border-2 transition-colors flex items-center gap-1.5 sm:gap-2 text-sm ${
                                trade.gainIfStrategyRespected === true
                                  ? 'bg-green-600 dark:bg-green-500 text-white border-green-600 dark:border-green-500'
                                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                              }`}
                            >
                              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              {t('trades:yes')}
                            </button>
                            <button
                              type="button"
                              onClick={() => updateTradeStrategy(trade.id, 'gainIfStrategyRespected', trade.gainIfStrategyRespected === false ? null : false)}
                              className={`px-3 sm:px-4 py-2 rounded-lg border-2 transition-colors flex items-center gap-1.5 sm:gap-2 text-sm ${
                                trade.gainIfStrategyRespected === false
                                  ? 'bg-red-600 dark:bg-red-500 text-white border-red-600 dark:border-red-500'
                                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                              }`}
                            >
                              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              {t('trades:no')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Émotions dominantes */}
                  <div className="mb-3 sm:mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('trades:strategyCompliance.dominantEmotions')}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {TRADING_EMOTIONS.map((emotion) => {
                        const isSelected = trade.dominantEmotions.includes(emotion.value);
                        return (
                          <button
                            key={emotion.value}
                            type="button"
                            onClick={() => toggleEmotion(trade.id, emotion.value)}
                            className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm border transition-colors ${
                              isSelected
                                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-700 font-medium'
                                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                            }`}
                          >
                            {emotion.label}
                          </button>
                        );
                      })}
                    </div>
                    {trade.dominantEmotions.length > 0 && (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {trade.dominantEmotions.length === 1 
                          ? t('trades:strategyCompliance.emotionsSelected', { count: trade.dominantEmotions.length })
                          : t('trades:strategyCompliance.emotionsSelectedPlural', { count: trade.dominantEmotions.length })}
                      </p>
                    )}
                  </div>

                  {/* Note de session */}
                  <div className="mt-3 sm:mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('trades:strategyCompliance.sessionRating')}
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => updateTradeStrategy(trade.id, 'sessionRating', trade.sessionRating === rating ? null : rating)}
                          className={`w-10 h-10 rounded-lg border-2 transition-colors flex items-center justify-center text-sm font-medium ${
                            trade.sessionRating === rating
                              ? 'bg-purple-600 dark:bg-purple-500 text-white border-purple-600 dark:border-purple-500'
                              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                          }`}
                        >
                          {rating}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Screenshot */}
                  <div className="mt-3 sm:mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('trades:strategyCompliance.screenshotUrl')}
                    </label>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <input
                        type="url"
                        value={trade.screenshotUrl || ''}
                        onChange={(e) => updateTradeStrategy(trade.id, 'screenshotUrl', e.target.value)}
                        placeholder={t('trades:strategyCompliance.screenshotPlaceholder')}
                        className="flex-1 min-w-0 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      {trade.screenshotUrl && (
                        <button
                          type="button"
                          onClick={() => window.open(trade.screenshotUrl, '_blank', 'noopener,noreferrer')}
                          className="px-3 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-xs sm:text-sm font-medium flex items-center justify-center gap-2 flex-shrink-0"
                          title={t('trades:strategyCompliance.openScreenshot')}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="hidden sm:inline">{t('trades:strategyCompliance.viewImage')}</span>
                          <span className="sm:hidden">{t('trades:strategyCompliance.viewImage', { defaultValue: 'Voir' })}</span>
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {t('trades:strategyCompliance.screenshotDescription')}
                    </p>
                  </div>

                  {/* Vidéo */}
                  <div className="mt-3 sm:mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('trades:strategyCompliance.videoUrl')}
                    </label>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <input
                        type="url"
                        value={trade.videoUrl || ''}
                        onChange={(e) => updateTradeStrategy(trade.id, 'videoUrl', e.target.value)}
                        placeholder={t('trades:strategyCompliance.videoPlaceholder')}
                        className="flex-1 min-w-0 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                      {trade.videoUrl && (
                        <button
                          type="button"
                          onClick={() => window.open(trade.videoUrl, '_blank', 'noopener,noreferrer')}
                          className="px-3 py-2 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors text-xs sm:text-sm font-medium flex items-center justify-center gap-2 flex-shrink-0"
                          title={t('trades:strategyCompliance.openVideo')}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="hidden sm:inline">{t('trades:strategyCompliance.viewVideo')}</span>
                          <span className="sm:hidden">{t('trades:strategyCompliance.viewVideo', { defaultValue: 'Voir' })}</span>
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {t('trades:strategyCompliance.videoDescription')}
                    </p>
                  </div>

                  {/* Détails des émotions */}
                  <div className="mt-3 sm:mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('trades:strategyCompliance.emotionDetails')}
                    </label>
                    <textarea
                      value={trade.emotionDetails || ''}
                      onChange={(e) => updateTradeStrategy(trade.id, 'emotionDetails', e.target.value)}
                      placeholder={t('trades:strategyCompliance.emotionDetailsPlaceholder')}
                      rows={3}
                      className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
                    />
                  </div>

                  {/* Améliorations possibles */}
                  <div className="mt-3 sm:mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('trades:strategyCompliance.possibleImprovements')}
                    </label>
                    <textarea
                      value={trade.possibleImprovements || ''}
                      onChange={(e) => updateTradeStrategy(trade.id, 'possibleImprovements', e.target.value)}
                      placeholder={t('trades:strategyCompliance.possibleImprovementsPlaceholder')}
                      rows={3}
                      className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 rounded-b-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
          <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            {trades.length > 0 && (
              <span>
                {t('trades:strategyCompliance.tradesWithStrategyRespected', {
                  count: trades.filter((t) => t.strategyRespected === true).length,
                  total: trades.length
                })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => onClose(false)}
              disabled={isSaving}
              className="px-3 sm:px-4 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 text-sm sm:text-base font-medium transition-colors disabled:opacity-50 flex-1 sm:flex-initial"
            >
              {t('trades:strategyCompliance.cancel')}
            </button>
            {/* Bouton de suppression - uniquement pour les jours sans trades avec compliance existante */}
            {isDayWithoutTrades && dayCompliance?.id ? (
              <button
                onClick={handleDeleteClick}
                disabled={isSaving || isLoading}
                className="px-3 sm:px-4 py-2 rounded-lg bg-red-600 dark:bg-red-500 text-white hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base font-medium transition-colors flex items-center justify-center gap-2 flex-1 sm:flex-initial"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {t('trades:strategyCompliance.delete', { defaultValue: 'Supprimer' })}
              </button>
            ) : null}
            <button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="px-4 sm:px-6 py-2 rounded-lg bg-purple-600 dark:bg-purple-500 text-white hover:bg-purple-700 dark:hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base font-medium transition-colors flex items-center justify-center gap-2 flex-1 sm:flex-initial"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('trades:strategyCompliance.saving')}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {t('trades:strategyCompliance.save')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modale de confirmation de suppression */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        title={t('trades:strategyCompliance.deleteConfirmTitle', { defaultValue: 'Supprimer le respect de la stratégie' })}
        message={t('trades:strategyCompliance.deleteConfirmMessage', { defaultValue: 'Êtes-vous sûr de vouloir supprimer le respect de la stratégie pour ce jour ? Cette action est irréversible.' })}
        isLoading={isSaving}
        confirmButtonText={t('trades:strategyCompliance.delete', { defaultValue: 'Supprimer' })}
      />
    </div>
  );
};

