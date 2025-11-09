import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { goalsService, TradingGoal, GoalsFilters } from '../services/goals';
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
  
  const loadGoals = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: GoalsFilters = {};
      if (filterStatus !== 'all') {
        filters.status = filterStatus;
      }
      const data = await goalsService.list(filters);
      // S'assurer que data est toujours un tableau
      setGoals(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || t('goals:errorLoading'));
      setGoals([]);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, t]);
  
  useEffect(() => {
    loadGoals();
  }, [loadGoals]);
  
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
      console.log('Cancelling goal:', goal.id);
      const updatedGoal = await goalsService.update(goal.id, { status: 'cancelled' });
      console.log('Goal cancelled successfully:', updatedGoal);
      console.log('Updated goal status:', updatedGoal.status);
      
      toast.success(t('goals:cancelSuccess', { defaultValue: 'Objectif annulé avec succès' }), {
        duration: 3000,
      });
      
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
      console.error('Error cancelling goal:', err);
      toast.error(err.message || t('goals:cancelError', { defaultValue: 'Erreur lors de l\'annulation' }), {
        duration: 4000,
      });
    }
  };

  const handleReactivateGoal = async (goal: TradingGoal) => {
    try {
      console.log('Reactivating goal:', goal.id);
      const updatedGoal = await goalsService.update(goal.id, { status: 'active' });
      console.log('Goal reactivated successfully:', updatedGoal);
      console.log('Updated goal status:', updatedGoal.status);
      
      toast.success(t('goals:reactivateSuccess', { defaultValue: 'Objectif réactivé avec succès' }), {
        duration: 3000,
      });
      
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
      console.error('Error reactivating goal:', err);
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
  
  const activeGoals = useMemo(() => goals.filter(g => g.status === 'active'), [goals]);
  const achievedGoals = useMemo(() => goals.filter(g => g.status === 'achieved'), [goals]);
  const failedGoals = useMemo(() => goals.filter(g => g.status === 'failed'), [goals]);
  const cancelledGoals = useMemo(() => goals.filter(g => g.status === 'cancelled'), [goals]);
  
  
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Filtres avec boutons */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
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
                {goals.length}
              </span>
            </button>
            <button
              onClick={() => setFilterStatus('active')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
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
                {activeGoals.length}
              </span>
            </button>
            <button
              onClick={() => setFilterStatus('achieved')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
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
                {achievedGoals.length}
              </span>
            </button>
            <button
              onClick={() => setFilterStatus('failed')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
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
                {failedGoals.length}
              </span>
            </button>
            <button
              onClick={() => setFilterStatus('cancelled')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
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
                {cancelledGoals.length}
              </span>
            </button>
          </div>
          <button
            onClick={handleCreateGoal}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('goals:createGoal')}
          </button>
        </div>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}
      
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">{t('goals:loading')}</p>
          </div>
        </div>
      ) : goals.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">{t('goals:noGoals')}</p>
          <button
            onClick={handleCreateGoal}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('goals:createFirstGoal')}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Objectifs actifs */}
          {activeGoals.length > 0 && (filterStatus === 'all' || filterStatus === 'active') && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('goals:activeGoals')} ({activeGoals.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('goals:achievedGoals')} ({achievedGoals.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('goals:failedGoals')} ({failedGoals.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('goals:cancelledGoals', { defaultValue: 'Objectifs annulés' })} ({cancelledGoals.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

