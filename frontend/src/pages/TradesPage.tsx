import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { tradesService, TradeListItem } from '../services/trades';
import { AccountSelector } from '../components/accounts/AccountSelector';
import { useAccountNumberVisibility } from '../hooks/useAccountNumberVisibility';
import { TradesFilters } from '../components/trades/TradesFilters';
import { TradesTable } from '../components/trades/TradesTable';
import { TradeModal } from '../components/trades/TradeModal';
import { CreateTradeModal } from '../components/trades/CreateTradeModal';
import { BulkStrategyAssignModal } from '../components/trades/BulkStrategyAssignModal';

import PaginationControls from '../components/ui/PaginationControls';
import { TradesPageSkeleton } from '../components/ui/TradesPageSkeleton';
import { PageShell } from '../components/layout';
import { DeleteConfirmModal } from '../components/ui';
import { ImportTradesModal } from '../components/trades/ImportTradesModal';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useTradingAccount } from '../contexts/useTradingAccount';
import { usePreferences } from '../hooks/usePreferences';
import userService from '../services/userService';
import { PnlBasisToggle } from '../components/common/PnlBasisToggle';
import { TopStepSyncControls } from '../components/accounts/TopStepSyncControls';
import { useTopStepSyncEligibility } from '../hooks/useTopStepSyncEligibility';

const DEFAULT_TRADES_PAGE_SIZE = 20;
const TRADES_PAGE_SIZE_OPTIONS = [5, 10, 20, 25, 50, 100];

const sanitizePageSize = (value: number | string | null | undefined) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_TRADES_PAGE_SIZE;
  }
  const parsed = value !== undefined && value !== null ? parseInt(String(value), 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TRADES_PAGE_SIZE;
};

type LoadOptions = {
  /** Sync auto (polling) : overlay tableau sans libellé « Mise à jour… » dans la barre d’actions */
  silent?: boolean;
};

