import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast/headless';
import { tradesService } from '../../services/trades';
import { AccountSelector } from '../accounts/AccountSelector';
import { positionStrategiesService, PositionStrategy } from '../../services/positionStrategies';
import { CustomSelect } from '../common/CustomSelect';
import { NumberInput } from '../common/NumberInput';
import { DateTimeInput } from '../common/DateTimeInput';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useTradingAccount } from '../../contexts/TradingAccountContext';
import { usePreferences } from '../../hooks/usePreferences';
import { formatNumber } from '../../utils/numberFormat';
import { formatDate } from '../../utils/dateFormat';

interface CreateTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  tradeId?: number | null; // ID du trade à éditer (null ou undefined = création)
}

export const CreateTradeModal: React.FC<CreateTradeModalProps> = ({
  isOpen,
  onClose,
  onSave,
  tradeId,
}) => {
  const { t } = useI18nTranslation();
  const { preferences, loading: preferencesLoading } = usePreferences();
  const { selectedAccountId } = useTradingAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [strategies, setStrategies] = useState<PositionStrategy[]>([]);
  const [loadingStrategies, setLoadingStrategies] = useState(false);
  const [isPnlManuallyEdited, setIsPnlManuallyEdited] = useState(false);

  const [formData, setFormData] = useState({
    trading_account: null as number | null,
    contract_name: '',
    trade_type: 'Long' as 'Long' | 'Short',
    entered_at: '',
    exited_at: '',
    entry_price: '',
    exit_price: '',
    size: '',
    point_value: '',
    fees: '0',
    commissions: '0',
    pnl: '',
    notes: '',
    position_strategy: null as number | null,
    planned_stop_loss: '',
    planned_take_profit: '',
  });


  // Charger les stratégies de position
  useEffect(() => {
    if (isOpen) {
      const loadStrategies = async () => {
        setLoadingStrategies(true);
        try {
          const list = await positionStrategiesService.list({ 
            status: 'active',
            is_current: true 
          });
          setStrategies(list);
        } catch {
          setStrategies([]);
        } finally {
          setLoadingStrategies(false);
        }
      };
      loadStrategies();
    }
  }, [isOpen]);

  // Charger les données du trade si on est en mode édition
  useEffect(() => {
    if (isOpen && tradeId && !preferencesLoading) {
      const loadTrade = async () => {
        setIsLoading(true);
        try {
          const trade = await tradesService.retrieve(tradeId);
          // Formater les dates pour datetime-local (YYYY-MM-DDTHH:mm)
          // en tenant compte du timezone de l'utilisateur
          const formatDateTimeLocal = (dateStr: string | null): string => {
            if (!dateStr) return '';
            const date = new Date(dateStr);
            
            let year: number, month: number, day: number, hours: number, minutes: number;
            
            if (preferences.timezone) {
              // Utiliser Intl.DateTimeFormat pour obtenir les composants dans le timezone spécifié
              const formatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: preferences.timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              });
              
              const parts = formatter.formatToParts(date);
              year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
              month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10);
              day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
              hours = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
              minutes = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
            } else {
              // Fallback vers l'heure locale si pas de timezone
              year = date.getFullYear();
              month = date.getMonth() + 1;
              day = date.getDate();
              hours = date.getHours();
              minutes = date.getMinutes();
            }
            
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          };
          
          setFormData({
            trading_account: trade.trading_account || null,
            contract_name: trade.contract_name || '',
            trade_type: trade.trade_type || 'Long',
            entered_at: formatDateTimeLocal(trade.entered_at),
            exited_at: formatDateTimeLocal(trade.exited_at),
            entry_price: trade.entry_price || '',
            exit_price: trade.exit_price || '',
            size: trade.size || '',
            point_value: trade.point_value || '',
            fees: trade.fees || '0',
            commissions: trade.commissions || '0',
            pnl: trade.pnl || '',
            notes: trade.notes || '',
            position_strategy: trade.position_strategy || null,
            planned_stop_loss: trade.planned_stop_loss || '',
            planned_take_profit: trade.planned_take_profit || '',
          });
          // Si le PnL existe déjà, considérer qu'il a été édité manuellement
          setIsPnlManuallyEdited(!!trade.pnl);
        } catch (err: any) {
          const errorMessage = err.message || t('trades:createModal.errors.loadError', { defaultValue: 'Erreur lors du chargement du trade' });
          setError(errorMessage);
          toast.error(errorMessage);
        } finally {
          setIsLoading(false);
        }
      };
      loadTrade();
    }
  }, [isOpen, tradeId, t, preferences.timezone, preferencesLoading]);

  // Options pour le type de trade
  const tradeTypeOptions = useMemo(() => [
    { value: 'Long', label: t('trades:createModal.long', { defaultValue: 'Long' }) },
    { value: 'Short', label: t('trades:createModal.short', { defaultValue: 'Short' }) },
  ], [t]);

  // Options pour les stratégies
  const strategyOptions = useMemo(() => [
    { value: null, label: t('trades:createModal.noStrategy', { defaultValue: 'Aucune stratégie' }) },
    ...strategies.map(strategy => ({
      value: strategy.id,
      label: `${strategy.title}${strategy.version > 1 ? ` (v${strategy.version})` : ''}`
    }))
  ], [strategies, t]);

  // Placeholders formatés selon les préférences utilisateur
  const pricePlaceholder = useMemo(() => formatNumber(0, 4, preferences.number_format), [preferences.number_format]);
  const pnlPlaceholder = useMemo(() => formatNumber(0, 4, preferences.number_format), [preferences.number_format]);
  const feesPlaceholder = useMemo(() => formatNumber(0, 4, preferences.number_format), [preferences.number_format]);
  const sizePlaceholder = useMemo(() => formatNumber(1, 4, preferences.number_format), [preferences.number_format]);
  const pointValuePlaceholder = useMemo(() => formatNumber(20, 2, preferences.number_format), [preferences.number_format]);
  
  // Format de date/heure pour l'aide
  const dateTimeFormatExample = useMemo(() => {
    if (preferencesLoading) {
      // Retourner un format par défaut pendant le chargement
      return 'DD/MM/YYYY HH:MM';
    }
    const now = new Date();
    // S'assurer que date_format est bien défini (par défaut 'EU' si non défini)
    const dateFormat = preferences.date_format || 'EU';
    
    // Utiliser le timezone de l'utilisateur pour formater correctement
    const formattedDate = formatDate(now, dateFormat as 'EU' | 'US', false, preferences.timezone);
    const formattedTime = formatDate(now, dateFormat as 'EU' | 'US', true, preferences.timezone);
    // Extraire l'heure de la date formatée avec heure
    const timePart = formattedTime.split(' ')[1] || '00:00';
    return `${formattedDate} ${timePart}`;
  }, [preferences.date_format, preferences.timezone, preferencesLoading]);

  // Initialiser avec le compte sélectionné dans le contexte (seulement en mode création)
  useEffect(() => {
    if (isOpen && selectedAccountId && !tradeId) {
      setFormData(prev => ({ ...prev, trading_account: selectedAccountId }));
    }
  }, [isOpen, selectedAccountId, tradeId]);

  // Réinitialiser le formulaire quand la modale s'ouvre (seulement si création, pas édition)
  useEffect(() => {
    if (isOpen && !tradeId && !preferencesLoading) {
      // Obtenir la date/heure actuelle dans le timezone de l'utilisateur
      const now = new Date();
      
      // Formater la date/heure au format datetime-local (YYYY-MM-DDTHH:mm)
      // en tenant compte du timezone de l'utilisateur
      const formatDateTimeLocal = (date: Date): string => {
        // Si un timezone est configuré, convertir la date dans ce timezone
        let year: number, month: number, day: number, hours: number, minutes: number;
        
        if (preferences.timezone) {
          // Utiliser Intl.DateTimeFormat pour obtenir les composants dans le timezone spécifié
          const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: preferences.timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
          
          const parts = formatter.formatToParts(date);
          year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
          month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10);
          day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
          hours = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
          minutes = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
        } else {
          // Fallback vers l'heure locale si pas de timezone
          year = date.getFullYear();
          month = date.getMonth() + 1;
          day = date.getDate();
          hours = date.getHours();
          minutes = date.getMinutes();
        }
        
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      };
      
      setFormData({
        trading_account: selectedAccountId || null,
        contract_name: '',
        trade_type: 'Long',
        entered_at: formatDateTimeLocal(now), // Format datetime-local avec date/heure actuelle dans le timezone de l'utilisateur
        exited_at: '', // Laisser vide par défaut car c'est optionnel
        entry_price: '',
        exit_price: '',
        size: '',
        point_value: '',
        fees: '0',
        commissions: '0',
        pnl: '',
        notes: '',
        position_strategy: null,
        planned_stop_loss: '',
        planned_take_profit: '',
      });
      setError(null);
      setIsPnlManuallyEdited(false);
    }
  }, [isOpen, selectedAccountId, tradeId, preferences.timezone, preferencesLoading]);

  // Empêcher le scroll du body quand la modale est ouverte
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Calculer automatiquement le PnL si les prix d'entrée et de sortie sont fournis
  useEffect(() => {
    // Ne pas calculer si l'utilisateur a modifié manuellement le PnL
    if (isPnlManuallyEdited) {
      return;
    }

    if (formData.entry_price && formData.exit_price && formData.size && formData.trade_type) {
      const entryPrice = parseFloat(formData.entry_price);
      const exitPrice = parseFloat(formData.exit_price);
      const size = parseFloat(formData.size);
      const pointValue = formData.point_value ? parseFloat(formData.point_value) : null;

      if (!isNaN(entryPrice) && !isNaN(exitPrice) && !isNaN(size) && entryPrice > 0 && exitPrice > 0 && size > 0) {
        let priceDiff: number;
        if (formData.trade_type === 'Long') {
          // Long: gain si prix monte
          priceDiff = exitPrice - entryPrice;
        } else {
          // Short: gain si prix baisse
          priceDiff = entryPrice - exitPrice;
        }

        // Calculer le PnL
        let calculatedPnl: number;
        if (pointValue && !isNaN(pointValue) && pointValue > 0) {
          // Calcul précis avec la valeur du point
          calculatedPnl = priceDiff * pointValue * size;
        } else {
          // Approximation sans valeur du point
          calculatedPnl = priceDiff * size;
        }

        // Mettre à jour le PnL
        setFormData(prev => ({ ...prev, pnl: String(calculatedPnl) }));
      } else if (!formData.entry_price || !formData.exit_price || !formData.size) {
        // Réinitialiser le PnL si les champs requis ne sont plus remplis
        setFormData(prev => ({ ...prev, pnl: '' }));
      }
    } else {
      // Réinitialiser le PnL si les champs requis ne sont plus remplis
      setFormData(prev => ({ ...prev, pnl: '' }));
    }
  }, [formData.entry_price, formData.exit_price, formData.size, formData.trade_type, formData.point_value, isPnlManuallyEdited]);

  // Calculer automatiquement le R:R prévu si les prix sont fournis
  const calculatedPlannedRR = useMemo(() => {
    if (!formData.entry_price || !formData.planned_stop_loss || !formData.planned_take_profit || !formData.trade_type) {
      return null;
    }

    const entryPrice = parseFloat(formData.entry_price);
    const stopLoss = parseFloat(formData.planned_stop_loss);
    const takeProfit = parseFloat(formData.planned_take_profit);

    if (isNaN(entryPrice) || isNaN(stopLoss) || isNaN(takeProfit) || entryPrice <= 0 || stopLoss <= 0 || takeProfit <= 0) {
      return null;
    }

    let risk: number;
    let reward: number;

    if (formData.trade_type === 'Long') {
      // Long: risk = entry - stop_loss, reward = take_profit - entry
      risk = entryPrice - stopLoss;
      reward = takeProfit - entryPrice;
    } else {
      // Short: risk = stop_loss - entry, reward = entry - take_profit
      risk = stopLoss - entryPrice;
      reward = entryPrice - takeProfit;
    }

    if (risk > 0) {
      return reward / risk;
    }

    return null;
  }, [formData.entry_price, formData.planned_stop_loss, formData.planned_take_profit, formData.trade_type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Validation des champs requis
      if (!formData.contract_name.trim()) {
        throw new Error(t('trades:createModal.errors.contractRequired', { defaultValue: 'Le nom du contrat est requis' }));
      }
      if (!formData.entered_at) {
        throw new Error(t('trades:createModal.errors.entryDateRequired', { defaultValue: 'La date d\'entrée est requise' }));
      }
      if (!formData.entry_price || parseFloat(formData.entry_price) <= 0) {
        throw new Error(t('trades:createModal.errors.entryPriceRequired', { defaultValue: 'Le prix d\'entrée est requis et doit être supérieur à 0' }));
      }
      if (!formData.size || parseFloat(formData.size) <= 0) {
        throw new Error(t('trades:createModal.errors.sizeRequired', { defaultValue: 'La taille est requise et doit être supérieure à 0' }));
      }

      // Préparer le payload
      const payload: any = {
        contract_name: formData.contract_name.trim(),
        trade_type: formData.trade_type,
        entered_at: new Date(formData.entered_at).toISOString(),
        entry_price: formData.entry_price,
        size: formData.size,
        fees: formData.fees || '0',
        commissions: formData.commissions || '0',
      };

      // Ajouter les champs optionnels s'ils sont remplis
      if (formData.trading_account) {
        payload.trading_account = formData.trading_account;
      }
      if (formData.exited_at && formData.exited_at.trim() !== '') {
        payload.exited_at = new Date(formData.exited_at).toISOString();
      }
      if (formData.exit_price) {
        payload.exit_price = formData.exit_price;
      }
      if (formData.point_value) {
        payload.point_value = formData.point_value;
      }
      if (formData.pnl) {
        payload.pnl = formData.pnl;
      }
      if (formData.notes.trim()) {
        payload.notes = formData.notes.trim();
      }
      if (formData.position_strategy) {
        payload.position_strategy = formData.position_strategy;
      }
      if (formData.planned_stop_loss) {
        payload.planned_stop_loss = formData.planned_stop_loss;
      }
      if (formData.planned_take_profit) {
        payload.planned_take_profit = formData.planned_take_profit;
      }

      if (tradeId) {
        // Mode édition
        await tradesService.update(tradeId, payload);
        toast.success(t('trades:createModal.updateSuccess', { defaultValue: 'Trade modifié avec succès' }));
      } else {
        // Mode création
        await tradesService.create(payload);
        toast.success(t('trades:createModal.success', { defaultValue: 'Trade créé avec succès' }));
      }
      onSave();
      onClose();
    } catch (err: any) {
      const errorMessage = err.message || (
        tradeId 
          ? t('trades:createModal.errors.updateError', { defaultValue: 'Erreur lors de la modification du trade' })
          : t('trades:createModal.errors.createError', { defaultValue: 'Erreur lors de la création du trade' })
      );
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-2 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white dark:bg-gray-800 w-full max-w-4xl rounded-xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-3 sm:px-6 py-3 sm:py-5 border-b border-gray-200 dark:border-gray-700 flex items-start sm:items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-t-xl flex-shrink-0 gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-600 dark:bg-blue-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
                {tradeId 
                  ? t('trades:createModal.editTitle', { defaultValue: 'Modifier un trade' })
                  : t('trades:createModal.title', { defaultValue: 'Créer un trade manuellement' })}
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                {tradeId
                  ? t('trades:createModal.editDescription', { defaultValue: 'Modifiez les informations du trade' })
                  : t('trades:createModal.description', { defaultValue: 'Saisissez les informations du trade' })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="w-8 h-8 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          {error && (
            <div className="mb-3 sm:mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs sm:text-sm text-red-700 dark:text-red-300 break-words">
              {error}
            </div>
          )}

          <div className="space-y-3 sm:space-y-4">
            {/* Compte de trading */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('trades:createModal.tradingAccount', { defaultValue: 'Compte de trading' })}
                <span className="text-gray-400 text-xs ml-1">({t('common:optional', { defaultValue: 'optionnel' })})</span>
              </label>
              <AccountSelector
                value={formData.trading_account}
                onChange={(accountId) => setFormData(prev => ({ ...prev, trading_account: accountId }))}
                allowAllActive={false}
                hideLabel
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('trades:createModal.tradingAccountHelp', { defaultValue: 'Si non spécifié, le compte par défaut sera utilisé' })}
              </p>
            </div>

            {/* Nom du contrat et Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('trades:createModal.contractName', { defaultValue: 'Nom du contrat' })}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.contract_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, contract_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="ex: NQZ5, ESH5"
                  required
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('trades:createModal.tradeType', { defaultValue: 'Type' })}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <CustomSelect
                  value={formData.trade_type}
                  onChange={(value) => setFormData(prev => ({ ...prev, trade_type: value as 'Long' | 'Short' }))}
                  options={tradeTypeOptions}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Dates d'entrée et de sortie */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('trades:createModal.entryDate', { defaultValue: 'Date/Heure d\'entrée' })}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <DateTimeInput
                  value={formData.entered_at}
                  onChange={(value) => setFormData(prev => ({ ...prev, entered_at: value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  disabled={isLoading}
                  title={t('trades:createModal.dateTimeFormat', { defaultValue: `Format: ${dateTimeFormatExample}`, dateTimeFormatExample })}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Format: {dateTimeFormatExample}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('trades:createModal.exitDate', { defaultValue: 'Date/Heure de sortie' })}
                  <span className="text-gray-400 text-xs ml-1">({t('common:optional', { defaultValue: 'optionnel' })})</span>
                </label>
                <DateTimeInput
                  value={formData.exited_at || ''}
                  onChange={(value) => setFormData(prev => ({ ...prev, exited_at: value || '' }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                  title={t('trades:createModal.dateTimeFormat', { defaultValue: `Format: ${dateTimeFormatExample}`, dateTimeFormatExample })}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Format: {dateTimeFormatExample}
                </p>
              </div>
            </div>

            {/* Prix d'entrée et de sortie */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('trades:createModal.entryPrice', { defaultValue: 'Prix d\'entrée' })}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <NumberInput
                  value={formData.entry_price}
                  onChange={(value) => setFormData(prev => ({ ...prev, entry_price: value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={pricePlaceholder}
                  required
                  min={0}
                  step="any"
                  digits={4}
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('trades:createModal.exitPrice', { defaultValue: 'Prix de sortie' })}
                  <span className="text-gray-400 text-xs ml-1">({t('common:optional', { defaultValue: 'optionnel' })})</span>
                </label>
                <NumberInput
                  value={formData.exit_price}
                  onChange={(value) => setFormData(prev => ({ ...prev, exit_price: value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={pricePlaceholder}
                  min={0}
                  step="any"
                  digits={4}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Risk/Reward Ratio - Planification */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                {t('trades:createModal.riskRewardPlanning', { defaultValue: 'Planification Risk/Reward' })}
                <span className="text-gray-400 text-xs ml-1 font-normal">({t('common:optional', { defaultValue: 'optionnel' })})</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('trades:createModal.plannedStopLoss', { defaultValue: 'Stop Loss prévu' })}
                  </label>
                  <NumberInput
                    value={formData.planned_stop_loss}
                    onChange={(value) => setFormData(prev => ({ ...prev, planned_stop_loss: value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={pricePlaceholder}
                    min={0}
                    step="any"
                    digits={4}
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('trades:createModal.plannedTakeProfit', { defaultValue: 'Take Profit prévu' })}
                  </label>
                  <NumberInput
                    value={formData.planned_take_profit}
                    onChange={(value) => setFormData(prev => ({ ...prev, planned_take_profit: value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={pricePlaceholder}
                    min={0}
                    step="any"
                    digits={4}
                    disabled={isLoading}
                  />
                </div>
              </div>
              {calculatedPlannedRR !== null && (
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    <span className="font-medium">{t('trades:createModal.plannedRR', { defaultValue: 'R:R prévu' })}:</span>{' '}
                    <span className="font-semibold">1:{calculatedPlannedRR.toFixed(2)}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Taille et Valeur du point */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('trades:createModal.size', { defaultValue: 'Taille (Quantité)' })}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <NumberInput
                  value={formData.size}
                  onChange={(value) => setFormData(prev => ({ ...prev, size: value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={sizePlaceholder}
                  required
                  min={0.0001}
                  step="any"
                  digits={4}
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('trades:createModal.pointValue', { defaultValue: 'Valeur du point' })}
                  <span className="text-gray-400 text-xs ml-1">({t('common:optional', { defaultValue: 'optionnel' })})</span>
                </label>
                <NumberInput
                  value={formData.point_value}
                  onChange={(value) => setFormData(prev => ({ ...prev, point_value: value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={pointValuePlaceholder}
                  min={0.01}
                  step="any"
                  digits={2}
                  disabled={isLoading}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t('trades:createModal.pointValueHelp', { defaultValue: 'Ex: 20 pour NQ, 50 pour ES, 5 pour YM' })}
                </p>
              </div>
            </div>

            {/* Frais et Commissions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('trades:createModal.fees', { defaultValue: 'Frais' })}
                </label>
                <NumberInput
                  value={formData.fees}
                  onChange={(value) => setFormData(prev => ({ ...prev, fees: value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={feesPlaceholder}
                  min={0}
                  step="any"
                  digits={4}
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('trades:createModal.commissions', { defaultValue: 'Commissions' })}
                </label>
                <NumberInput
                  value={formData.commissions}
                  onChange={(value) => setFormData(prev => ({ ...prev, commissions: value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={feesPlaceholder}
                  min={0}
                  step="any"
                  digits={4}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* PnL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('trades:createModal.pnl', { defaultValue: 'Profit/Perte (PnL)' })}
                <span className="text-gray-400 text-xs ml-1">({t('common:optional', { defaultValue: 'optionnel' })})</span>
              </label>
              <NumberInput
                value={formData.pnl}
                onChange={(value) => {
                  setIsPnlManuallyEdited(true);
                  setFormData(prev => ({ ...prev, pnl: value }));
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={pnlPlaceholder}
                step="any"
                digits={4}
                disabled={isLoading}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('trades:createModal.pnlHelp', { defaultValue: 'Si non spécifié, le PnL peut être calculé automatiquement' })}
              </p>
            </div>

            {/* Stratégie */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('trades:createModal.strategy', { defaultValue: 'Stratégie' })}
                <span className="text-gray-400 text-xs ml-1">({t('common:optional', { defaultValue: 'optionnel' })})</span>
              </label>
              <CustomSelect
                value={formData.position_strategy}
                onChange={(value) => setFormData(prev => ({ ...prev, position_strategy: value as number | null }))}
                options={strategyOptions}
                disabled={isLoading || loadingStrategies}
              />
              {loadingStrategies && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t('trades:createModal.loadingStrategies', { defaultValue: 'Chargement des stratégies...' })}
                </p>
              )}
              {!loadingStrategies && strategies.length === 0 && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t('trades:createModal.noStrategiesAvailable', { defaultValue: 'Aucune stratégie active disponible' })}
                </p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('trades:createModal.notes', { defaultValue: 'Notes' })}
                <span className="text-gray-400 text-xs ml-1">({t('common:optional', { defaultValue: 'optionnel' })})</span>
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                placeholder={t('trades:createModal.notesPlaceholder', { defaultValue: 'Notes personnelles sur ce trade' })}
                disabled={isLoading}
              />
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-3 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3 flex-shrink-0 bg-gray-50 dark:bg-gray-900/50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors w-full sm:w-auto"
          >
            {t('common:cancel', { defaultValue: 'Annuler' })}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors w-full sm:w-auto"
          >
            {isLoading
              ? t('common:saving', { defaultValue: 'Enregistrement...' })
              : tradeId
                ? t('common:save', { defaultValue: 'Enregistrer' })
                : t('common:create', { defaultValue: 'Créer' })}
          </button>
        </div>
      </div>
    </div>
  );
};

