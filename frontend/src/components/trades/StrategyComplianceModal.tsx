import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { tradesService, TradeListItem } from '../../services/trades';
import { tradeStrategiesService, TradeStrategy, BulkStrategyData } from '../../services/tradeStrategies';
import { Tooltip } from '../ui';
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
  const [openRatingDropdowns, setOpenRatingDropdowns] = useState<Map<number, boolean>>(new Map());
  const ratingRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const isInitialLoad = useRef(true);
  const serverDataRef = useRef<TradeWithStrategy[]>([]); // Garder une référence aux données du serveur

  // Clé pour le localStorage basée sur la date et le compte de trading
  const draftKey = useMemo(() => {
    if (!date) return null;
    const accountKey = tradingAccount ? `-${tradingAccount}` : '';
    return `strategy-compliance-draft-${date}${accountKey}`;
  }, [date, tradingAccount]);

  // Fermer les dropdowns quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      ratingRefs.current.forEach((ref, tradeId) => {
        if (ref && !ref.contains(target)) {
          setOpenRatingDropdowns(prev => {
            const newMap = new Map(prev);
            newMap.set(tradeId, false);
            return newMap;
          });
        }
      });
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
    if (isInitialLoad.current || !draftKey || trades.length === 0) {
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
  }, [trades, draftKey]);

  useEffect(() => {
    if (open && date) {
      isInitialLoad.current = true;
      loadData();
    } else {
      setTrades([]);
      setError(null);
      setOpenRatingDropdowns(new Map());
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

  const toggleEmotion = (tradeId: number, emotion: string) => {
    const trade = trades.find((t) => t.id === tradeId);
    if (!trade) return;

    const currentEmotions = trade.dominantEmotions || [];
    const newEmotions = currentEmotions.includes(emotion)
      ? currentEmotions.filter((e) => e !== emotion)
      : [...currentEmotions, emotion];

    updateTradeStrategy(tradeId, 'dominantEmotions', newEmotions);
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

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
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

                  {/* Note subjective */}
                  <div className="mt-3 sm:mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('trades:strategyCompliance.subjectiveRating')}
                    </label>
                    <div 
                      ref={(el) => {
                        if (el) {
                          ratingRefs.current.set(trade.id, el);
                        } else {
                          ratingRefs.current.delete(trade.id);
                        }
                      }}
                      className="relative w-full sm:w-56"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setOpenRatingDropdowns(prev => {
                            const newMap = new Map(prev);
                            newMap.set(trade.id, !prev.get(trade.id));
                            return newMap;
                          });
                        }}
                        className="w-full inline-flex items-center justify-between rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <span className="inline-flex items-center gap-2 text-gray-900 dark:text-gray-100">
                          {trade.sessionRating === null 
                            ? t('trades:strategyCompliance.selectRating')
                            : `${trade.sessionRating} - ${
                                trade.sessionRating === 1 ? t('trades:strategyCompliance.ratingVeryBad') :
                                trade.sessionRating === 2 ? t('trades:strategyCompliance.ratingBad') :
                                trade.sessionRating === 3 ? t('trades:strategyCompliance.ratingAverage') :
                                trade.sessionRating === 4 ? t('trades:strategyCompliance.ratingGood') :
                                t('trades:strategyCompliance.ratingExcellent')
                              }`
                          }
                        </span>
                        <svg 
                          className={`h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform ${openRatingDropdowns.get(trade.id) ? 'rotate-180' : ''}`} 
                          xmlns="http://www.w3.org/2000/svg" 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {openRatingDropdowns.get(trade.id) && (
                        <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden">
                          <ul className="py-1 text-sm text-gray-700 dark:text-gray-300">
                            <li>
                              <button
                                type="button"
                                onClick={() => {
                                  updateTradeStrategy(trade.id, 'sessionRating', null);
                                  setOpenRatingDropdowns(prev => {
                                    const newMap = new Map(prev);
                                    newMap.set(trade.id, false);
                                    return newMap;
                                  });
                                }}
                                className={`w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${trade.sessionRating === null ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
                              >
                                <span className="text-gray-900 dark:text-gray-100">{t('trades:strategyCompliance.selectRating')}</span>
                              </button>
                            </li>
                            {[
                              { value: 1, label: t('trades:strategyCompliance.ratingVeryBad') },
                              { value: 2, label: t('trades:strategyCompliance.ratingBad') },
                              { value: 3, label: t('trades:strategyCompliance.ratingAverage') },
                              { value: 4, label: t('trades:strategyCompliance.ratingGood') },
                              { value: 5, label: t('trades:strategyCompliance.ratingExcellent') },
                            ].map(opt => (
                              <li key={opt.value}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateTradeStrategy(trade.id, 'sessionRating', opt.value);
                                    setOpenRatingDropdowns(prev => {
                                      const newMap = new Map(prev);
                                      newMap.set(trade.id, false);
                                      return newMap;
                                    });
                                  }}
                                  className={`w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${trade.sessionRating === opt.value ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
                                >
                                  <span className="text-gray-900 dark:text-gray-100">{opt.value} - {opt.label}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {t('trades:strategyCompliance.ratingTooltip')}
                    </p>
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
    </div>
  );
};

