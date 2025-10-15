import React, { useState, useEffect } from 'react';
import { TopStepTrade, tradesService } from '../../services/trades';
import ConfirmDialog from '../common/ConfirmDialog';

interface TradeStrategyData {
  trade_id: string;
  strategy_respected: boolean | null;
  dominant_emotions: string[];
  gain_if_strategy_respected: boolean | null;
  tp1_reached: boolean;
  tp2_plus_reached: boolean;
  session_rating: number | null;
  emotion_details: string;
  possible_improvements: string;
  screenshot_url: string;
  video_url: string;
}

interface TradesStrategyModalProps {
  isOpen: boolean;
  onClose: () => void;
  trades: TopStepTrade[];
  selectedDate: string;
  onSave: (tradeStrategies: TradeStrategyData[]) => Promise<void>;
  onDeleteTrade?: (tradeId: number) => Promise<void>;
}

const EMOTION_CHOICES = [
  'confiance', 'peur', 'avarice', 'frustration', 'impatience', 'patience', 'euphorie',
  'anxiete', 'colere', 'satisfaction', 'deception', 'calme', 'stress',
  'determination', 'doute', 'excitation', 'lassitude', 'fatigue'
];

const SESSION_RATING_CHOICES = [
  { value: 1, label: '1 - Très mauvaise' },
  { value: 2, label: '2 - Mauvaise' },
  { value: 3, label: '3 - Moyenne' },
  { value: 4, label: '4 - Bonne' },
  { value: 5, label: '5 - Excellente' }
];

