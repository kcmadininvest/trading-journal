import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast/headless';
import { goalsService, TradingGoal, GoalsFilters, GoalStatistics } from '../services/goals';
import { tradingAccountsService, TradingAccount } from '../services/tradingAccounts';
import { currenciesService, Currency } from '../services/currencies';
import { GoalCardEnhanced } from '../components/goals/GoalCardEnhanced';
import { GoalWizard } from '../components/goals/GoalWizard';
import { GoalFilters } from '../components/goals/GoalFilters';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonGrid } from '../components/ui/SkeletonLoader';
import DeleteConfirmModal from '../components/ui/DeleteConfirmModal';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useTradingAccount } from '../contexts/TradingAccountContext';
import { useAccountNumberVisibility } from '../hooks/useAccountNumberVisibility';
import { PageShell } from '../components/layout';

const GoalsPage: React.FC = () => {
  const { t } = useI18nTranslation();
  const { selectedAccountId, setSelectedAccountId, loading: accountLoading } = useTradingAccount();
  const hideAccountNumber = useAccountNumberVisibility();

  const [goals, setGoals] = useState<TradingGoal[]>([]);
  const [loading, setLoading] = useState(true); // Initialiser à true pour éviter le saut initial
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<TradingAccount[] | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [filters, setFilters] = useState<GoalsFilters>({ status: 'active' });
  const handleTradingAccountChange = React.useCallback((accountId: number | null) => {
    setSelectedAccountId(accountId);
    setFilters((prev) => ({
      ...prev,
      trading_account: accountId ?? undefined,
    }));
  }, [setSelectedAccountId]);

  // Alignement Trades / Dashboard : filtres API alignés sur le compte du contexte
  useEffect(() => {
    setFilters((prev) => {
      const next = selectedAccountId ?? undefined;
      if (prev.trading_account === next) return prev;
      return { ...prev, trading_account: next };
    });
  }, [selectedAccountId]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<TradingGoal | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<TradingGoal | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statistics, setStatistics] = useState<GoalStatistics | null>(null);
  const previousGoalsStatusRef = React.useRef<Map<number, string>>(new Map());
  const notifiedGoalsRef = React.useRef<Set<number>>(new Set());
  const hasLoadedRef = React.useRef(false);
  const lastFiltersKeyRef = React.useRef<string>('');
  
  const loadGoals = React.useCallback(async (showLoading = true, filtersToUse?: GoalsFilters) => {
    const currentFilters = filtersToUse || filters;
    if (showLoading) {
      setLoading(true);
      setError(null);
    }
    try {
      // Charger les goals et les statistiques en parallèle lors du chargement initial
      const statsParams =
        currentFilters.trading_account != null
          ? { trading_account: currentFilters.trading_account }
          : undefined;
      const [data, stats] = await Promise.all([
        goalsService.list(currentFilters),
        goalsService.getStatistics(statsParams).catch(() => null),
      ]);

      if (stats) {
        setStatistics((prevStats) => {
          if (!prevStats) return stats;
          if (
            prevStats.total_goals !== stats.total_goals ||
            prevStats.active_goals !== stats.active_goals ||
            prevStats.achieved_goals !== stats.achieved_goals ||
            prevStats.failed_goals !== stats.failed_goals ||
            prevStats.cancelled_goals !== stats.cancelled_goals
          ) {
            return stats;
          }
          return prevStats;
        });
      }
      
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
  }, [filters, t]);
  
  useEffect(() => {
    if (accountLoading) return;

    const expectedAccount = selectedAccountId ?? undefined;
    if (filters.trading_account !== expectedAccount) {
      return;
    }

    const filtersKey = JSON.stringify(filters);

    const runLoad = () => {
      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        lastFiltersKeyRef.current = filtersKey;
        loadGoals(true, filters);
      } else if (filtersKey !== lastFiltersKeyRef.current) {
        lastFiltersKeyRef.current = filtersKey;
        loadGoals(true, filters);
      }
    };

    if (!hasLoadedRef.current) {
      runLoad();
      return;
    }

    const timeoutId = window.setTimeout(runLoad, 200);
    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, accountLoading, selectedAccountId]);

  // Polling périodique pour détecter les changements de statut (toutes les 30 secondes)
  // Utiliser showLoading=false pour éviter le clignotement visuel
  useEffect(() => {
    if (isModalOpen) return; // Ne pas poller si la modale est ouverte
    
    const interval = setInterval(() => {
      loadGoals(false); // Ne pas afficher le loader lors du polling
    }, 30000); // 30 secondes

    return () => clearInterval(interval);
  }, [loadGoals, isModalOpen]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [accData, currData] = await Promise.all([
          tradingAccountsService.list(),
          currenciesService.list(),
        ]);
        if (!cancelled) {
          setAccounts(accData);
          setCurrencies(currData);
        }
      } catch {
        if (!cancelled) {
          setAccounts([]);
          setCurrencies([]);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);
  
  const getCurrencySymbol = (goal: TradingGoal): string => {
    const accountsList = accounts ?? [];
    if (!goal.trading_account) {
      // Si pas de compte spécifique, utiliser le compte sélectionné ou USD par défaut
      if (selectedAccountId) {
        const account = accountsList.find(a => a.id === selectedAccountId);
        if (account) {
          const currency = currencies.find(c => c.code === account.currency);
          return currency?.symbol || '';
        }
      }
      return '';
    }
    
    const account = accountsList.find(a => a.id === goal.trading_account);
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
    loadGoals(false);
  };

  const handleCancelGoal = async (goal: TradingGoal) => {
    try {
      const updatedGoal = await goalsService.update(goal.id, { status: 'cancelled' });
      
      toast.success(t('goals:cancelSuccess', { defaultValue: 'Objectif annulé avec succès' }), {
        duration: 3000,
      });
      
      // Recharger les statistiques pour mettre à jour les compteurs
      try {
        const statsParams =
          filters.trading_account != null ? { trading_account: filters.trading_account } : undefined;
        const stats = await goalsService.getStatistics(statsParams);
        setStatistics(stats);
      } catch {
        // Ignorer les erreurs de statistiques
      }

      // Mettre à jour directement l'objectif dans la liste locale
      setGoals(prevGoals => 
        prevGoals.map(g => g.id === goal.id ? { ...g, ...updatedGoal, status: 'cancelled' as const } : g)
      );
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
        const statsParams =
          filters.trading_account != null ? { trading_account: filters.trading_account } : undefined;
        const stats = await goalsService.getStatistics(statsParams);
        setStatistics(stats);
      } catch {
        // Ignorer les erreurs de statistiques
      }

      // Mettre à jour directement l'objectif dans la liste locale
      setGoals(prevGoals => 
        prevGoals.map(g => g.id === goal.id ? { ...g, ...updatedGoal, status: 'active' as const } : g)
      );
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
      loadGoals(false);
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
  
  // Compteurs pour les filtres
  const goalCounts = useMemo(
    () => ({
      active: statistics?.active_goals ?? activeGoals.length,
      achieved: statistics?.achieved_goals ?? achievedGoals.length,
      failed: statistics?.failed_goals ?? failedGoals.length,
      cancelled: statistics?.cancelled_goals ?? cancelledGoals.length,
    }),
    [statistics, activeGoals, achievedGoals, failedGoals, cancelledGoals]
  );

  // Filtrer les objectifs selon les filtres actifs
  const filteredGoals = useMemo(() => {
    let filtered = goals;

    // Le filtrage par statut est déjà fait par l'API, mais on peut ajouter d'autres filtres côté client si nécessaire
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(goal => {
        const goalTypeLabel = t(`goals:goalTypes.${goal.goal_type}`, { defaultValue: goal.goal_type });
        const notes = goal.notes?.toLowerCase() || '';
        return goalTypeLabel.toLowerCase().includes(searchLower) || notes.includes(searchLower);
      });
    }

    return filtered;
  }, [goals, filters, t]);

  return (
    <PageShell>
      {/* Filtres avancés */}
      <GoalFilters
        filters={filters}
        onFiltersChange={setFilters}
        goalCounts={goalCounts}
        onCreateClick={handleCreateGoal}
        hideAccountNumber={hideAccountNumber}
        tradingAccounts={accounts}
        selectedAccountId={selectedAccountId}
        onTradingAccountChange={handleTradingAccountChange}
        accountLoading={accountLoading}
      />

      {error && (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm sm:text-base text-red-800 dark:text-red-300 break-words">{error}</p>
        </div>
      )}
      
      {loading ? (
        <SkeletonGrid count={6} columns={3} />
      ) : filteredGoals.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <EmptyState
            icon={
              <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            title={t('goals:noGoals', { defaultValue: 'Aucun objectif' })}
            description={t('goals:noGoalsDescription', { defaultValue: 'Commencez par créer votre premier objectif de trading.' })}
            action={
              <button
                onClick={handleCreateGoal}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t('goals:createFirstGoal', { defaultValue: 'Créer mon premier objectif' })}
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGoals.map(goal => (
            <GoalCardEnhanced
              key={goal.id}
              goal={goal}
              currencySymbol={getCurrencySymbol(goal)}
              onClick={() => handleGoalClick(goal)}
              onCancel={handleCancelGoal}
              onReactivate={handleReactivateGoal}
              onDelete={handleDeleteClick}
            />
          ))}
        </div>
      )}
      
      <GoalWizard
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSave={handleGoalSaved}
        goal={selectedGoal}
        tradingAccounts={accounts ?? []}
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
    </PageShell>
  );
};

export default GoalsPage;

