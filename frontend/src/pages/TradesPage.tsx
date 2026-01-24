import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { tradesService, TradeListItem } from '../services/trades';
import { AccountSelector } from '../components/accounts/AccountSelector';
import { TradesFilters } from '../components/trades/TradesFilters';
import { TradesTable } from '../components/trades/TradesTable';
import { TradeModal } from '../components/trades/TradeModal';
import { CreateTradeModal } from '../components/trades/CreateTradeModal';

import PaginationControls from '../components/ui/PaginationControls';
import { DeleteConfirmModal } from '../components/ui';
import { ImportTradesModal } from '../components/trades/ImportTradesModal';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useTradingAccount } from '../contexts/TradingAccountContext';
import { usePreferences } from '../hooks/usePreferences';
import userService from '../services/userService';

const DEFAULT_TRADES_PAGE_SIZE = 20;
const TRADES_PAGE_SIZE_OPTIONS = [5, 10, 20, 25, 50, 100];

const sanitizePageSize = (value: number | string | null | undefined) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_TRADES_PAGE_SIZE;
  }
  const parsed = value !== undefined && value !== null ? parseInt(String(value), 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TRADES_PAGE_SIZE;
};

const TradesPage: React.FC = () => {
  const { t } = useI18nTranslation();
  const { selectedAccountId, setSelectedAccountId, loading: accountLoading } = useTradingAccount();
  const [items, setItems] = useState<TradeListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { preferences, loading: preferencesLoading } = usePreferences();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TRADES_PAGE_SIZE);
  const [instruments, setInstruments] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    trading_account: null as number | null,
    contract: '',
    type: '' as '' | 'Long' | 'Short',
    start_date: '',
    end_date: '',
    profitable: '' as '' | 'true' | 'false',
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [stats, setStats] = useState<{ total_trades: number; total_pnl: number; total_fees: number; total_raw_pnl?: number } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const isInitializing = useRef(false);
  const [tradeToDelete, setTradeToDelete] = useState<number | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTradeId, setEditingTradeId] = useState<number | null>(null);

  useEffect(() => {
    if (preferencesLoading) {
      return;
    }
    const prefSize = sanitizePageSize(preferences.items_per_page ?? DEFAULT_TRADES_PAGE_SIZE);
    setPageSize((prev) => (prev === prefSize ? prev : prefSize));
  }, [preferences.items_per_page, preferencesLoading]);

  // Créer une clé stable pour les dépendances des useEffect basée sur les valeurs de filters
  const filtersKey = useMemo(() => {
    return JSON.stringify({
      trading_account: filters.trading_account,
      contract: filters.contract,
      type: filters.type,
      start_date: filters.start_date,
      end_date: filters.end_date,
      profitable: filters.profitable,
    });
  }, [
    filters.trading_account,
    filters.contract,
    filters.type,
    filters.start_date,
    filters.end_date,
    filters.profitable,
  ]);

  // Utiliser useCallback pour garantir que load() utilise toujours les valeurs à jour
  const load = useCallback(async (overridePage?: number, overridePageSize?: number) => {
    // Utiliser les valeurs passées en paramètre ou les valeurs du state
    const currentPage = overridePage ?? page;
    const currentPageSize = overridePageSize ?? pageSize;
    const currentFilters = filters;
    
    setIsLoading(true);
    try {
      const res = await tradesService.list({
        trading_account: currentFilters.trading_account ?? undefined,
        contract: currentFilters.contract || undefined,
        type: currentFilters.type || undefined,
        start_date: currentFilters.start_date || undefined,
        end_date: currentFilters.end_date || undefined,
        profitable: currentFilters.profitable || undefined,
        page: currentPage,
        page_size: currentPageSize,
      });
      setItems(res.results);
      setTotal(res.count);
    } catch (e) {
      console.error('[TradesPage] load() error', e);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, filters]);

  const reloadStats = async () => {
    try {
      const { trading_account, contract, type, start_date, end_date, profitable } = filters;
      const s = await tradesService.statistics({
        trading_account: trading_account ?? undefined,
        contract: contract || undefined,
        type: type || undefined,
        start_date: start_date || undefined,
        end_date: end_date || undefined,
        profitable: profitable || undefined,
      });
      setStats(s);
    } catch {
      // ignore
    }
  };

  // Synchroniser filters.trading_account avec le contexte global
  useEffect(() => {
    if (filters.trading_account !== selectedAccountId) {
      setFilters(prev => ({ ...prev, trading_account: selectedAccountId }));
    }
  }, [selectedAccountId, filters.trading_account]);

  useEffect(() => {
    // Initialiser le compte sélectionné depuis le stockage ou le compte par défaut (une seule fois)
    if (hasInitialized) {
      return;
    }
    
    const init = async () => {
      if (isInitializing.current) {
        return;
      }
      isInitializing.current = true;
      
      // Ne plus initialiser ici, c'est géré par TradingAccountProvider
      // On synchronise juste filters.trading_account avec selectedAccountId
      setHasInitialized(true);
      isInitializing.current = false;
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Ne s'exécute qu'une fois au montage

  useEffect(() => {
    // Attendre la fin de l'initialisation et que le compte soit chargé avant de charger
    if (!hasInitialized || accountLoading || preferencesLoading) {
      return;
    }
    
    // Passer explicitement page et pageSize pour garantir les bonnes valeurs au premier chargement
    load(page, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasInitialized, accountLoading, page, pageSize, filtersKey]);

  useEffect(() => {
    // Attendre la fin de l'initialisation et que le compte soit chargé avant de charger les stats
    if (!hasInitialized || accountLoading) {
      return;
    }
    
    // Capturer les valeurs de filters pour éviter les problèmes de closure
    const { trading_account, contract, type, start_date, end_date, profitable } = filters;
    const loadStats = async () => {
      try {
        // Passer trading_account même s'il est null (tous les comptes) - undefined sera ignoré par l'API
        const s = await tradesService.statistics({
          trading_account: trading_account !== null ? trading_account : undefined,
          contract: contract || undefined,
          type: type || undefined,
          start_date: start_date || undefined,
          end_date: end_date || undefined,
          profitable: profitable || undefined,
        });
        setStats(s);
      } catch (e) {
        console.error('[TradesPage] Error loading statistics', e);
        setStats(null);
      }
    };
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, hasInitialized, accountLoading]);

  useEffect(() => {
    if (!hasInitialized || accountLoading) {
      return;
    }

    const loadInstruments = async () => {
      try {
        const list = await tradesService.instruments(selectedAccountId ?? null);
        setInstruments(list);

        setFilters(prev => {
          if (prev.contract && !list.includes(prev.contract)) {
            return { ...prev, contract: '' };
          }
          return prev;
        });
      } catch (e) {
        console.error('[TradesPage] Error loading instruments', e);
      }
    };
    loadInstruments();
  }, [selectedAccountId, accountLoading, hasInitialized]);

 

  const resetFilters = () => {
    setSelectedAccountId(null);
    setFilters({ trading_account: null, contract: '', type: '', start_date: '', end_date: '', profitable: '' });
    setPage(1);
  };

  const handlePageSizeChange = async (size: number) => {
    const sanitized = sanitizePageSize(size);
    setPageSize(sanitized);
    setPage(1);

    try {
      await userService.updatePreferences({ items_per_page: sanitized });
      window.dispatchEvent(new CustomEvent('preferences:updated'));
    } catch (error) {
      console.error('[TradesPage] Failed to persist items_per_page preference', error);
    }
  };

  const handleDeleteOne = async (id: number) => {
    setTradeToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDeleteOne = async () => {
    if (!tradeToDelete) return;
    
    setDeleteLoading(true);
    try {
      await tradesService.remove(tradeToDelete);
      // Retirer localement pour réactivité
      setItems(prev => prev.filter(t => t.id !== tradeToDelete));
      setTotal(prev => Math.max(0, prev - 1));
      // Recharger stats
      try {
        const s = await tradesService.statistics({
          contract: filters.contract || undefined,
          type: filters.type || undefined,
          start_date: filters.start_date || undefined,
          end_date: filters.end_date || undefined,
          profitable: filters.profitable || undefined,
        });
        setStats(s);
      } catch {}
      // Si la page courante est vide après suppression, reculer d'une page
      setTimeout(() => {
        if (items.length === 1 && page > 1) {
          setPage(page - 1);
        } else {
          load();
        }
      }, 0);
      setShowDeleteModal(false);
      setTradeToDelete(null);
    } catch (e) {
      // Fallback: recharger
      load();
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setShowBulkDeleteModal(true);
  };

  const confirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    
    const ids = [...selectedIds];
    setSelectedIds([]);
    setBulkDeleteLoading(true);
    
    try {
      const results = await Promise.allSettled(ids.map(id => tradesService.remove(id)));
      // Mettre à jour localement
      setItems(prev => prev.filter(t => !ids.includes(t.id)));
      setTotal(prev => Math.max(0, prev - ids.filter((_, i) => results[i].status === 'fulfilled').length));
      // Recharger stats
      try {
        const s = await tradesService.statistics({
          contract: filters.contract || undefined,
          type: filters.type || undefined,
          start_date: filters.start_date || undefined,
          end_date: filters.end_date || undefined,
          profitable: filters.profitable || undefined,
        });
        setStats(s);
      } catch {}
      // Ajuster pagination
      setTimeout(() => {
        if (items.length === 0 && page > 1) {
          setPage(page - 1);
        } else {
          load();
        }
      }, 0);
      setShowBulkDeleteModal(false);
    } catch {
      load();
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const handleExportTrades = async () => {
    setIsLoading(true);
    try {
      // Récupérer tous les trades avec les filtres actuels (sans pagination)
      const allTrades: TradeListItem[] = [];
      let currentPage = 1;
      let hasMore = true;
      const pageSizeForExport = 100;

      while (hasMore) {
        const res = await tradesService.list({
          trading_account: filters.trading_account ?? undefined,
          contract: filters.contract || undefined,
          type: filters.type || undefined,
          start_date: filters.start_date || undefined,
          end_date: filters.end_date || undefined,
          profitable: filters.profitable || undefined,
          page: currentPage,
          page_size: pageSizeForExport,
        });
        
        allTrades.push(...res.results);
        hasMore = res.next !== null;
        currentPage++;
      }

      // Générer le CSV
      const headers = [
        'ID',
        'TopStep ID',
        'Compte',
        'Contrat',
        'Type',
        'Date d\'entrée',
        'Date de sortie',
        'Prix d\'entrée',
        'Prix de sortie',
        'Taille',
        'Frais',
        'Commissions',
        'P&L',
        'P&L Net',
        'P&L %',
        'Rentable',
        'Durée',
        'Jour de trade',
      ];

      const rows = allTrades.map(trade => [
        trade.id.toString(),
        trade.topstep_id || '',
        trade.trading_account_name || '',
        trade.contract_name || '',
        trade.trade_type || '',
        trade.entered_at || '',
        trade.exited_at || '',
        trade.entry_price || '',
        trade.exit_price || '',
        trade.size || '',
        trade.fees || '',
        trade.commissions || '',
        trade.pnl || '',
        trade.net_pnl || '',
        trade.pnl_percentage || '',
        trade.is_profitable !== null ? (trade.is_profitable ? 'Oui' : 'Non') : '',
        trade.duration_str || trade.trade_duration || '',
        trade.trade_day || '',
      ]);

      // Créer le contenu CSV avec BOM pour Excel
      const csvContent = [
        '\uFEFF' + headers.join(','), // BOM pour Excel UTF-8
        ...rows.map(row => row.map(cell => {
          // Échapper les cellules contenant des virgules, guillemets ou retours à la ligne
          const cellStr = String(cell || '');
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(',')),
      ].join('\n');

      // Créer le blob et télécharger
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `trades_export_${dateStr}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const safePageSize = sanitizePageSize(pageSize);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const paginationStartIndex = total === 0 ? 0 : (page - 1) * safePageSize + 1;
  const paginationEndIndex = total === 0 ? 0 : Math.min(page * safePageSize, total);

  return (
    <div className="bg-gray-50 dark:bg-gray-900 py-4 sm:py-6 md:py-8">
      <div className="px-3 sm:px-4 md:px-6 lg:px-8">
        {/* Sélecteur de compte et boutons d'action */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="flex-1 w-full sm:max-w-md">
            <AccountSelector
              value={selectedAccountId}
              onChange={(accountId) => {
                setSelectedAccountId(accountId);
                setFilters(prev => ({ ...prev, trading_account: accountId }));
              }}
            />
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                setEditingTradeId(null);
                setShowCreateModal(true);
              }}
              disabled={isLoading}
              className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-green-600 dark:bg-green-500 text-white rounded-md hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('trades:create', { defaultValue: 'Créer un trade' })}
            </button>
            <button
              onClick={handleExportTrades}
              disabled={isLoading}
              className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t('trades:export', { defaultValue: 'Exporter' })}
            </button>
            <button
              onClick={() => setShowImport(true)}
              disabled={isLoading}
              className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-indigo-600 dark:bg-indigo-500 text-white rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {t('trades:import', { defaultValue: 'Importer' })}
            </button>
          </div>
        </div>

        {/* Filtres */}

        <TradesFilters
          values={filters}
          instruments={instruments}
          onChange={(next) => setFilters((prev) => ({ ...prev, ...next }))}
          onReset={resetFilters}
        />

        {selectedIds.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="text-sm sm:text-base text-gray-700 dark:text-gray-300">{selectedIds.length} {t('trades:selected')}</div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <button onClick={() => setSelectedIds([])} className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600">{t('common:reset')}</button>
              <button onClick={handleBulkDelete} className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-rose-600 dark:bg-rose-500 text-white rounded hover:bg-rose-700 dark:hover:bg-rose-600">{t('trades:deleteSelected')}</button>
            </div>
          </div>
        )}

        <TradesTable
          items={items}
          isLoading={isLoading}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onSelect={(t) => setSelectedId(t.id)}
          hideFooter
          selectedIds={selectedIds}
          onToggleRow={(id, selected) => setSelectedIds(prev => selected ? [...prev, id] : prev.filter(x => x !== id))}
          onToggleAll={(selected, ids) => setSelectedIds(prev => selected ? Array.from(new Set([...prev, ...ids])) : prev.filter(x => !ids.includes(x)))}
        totals={{
          pnl: stats?.total_raw_pnl,
          fees: stats?.total_fees,
          net_pnl: stats?.total_pnl,
          count: stats?.total_trades,
        }}
        onDelete={handleDeleteOne}
        onRowClick={(trade) => {
          setEditingTradeId(trade.id);
          setShowCreateModal(true);
        }}
        />

      {/* Totaux filtrés rendus dans le tfoot du tableau */}

        <PaginationControls
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          itemsPerPage={safePageSize}
          startIndex={paginationStartIndex}
          endIndex={paginationEndIndex}
          onPageChange={(p) => {
            setPage(p);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onPageSizeChange={handlePageSizeChange}
          pageSizeOptions={TRADES_PAGE_SIZE_OPTIONS}
        />

        {selectedId && (
          <TradeModal
            tradeId={selectedId}
            onClose={(changed) => {
              setSelectedId(null);
              if (changed) load();
            }}
          />
        )}

        {/* Modale de création temporairement supprimée */}
      </div>
      
      {/* Modal de suppression d'un trade */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setTradeToDelete(null);
        }}
        onConfirm={confirmDeleteOne}
        title={t('trades:deleteTitle', { defaultValue: 'Delete Trade' })}
        message={t('trades:deleteConfirm', { defaultValue: 'Are you sure you want to delete this trade? This action is irreversible.' })}
        isLoading={deleteLoading}
        confirmButtonText={t('trades:delete', { defaultValue: 'Delete' })}
      />

      {/* Modal de suppression en masse */}
      <DeleteConfirmModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={confirmBulkDelete}
        title={t('trades:deleteMultipleTitle', { defaultValue: 'Delete Multiple Trades' })}
        message={t('trades:deleteMultipleConfirm', { count: selectedIds.length, defaultValue: `Delete ${selectedIds.length} selected trade(s)? This action is irreversible.` })}
        isLoading={bulkDeleteLoading}
        confirmButtonText={t('trades:deleteSelected', { defaultValue: 'Delete Selected' })}
      />

      <ImportTradesModal open={showImport} onClose={(done) => {
        setShowImport(false);
        if (done) {
          // recharger la liste et les stats seront rechargées via filtersKey
          load();
          reloadStats();
        }
      }} />
      
      {/* Modale de création/édition de trade */}
      <CreateTradeModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingTradeId(null);
        }}
        onSave={() => {
          // Recharger la liste et les stats
          load();
          reloadStats();
        }}
        tradeId={editingTradeId}
      />
    </div>
  );
};

export default TradesPage;
