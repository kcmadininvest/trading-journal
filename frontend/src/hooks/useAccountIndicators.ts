import { useMemo, useState, useEffect, useCallback } from 'react';
import { TradeListItem } from '../services/trades';
import { TradingAccount } from '../services/tradingAccounts';
import { accountTransactionsService, AccountBalance as AccountBalanceData } from '../services/accountTransactions';

export interface DailyBalanceData {
  date: string;
  pnl: number;
  cumulative?: number;
}

export interface BestWorstDay {
  date: string;
  pnl: number;
}

export interface AccountBalance {
  initial: number;
  current: number;
}

export interface ConsistencyTarget {
  bestDayProfit: number;
  bestDayDate: string;
  overallProfit: number;
  bestDayPercentage: number;
  isCompliant: boolean;
  targetPercentage: number;
  requiredTotalProfit: number;
  additionalProfitNeeded: number;
}

export interface AccountIndicators {
  accountBalance: AccountBalance;
  totalTrades: number;
  bestAndWorstDays: {
    bestDay: BestWorstDay | null;
    worstDay: BestWorstDay | null;
  };
  consistencyTarget: ConsistencyTarget | null;
}

interface UseAccountIndicatorsParams {
  selectedAccount: TradingAccount | null;
  allTrades: TradeListItem[];
  filteredTrades: TradeListItem[];
  // Optionnel: données agrégées par jour (plus performant)
  filteredBalanceData?: DailyBalanceData[];
  // Optionnel: données analytics du backend (plus performant)
  analyticsData?: {
    daily_stats?: {
      best_day?: string | null;
      best_day_pnl?: number;
      worst_day?: string | null;
      worst_day_pnl?: number;
    };
  } | null;
}

/**
 * Hook personnalisé pour calculer les indicateurs de compte de manière cohérente
 * Utilise la source de données la plus performante disponible
 */
