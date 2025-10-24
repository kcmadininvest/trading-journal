import { useState, useEffect, useCallback } from 'react';
import { TradingAccount } from '../types';
import { tradesService } from '../services/trades';

interface StrategyData {
  [date: string]: any;
}

interface CalendarData {
  daily_data: Array<{ date: string; pnl: number; trade_count: number }>;
  weekly_data: Array<{ week: number; pnl: number; trade_count: number }>;
  monthly_total: number;
  year: number;
  month: number;
}

export const useStrategyData = (selectedAccount: TradingAccount | null, currentDate: Date) => {
  const [strategyData, setStrategyData] = useState<StrategyData>({});
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [globalStrategyData, setGlobalStrategyData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStrategyData = useCallback(async (year: number, month: number, accountId?: number) => {
    try {
      const data = await tradesService.getTradeStrategiesByDate(
        `${year}-${month.toString().padStart(2, '0')}-01`,
        accountId
      );
      
      const strategyMap: StrategyData = {};
      data.forEach((strategy: any) => {
        const date = strategy.trade.entered_at.split('T')[0];
        if (!strategyMap[date]) {
          strategyMap[date] = [];
        }
        strategyMap[date].push(strategy);
      });
      
      setStrategyData(strategyMap);
    } catch (error) {
      console.error('Erreur lors du chargement des données de stratégie:', error);
      setStrategyData({});
    }
  }, []);

  const fetchCalendarData = useCallback(async (year: number, month: number, accountId?: number) => {
    try {
      const data = await tradesService.getCalendarData(year, month, accountId);
      setCalendarData(data);
    } catch (error) {
      console.error('Erreur lors du chargement des données du calendrier:', error);
      setCalendarData(null);
    }
  }, []);

  const fetchGlobalStrategyData = useCallback(async (accountId?: number) => {
    try {
      const data = await tradesService.getAnalyticsData(accountId);
      setGlobalStrategyData(data);
    } catch (error) {
      console.error('Erreur lors du chargement des données globales:', error);
      setGlobalStrategyData(null);
    }
  }, []);

  const loadAllData = useCallback(async () => {
    if (!selectedAccount) return;
    
    setLoading(true);
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const accountId = selectedAccount.id;

    try {
      await Promise.all([
        fetchStrategyData(year, month, accountId),
        fetchCalendarData(year, month, accountId),
        fetchGlobalStrategyData(accountId)
      ]);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedAccount, currentDate, fetchStrategyData, fetchCalendarData, fetchGlobalStrategyData]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  return {
    strategyData,
    calendarData,
    globalStrategyData,
    loading,
    refetchData: loadAllData
  };
};
