// Types pour le journal de trading

export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

export interface Trade {
  id: number;
  user: number;
  symbol: string;
  trade_type: 'BUY' | 'SELL';
  entry_date: string;
  exit_date?: string;
  entry_price: number;
  exit_price?: number;
  quantity: number;
  stop_loss?: number;
  take_profit?: number;
  commission?: number;
  notes?: string;
  strategy?: string;
  profit_loss?: number;
  profit_loss_percentage?: number;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
}

// Types pour les comptes de trading
export interface TradingAccount {
  id: number;
  user: number;
  user_username: string;
  name: string;
  account_type: 'topstep' | 'ibkr' | 'ninjatrader' | 'tradovate' | 'other';
  broker_account_id?: string;
  currency: string;
  status: 'active' | 'inactive' | 'archived';
  broker_config: Record<string, any>;
  description?: string;
  is_default: boolean;
  trades_count: number;
  is_topstep: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TradingAccountCreate {
  name: string;
  account_type: 'topstep' | 'ibkr' | 'ninjatrader' | 'tradovate' | 'other';
  broker_account_id?: string;
  currency?: string;
  status?: 'active' | 'inactive' | 'archived';
  broker_config?: Record<string, any>;
  description?: string;
  is_default?: boolean;
}

export interface TradingAccountUpdate extends Partial<TradingAccountCreate> {}

// Types pour les trades avec compte de trading
export interface TopStepTrade {
  id: number;
  topstep_id: string;
  user: number;
  user_username: string;
  trading_account: number;
  trading_account_name: string;
  trading_account_type: string;
  contract_name: string;
  trade_type: 'Long' | 'Short';
  entered_at: string;
  exited_at?: string;
  entry_price: number;
  exit_price?: number;
  size: number;
  fees: number;
  commissions: number;
  pnl?: number;
  net_pnl?: number;
  pnl_percentage?: number;
  trade_day?: string;
  trade_duration?: string;
  duration_str?: string;
  notes?: string;
  strategy?: string;
  is_profitable?: boolean;
  formatted_entry_date?: string;
  formatted_exit_date?: string;
  imported_at: string;
  updated_at: string;
}


