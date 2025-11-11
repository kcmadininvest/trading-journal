import React from 'react';
import { TradeListItem } from '../../services/trades';
import { usePreferences } from '../../hooks/usePreferences';
import { formatCurrencyWithSign, formatNumber } from '../../utils/numberFormat';
import { formatDateTimeShort } from '../../utils/dateFormat';
import { useTranslation as useI18nTranslation } from 'react-i18next';

interface TradesTableProps {
  items: TradeListItem[];
  isLoading: boolean;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onSelect?: (trade: TradeListItem) => void;
  hideFooter?: boolean;
  selectedIds?: number[];
  onToggleRow?: (id: number, selected: boolean) => void;
  onToggleAll?: (selected: boolean, visibleIds: number[]) => void;
  totals?: { pnl?: number; fees?: number; net_pnl?: number; count?: number };
  onDelete?: (id: number) => void;
  onRowClick?: (trade: TradeListItem) => void; // Callback pour le clic sur une ligne
}

export const TradesTable: React.FC<TradesTableProps> = ({ items, isLoading, page, pageSize, total, onPageChange, onSelect, hideFooter, selectedIds = [], onToggleRow, onToggleAll, totals, onDelete, onRowClick }) => {
  const { preferences } = usePreferences();
  const { t } = useI18nTranslation();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const visibleIds = items.map(i => i.id);
  const allSelectedOnPage = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));

  const fmtCurrency = (v?: string | null) => {
    return formatCurrencyWithSign(v, '', preferences.number_format, 2);
  };

  const fmtNumber = (v?: string | null, digits = 2) => {
    return formatNumber(v, digits, preferences.number_format);
  };
  
  // Fonction pour formater la date avec les préférences
  const formatTradeDate = (dateStr: string) => {
    return formatDateTimeShort(dateStr, preferences.date_format, preferences.timezone);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Vue cartes pour mobile */}
      <div className="block md:hidden">
        {/* Header avec sélection pour mobile */}
        {!isLoading && items.length > 0 && (
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <input
              type="checkbox"
              checked={allSelectedOnPage}
              onChange={(e) => onToggleAll && onToggleAll(e.target.checked, visibleIds)}
              className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 appearance-none checked:bg-blue-600 dark:checked:bg-blue-400"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t('trades:selectAll', { defaultValue: 'Sélectionner tout' })}
            </span>
          </div>
        )}
        {isLoading ? (
          <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">{t('common:loading')}</div>
        ) : items.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">{t('trades:noTrades')}</div>
        ) : (
          <div className="space-y-3 p-3">
            {items.map((trade) => (
              <div
                key={trade.id}
                className={`p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600 ${onRowClick ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50' : ''}`}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (
                    target.closest('input[type="checkbox"]') ||
                    target.closest('button') ||
                    target.closest('a') ||
                    target.tagName === 'BUTTON' ||
                    target.tagName === 'INPUT' ||
                    target.tagName === 'A'
                  ) {
                    return;
                  }
                  if (onRowClick) {
                    onRowClick(trade);
                  }
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(trade.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        onToggleRow && onToggleRow(trade.id, e.target.checked);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 appearance-none checked:bg-blue-600 dark:checked:bg-blue-400 flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {formatTradeDate(trade.entered_at)}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {trade.trading_account_name || '-'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                      {trade.contract_name}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${trade.trade_type === 'Long' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300'}`}>
                      {trade.trade_type === 'Long' ? (
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                        </svg>
                      )}
                      {trade.trade_type === 'Long' ? t('trades:long') : t('trades:short')}
                    </span>
                    {onDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(trade.id);
                        }}
                        className="p-1 text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded transition-colors"
                        title={t('trades:delete')}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('trades:size')}</div>
                    <div className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{fmtNumber(trade.size, 4)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('trades:entry')}</div>
                    <div className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{fmtNumber(trade.entry_price, 2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('trades:exit')}</div>
                    <div className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{fmtNumber(trade.exit_price, 2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('trades:duration')}</div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">{trade.duration_str ?? '-'}</div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('trades:pnl')}</div>
                    <div
                      className="font-semibold tabular-nums"
                      style={
                        trade.pnl == null || isNaN(parseFloat(trade.pnl))
                          ? undefined
                          : { color: parseFloat(trade.pnl) >= 0 ? '#05967c' : '#e11d48' }
                      }
                    >
                      {fmtCurrency(trade.pnl)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('trades:fees')}</div>
                    <div className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{fmtCurrency(trade.fees)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('trades:netPnl')}</div>
                    <div
                      className="font-semibold tabular-nums"
                      style={
                        trade.net_pnl == null || isNaN(parseFloat(trade.net_pnl))
                          ? undefined
                          : { color: parseFloat(trade.net_pnl) >= 0 ? '#05967c' : '#e11d48' }
                      }
                    >
                      {fmtCurrency(trade.net_pnl)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* Totaux pour mobile */}
        {!isLoading && items.length > 0 && totals && (
          <div className="p-4 border-t-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('trades:totals')} {typeof totals.count === 'number' ? `(${totals.count} ${t('trades:trades')})` : ''}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('trades:pnl')}</div>
                <div
                  className="font-semibold tabular-nums"
                  style={totals.pnl !== undefined ? { color: (totals.pnl ?? 0) >= 0 ? '#05967c' : '#e11d48' } : undefined}
                >
                  {totals.pnl !== undefined ? formatCurrencyWithSign(totals.pnl, '', preferences.number_format, 2) : '-'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('trades:fees')}</div>
                <div className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                  {totals.fees !== undefined ? formatNumber(totals.fees, 2, preferences.number_format) : '-'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('trades:netPnl')}</div>
                <div
                  className="font-semibold tabular-nums"
                  style={totals.net_pnl !== undefined ? { color: (totals.net_pnl ?? 0) >= 0 ? '#05967c' : '#e11d48' } : undefined}
                >
                  {totals.net_pnl !== undefined ? formatCurrencyWithSign(totals.net_pnl, '', preferences.number_format, 2) : '-'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Vue tableau pour desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-2 sm:px-4 py-2 sm:py-3 w-10">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={allSelectedOnPage}
                    onChange={(e) => onToggleAll && onToggleAll(e.target.checked, visibleIds)}
                    className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 appearance-none checked:bg-blue-600 dark:checked:bg-blue-400"
                  />
                </div>
              </th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('trades:date')}</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('trades:account')}</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('trades:contract')}</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('trades:type')}</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('trades:size')}</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('trades:entry')}</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('trades:exit')}</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('trades:pnl')}</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('trades:fees')}</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('trades:netPnl')}</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('trades:duration')}</th>
              <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('trades:actions')}</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {isLoading ? (
              <tr>
                <td colSpan={12} className="px-3 sm:px-4 py-4 sm:py-6 text-center text-sm sm:text-base text-gray-500 dark:text-gray-400">{t('common:loading')}</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-3 sm:px-4 py-4 sm:py-6 text-center text-sm sm:text-base text-gray-500 dark:text-gray-400">{t('trades:noTrades')}</td>
              </tr>
            ) : (
              items.map((trade) => (
                <tr 
                  key={trade.id} 
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${onRowClick ? 'cursor-pointer' : ''}`}
                  onClick={(e) => {
                    // Ne pas déclencher le clic sur la ligne si on clique sur:
                    // - la checkbox
                    // - le bouton de suppression
                    // - un lien ou un bouton
                    const target = e.target as HTMLElement;
                    if (
                      target.closest('input[type="checkbox"]') ||
                      target.closest('button') ||
                      target.closest('a') ||
                      target.tagName === 'BUTTON' ||
                      target.tagName === 'INPUT' ||
                      target.tagName === 'A'
                    ) {
                      return;
                    }
                    if (onRowClick) {
                      onRowClick(trade);
                    }
                  }}
                >
                  <td className="px-2 sm:px-4 py-2 sm:py-3 w-10">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(trade.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          onToggleRow && onToggleRow(trade.id, e.target.checked);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 text-blue-600 dark:text-blue-400 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 appearance-none checked:bg-blue-600 dark:checked:bg-blue-400"
                      />
                    </div>
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-700 dark:text-gray-300">{formatTradeDate(trade.entered_at)}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-700 dark:text-gray-300">{trade.trading_account_name || '-'}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm">
                    <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                      {trade.contract_name}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm">
                    <span className={`inline-flex items-center px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-medium ${trade.trade_type === 'Long' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300'}`}>
                      {trade.trade_type === 'Long' ? (
                        <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-0.5 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-0.5 sm:mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                        </svg>
                      )}
                      {trade.trade_type === 'Long' ? t('trades:long') : t('trades:short')}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-right tabular-nums text-gray-700 dark:text-gray-300">{fmtNumber(trade.size, 4)}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-right tabular-nums text-gray-700 dark:text-gray-300">{fmtNumber(trade.entry_price, 2)}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-right tabular-nums text-gray-700 dark:text-gray-300">{fmtNumber(trade.exit_price, 2)}</td>
                  <td
                    className={`px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-right tabular-nums font-semibold`}
                    style={
                      trade.pnl == null || isNaN(parseFloat(trade.pnl))
                        ? undefined
                        : { color: parseFloat(trade.pnl) >= 0 ? '#05967c' : '#e11d48' }
                    }
                  >
                    {fmtCurrency(trade.pnl)}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-right tabular-nums text-gray-700 dark:text-gray-300">{fmtCurrency(trade.fees)}</td>
                  <td
                    className={`px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-right tabular-nums font-semibold`}
                    style={
                      trade.net_pnl == null || isNaN(parseFloat(trade.net_pnl))
                        ? undefined
                        : { color: parseFloat(trade.net_pnl) >= 0 ? '#05967c' : '#e11d48' }
                    }
                  >
                    {fmtCurrency(trade.net_pnl)}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-right text-gray-700 dark:text-gray-300">{trade.duration_str ?? '-'}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-center">
                    {onDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(trade.id);
                        }}
                        className="p-1 text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded transition-colors"
                        title={t('trades:delete')}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {(!isLoading && items.length > 0 && totals) && (
            <tfoot className="bg-gray-50 dark:bg-gray-700/50">
              <tr className="border-t-2 border-gray-200 dark:border-gray-600">
                <td colSpan={8} className="px-2 sm:px-4 py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                  <span className="inline-flex items-center gap-1 sm:gap-2 font-medium">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    {t('trades:totals')} {typeof totals.count === 'number' ? `(${totals.count} ${t('trades:trades')})` : ''}
                  </span>
                </td>
                <td className="px-2 sm:px-4 py-2 text-right text-xs sm:text-sm font-semibold" style={totals.pnl !== undefined ? { color: (totals.pnl ?? 0) >= 0 ? '#05967c' : '#e11d48' } : undefined}>
                  {totals.pnl !== undefined ? formatCurrencyWithSign(totals.pnl, '', preferences.number_format, 2) : ''}
                </td>
                <td className="px-2 sm:px-4 py-2 text-right text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                  {totals.fees !== undefined ? formatNumber(totals.fees, 2, preferences.number_format) : ''}
                </td>
                <td className="px-2 sm:px-4 py-2 text-right text-xs sm:text-sm font-semibold" style={totals.net_pnl !== undefined ? { color: (totals.net_pnl ?? 0) >= 0 ? '#05967c' : '#e11d48' } : undefined}>
                  {totals.net_pnl !== undefined ? formatCurrencyWithSign(totals.net_pnl, '', preferences.number_format, 2) : ''}
                </td>
                <td className="p-0"></td>
                <td className="p-0"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {!hideFooter && (
        <div className="px-3 sm:px-4 py-2 sm:py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{t('common:page')} {page} / {totalPages}</div>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="px-3 py-2 text-xs sm:text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 rounded hover:bg-gray-200 dark:hover:bg-gray-600">{t('common:previous')}</button>
            <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="px-3 py-2 text-xs sm:text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 rounded hover:bg-gray-200 dark:hover:bg-gray-600">{t('common:next')}</button>
          </div>
        </div>
      )}
    </div>
  );
};