const TradesStrategyModal: React.FC<TradesStrategyModalProps> = ({
  isOpen,
  onClose,
  trades,
  selectedDate,
  onSave,
  onDeleteTrade
}) => {
  const [tradeStrategies, setTradeStrategies] = useState<{ [key: string]: TradeStrategyData }>({});
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; tradeId: number | null; tradeInfo: string }>({
    isOpen: false,
    tradeId: null,
    tradeInfo: ''
  });

  // Initialiser les données pour chaque trade
  useEffect(() => {
    const loadExistingStrategies = async () => {
      if (isOpen && trades.length > 0) {
        try {
          // Récupérer les stratégies existantes pour cette date
          const existingStrategies = await tradesService.getTradeStrategiesByDate(selectedDate);
          
          const initialData: { [key: string]: TradeStrategyData } = {};
          trades.forEach(trade => {
            // Chercher si une stratégie existe déjà pour ce trade
            const existingStrategy = existingStrategies.find((s: any) => s.trade === trade.id);
            
            if (existingStrategy) {
              // Utiliser les données existantes
              initialData[trade.topstep_id] = {
                trade_id: trade.topstep_id,
                strategy_respected: existingStrategy.strategy_respected,
                dominant_emotions: existingStrategy.dominant_emotions || [],
                gain_if_strategy_respected: existingStrategy.gain_if_strategy_respected,
                tp1_reached: existingStrategy.tp1_reached,
                tp2_plus_reached: existingStrategy.tp2_plus_reached,
                session_rating: existingStrategy.session_rating,
                emotion_details: existingStrategy.emotion_details || '',
                possible_improvements: existingStrategy.possible_improvements || '',
                screenshot_url: existingStrategy.screenshot_url || '',
                video_url: existingStrategy.video_url || ''
              };
            } else {
              // Utiliser les valeurs par défaut pour les nouveaux trades
              initialData[trade.topstep_id] = {
                trade_id: trade.topstep_id,
                strategy_respected: null,
                dominant_emotions: [],
                gain_if_strategy_respected: null,
                tp1_reached: false,
                tp2_plus_reached: false,
                session_rating: null,
                emotion_details: '',
                possible_improvements: '',
                screenshot_url: '',
                video_url: ''
              };
            }
          });
          setTradeStrategies(initialData);
        } catch (error) {
          console.error('Erreur lors du chargement des stratégies existantes:', error);
          // En cas d'erreur, utiliser les valeurs par défaut
          const initialData: { [key: string]: TradeStrategyData } = {};
          trades.forEach(trade => {
            initialData[trade.topstep_id] = {
              trade_id: trade.topstep_id,
              strategy_respected: null,
              dominant_emotions: [],
              gain_if_strategy_respected: null,
              tp1_reached: false,
              tp2_plus_reached: false,
              session_rating: null,
              emotion_details: '',
              possible_improvements: '',
              screenshot_url: '',
              video_url: ''
            };
          });
          setTradeStrategies(initialData);
        }
      } else if (isOpen && trades.length === 0) {
        // Réinitialiser si aucun trade
        setTradeStrategies({});
      }
    };

    loadExistingStrategies();
  }, [isOpen, trades, selectedDate]);

  const handleInputChange = (tradeId: string, field: keyof TradeStrategyData, value: any) => {
    setTradeStrategies(prev => {
      const updatedStrategy = {
        ...prev[tradeId],
        [field]: value
      };
      
      // Si la stratégie est respectée (true), automatiquement définir gain_if_strategy_respected à true
      if (field === 'strategy_respected' && value === true) {
        updatedStrategy.gain_if_strategy_respected = true;
      }
      
      return {
        ...prev,
        [tradeId]: updatedStrategy
      };
    });
    
    // Effacer l'erreur pour ce champ
    if (errors[`${tradeId}_${field}`]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`${tradeId}_${field}`];
        return newErrors;
      });
    }
  };

  const handleEmotionToggle = (tradeId: string, emotion: string) => {
    const currentEmotions = tradeStrategies[tradeId]?.dominant_emotions || [];
    const newEmotions = currentEmotions.includes(emotion)
      ? currentEmotions.filter(e => e !== emotion)
      : [...currentEmotions, emotion];
    
    handleInputChange(tradeId, 'dominant_emotions', newEmotions);
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    
    Object.keys(tradeStrategies).forEach(tradeId => {
      const strategy = tradeStrategies[tradeId];
      
      if (strategy.strategy_respected === null) {
        newErrors[`${tradeId}_strategy_respected`] = 'Veuillez indiquer si la stratégie a été respectée';
      }
      
      if (strategy.session_rating === null) {
        newErrors[`${tradeId}_session_rating`] = 'Veuillez noter la session';
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    try {
      const strategiesArray = Object.values(tradeStrategies);
      await onSave(strategiesArray);
      handleClose();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setTradeStrategies({});
    setErrors({});
    onClose();
  };

  const handleDeleteTrade = (tradeId: number) => {
    if (!onDeleteTrade) return;
    
    const trade = trades.find(t => t.id === tradeId);
    if (!trade) return;
    
    setConfirmDelete({
      isOpen: true,
      tradeId,
      tradeInfo: `${trade.topstep_id} (${trade.contract_name})`
    });
  };

  const confirmDeleteTrade = async () => {
    if (!confirmDelete.tradeId || !onDeleteTrade) return;
    
    try {
      await onDeleteTrade(confirmDelete.tradeId);
      setConfirmDelete({ isOpen: false, tradeId: null, tradeInfo: '' });
      
      // Déclencher l'événement pour notifier les autres composants (calendrier, etc.)
      window.dispatchEvent(new CustomEvent('trades:updated'));
    } catch (error: any) {
      console.error('Erreur lors de la suppression du trade:', error);
      
      // Gestion spécifique des erreurs
      if (error.response?.status === 404) {
        alert('Ce trade n\'existe plus. Il a peut-être déjà été supprimé.');
      } else if (error.response?.status === 500) {
        alert('Erreur serveur lors de la suppression. Veuillez réessayer.');
      } else {
        alert('Erreur lors de la suppression du trade. Veuillez réessayer.');
      }
    }
  };

  const cancelDeleteTrade = () => {
    setConfirmDelete({ isOpen: false, tradeId: null, tradeInfo: '' });
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={handleOverlayClick}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 text-white p-6 rounded-t-lg relative">
          <div className="absolute inset-0 bg-black bg-opacity-20 rounded-t-lg"></div>
          <div className="relative">
            <h2 className="text-xl font-bold mb-1">
              Suivi de la stratégie - {selectedDate ? (() => {
                const date = new Date(selectedDate + 'T00:00:00');
                return date.toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                });
              })() : ''}
            </h2>
            <p className="text-gray-300 text-sm">
              {trades.length} trade{trades.length > 1 ? 's' : ''} trouvé{trades.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {trades.map((trade) => {
              const strategy = tradeStrategies[trade.topstep_id] || {
                trade_id: trade.topstep_id,
                strategy_respected: null,
                dominant_emotions: [],
                gain_if_strategy_respected: null,
                tp1_reached: false,
                tp2_plus_reached: false,
                session_rating: null,
                emotion_details: '',
                possible_improvements: '',
                screenshot_url: '',
                video_url: ''
              };

              return (
                <div key={trade.topstep_id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  {/* Trade Info Header */}
                  <div className="flex justify-between items-start mb-4 pb-4 border-b border-gray-200">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 flex-1">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">ID TopStep</label>
                        <div className="text-sm text-gray-900 font-mono">{trade.topstep_id}</div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Contrat</label>
                        <div className="text-sm text-gray-900">{trade.contract_name}</div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                        <div className={`text-sm font-medium ${trade.trade_type === 'Long' ? 'text-green-600' : 'text-red-600'}`}>
                          {trade.trade_type}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Taille</label>
                        <div className="text-sm text-gray-900">{trade.size}</div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">PnL Net</label>
                        <div className={`text-sm font-medium ${Number(trade.net_pnl) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {Number(trade.net_pnl) >= 0 ? '+' : ''}{Number(trade.net_pnl).toFixed(2)}$
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteTrade(trade.id)}
                      className="ml-4 p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                      title="Supprimer ce trade"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {/* Strategy Form */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Stratégie respectée */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Stratégie respectée *
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name={`strategy_respected_${trade.topstep_id}`}
                            checked={strategy.strategy_respected === true}
                            onChange={() => handleInputChange(trade.topstep_id, 'strategy_respected', true)}
                            className="mr-2"
                          />
                          <span className="text-sm">Oui</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name={`strategy_respected_${trade.topstep_id}`}
                            checked={strategy.strategy_respected === false}
                            onChange={() => handleInputChange(trade.topstep_id, 'strategy_respected', false)}
                            className="mr-2"
                          />
                          <span className="text-sm">Non</span>
                        </label>
                      </div>
                      {errors[`${trade.topstep_id}_strategy_respected`] && (
                        <p className="text-red-500 text-xs mt-1">{errors[`${trade.topstep_id}_strategy_respected`]}</p>
                      )}
                    </div>

                    {/* Émotions dominantes */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Émotions dominantes
                      </label>
                      <div className="grid grid-cols-2 gap-1">
                        {EMOTION_CHOICES.map(emotion => (
                          <label key={emotion} className="flex items-center text-xs">
                            <input
                              type="checkbox"
                              checked={strategy.dominant_emotions.includes(emotion)}
                              onChange={() => handleEmotionToggle(trade.topstep_id, emotion)}
                              className="mr-1"
                            />
                            <span className="capitalize">{emotion}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Gain si stratégie respectée - Affiché seulement si stratégie non respectée */}
                    {strategy.strategy_respected === false && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Gain si stratégie respectée
                        </label>
                        <div className="space-y-2">
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name={`gain_if_strategy_respected_${trade.topstep_id}`}
                              checked={strategy.gain_if_strategy_respected === true}
                              onChange={() => handleInputChange(trade.topstep_id, 'gain_if_strategy_respected', true)}
                              className="mr-2"
                            />
                            <span className="text-sm">Oui</span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name={`gain_if_strategy_respected_${trade.topstep_id}`}
                              checked={strategy.gain_if_strategy_respected === false}
                              onChange={() => handleInputChange(trade.topstep_id, 'gain_if_strategy_respected', false)}
                              className="mr-2"
                            />
                            <span className="text-sm">Non</span>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Take Profits */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Take Profits atteints
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={strategy.tp1_reached}
                            onChange={(e) => handleInputChange(trade.topstep_id, 'tp1_reached', e.target.checked)}
                            className="mr-2"
                          />
                          <span className="text-sm">TP1 atteint</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={strategy.tp2_plus_reached}
                            onChange={(e) => handleInputChange(trade.topstep_id, 'tp2_plus_reached', e.target.checked)}
                            className="mr-2"
                          />
                          <span className="text-sm">TP2+ atteint</span>
                        </label>
                      </div>
                    </div>

                    {/* Note de la session */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Note de la session *
                      </label>
                      <select
                        value={strategy.session_rating || ''}
                        onChange={(e) => handleInputChange(trade.topstep_id, 'session_rating', e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Sélectionner une note</option>
                        {SESSION_RATING_CHOICES.map(choice => (
                          <option key={choice.value} value={choice.value}>
                            {choice.label}
                          </option>
                        ))}
                      </select>
                      {errors[`${trade.topstep_id}_session_rating`] && (
                        <p className="text-red-500 text-xs mt-1">{errors[`${trade.topstep_id}_session_rating`]}</p>
                      )}
                    </div>

                    {/* Détails des émotions */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Détails des émotions
                      </label>
                      <textarea
                        value={strategy.emotion_details}
                        onChange={(e) => handleInputChange(trade.topstep_id, 'emotion_details', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Décrivez vos émotions pendant ce trade..."
                      />
                    </div>

                    {/* Améliorations possibles */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Améliorations possibles
                      </label>
                      <textarea
                        value={strategy.possible_improvements}
                        onChange={(e) => handleInputChange(trade.topstep_id, 'possible_improvements', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Que pourriez-vous améliorer ?"
                      />
                    </div>

                    {/* Screenshot URL */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        URL Screenshot
                      </label>
                      <input
                        type="url"
                        value={strategy.screenshot_url}
                        onChange={(e) => handleInputChange(trade.topstep_id, 'screenshot_url', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Lien vers l'image TradingView..."
                      />
                      {strategy.screenshot_url && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => window.open(strategy.screenshot_url, '_blank', 'noopener,noreferrer')}
                            className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                          >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Voir le screenshot
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Vidéo URL */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        URL Vidéo
                      </label>
                      <input
                        type="url"
                        value={strategy.video_url}
                        onChange={(e) => handleInputChange(trade.topstep_id, 'video_url', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Lien YouTube ou autre..."
                      />
                      {strategy.video_url && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => window.open(strategy.video_url, '_blank', 'noopener,noreferrer')}
                            className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                          >
                            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                            Regarder la vidéo
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-lg border-t border-gray-200">
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isLoading ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
          </div>
        </div>
      </div>

      {/* Dialog de confirmation de suppression */}
      <ConfirmDialog
        isOpen={confirmDelete.isOpen}
        title="Supprimer le trade"
        message={
          <div>
            <p>Êtes-vous sûr de vouloir supprimer le trade <strong>{confirmDelete.tradeInfo}</strong> ?</p>
            <p className="mt-2 text-sm text-gray-600">
              Cette action supprimera également toutes les données de stratégie associées et ne peut pas être annulée.
            </p>
          </div>
        }
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        tone="danger"
        onConfirm={confirmDeleteTrade}
        onCancel={cancelDeleteTrade}
      />
    </div>
  );
};

export default TradesStrategyModal;