export function useAccountIndicators({
  selectedAccount,
  allTrades,
  filteredTrades,
  filteredBalanceData,
  analyticsData,
}: UseAccountIndicatorsParams): AccountIndicators {
  // État pour le solde avec transactions
  const [balanceWithTransactions, setBalanceWithTransactions] = useState<AccountBalanceData | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Fonction pour charger le solde
  const loadBalance = useCallback(async () => {
    if (!selectedAccount) {
      setBalanceWithTransactions(null);
      return;
    }

    setBalanceLoading(true);
    try {
      const balance = await accountTransactionsService.getBalance(selectedAccount.id);
      setBalanceWithTransactions(balance);
    } catch (error) {
      console.error('Erreur lors du chargement du solde avec transactions:', error);
      setBalanceWithTransactions(null);
    } finally {
      setBalanceLoading(false);
    }
  }, [selectedAccount?.id]);

  // Charger le solde avec transactions depuis l'API
  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  // Écouter les événements de mise à jour des transactions
  useEffect(() => {
    const handleTransactionUpdate = () => {
      loadBalance();
    };

    window.addEventListener('account-transaction:updated', handleTransactionUpdate);

    return () => {
      window.removeEventListener('account-transaction:updated', handleTransactionUpdate);
    };
  }, [loadBalance]);

  // Calculer le solde initial et actuel du compte
  const accountBalance = useMemo(() => {
    if (!selectedAccount) {
      return { initial: 0, current: 0 };
    }

    // Si on a le solde avec transactions depuis l'API, l'utiliser
    if (balanceWithTransactions) {
      return {
        initial: parseFloat(balanceWithTransactions.initial_capital),
        current: parseFloat(balanceWithTransactions.current_balance),
      };
    }

    // Fallback: calculer sans transactions (pour compatibilité)
    const initialCapital = selectedAccount.initial_capital 
      ? parseFloat(String(selectedAccount.initial_capital)) 
      : 0;

    // Calculer le PnL total de tous les trades du compte (pas seulement la période filtrée)
    const totalPnl = allTrades.reduce((sum, t) => sum + (t.net_pnl ? parseFloat(t.net_pnl) : 0), 0);

    const currentBalance = initialCapital + totalPnl;

    return {
      initial: initialCapital,
      current: currentBalance,
    };
  }, [selectedAccount, allTrades, balanceWithTransactions]);

  // Calculer le meilleur et le pire jour pour la période filtrée
  // Priorité: filteredBalanceData > analyticsData > calcul depuis filteredTrades
  const bestAndWorstDays = useMemo(() => {
    // Méthode 1: Utiliser filteredBalanceData si disponible (le plus performant)
    if (filteredBalanceData && filteredBalanceData.length > 0) {
      const bestDay = filteredBalanceData.reduce((max, day) => 
        day.pnl > max.pnl ? day : max, 
        filteredBalanceData[0]
      );
      
      const worstDay = filteredBalanceData.reduce((min, day) => 
        day.pnl < min.pnl ? day : min, 
        filteredBalanceData[0]
      );

      return {
        bestDay: bestDay.pnl > 0 ? { date: bestDay.date, pnl: bestDay.pnl } : null,
        worstDay: worstDay.pnl < 0 ? { date: worstDay.date, pnl: worstDay.pnl } : null,
      };
    }

    // Méthode 2: Utiliser analyticsData si disponible
    if (analyticsData?.daily_stats) {
      const { best_day, best_day_pnl, worst_day, worst_day_pnl } = analyticsData.daily_stats;
      return {
        bestDay: best_day && best_day_pnl !== undefined && best_day_pnl > 0
          ? { date: best_day, pnl: best_day_pnl }
          : null,
        worstDay: worst_day && worst_day_pnl !== undefined && worst_day_pnl < 0
          ? { date: worst_day, pnl: worst_day_pnl }
          : null,
      };
    }

    // Méthode 3: Calculer depuis filteredTrades (fallback)
    if (filteredTrades.length === 0) {
      return { bestDay: null, worstDay: null };
    }

    // Grouper les trades par date
    const dailyData: { [date: string]: number } = {};
    filteredTrades.forEach(trade => {
      if (trade.net_pnl && trade.trade_day) {
        const date = trade.trade_day;
        dailyData[date] = (dailyData[date] || 0) + parseFloat(trade.net_pnl);
      }
    });

    const dailyEntries = Object.entries(dailyData).map(([date, pnl]) => ({ date, pnl }));

    if (dailyEntries.length === 0) {
      return { bestDay: null, worstDay: null };
    }

    const bestDay = dailyEntries.reduce((max, day) => 
      day.pnl > max.pnl ? day : max, 
      dailyEntries[0]
    );
    
    const worstDay = dailyEntries.reduce((min, day) => 
      day.pnl < min.pnl ? day : min, 
      dailyEntries[0]
    );

    return {
      bestDay: bestDay.pnl > 0 ? { date: bestDay.date, pnl: bestDay.pnl } : null,
      worstDay: worstDay.pnl < 0 ? { date: worstDay.date, pnl: worstDay.pnl } : null,
    };
  }, [filteredBalanceData, analyticsData, filteredTrades]);

  // Calculer le Consistency Target pour les comptes TopStep
  // Utilise le meilleur jour de tous les temps (pas seulement la période filtrée)
  const consistencyTarget = useMemo(() => {
    if (!selectedAccount || selectedAccount.account_type !== 'topstep') {
      return null;
    }

    const overallProfit = accountBalance.current - accountBalance.initial;
    if (overallProfit <= 0) {
      return null;
    }

    // Calculer le meilleur jour de tous les temps à partir de tous les trades du compte
    if (allTrades.length === 0) {
      return null;
    }

    // Grouper les trades par date pour trouver le meilleur jour
    const dailyData: { [date: string]: number } = {};
    allTrades.forEach(trade => {
      if (trade.net_pnl && trade.trade_day) {
        const date = trade.trade_day;
        dailyData[date] = (dailyData[date] || 0) + parseFloat(trade.net_pnl);
      }
    });

    const dailyEntries = Object.entries(dailyData).map(([date, pnl]) => ({ date, pnl }));
    if (dailyEntries.length === 0) {
      return null;
    }

    const bestDay = dailyEntries.reduce((max, day) => 
      day.pnl > max.pnl ? day : max, 
      dailyEntries[0]
    );

    if (bestDay.pnl <= 0) {
      return null;
    }

    const bestDayProfit = bestDay.pnl;
    const bestDayPercentage = (bestDayProfit / overallProfit) * 100;
    const isCompliant = bestDayPercentage < 50;
    const targetPercentage = 50;

    // Calculer le profit total nécessaire si non conforme
    const requiredTotalProfit = bestDayProfit / 0.5;
    const additionalProfitNeeded = requiredTotalProfit - overallProfit;

    return {
      bestDayProfit,
      bestDayDate: bestDay.date,
      overallProfit,
      bestDayPercentage,
      isCompliant,
      targetPercentage,
      requiredTotalProfit,
      additionalProfitNeeded: additionalProfitNeeded > 0 ? additionalProfitNeeded : 0,
    };
  }, [selectedAccount, accountBalance, allTrades]);

  // Total trades pour la période filtrée
  const totalTrades = filteredTrades.length;

  return {
    accountBalance,
    totalTrades,
    bestAndWorstDays,
    consistencyTarget,
  };
}

