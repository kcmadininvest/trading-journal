import { useMemo, useState, useEffect, useCallback } from 'react';
import { TradeListItem } from '../services/trades';
import { TradingAccount } from '../services/tradingAccounts';
import {
  accountTransactionsService,
  AccountBalance as AccountBalanceData,
  TopStepConsistencyData,
} from '../services/accountTransactions';
import type { PnlDisplayMode } from '../utils/pnlDisplay';
import { toIsoCalendarDateInTimezone } from '../utils/dateFormat';
import { getTradeDisplayPnlValue } from '../utils/pnlDisplay';

function groupTradesPnlByDay(
  trades: TradeListItem[],
  pnlDisplay: PnlDisplayMode,
  timezone: string,
): Record<string, number> {
  const dailyData: Record<string, number> = {};
  for (const trade of trades) {
    const v = getTradeDisplayPnlValue(trade, pnlDisplay);
    if (v == null) {
      continue;
    }
    const date = trade.entered_at
      ? toIsoCalendarDateInTimezone(trade.entered_at, timezone)
      : trade.trade_day;
    if (!date) {
      continue;
    }
    dailyData[date] = (dailyData[date] || 0) + v;
  }
  return dailyData;
}

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
  /** Plus haut solde atteint (historique, dépôts/retraits inclus) */
  peak: number;
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
  activeDays?: number;
  accountCreatedAt?: string;
  bestAndWorstDays: {
    bestDay: BestWorstDay | null;
    worstDay: BestWorstDay | null;
  };
  consistencyTarget: ConsistencyTarget | null;
}

export interface UseAccountIndicatorsResult extends AccountIndicators {
  balanceLoading: boolean;
  balanceError: string | null;
  peakLoading: boolean;
}

interface UseAccountIndicatorsParams {
  selectedAccount: TradingAccount | null;
  filteredTrades: TradeListItem[];
  filteredBalanceData?: DailyBalanceData[];
  analyticsData?: {
    daily_stats?: {
      best_day?: string | null;
      best_day_pnl?: number;
      worst_day?: string | null;
      worst_day_pnl?: number;
    };
  } | null;
  activeDays?: number;
  pnlDisplay?: PnlDisplayMode;
  timezone?: string;
}

