import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { goalsService, TradingGoal, GoalsFilters, GoalStatistics } from '../services/goals';
import { tradingAccountsService, TradingAccount } from '../services/tradingAccounts';
import { currenciesService, Currency } from '../services/currencies';
import { GoalCard } from '../components/goals/GoalCard';
import { GoalModal } from '../components/goals/GoalModal';
import { FloatingActionButton } from '../components/ui/FloatingActionButton';
import DeleteConfirmModal from '../components/ui/DeleteConfirmModal';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useTradingAccount } from '../contexts/TradingAccountContext';

const GoalsPage: React.FC = () => {
  const { t } = useI18nTranslation();
  const { selectedAccountId } = useTradingAccount();
  
  const [goals, setGoals] = useState<TradingGoal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'achieved' | 'failed' | 'cancelled'>('active');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<TradingGoal | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<TradingGoal | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statistics, setStatistics] = useState<GoalStatistics | null>(null);
  const previousGoalsStatusRef = React.useRef<Map<number, string>>(new Map());
  const notifiedGoalsRef = React.useRef<Set<number>>(new Set()); // Objectifs pour lesquels on a déjà notifié
  
  const loadGoals = React.useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
      setError(null);
    }
    try {
      const filters: GoalsFilters = {};
      if (filterStatus !== 'all') {
        filters.status = filterStatus;
      }
      const data = await goalsService.list(filters);
      // S'assurer que data est toujours un tableau
      const newGoals = Array.isArray(data) ? data : [];
      
      // Détecter les changements de statut pour afficher des notifications
      const now = new Date();
      newGoals.forEach((goal) => {
        const previousStatus = previousGoalsStatusRef.current.get(goal.id);
        const hasBeenNotified = notifiedGoalsRef.current.has(goal.id);
        
        // Vérifier si le statut a changé
        if (previousStatus && previousStatus !== goal.status) {
          // Statut a changé
          if (goal.status === 'achieved' && previousStatus !== 'achieved') {
            const goalTypeLabel = t(`goals:goalTypes.${goal.goal_type}`, { defaultValue: goal.goal_type });
            toast.success(
              t('goals:goalAchievedNotification', { 
                defaultValue: `🎉 Objectif atteint : ${goalTypeLabel}`,
                goalType: goalTypeLabel
              }),
              { duration: 5000, icon: '🎉' }
            );
            notifiedGoalsRef.current.add(goal.id);
          } else if (goal.status === 'failed' && previousStatus !== 'failed') {
            const goalTypeLabel = t(`goals:goalTypes.${goal.goal_type}`, { defaultValue: goal.goal_type });
            toast.error(
              t('goals:goalFailedNotification', { 
                defaultValue: `❌ Objectif échoué : ${goalTypeLabel}`,
                goalType: goalTypeLabel
              }),
              { duration: 5000, icon: '❌' }
            );
            notifiedGoalsRef.current.add(goal.id);
          }
        } else if (goal.status === 'achieved' && !hasBeenNotified) {
          // Vérifier si l'objectif a été atteint récemment (dans les 5 dernières minutes)
          // en utilisant last_achieved_alert_sent ou updated_at
          let recentlyAchieved = false;
          
          if (goal.last_achieved_alert_sent) {
            const alertSentDate = new Date(goal.last_achieved_alert_sent);
            const minutesSinceAlert = (now.getTime() - alertSentDate.getTime()) / (1000 * 60);
            recentlyAchieved = minutesSinceAlert <= 5; // Dans les 5 dernières minutes
          } else if (goal.updated_at) {
            const updatedDate = new Date(goal.updated_at);
            const minutesSinceUpdate = (now.getTime() - updatedDate.getTime()) / (1000 * 60);
            // Si mis à jour récemment et statut est "achieved", probablement vient d'être atteint
            recentlyAchieved = minutesSinceUpdate <= 5 && goal.status === 'achieved';
          }
          
          if (recentlyAchieved) {
            const goalTypeLabel = t(`goals:goalTypes.${goal.goal_type}`, { defaultValue: goal.goal_type });
            toast.success(
              t('goals:goalAchievedNotification', { 
                defaultValue: `🎉 Objectif atteint : ${goalTypeLabel}`,
                goalType: goalTypeLabel
              }),
              { duration: 5000, icon: '🎉' }
            );
            notifiedGoalsRef.current.add(goal.id);
          }
        }
      });
      
      // Mettre à jour le map des statuts précédents
      const newStatusMap = new Map<number, string>();
      newGoals.forEach((goal) => {
        newStatusMap.set(goal.id, goal.status);
      });
      previousGoalsStatusRef.current = newStatusMap;
      
      // Ne mettre à jour que si les données ont vraiment changé pour éviter les re-renders inutiles
      setGoals(prevGoals => {
        if (prevGoals.length !== newGoals.length) {
          return newGoals;
        }
        
        // Créer un map pour comparer efficacement
        const prevGoalsMap = new Map(prevGoals.map(g => [g.id, g]));
        const newGoalsMap = new Map(newGoals.map(g => [g.id, g]));
        
        // Vérifier si un objectif a été supprimé
        const hasDeleted = prevGoals.some(prevGoal => !newGoalsMap.has(prevGoal.id));
        if (hasDeleted) {
          return newGoals;
        }
        
        // Vérifier si un objectif a changé ou a été ajouté
        const hasChanged = newGoals.some(newGoal => {
          const prevGoal = prevGoalsMap.get(newGoal.id);
          if (!prevGoal) return true; // Nouvel objectif
          
          // Comparer les propriétés importantes, y compris les dates
          return prevGoal.status !== newGoal.status || 
                 prevGoal.progress_percentage !== newGoal.progress_percentage ||
                 prevGoal.current_value !== newGoal.current_value ||
                 prevGoal.remaining_days !== newGoal.remaining_days ||
                 prevGoal.start_date !== newGoal.start_date ||
                 prevGoal.end_date !== newGoal.end_date;
        });
        
        return hasChanged ? newGoals : prevGoals;
      });
    } catch (err: any) {
      if (showLoading) {
        setError(err.message || t('goals:errorLoading'));
        setGoals([]);
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [filterStatus, t]);
  
  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  // Polling périodique pour détecter les changements de statut (toutes les 30 secondes)
  // Utiliser showLoading=false pour éviter le clignotement visuel
  useEffect(() => {
    if (isModalOpen) return; // Ne pas poller si la modale est ouverte
    
    const interval = setInterval(() => {
      loadGoals(false); // Ne pas afficher le loader lors du polling
    }, 30000); // 30 secondes

    return () => clearInterval(interval);
  }, [loadGoals, isModalOpen]);

  // Charger les statistiques séparément pour avoir les compteurs corrects
  // Utiliser un debounce pour éviter les rechargements trop fréquents
  useEffect(() => {
    const loadStatistics = async () => {
      try {
        const stats = await goalsService.getStatistics();
        // Ne mettre à jour que si les statistiques ont vraiment changé
        setStatistics(prevStats => {
          if (!prevStats) return stats;
          // Comparer les valeurs importantes
          if (prevStats.total_goals !== stats.total_goals ||
              prevStats.active_goals !== stats.active_goals ||
              prevStats.achieved_goals !== stats.achieved_goals ||
              prevStats.failed_goals !== stats.failed_goals ||
              prevStats.cancelled_goals !== stats.cancelled_goals) {
            return stats;
          }
          return prevStats; // Pas de changement, garder l'ancien
        });
      } catch (err) {
        // Ignorer les erreurs de statistiques, ce n'est pas critique
        console.error('Failed to load goal statistics:', err);
      }
    };
    
    // Debounce pour éviter les appels trop fréquents
    const timeoutId = setTimeout(loadStatistics, 300);
    return () => clearTimeout(timeoutId);
  }, [goals]); // Recharger quand les objectifs changent
  
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const data = await tradingAccountsService.list();
        setAccounts(data);
      } catch {
        setAccounts([]);
      }
    };
    loadAccounts();
  }, []);
  
  useEffect(() => {
    const loadCurrencies = async () => {
      try {
        const data = await currenciesService.list();
        setCurrencies(data);
      } catch {
        setCurrencies([]);
      }
    };
    loadCurrencies();
  }, []);
  
  const getCurrencySymbol = (goal: TradingGoal): string => {
    if (!goal.trading_account) {
      // Si pas de compte spécifique, utiliser le compte sélectionné ou USD par défaut
      if (selectedAccountId) {
        const account = accounts.find(a => a.id === selectedAccountId);
        if (account) {
          const currency = currencies.find(c => c.code === account.currency);
          return currency?.symbol || '';
        }
      }
      return '';
    }
    
    const account = accounts.find(a => a.id === goal.trading_account);
    if (account) {
      const currency = currencies.find(c => c.code === account.currency);
      return currency?.symbol || '';
    }
    return '';
  };
  
  const handleCreateGoal = () => {
    setSelectedGoal(null);
    setIsModalOpen(true);
  };
  
  const handleGoalClick = (goal: TradingGoal) => {
    setSelectedGoal(goal);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedGoal(null);
  };

  const handleGoalSaved = () => {
    loadGoals();
  };

  const handleCancelGoal = async (goal: TradingGoal) => {
    try {
      const updatedGoal = await goalsService.update(goal.id, { status: 'cancelled' });
      
      toast.success(t('goals:cancelSuccess', { defaultValue: 'Objectif annulé avec succès' }), {
        duration: 3000,
      });
      
      // Recharger les statistiques pour mettre à jour les compteurs
      try {
        const stats = await goalsService.getStatistics();
        setStatistics(stats);
      } catch (err) {
        console.error('Failed to reload statistics:', err);
      }
      
      // Si le filtre est sur "active", changer pour "all" pour voir l'objectif annulé
      // Puis recharger les données avec le nouveau filtre
      if (filterStatus === 'active') {
        setFilterStatus('all');
        // Le useEffect se chargera de recharger les données
      } else {
        // Sinon, mettre à jour directement l'objectif dans la liste locale
        setGoals(prevGoals => 
          prevGoals.map(g => g.id === goal.id ? { ...g, ...updatedGoal, status: 'cancelled' as const } : g)
        );
      }
    } catch (err: any) {
      toast.error(err.message || t('goals:cancelError', { defaultValue: 'Erreur lors de l\'annulation' }), {
        duration: 4000,
      });
    }
  };

  const handleReactivateGoal = async (goal: TradingGoal) => {
    try {
      const updatedGoal = await goalsService.update(goal.id, { status: 'active' });
      
      toast.success(t('goals:reactivateSuccess', { defaultValue: 'Objectif réactivé avec succès' }), {
        duration: 3000,
      });
      
      // Recharger les statistiques pour mettre à jour les compteurs
      try {
        const stats = await goalsService.getStatistics();
        setStatistics(stats);
      } catch (err) {
        console.error('Failed to reload statistics:', err);
      }
      
      // Mettre à jour directement l'objectif dans la liste locale
      setGoals(prevGoals => 
        prevGoals.map(g => g.id === goal.id ? { ...g, ...updatedGoal, status: 'active' as const } : g)
      );
      
      // Si le filtre est sur "cancelled", changer pour "active" pour voir l'objectif réactivé
      if (filterStatus === 'cancelled') {
        setFilterStatus('active');
        // Le useEffect se chargera de recharger les données
      }
    } catch (err: any) {
      toast.error(err.message || t('goals:reactivateError', { defaultValue: 'Erreur lors de la réactivation' }), {
        duration: 4000,
      });
    }
  };

  const handleDeleteClick = (goal: TradingGoal) => {
    setGoalToDelete(goal);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!goalToDelete) return;
    
    setIsDeleting(true);
    try {
      await goalsService.delete(goalToDelete.id);
      toast.success(t('goals:deleteSuccess', { defaultValue: 'Objectif supprimé avec succès' }));
      setDeleteModalOpen(false);
      setGoalToDelete(null);
      loadGoals();
    } catch (err: any) {
      toast.error(err.message || t('goals:deleteError', { defaultValue: 'Erreur lors de la suppression' }));
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Utiliser les statistiques pour les compteurs si disponibles, sinon calculer depuis la liste
  const activeGoals = useMemo(() => goals.filter(g => g.status === 'active'), [goals]);
  const achievedGoals = useMemo(() => goals.filter(g => g.status === 'achieved'), [goals]);
  const failedGoals = useMemo(() => goals.filter(g => g.status === 'failed'), [goals]);
  const cancelledGoals = useMemo(() => goals.filter(g => g.status === 'cancelled'), [goals]);
  
  // Compteurs pour les boutons de filtre (utiliser les statistiques si disponibles)
  const activeCount = statistics?.active_goals ?? activeGoals.length;
  const achievedCount = statistics?.achieved_goals ?? achievedGoals.length;
  const failedCount = statistics?.failed_goals ?? failedGoals.length;
  const cancelledCount = statistics?.cancelled_goals ?? cancelledGoals.length;
  const totalCount = statistics?.total_goals ?? goals.length; // Utiliser les statistiques pour le total
  
  
  return (
    <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8 bg-gray-50 dark:bg-gray-900">
      {/* Filtres avec boutons */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="flex flex-wrap gap-2 flex-1 min-w-0">
              <button
                onClick={() => setFilterStatus('all')}
                className={`flex-1 min-w-[calc(50%-0.25rem)] sm:min-w-0 px-2 sm:px-3 md:px-4 py-2 text-xs sm:text-sm md:text-base rounded-lg font-medium transition-colors flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap ${
                  filterStatus === 'all'
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {t('goals:allStatuses')}
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  filterStatus === 'all'
                    ? 'bg-gray-500 text-white'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                }`}>
                  {totalCount}
                </span>
              </button>
              <button
                onClick={() => setFilterStatus('active')}
                className={`flex-1 min-w-[calc(50%-0.25rem)] sm:min-w-0 px-2 sm:px-3 md:px-4 py-2 text-xs sm:text-sm md:text-base rounded-lg font-medium transition-colors flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap ${
                  filterStatus === 'active'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {t('goals:status.active')}
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  filterStatus === 'active'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                }`}>
                  {activeCount}
                </span>
              </button>
              <button
                onClick={() => setFilterStatus('achieved')}
                className={`flex-1 min-w-[calc(50%-0.25rem)] sm:min-w-0 px-2 sm:px-3 md:px-4 py-2 text-xs sm:text-sm md:text-base rounded-lg font-medium transition-colors flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap ${
                  filterStatus === 'achieved'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {t('goals:status.achieved')}
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  filterStatus === 'achieved'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                }`}>
                  {achievedCount}
                </span>
              </button>
              <button
                onClick={() => setFilterStatus('failed')}
                className={`flex-1 min-w-[calc(50%-0.25rem)] sm:min-w-0 px-2 sm:px-3 md:px-4 py-2 text-xs sm:text-sm md:text-base rounded-lg font-medium transition-colors flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap ${
                  filterStatus === 'failed'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {t('goals:status.failed')}
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  filterStatus === 'failed'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                }`}>
                  {failedCount}
                </span>
              </button>
              <button
                onClick={() => setFilterStatus('cancelled')}
                className={`flex-1 min-w-[calc(50%-0.25rem)] sm:min-w-0 px-2 sm:px-3 md:px-4 py-2 text-xs sm:text-sm md:text-base rounded-lg font-medium transition-colors flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap ${
                  filterStatus === 'cancelled'
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {t('goals:status.cancelled')}
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  filterStatus === 'cancelled'
                    ? 'bg-gray-500 text-white'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                }`}>
                  {cancelledCount}
                </span>
              </button>
            </div>
            <button
              onClick={handleCreateGoal}
              className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-blue-600 dark:bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors whitespace-nowrap w-full sm:w-auto flex items-center justify-center gap-1 sm:gap-2"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('goals:createGoal')}
            </button>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm sm:text-base text-red-800 dark:text-red-300 break-words">{error}</p>
        </div>
      )}
      
      {loading ? (
        <div className="flex items-center justify-center py-8 sm:py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-blue-600 dark:border-blue-500 mx-auto mb-3 sm:mb-4"></div>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">{t('goals:loading')}</p>
          </div>
        </div>
      ) : goals.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 sm:p-12 text-center">
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-3 sm:mb-4">{t('goals:noGoals')}</p>
          <button
            onClick={handleCreateGoal}
            className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('goals:createFirstGoal')}
          </button>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* Objectifs actifs */}
          {activeGoals.length > 0 && (filterStatus === 'all' || filterStatus === 'active') && (
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">
                {t('goals:activeGoals')} ({activeGoals.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {activeGoals.map(goal => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    currencySymbol={getCurrencySymbol(goal)}
                    onClick={() => handleGoalClick(goal)}
                    onCancel={handleCancelGoal}
                    onDelete={handleDeleteClick}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Objectifs atteints */}
          {achievedGoals.length > 0 && (filterStatus === 'all' || filterStatus === 'achieved') && (
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">
                {t('goals:achievedGoals')} ({achievedGoals.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {achievedGoals.map(goal => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    currencySymbol={getCurrencySymbol(goal)}
                    onClick={() => handleGoalClick(goal)}
                    onDelete={handleDeleteClick}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Objectifs échoués */}
          {failedGoals.length > 0 && (filterStatus === 'all' || filterStatus === 'failed') && (
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">
                {t('goals:failedGoals')} ({failedGoals.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {failedGoals.map(goal => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    currencySymbol={getCurrencySymbol(goal)}
                    onClick={() => handleGoalClick(goal)}
                    onDelete={handleDeleteClick}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Objectifs annulés */}
          {cancelledGoals.length > 0 && (filterStatus === 'all' || filterStatus === 'cancelled') && (
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">
                {t('goals:cancelledGoals', { defaultValue: 'Objectifs annulés' })} ({cancelledGoals.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {cancelledGoals.map(goal => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    currencySymbol={getCurrencySymbol(goal)}
                    onClick={() => handleGoalClick(goal)}
                    onReactivate={handleReactivateGoal}
                    onDelete={handleDeleteClick}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      <FloatingActionButton onClick={handleCreateGoal} title={t('goals:createGoal')} />
      
      <GoalModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSave={handleGoalSaved}
        goal={selectedGoal}
        tradingAccounts={accounts}
      />

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setGoalToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title={t('goals:deleteConfirmTitle', { defaultValue: 'Supprimer l\'objectif' })}
        message={t('goals:deleteConfirmMessage', { defaultValue: 'Êtes-vous sûr de vouloir supprimer cet objectif ? Cette action est irréversible.' })}
        isLoading={isDeleting}
        confirmButtonText={t('goals:delete', { defaultValue: 'Supprimer' })}
      />
    </div>
  );
};

export default GoalsPage;

