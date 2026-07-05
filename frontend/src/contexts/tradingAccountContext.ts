import { createContext } from 'react';
import type { TradingAccount } from '../services/tradingAccounts';

export interface TradingAccountContextType {
  selectedAccountId: number | null;
  setSelectedAccountId: (accountId: number | null) => void;
  selectedAccount: TradingAccount | null;
  accounts: TradingAccount[];
  loading: boolean;
}

export const TradingAccountContext = createContext<TradingAccountContextType | null>(null);