function parsePeakFromApi(
  balance: AccountBalanceData,
  mode: PnlDisplayMode,
  current: number,
  initial: number,
): number | null {
  const rawPeak = mode === 'gross' ? balance.peak_balance_gross : balance.peak_balance;
  if (rawPeak !== undefined && rawPeak !== '') {
    const parsed = parseFloat(rawPeak);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function buildAccountBalanceFromApi(
  balance: AccountBalanceData,
  pnlDisplay: PnlDisplayMode,
  fallbackInitial: number,
  fallbackPeak: number,
): AccountBalance {
  const initial = Number.isFinite(parseFloat(balance.initial_capital))
    ? parseFloat(balance.initial_capital)
    : fallbackInitial;
  const currentNet = parseFloat(balance.current_balance);
  if (pnlDisplay === 'net') {
    const peak =
      parsePeakFromApi(balance, 'net', currentNet, initial) ?? fallbackPeak;
    return { initial, current: currentNet, peak };
  }
  const rawGross = balance.current_balance_gross;
  const currentGross =
    rawGross !== undefined && rawGross !== '' && Number.isFinite(parseFloat(rawGross))
      ? parseFloat(rawGross)
      : currentNet;
  const peak =
    parsePeakFromApi(balance, 'gross', currentGross, initial) ?? fallbackPeak;
  return { initial, current: currentGross, peak };
}

function mergePeakIntoBalance(
  balance: AccountBalanceData,
  peakNet: string,
  peakGross: string | undefined,
): AccountBalanceData {
  return {
    ...balance,
    peak_balance: peakNet,
    peak_balance_gross: peakGross ?? peakNet,
  };
}

export function useAccountIndicators({
  selectedAccount,
  filteredTrades,
  filteredBalanceData,
  analyticsData,
  activeDays,
  pnlDisplay = 'net',
  timezone = 'Europe/Paris',
}: UseAccountIndicatorsParams): UseAccountIndicatorsResult {
  const [balanceWithTransactions, setBalanceWithTransactions] = useState<AccountBalanceData | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [peakLoading, setPeakLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [topstepConsistency, setTopstepConsistency] = useState<TopStepConsistencyData | null>(null);

  const loadBalance = useCallback(async () => {
    if (!selectedAccount) {
      setBalanceWithTransactions(null);
      setTopstepConsistency(null);
      setBalanceLoading(false);
      setPeakLoading(false);
      setBalanceError(null);
      return;
    }

    setBalanceLoading(true);
    setPeakLoading(true);
    setBalanceError(null);
    setTopstepConsistency(null);

    const accountId = selectedAccount.id;
    const isTopstep = selectedAccount.account_type === 'topstep';

    try {
      const fastBalance = await accountTransactionsService.getBalance(accountId, {
        include_peak: false,
      });
      setBalanceWithTransactions(fastBalance);
      setBalanceLoading(false);

      const peakPromise = accountTransactionsService.getBalancePeak(accountId);
      const consistencyPromise = isTopstep
        ? accountTransactionsService.getBalanceConsistency(accountId)
        : Promise.resolve({ consistency: null });

      const [peakData, consistencyResponse] = await Promise.all([
        peakPromise,
        consistencyPromise,
      ]);

      setBalanceWithTransactions((prev) =>
        prev
          ? mergePeakIntoBalance(prev, peakData.peak_balance, peakData.peak_balance_gross)
          : mergePeakIntoBalance(fastBalance, peakData.peak_balance, peakData.peak_balance_gross),
      );
      setTopstepConsistency(consistencyResponse.consistency);
    } catch (error) {
      console.error('Erreur lors du chargement du solde avec transactions:', error);
      setBalanceWithTransactions(null);
      setTopstepConsistency(null);
      setBalanceError(
        error instanceof Error ? error.message : 'Erreur lors du chargement du solde',
      );
    } finally {
      setBalanceLoading(false);
      setPeakLoading(false);
    }
  }, [selectedAccount]);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  useEffect(() => {
    const handleTransactionUpdate = () => {
      loadBalance();
    };

    window.addEventListener('account-transaction:updated', handleTransactionUpdate);

    return () => {
      window.removeEventListener('account-transaction:updated', handleTransactionUpdate);
    };
  }, [loadBalance]);

  const accountBalance = useMemo(() => {
    if (!selectedAccount) {
      return { initial: 0, current: 0, peak: 0 };
    }

    const fallbackInitial = selectedAccount.initial_capital
      ? parseFloat(String(selectedAccount.initial_capital))
      : 0;

    if (balanceWithTransactions) {
      const hasPeakData =
        balanceWithTransactions.peak_balance !== undefined ||
        balanceWithTransactions.peak_balance_gross !== undefined;
      const interim = buildAccountBalanceFromApi(
        balanceWithTransactions,
        pnlDisplay,
        fallbackInitial,
        Math.max(
          parseFloat(balanceWithTransactions.current_balance) || fallbackInitial,
          fallbackInitial,
        ),
      );
      if (hasPeakData) {
        return interim;
      }
      return {
        ...interim,
        peak: interim.current >= interim.initial ? interim.current : interim.initial,
      };
    }

    return {
      initial: fallbackInitial,
      current: fallbackInitial,
      peak: fallbackInitial,
    };
  }, [selectedAccount, balanceWithTransactions, pnlDisplay]);

  const bestAndWorstDays = useMemo(() => {
    if (filteredBalanceData && filteredBalanceData.length > 0) {
      const bestDay = filteredBalanceData.reduce(
        (max, day) => (day.pnl > max.pnl ? day : max),
        filteredBalanceData[0],
      );

      const worstDay = filteredBalanceData.reduce(
        (min, day) => (day.pnl < min.pnl ? day : min),
        filteredBalanceData[0],
      );

      return {
        bestDay: bestDay.pnl > 0 ? { date: bestDay.date, pnl: bestDay.pnl } : null,
        worstDay: worstDay.pnl < 0 ? { date: worstDay.date, pnl: worstDay.pnl } : null,
      };
    }

    if (analyticsData?.daily_stats) {
      const { best_day, best_day_pnl, worst_day, worst_day_pnl } = analyticsData.daily_stats;
      return {
        bestDay:
          best_day && best_day_pnl !== undefined && best_day_pnl > 0
            ? { date: best_day, pnl: best_day_pnl }
            : null,
        worstDay:
          worst_day && worst_day_pnl !== undefined && worst_day_pnl < 0
            ? { date: worst_day, pnl: worst_day_pnl }
            : null,
      };
    }

    if (filteredTrades.length === 0) {
      return { bestDay: null, worstDay: null };
    }

    const dailyData = groupTradesPnlByDay(filteredTrades, pnlDisplay, timezone);
    const dailyEntries = Object.entries(dailyData).map(([date, pnl]) => ({ date, pnl }));

    if (dailyEntries.length === 0) {
      return { bestDay: null, worstDay: null };
    }

    const bestDay = dailyEntries.reduce(
      (max, day) => (day.pnl > max.pnl ? day : max),
      dailyEntries[0],
    );

    const worstDay = dailyEntries.reduce(
      (min, day) => (day.pnl < min.pnl ? day : min),
      dailyEntries[0],
    );

    return {
      bestDay: bestDay.pnl > 0 ? { date: bestDay.date, pnl: bestDay.pnl } : null,
      worstDay: worstDay.pnl < 0 ? { date: worstDay.date, pnl: worstDay.pnl } : null,
    };
  }, [filteredBalanceData, analyticsData, filteredTrades, pnlDisplay, timezone]);

  const consistencyTarget = useMemo(() => {
    if (!selectedAccount || selectedAccount.account_type !== 'topstep' || !topstepConsistency) {
      return null;
    }

    const overallProfit = accountBalance.current - accountBalance.initial;
    if (overallProfit <= 0) {
      return null;
    }

    const rawBestPnl =
      pnlDisplay === 'gross'
        ? topstepConsistency.best_day_pnl_gross ?? topstepConsistency.best_day_pnl_net
        : topstepConsistency.best_day_pnl_net;
    const bestDayProfit = parseFloat(rawBestPnl);
    if (!Number.isFinite(bestDayProfit) || bestDayProfit <= 0) {
      return null;
    }

    const bestDayPercentage = (bestDayProfit / overallProfit) * 100;
    const isCompliant = bestDayPercentage < 50;
    const targetPercentage = 50;
    const requiredTotalProfit = bestDayProfit / 0.5;
    const additionalProfitNeeded = requiredTotalProfit - overallProfit;

    return {
      bestDayProfit,
      bestDayDate: topstepConsistency.best_day,
      overallProfit,
      bestDayPercentage,
      isCompliant,
      targetPercentage,
      requiredTotalProfit,
      additionalProfitNeeded: additionalProfitNeeded > 0 ? additionalProfitNeeded : 0,
    };
  }, [selectedAccount, accountBalance, topstepConsistency, pnlDisplay]);

  const totalTrades = filteredTrades.length;

  return {
    accountBalance,
    totalTrades,
    activeDays,
    accountCreatedAt: selectedAccount?.created_at ?? undefined,
    bestAndWorstDays,
    consistencyTarget,
    balanceLoading,
    balanceError,
    peakLoading,
  };
}
