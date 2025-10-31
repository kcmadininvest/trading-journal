import React, { useEffect, useState, useRef, useMemo } from 'react';
import { tradesService, TradeListItem } from '../services/trades';
import { AccountSelector } from '../components/accounts/AccountSelector';
import { tradingAccountsService } from '../services/tradingAccounts';
import { TradesFilters } from '../components/trades/TradesFilters';
import { TradesTable } from '../components/trades/TradesTable';
import { TradeModal } from '../components/trades/TradeModal';
 
import PaginationControls from '../components/ui/PaginationControls';
import { FloatingActionButton } from '../components/ui/FloatingActionButton';
import { ImportTradesModal } from '../components/trades/ImportTradesModal';

const TradesPage: React.FC = () => {
  console.log('[TradesPage] Component render');
  
  const [items, setItems] = useState<TradeListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
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
  const isInitializing = useRef(false);
  const hasInitialized = useRef(false);

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

  const load = async () => {
    console.log('[TradesPage] load() called', { 
      filters, 
      page, 
      pageSize, 
      hasInitialized: hasInitialized.current 
    });
    setIsLoading(true);
    try {
      const res = await tradesService.list({
        trading_account: filters.trading_account ?? undefined,
        contract: filters.contract || undefined,
        type: filters.type || undefined,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
        profitable: filters.profitable || undefined,
        page,
        page_size: pageSize,
      });
      console.log('[TradesPage] load() success', { count: res.count, resultsCount: res.results.length });
      setItems(res.results);
      setTotal(res.count);
    } catch (e) {
      console.error('[TradesPage] load() error', e);
    } finally {
      setIsLoading(false);
      console.log('[TradesPage] load() finished');
    }
  };

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

  useEffect(() => {
    console.log('[TradesPage] useEffect[init] - Start', { 
      hasInitialized: hasInitialized.current, 
      isInitializing: isInitializing.current 
    });
    // Initialiser le compte sélectionné depuis le stockage ou le compte par défaut (une seule fois)
    if (hasInitialized.current) {
      console.log('[TradesPage] useEffect[init] - Already initialized, skipping');
      return;
    }
    
    const init = async () => {
      if (isInitializing.current) {
        console.log('[TradesPage] useEffect[init] - Already initializing, skipping');
        return;
      }
      console.log('[TradesPage] useEffect[init] - Starting initialization');
      isInitializing.current = true;
      
      const stored = localStorage.getItem('current_account_id');
      console.log('[TradesPage] useEffect[init] - localStorage account_id', stored);
      if (stored) {
        const id = Number(stored);
        if (!Number.isNaN(id)) {
          console.log('[TradesPage] useEffect[init] - Setting account from localStorage', id);
          setFilters(prev => {
            if (prev.trading_account === id) {
              console.log('[TradesPage] useEffect[init] - Account unchanged, skipping update');
              return prev;
            }
            console.log('[TradesPage] useEffect[init] - Updating filters with account', id);
            // Réinitialiser les stats pour éviter d'afficher des valeurs incorrectes
            setStats(null);
            return { ...prev, trading_account: id };
          });
          hasInitialized.current = true;
          isInitializing.current = false;
          console.log('[TradesPage] useEffect[init] - Initialization complete (from localStorage)');
          return;
        }
      }
      try {
        console.log('[TradesPage] useEffect[init] - Fetching default account');
        const def = await tradingAccountsService.default();
        console.log('[TradesPage] useEffect[init] - Default account received', def);
        if (def && def.status === 'active') {
          console.log('[TradesPage] useEffect[init] - Setting account from default', def.id);
          setFilters(prev => {
            if (prev.trading_account === def.id) {
              console.log('[TradesPage] useEffect[init] - Account unchanged, skipping update');
              return prev;
            }
            console.log('[TradesPage] useEffect[init] - Updating filters with default account', def.id);
            // Réinitialiser les stats pour éviter d'afficher des valeurs incorrectes
            setStats(null);
            return { ...prev, trading_account: def.id };
          });
        }
      } catch (e) {
        console.error('[TradesPage] useEffect[init] - Error fetching default account', e);
      }
      hasInitialized.current = true;
      isInitializing.current = false;
      console.log('[TradesPage] useEffect[init] - Initialization complete (from default)');
    };
    init();
  }, []);

  useEffect(() => {
    console.log('[TradesPage] useEffect[persist] - Start', { 
      trading_account: filters.trading_account,
      hasInitialized: hasInitialized.current,
      isInitializing: isInitializing.current 
    });
    // Persister le compte sélectionné (seulement après l'initialisation)
    if (!hasInitialized.current || isInitializing.current) {
      console.log('[TradesPage] useEffect[persist] - Skipping (not initialized yet)');
      return;
    }
    
    if (filters.trading_account) {
      console.log('[TradesPage] useEffect[persist] - Saving account to localStorage', filters.trading_account);
      localStorage.setItem('current_account_id', String(filters.trading_account));
    } else {
      console.log('[TradesPage] useEffect[persist] - Removing account from localStorage');
      localStorage.removeItem('current_account_id');
    }
  }, [filters.trading_account]);

  useEffect(() => {
    console.log('[TradesPage] useEffect[load] - Start', { 
      page, 
      pageSize, 
      filters, 
      filtersKey,
      hasInitialized: hasInitialized.current 
    });
    // Attendre la fin de l'initialisation avant de charger
    if (!hasInitialized.current) {
      console.log('[TradesPage] useEffect[load] - Skipping (not initialized yet)');
      return;
    }
    
    console.log('[TradesPage] useEffect[load] - Triggering load()');
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, filtersKey]);

  useEffect(() => {
    console.log('[TradesPage] useEffect[stats] - Start', { 
      filters, 
      filtersKey,
      hasInitialized: hasInitialized.current 
    });
    // Attendre la fin de l'initialisation avant de charger les stats
    if (!hasInitialized.current) {
      console.log('[TradesPage] useEffect[stats] - Skipping (not initialized yet)');
      return;
    }
    
    // Si le compte n'est pas encore défini après l'initialisation, ne pas charger les stats
    // (elles seront chargées une fois le compte défini via filtersKey)
    if (filters.trading_account === null && hasInitialized.current) {
      console.log('[TradesPage] useEffect[stats] - Account not set yet, waiting...');
      // Réinitialiser les stats pour éviter d'afficher de vieilles valeurs
      setStats(null);
      return;
    }
    
    // Capturer les valeurs de filters pour éviter les problèmes de closure
    const { trading_account, contract, type, start_date, end_date, profitable } = filters;
    const loadStats = async () => {
      console.log('[TradesPage] useEffect[stats] - Loading statistics', { filters });
      try {
        const s = await tradesService.statistics({
          trading_account: trading_account ?? undefined,
          contract: contract || undefined,
          type: type || undefined,
          start_date: start_date || undefined,
          end_date: end_date || undefined,
          profitable: profitable || undefined,
        });
        console.log('[TradesPage] useEffect[stats] - Statistics loaded', s);
        setStats(s);
      } catch (e) {
        console.error('[TradesPage] useEffect[stats] - Error loading statistics', e);
        setStats(null);
      }
    };
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, filters.trading_account]);

  useEffect(() => {
    console.log('[TradesPage] useEffect[instruments] - Start');
    const loadInstruments = async () => {
      console.log('[TradesPage] useEffect[instruments] - Loading instruments');
      try {
        const list = await tradesService.instruments();
        console.log('[TradesPage] useEffect[instruments] - Instruments loaded', list.length, 'items');
        setInstruments(list);
      } catch (e) {
        console.error('[TradesPage] useEffect[instruments] - Error loading instruments', e);
      }
    };
    loadInstruments();
  }, []);

 

  const resetFilters = () => {
    setFilters({ trading_account: null, contract: '', type: '', start_date: '', end_date: '', profitable: '' });
    setPage(1);
  };

  const handleDeleteOne = async (id: number) => {
    const confirmMsg = 'Êtes-vous sûr de vouloir supprimer ce trade ? Cette action est irréversible.';
    if (!window.confirm(confirmMsg)) return;
    try {
      await tradesService.remove(id);
      // Retirer localement pour réactivité
      setItems(prev => prev.filter(t => t.id !== id));
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
    } catch (e) {
      // Fallback: recharger
      load();
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const n = selectedIds.length;
    const confirmMsg = `Supprimer ${n} trade${n > 1 ? 's' : ''} sélectionné${n > 1 ? 's' : ''} ? Cette action est irréversible.`;
    if (!window.confirm(confirmMsg)) return;
    const ids = [...selectedIds];
    setSelectedIds([]);
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
    } catch {
      load();
    }
  };

  return (
    <div className="bg-gray-50 py-8">
      <div className="px-4 sm:px-6 lg:px-8">
        {/* Sélecteur de compte */}
        <AccountSelector
          value={filters.trading_account}
          onChange={(accountId) => setFilters(prev => ({ ...prev, trading_account: accountId }))}
        />

        {/* Filtres */}

        <TradesFilters
          values={filters}
          instruments={instruments}
          onChange={(next) => setFilters((prev) => ({ ...prev, ...next }))}
          onReset={resetFilters}
        />

        {selectedIds.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 mb-4 flex items-center justify-between">
            <div className="text-sm text-gray-700">{selectedIds.length} sélectionné(s)</div>
            <div className="flex gap-2">
              <button onClick={() => setSelectedIds([])} className="px-3 py-2 bg-gray-100 rounded">Effacer la sélection</button>
              <button onClick={handleBulkDelete} className="px-3 py-2 bg-rose-600 text-white rounded hover:bg-rose-700">Supprimer sélection</button>
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
        />

      {/* Totaux filtrés rendus dans le tfoot du tableau */}

        <PaginationControls
          currentPage={page}
          totalPages={Math.max(1, Math.ceil(total / pageSize))}
          totalItems={total}
          itemsPerPage={pageSize}
          startIndex={(page - 1) * pageSize + 1}
          endIndex={Math.min(page * pageSize, total)}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
            // reload
            load();
          }}
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
      <FloatingActionButton onClick={() => setShowImport(true)} title="Importer des trades" />
      <ImportTradesModal open={showImport} onClose={(done) => {
        setShowImport(false);
        if (done) {
          // recharger la liste et les stats seront rechargées via filtersKey
          load();
          reloadStats();
        }
      }} />
    </div>
  );
};

export default TradesPage;
