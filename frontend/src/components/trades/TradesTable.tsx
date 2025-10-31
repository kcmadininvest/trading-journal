import React from 'react';
import { TradeListItem } from '../../services/trades';

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
}

export const TradesTable: React.FC<TradesTableProps> = ({ items, isLoading, page, pageSize, total, onPageChange, onSelect, hideFooter, selectedIds = [], onToggleRow, onToggleAll, totals, onDelete }) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const visibleIds = items.map(i => i.id);
  const allSelectedOnPage = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));

  const fmtCurrency = (v?: string | null) => {
    if (v == null) return '-';
    const num = parseFloat(v);
    if (isNaN(num)) return '-';
    const sign = num > 0 ? '+' : '';
    return `${sign}${num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const fmtNumber = (v?: string | null, digits = 2) => {
    if (v == null) return '-';
    const num = parseFloat(v);
    if (isNaN(num)) return '-';
    return num.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 w-10">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={allSelectedOnPage}
                    onChange={(e) => onToggleAll && onToggleAll(e.target.checked, visibleIds)}
                  />
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contrat</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Taille</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Entrée</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sortie</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">PnL</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Frais</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">PnL Net</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Durée</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={11} className="px-4 py-6 text-center text-gray-500">Chargement...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-6 text-center text-gray-500">Aucun trade trouvé</td>
              </tr>
            ) : (
              items.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 w-10">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(t.id)}
                        onChange={(e) => onToggleRow && onToggleRow(t.id, e.target.checked)}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{new Date(t.entered_at).toLocaleString()}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                      {t.contract_name}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium ${t.trade_type === 'Long' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {t.trade_type === 'Long' ? (
                        <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                        </svg>
                      )}
                      {t.trade_type === 'Long' ? 'Long' : 'Short'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right tabular-nums">{fmtNumber(t.size, 4)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right tabular-nums">{fmtNumber(t.entry_price, 2)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right tabular-nums">{fmtNumber(t.exit_price, 2)}</td>
                  <td
                    className={`px-4 py-3 whitespace-nowrap text-sm text-right tabular-nums font-semibold`}
                    style={
                      t.pnl == null || isNaN(parseFloat(t.pnl))
                        ? undefined
                        : { color: parseFloat(t.pnl) >= 0 ? '#05967c' : '#e11d48' }
                    }
                  >
                    {fmtCurrency(t.pnl)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right tabular-nums">{fmtCurrency(t.fees)}</td>
                  <td
                    className={`px-4 py-3 whitespace-nowrap text-sm text-right tabular-nums font-semibold`}
                    style={
                      t.net_pnl == null || isNaN(parseFloat(t.net_pnl))
                        ? undefined
                        : { color: parseFloat(t.net_pnl) >= 0 ? '#05967c' : '#e11d48' }
                    }
                  >
                    {fmtCurrency(t.net_pnl)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right">{t.duration_str ?? '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                    {onDelete && (
                      <button
                        onClick={() => onDelete(t.id)}
                        className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition-colors"
                        title="Supprimer"
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
            <tfoot className="bg-gray-50">
              <tr className="border-t-2 border-gray-200">
                <td colSpan={7} className="px-4 py-2 text-sm text-gray-700">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Totaux filtrés {typeof totals.count === 'number' ? `(${totals.count} trades)` : ''}
                  </span>
                </td>
                <td className="px-4 py-2 text-right text-sm font-semibold" style={totals.pnl !== undefined ? { color: (totals.pnl ?? 0) >= 0 ? '#05967c' : '#e11d48' } : undefined}>
                  {totals.pnl !== undefined ? `${totals.pnl >= 0 ? '+' : ''}${(totals.pnl).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                </td>
                <td className="px-4 py-2 text-right text-sm">
                  {totals.fees !== undefined ? (totals.fees).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                </td>
                <td className="px-4 py-2 text-right text-sm font-semibold" style={totals.net_pnl !== undefined ? { color: (totals.net_pnl ?? 0) >= 0 ? '#05967c' : '#e11d48' } : undefined}>
                  {totals.net_pnl !== undefined ? `${totals.net_pnl >= 0 ? '+' : ''}${(totals.net_pnl).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
                </td>
                <td className="p-0"></td>
                <td className="p-0"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {!hideFooter && (
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="text-sm text-gray-600">Page {page} / {totalPages}</div>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="px-3 py-2 bg-gray-100 disabled:opacity-50 rounded">Précédent</button>
            <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="px-3 py-2 bg-gray-100 disabled:opacity-50 rounded">Suivant</button>
          </div>
        </div>
      )}
    </div>
  );
};


