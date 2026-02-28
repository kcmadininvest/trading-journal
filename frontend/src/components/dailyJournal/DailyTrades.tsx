import React, { useEffect, useState } from 'react';
import { tradesService, TradeListItem } from '../../services/trades';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { formatCurrencyWithSign } from '../../utils/numberFormat';
import { usePreferences } from '../../hooks/usePreferences';

interface DailyTradesProps {
  date: string;
  tradingAccountId?: number;
  onAnalytics: (tradeId: number) => void;
}

export const DailyTrades: React.FC<DailyTradesProps> = ({
  date,
  tradingAccountId,
  onAnalytics,
}) => {
  const { t } = useI18nTranslation();
  const { preferences } = usePreferences();
  const [trades, setTrades] = useState<TradeListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadTrades = async () => {
      setIsLoading(true);
      try {
        const response = await tradesService.list({
          trading_account: tradingAccountId,
          start_date: date,
          end_date: date,
          page_size: 100,
        });
        setTrades(response.results);
      } catch (error) {
        console.error('Erreur lors du chargement des trades:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTrades();
  }, [date, tradingAccountId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
        {t('dailyJournal.noTrades', { defaultValue: 'Aucun trade pour cette journée' })}
      </div>
    );
  }

  const getPnlValue = (pnl: string | null) => parseFloat(pnl || '0');

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        {t('dailyJournal.tradesOfDay', { defaultValue: 'Trades du jour' })} ({trades.length})
      </h3>
      
      <div className="flex flex-wrap gap-2">
        {trades.map((trade, index) => {
          const pnl = getPnlValue(trade.net_pnl);
          const isWinning = pnl >= 0;
          
          return (
            <button
              key={trade.id}
              onClick={() => onAnalytics(trade.id)}
              className={`group relative inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all hover:scale-105 hover:shadow-md ${
                isWinning
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:border-green-400 dark:hover:border-green-600'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 hover:border-red-400 dark:hover:border-red-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  #{index + 1}
                </span>
                <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                  {trade.contract_name}
                </span>
                <span
                  className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                    trade.trade_type === 'Long'
                      ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                      : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                  }`}
                >
                  {trade.trade_type === 'Long' ? 'L' : 'S'}
                </span>
                <span
                  className={`text-sm font-bold ${
                    isWinning
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-red-700 dark:text-red-400'
                  }`}
                >
                  {formatCurrencyWithSign(trade.net_pnl, '', preferences.number_format, 2)}
                </span>
              </div>
              
              <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
};