const TradesPage: React.FC = () => {
  const { t } = useI18nTranslation();
  const { selectedAccountId, setSelectedAccountId, loading: accountLoading } = useTradingAccount();
  const hideAccountNumber = useAccountNumberVisibility();
  const [items, setItems] = useState<TradeListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshQuiet, setRefreshQuiet] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { preferences, loading: preferencesLoading } = usePreferences();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_TRADES_PAGE_SIZE);
  const [instruments, setInstruments] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    trading_account: null as number | null,
    contract: [] as string[],
    type: '' as '' | 'Long' | 'Short',
    start_date: '',
    end_date: '',
    profitable: '' as '' | 'true' | 'false',
    has_strategy: '' as '' | 'true' | 'false',
    position_strategy: '',
  });
  const replayEligible = useTopStepSyncEligibility(filters.trading_account ?? selectedAccountId);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectAllPages, setSelectAllPages] = useState(false);
  const [stats, setStats] = useState<{
    total_trades: number;
    total_pnl: number;
    total_fees: number;
    total_raw_pnl?: number;
    total_net_pnl?: number;
  } | null>(null);
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
  const [showBulkStrategyModal, setShowBulkStrategyModal] = useState(false);
  /** Passe à true après la première fin de `load()` (succès ou erreur). État — pas un ref — pour forcer le re-render. */
  const [listReady, setListReady] = useState(false);

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
      has_strategy: filters.has_strategy,
      position_strategy: filters.position_strategy,
    });
  }, [
    filters.trading_account,
    filters.contract,
    filters.type,
    filters.start_date,
    filters.end_date,
    filters.profitable,
    filters.has_strategy,
    filters.position_strategy,
  ]);

  // Utiliser useCallback pour garantir que load() utilise toujours les valeurs à jour
  const load = useCallback(async (
    overridePage?: number,
    overridePageSize?: number,
    options?: LoadOptions
  ) => {
    const currentPage = overridePage ?? page;
    const currentPageSize = overridePageSize ?? pageSize;
    const currentFilters = filters;

    setRefreshQuiet(options?.silent ?? false);
    setIsRefreshing(true);
    try {
      const res = await tradesService.list({
        trading_account: currentFilters.trading_account ?? undefined,
        contract: currentFilters.contract.length > 0 ? currentFilters.contract : undefined,
        type: currentFilters.type || undefined,
        start_date: currentFilters.start_date || undefined,
        end_date: currentFilters.end_date || undefined,
        profitable: currentFilters.profitable || undefined,
        has_strategy: currentFilters.has_strategy || undefined,
        position_strategy: currentFilters.position_strategy ? Number(currentFilters.position_strategy) : undefined,
        page: currentPage,
        page_size: currentPageSize,
      });
      setItems(res.results);
      setTotal(res.count);
    } catch (e) {
      console.error('[TradesPage] load() error', e);
    } finally {
      setIsRefreshing(false);
      setListReady(true);
    }
  }, [page, pageSize, filters]);

  const reloadStats = async () => {
    try {
      const { trading_account, contract, type, start_date, end_date, profitable, position_strategy } = filters;
      const s = await tradesService.statistics({
        trading_account: trading_account ?? undefined,
        contract: contract.length > 0 ? contract : undefined,
        type: type || undefined,
        start_date: start_date || undefined,
        end_date: end_date || undefined,
        profitable: profitable || undefined,
        has_strategy: filters.has_strategy || undefined,
        position_strategy: position_strategy ? Number(position_strategy) : undefined,
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
    
    // Attendre que filters.trading_account soit synchronisé avec selectedAccountId
    // pour éviter d'afficher furtivement tous les trades lors du rafraîchissement
    if (filters.trading_account !== selectedAccountId) {
      return;
    }
    
    // Passer explicitement page et pageSize pour garantir les bonnes valeurs au premier chargement
    load(page, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasInitialized, accountLoading, preferencesLoading, page, pageSize, filtersKey]);

  useEffect(() => {
    // Attendre la fin de l'initialisation et que le compte soit chargé avant de charger les stats
    if (!hasInitialized || accountLoading) {
      return;
    }
    
    // Attendre que filters.trading_account soit synchronisé avec selectedAccountId
    // pour éviter d'afficher furtivement les totaux de tous les comptes lors du rafraîchissement
    if (filters.trading_account !== selectedAccountId) {
      return;
    }
    
    // Capturer les valeurs de filters pour éviter les problèmes de closure
    const { trading_account, contract, type, start_date, end_date, profitable, has_strategy, position_strategy } = filters;
    const loadStats = async () => {
      try {
        // Passer trading_account même s'il est null (tous les comptes) - undefined sera ignoré par l'API
        const s = await tradesService.statistics({
          trading_account: trading_account !== null ? trading_account : undefined,
          contract: contract.length > 0 ? contract : undefined,
          type: type || undefined,
          start_date: start_date || undefined,
          end_date: end_date || undefined,
          profitable: profitable || undefined,
          has_strategy: has_strategy || undefined,
          position_strategy: position_strategy ? Number(position_strategy) : undefined,
        });
        setStats(s);
      } catch (e) {
        console.error('[TradesPage] Error loading statistics', e);
        setStats(null);
      }
    };
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, hasInitialized, accountLoading, preferences.pnl_display]);

  useEffect(() => {
    if (!hasInitialized || accountLoading) {
      return;
    }

    const loadInstruments = async () => {
      try {
        const list = await tradesService.instruments(selectedAccountId ?? null);
        setInstruments(list);

        setFilters(prev => {
          if (prev.contract.length > 0) {
            const valid = prev.contract.filter((c) => list.includes(c));
            if (valid.length !== prev.contract.length) {
              return { ...prev, contract: valid };
            }
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
    setFilters({
      trading_account: selectedAccountId,
      contract: [] as string[],
      type: '',
      start_date: '',
      end_date: '',
      profitable: '',
      has_strategy: '',
      position_strategy: '',
    });
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
          trading_account: filters.trading_account !== null ? filters.trading_account : undefined,
          contract: filters.contract.length > 0 ? filters.contract : undefined,
          type: filters.type || undefined,
          start_date: filters.start_date || undefined,
          end_date: filters.end_date || undefined,
          profitable: filters.profitable || undefined,
          has_strategy: filters.has_strategy || undefined,
          position_strategy: filters.position_strategy ? Number(filters.position_strategy) : undefined,
        });
        setStats(s);
      } catch {
        // stats optionnelles après suppression
      }
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
    } catch {
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
          trading_account: filters.trading_account !== null ? filters.trading_account : undefined,
          contract: filters.contract.length > 0 ? filters.contract : undefined,
          type: filters.type || undefined,
          start_date: filters.start_date || undefined,
          end_date: filters.end_date || undefined,
          profitable: filters.profitable || undefined,
          has_strategy: filters.has_strategy || undefined,
          position_strategy: filters.position_strategy ? Number(filters.position_strategy) : undefined,
        });
        setStats(s);
      } catch {
        // stats optionnelles après suppression
      }
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
    setIsExporting(true);
    try {
      // Récupérer tous les trades avec les filtres actuels (sans pagination)
      const allTrades: TradeListItem[] = [];
      let currentPage = 1;
      let hasMore = true;
      const pageSizeForExport = 100;

      while (hasMore) {
        const res = await tradesService.list({
          trading_account: filters.trading_account ?? undefined,
          contract: filters.contract.length > 0 ? filters.contract : undefined,
          type: filters.type || undefined,
          start_date: filters.start_date || undefined,
          end_date: filters.end_date || undefined,
          profitable: filters.profitable || undefined,
          position_strategy: filters.position_strategy ? Number(filters.position_strategy) : undefined,
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
      setIsExporting(false);
    }
  };

  const actionButtonsDisabled = isExporting || deleteLoading || bulkDeleteLoading;
  const showUpdatingIndicator = isRefreshing && !refreshQuiet;

  const safePageSize = sanitizePageSize(pageSize);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const paginationStartIndex = total === 0 ? 0 : (page - 1) * safePageSize + 1;
  const paginationEndIndex = total === 0 ? 0 : Math.min(page * safePageSize, total);

  // Ordre réel du chargement : (1) compte courant API + préférences user (2) sync
  // filters.trading_account → selectedAccountId (effet dédié) (3) premier `load()`.
  // Squelette tant que (1) ou (3) pas terminé. PageShell fluid + Layout (main flex-1) : footer en bas sans min-h-screen.
  const showPageSkeleton =
    accountLoading || preferencesLoading || !listReady;

  if (showPageSkeleton) {
    return <TradesPageSkeleton />;
  }

  return (
    <PageShell variant="fluid">
        {/* Compte, PnL net/brut et actions — même carte / grille que Stratégies / Calendrier */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex min-w-0 flex-col lg:flex-row lg:items-end gap-4">
            <div className="w-full min-w-0 lg:w-auto lg:flex-shrink-0">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('common:tradingAccount')}
              </label>
              <AccountSelector
                value={selectedAccountId}
                onChange={(accountId) => {
                  setSelectedAccountId(accountId);
                  setFilters(prev => ({ ...prev, trading_account: accountId }));
                }}
                hideLabel
                hideAccountNumber={hideAccountNumber}
              />
            </div>
            <div className="flex w-full items-end lg:w-auto lg:flex-shrink-0">
              <PnlBasisToggle />
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 lg:ml-auto lg:w-auto lg:flex-shrink-0 lg:justify-end">
              {showUpdatingIndicator && (
                <span
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-300"
                  role="status"
                  aria-live="polite"
                >
                  <svg
                    className="h-4 w-4 shrink-0 animate-spin text-blue-600 dark:text-blue-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  {t('common:updating', { defaultValue: 'Mise à jour…' })}
                </span>
              )}
              <button
                onClick={() => {
                  setEditingTradeId(null);
                  setShowCreateModal(true);
                }}
                disabled={actionButtonsDisabled}
                className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-green-600 dark:bg-green-500 text-white rounded-md hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {t('trades:create', { defaultValue: 'Créer un trade' })}
              </button>
              <button
                onClick={handleExportTrades}
                disabled={actionButtonsDisabled}
                className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {t('trades:export', { defaultValue: 'Exporter' })}
              </button>
              <TopStepSyncControls
                accountId={filters.trading_account ?? selectedAccountId}
                enablePolling
                onSynced={() => void load()}
                onPollingSynced={() => void load(undefined, undefined, { silent: true })}
              />
              {filters.start_date &&
                filters.end_date &&
                filters.start_date === filters.end_date &&
                replayEligible.canSync && (
                  <button
                    type="button"
                    onClick={() => {
                      const qs = new URLSearchParams();
                      const acc = filters.trading_account ?? selectedAccountId;
                      if (acc) qs.set('account', String(acc));
                      qs.set('date', filters.start_date);
                      qs.set('auto', '1');
                      window.location.hash = `session-replay?${qs.toString()}`;
                    }}
                    className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 flex items-center justify-center gap-2"
                  >
                    {t('replay:replayDay', { defaultValue: 'Rejouer la journée' })}
                  </button>
                )}
              <button
                onClick={() => setShowImport(true)}
                disabled={actionButtonsDisabled}
                className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-indigo-600 dark:bg-indigo-500 text-white rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {t('trades:import', { defaultValue: 'Importer' })}
              </button>
            </div>
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-col gap-1">
                <div className="text-sm sm:text-base text-gray-700 dark:text-gray-300">
                  {selectAllPages ? (
                    <span className="font-semibold">{total} {t('trades:selected')}</span>
                  ) : (
                    <span>{selectedIds.length} {t('trades:selected')}</span>
                  )}
                </div>
                {!selectAllPages && selectedIds.length > 0 && total > pageSize && (
                  <button
                    onClick={async () => {
                      try {
                        const allIds = await tradesService.getAllIds({
                          trading_account: filters.trading_account ?? undefined,
                          contract: filters.contract.length > 0 ? filters.contract : undefined,
                          type: filters.type || undefined,
                          start_date: filters.start_date || undefined,
                          end_date: filters.end_date || undefined,
                          profitable: filters.profitable || undefined,
                          has_strategy: filters.has_strategy || undefined,
                        });
                        setSelectedIds(allIds);
                        setSelectAllPages(true);
                      } catch (e) {
                        console.error('Error selecting all:', e);
                      }
                    }}
                    className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:underline text-left"
                  >
                    {t('trades:selectAllPages', { count: total, defaultValue: `Sélectionner les ${total} trades sur toutes les pages` })}
                  </button>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <button onClick={() => { setSelectedIds([]); setSelectAllPages(false); }} className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600">{t('common:reset')}</button>
              <button 
                onClick={() => setShowBulkStrategyModal(true)} 
                className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {t('trades:bulkAssignStrategy.button', { defaultValue: 'Assigner une stratégie' })}
              </button>
              <button onClick={handleBulkDelete} className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-rose-600 dark:bg-rose-500 text-white rounded hover:bg-rose-700 dark:hover:bg-rose-600">{t('trades:deleteSelected')}</button>
              </div>
            </div>
          </div>
        )}

        <TradesTable
          items={items}
          isInitialLoading={isRefreshing && items.length === 0}
          isRefreshing={isRefreshing}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onSelect={(t) => setSelectedId(t.id)}
          hideFooter
          selectedIds={selectedIds}
          onToggleRow={(id, selected) => {
            setSelectAllPages(false);
            setSelectedIds(prev => selected ? [...prev, id] : prev.filter(x => x !== id));
          }}
          onToggleAll={(selected, ids) => {
            setSelectAllPages(false);
            setSelectedIds(prev => selected ? Array.from(new Set([...prev, ...ids])) : prev.filter(x => !ids.includes(x)));
          }}
        totals={{
          pnl: stats?.total_raw_pnl,
          fees: stats?.total_fees,
          net_pnl: stats?.total_net_pnl ?? stats?.total_pnl,
          count: stats?.total_trades,
        }}
        onDelete={handleDeleteOne}
        onRowClick={(trade) => {
          setEditingTradeId(trade.id);
          setShowCreateModal(true);
        }}
        hideAccountNumber={hideAccountNumber}
        />

      {/* Totaux filtrés rendus dans le tfoot du tableau */}

        <div className="mt-4 sm:mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-800">
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
            className="border-t-0"
          />
        </div>

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
          // Recharger les stats et la liste
          reloadStats();
          load();
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
          // Recharger les stats et la liste
          reloadStats();
          load();
        }}
        tradeId={editingTradeId}
      />

      <BulkStrategyAssignModal
        isOpen={showBulkStrategyModal}
        onClose={() => setShowBulkStrategyModal(false)}
        onSuccess={() => {
          // Recharger la liste après assignation réussie
          load();
          setSelectedIds([]);
        }}
        selectedTradeIds={selectedIds}
      />

    </PageShell>
  );
};

export default TradesPage;
