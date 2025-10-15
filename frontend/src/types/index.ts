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


