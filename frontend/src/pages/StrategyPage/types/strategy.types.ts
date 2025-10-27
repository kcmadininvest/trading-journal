import { TradingAccount } from '../../../types';
import { TopStepTrade } from '../../../services/trades';

// Types de base pour les données de stratégie
export interface DailyData {
  date: string;
  pnl: number;
  trade_count: number;
}

export interface WeeklyData {
  week: number;
  pnl: number;
  trade_count: number;
}

export interface CalendarData {
  daily_data: DailyData[];
  weekly_data: WeeklyData[];
  monthly_total: number;
  year: number;
  month: number;
}

// Types pour les données de stratégie
export interface StrategyDayData {
  total: number;
  respected: number;
  notRespected: number;
  percentage: number;
  respectedTrades: StrategyTradeData[];
  notRespectedTrades: StrategyTradeData[];
}

export interface StrategyTradeData {
  pnl: number;
  tp1_reached: boolean;
  tp2_plus_reached: boolean;
  dominant_emotions: string[];
}

export type StrategyDataMap = { [date: string]: StrategyDayData };

export interface GlobalStrategyData {
  total: number;
  respected: number;
  notRespected: number;
  percentage: number;
}

// Types pour l'état de la page Strategy
export type StrategyTab = 'calendar' | 'global';

export interface StrategyLoadingState {
  calendar: boolean;
  strategy: boolean;
  global: boolean;
}

export interface StrategyState {
  // Navigation
  activeTab: StrategyTab;
  currentDate: Date;
  currentYear: number;
  
  // Données
  calendarData: CalendarData | null;
  strategyData: StrategyDataMap;
  globalStrategyData: GlobalStrategyData;
  
  // UI
  selectedDate: Date | null;
  showTradesModal: boolean;
  dayTrades: TopStepTrade[];
  
  // Chargement
  loading: StrategyLoadingState;
  
  // Compte sélectionné
  selectedAccount: TradingAccount | null;
}

// Types pour les actions
export interface StrategyActions {
  setActiveTab: (tab: StrategyTab) => void;
  setCurrentDate: (date: Date) => void;
  setCurrentYear: (year: number) => void;
  setSelectedDate: (date: Date | null) => void;
  setShowTradesModal: (show: boolean) => void;
  setDayTrades: (trades: TopStepTrade[]) => void;
  setSelectedAccount: (account: TradingAccount | null) => void;
  navigateMonth: (direction: 'prev' | 'next') => void;
  navigateYear: (direction: 'prev' | 'next') => void;
  goToToday: () => void;
  goToCurrentYear: () => void;
  handleDayClick: (dayInfo: any) => Promise<void>;
  handleSaveTradeStrategies: (strategies: any[]) => Promise<void>;
  handleDeleteTrade: (tradeId: number) => Promise<void>;
}

// Types pour les props des composants
export interface StrategyHeaderProps {
  selectedAccount: TradingAccount | null;
  onAccountChange: (account: TradingAccount | null) => void;
  globalStrategyData: GlobalStrategyData;
  isGlobalStrategyDataLoading: boolean;
}

export interface StrategyTabsProps {
  activeTab: StrategyTab;
  onTabChange: (tab: StrategyTab) => void;
}

export interface CalendarViewProps {
  currentDate: Date;
  calendarData: CalendarData | null;
  strategyData: StrategyDataMap;
  loading: StrategyLoadingState;
  selectedAccount: TradingAccount | null;
  onNavigateMonth: (direction: 'prev' | 'next') => void;
  onGoToToday: () => void;
  onDayClick: (dayInfo: any) => Promise<void>;
}

export interface GlobalViewProps {
  currentYear: number;
  selectedAccount: TradingAccount | null;
  loading: StrategyLoadingState;
  hasInitialDataLoaded: boolean;
  onNavigateYear: (direction: 'prev' | 'next') => void;
  onGoToCurrentYear: () => void;
  onMonthClick: (month: number, year: number) => void;
}

// Types pour les hooks
export interface UseStrategyDataReturn {
  strategyData: StrategyDataMap;
  globalStrategyData: GlobalStrategyData;
  loading: StrategyLoadingState;
  fetchStrategyData: (year: number, month: number, accountId?: number) => Promise<void>;
  fetchGlobalStrategyData: (accountId?: number) => Promise<void>;
  updateStrategyDataSilently: (year: number, month: number, accountId?: number) => Promise<void>;
}

export interface UseCalendarDataReturn {
  calendarData: CalendarData | null;
  loading: boolean;
  fetchCalendarData: (year: number, month: number, accountId?: number) => Promise<void>;
}

export interface UseStrategyNavigationReturn {
  activeTab: StrategyTab;
  currentDate: Date;
  currentYear: number;
  setActiveTab: (tab: StrategyTab) => void;
  setCurrentDate: (date: Date) => void;
  setCurrentYear: (year: number) => void;
  navigateMonth: (direction: 'prev' | 'next') => void;
  navigateYear: (direction: 'prev' | 'next') => void;
  goToToday: () => void;
  goToCurrentYear: () => void;
}
