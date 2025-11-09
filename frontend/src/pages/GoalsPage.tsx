import React, { useState, useEffect, useMemo } from 'react';
import { goalsService, TradingGoal, GoalsFilters } from '../services/goals';
import { tradingAccountsService, TradingAccount } from '../services/tradingAccounts';
import { currenciesService, Currency } from '../services/currencies';
import { GoalCard } from '../components/goals/GoalCard';
import { GoalModal } from '../components/goals/GoalModal';
import { FloatingActionButton } from '../components/ui/FloatingActionButton';
import { CustomSelect } from '../components/common/CustomSelect';
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
  const [filters, setFilters] = useState<GoalsFilters>({
    status: 'active',
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<TradingGoal | null>(null);
  
  const loadGoals = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await goalsService.list(filters);
      // S'assurer que data est toujours un tableau
      setGoals(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || t('goals:errorLoading'));
      setGoals([]);
    } finally {
      setLoading(false);
    }
  }, [filters, t]);
  
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
  
  const activeGoals = useMemo(() => goals.filter(g => g.status === 'active'), [goals]);
  const achievedGoals = useMemo(() => goals.filter(g => g.status === 'achieved'), [goals]);
  const failedGoals = useMemo(() => goals.filter(g => g.status === 'failed'), [goals]);
  
  const statusOptions = useMemo(() => [
    { value: 'all', label: t('goals:allStatuses') },
    { value: 'active', label: t('goals:status.active') },
    { value: 'achieved', label: t('goals:status.achieved') },
    { value: 'failed', label: t('goals:status.failed') },
    { value: 'cancelled', label: t('goals:status.cancelled') },
  ], [t]);
  
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Filtres */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="w-full sm:w-auto min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('goals:filterByStatus')}
            </label>
            <CustomSelect
              value={filters.status || 'all'}
              onChange={(value) => setFilters({ ...filters, status: value === 'all' ? undefined : value as string })}
              options={statusOptions}
            />
          </div>
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
          {activeGoals.length > 0 && (
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
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Objectifs atteints */}
          {achievedGoals.length > 0 && filters.status !== 'active' && (
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
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Objectifs échoués */}
          {failedGoals.length > 0 && filters.status !== 'active' && (
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
    </div>
  );
};

export default GoalsPage;

