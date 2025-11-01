import React, { useEffect, useState, useCallback } from 'react';
import { tradesService, TradeListItem } from '../../services/trades';
import { usePreferences } from '../../hooks/usePreferences';
import { formatCurrencyWithSign, formatNumber } from '../../utils/numberFormat';
import { formatDateLong, formatTime } from '../../utils/dateFormat';
import { useTranslation as useI18nTranslation } from 'react-i18next';

interface DayTradesModalProps {
  open: boolean;
  date: string; // YYYY-MM-DD
  onClose: () => void;
  tradingAccount?: number;
  onStrategyClick?: (date: string) => void;
}

export const DayTradesModal: React.FC<DayTradesModalProps> = ({
  open,
  date,
  onClose,
  tradingAccount,
  onStrategyClick,
}) => {
  const { preferences } = usePreferences();
  const { t } = useI18nTranslation();
  const [trades, setTrades] = useState<TradeListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTrades = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await tradesService.list({
        trade_day: date,
        trading_account: tradingAccount ?? undefined,
        page_size: 100,
      });
      // Trier du plus ancien au plus récent (par entered_at)
      const sortedTrades = [...response.results].sort((a, b) => {
        const dateA = new Date(a.entered_at).getTime();
        const dateB = new Date(b.entered_at).getTime();
        return dateA - dateB;
      });
      setTrades(sortedTrades);
    } catch (e: any) {
      setError(e?.message || t('trades:dayTradesModal.errorLoading'));
    } finally {
      setIsLoading(false);
    }
  }, [date, tradingAccount, t]);

  useEffect(() => {
    if (open && date) {
      loadTrades();
    } else {
      setTrades([]);
      setError(null);
    }
  }, [open, date, tradingAccount, loadTrades]);

  if (!open) return null;

  const formatDate = (dateStr: string) => {
    return formatDateLong(dateStr, preferences.date_format, preferences.language, preferences.timezone);
  };

  const formatTimeLocal = (dateStr: string) => {
    return formatTime(dateStr, preferences.timezone, preferences.language);
  };

  const formatPnl = (pnl: string | null) => {
    if (!pnl) return '—';
    return formatCurrencyWithSign(pnl, '', preferences.number_format, 2);
  };

  const getPnlColor = (pnl: string | null) => {
    if (!pnl) return 'text-gray-500 dark:text-gray-400';
    const num = parseFloat(pnl);
    if (num > 0) return 'text-green-600 dark:text-green-400 font-semibold';
    if (num < 0) return 'text-red-600 dark:text-red-400 font-semibold';
    return 'text-gray-500 dark:text-gray-400';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white dark:bg-gray-800 w-full max-w-4xl rounded-xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-t-xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 dark:bg-blue-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('trades:dayTradesModal.title')}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">{formatDate(date)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="font-medium text-rose-900 dark:text-rose-300">{t('trades:dayTradesModal.error')}</p>
                <p className="text-sm text-rose-700 dark:text-rose-400 mt-1">{error}</p>
              </div>
            </div>
          ) : trades.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-lg font-medium">{t('trades:dayTradesModal.noTradesForDate')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-900 dark:text-blue-300 font-medium">
                      {trades.length === 1 
                        ? t('trades:dayTradesModal.tradesFound', { count: trades.length })
                        : t('trades:dayTradesModal.tradesFoundPlural', { count: trades.length })}
                    </p>
                  </div>
                  {onStrategyClick && (
                    <button
                      onClick={() => onStrategyClick(date)}
                      className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm font-medium flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {t('trades:dayTradesModal.manageStrategy')}
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">{t('trades:dayTradesModal.time')}</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">{t('trades:dayTradesModal.symbol')}</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">{t('trades:type')}</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">{t('trades:size')}</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">{t('trades:dayTradesModal.entryPrice')}</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">{t('trades:dayTradesModal.exitPrice')}</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">{t('trades:pnl')}</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">{t('trades:duration')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {trades.map((trade) => (
                      <tr key={trade.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {formatTimeLocal(trade.entered_at)}
                          {trade.exited_at && ` - ${formatTimeLocal(trade.exited_at)}`}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{trade.contract_name}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              trade.trade_type === 'Long'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                            }`}
                          >
                            {trade.trade_type === 'Long' ? t('trades:long') : t('trades:short')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{formatNumber(trade.size, 4, preferences.number_format)}</td>
                        <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                          {formatNumber(trade.entry_price, 2, preferences.number_format)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                          {trade.exit_price ? formatNumber(trade.exit_price, 2, preferences.number_format) : '—'}
                        </td>
                        <td className={`px-4 py-3 text-right ${getPnlColor(trade.net_pnl)}`}>
                          {formatPnl(trade.net_pnl)}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{trade.duration_str || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Résumé */}
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('trades:dayTradesModal.totalPnl')}</p>
                    <p
                      className={`text-lg font-bold ${getPnlColor(
                        trades.reduce((sum, t) => sum + parseFloat(t.net_pnl || '0'), 0).toString()
                      )}`}
                    >
                      {formatPnl(
                        trades.reduce((sum, t) => sum + parseFloat(t.net_pnl || '0'), 0).toString()
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('trades:dayTradesModal.totalFees')}</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {formatNumber(
                        trades.reduce((sum, t) => sum + parseFloat(t.fees || '0'), 0),
                        2,
                        preferences.number_format
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('trades:dayTradesModal.winningTrades')}</p>
                    <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                      {trades.filter((t) => parseFloat(t.net_pnl || '0') > 0).length} / {trades.length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 rounded-b-xl flex items-center justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 font-medium transition-colors"
          >
            {t('trades:dayTradesModal.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

