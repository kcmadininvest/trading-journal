import { useContext } from 'react';
import { TradingAccountContext } from './tradingAccountContext';

export const useTradingAccount = () => {
  const context = useContext(TradingAccountContext);
  if (!context) {
    throw new Error('useTradingAccount must be used within TradingAccountProvider');
  }
  return context;
};
