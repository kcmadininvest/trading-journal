import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { tradesService, TradeListItem } from '../services/trades';
import { AccountSelector } from '../components/accounts/AccountSelector';
import { tradingAccountsService } from '../services/tradingAccounts';
import { TradesFilters } from '../components/trades/TradesFilters';
import { TradesTable } from '../components/trades/TradesTable';
import { TradeModal } from '../components/trades/TradeModal';
 
import PaginationControls from '../components/ui/PaginationControls';
import { FloatingActionButton } from '../components/ui/FloatingActionButton';
import { ImportTradesModal } from '../components/trades/ImportTradesModal';
import { useTranslation as useI18nTranslation } from 'react-i18next';

const TradesPage: React.FC = () => {
  const { t } = useI18nTranslation();
  const [items, setItems] = useState<TradeListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  // Restaurer pageSize depuis localStorage ou utiliser la valeur par défaut
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem('trades_page_size');
    return saved ? parseInt(saved, 10) : 20;
  });
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
      
      // Toujours utiliser le compte par défaut du serveur (fiable)
      // Le localStorage peut contenir un compte obsolète ou d'un autre utilisateur
      try {
        const def = await tradingAccountsService.default();
        if (def && def.status === 'active') {
          // Mettre à jour les filtres
          setFilters(prev => {
            const needsUpdate = prev.trading_account !== def.id;
            if (needsUpdate) {
              // Réinitialiser les stats pour éviter d'afficher des valeurs incorrectes
              setStats(null);
            }
            // Toujours retourner un nouvel objet pour forcer le déclenchement des dépendances
            return { ...prev, trading_account: def.id };
          });
          
          // Marquer comme initialisé APRÈS avoir mis à jour les filtres
          // Utiliser useState pour déclencher les re-renders et useEffect
          setHasInitialized(true);
          isInitializing.current = false;
        } else {
          setHasInitialized(true);
          isInitializing.current = false;
        }
      } catch (e) {
        console.error('[TradesPage] Error fetching default account', e);
        setHasInitialized(true);
        isInitializing.current = false;
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Persister le compte sélectionné (seulement après l'initialisation)
    if (!hasInitialized || isInitializing.current) {
      return;
    }
    
    if (filters.trading_account) {
      localStorage.setItem('current_account_id', String(filters.trading_account));
    } else {
      localStorage.removeItem('current_account_id');
    }
  }, [filters.trading_account, hasInitialized]);

  useEffect(() => {
    // Attendre la fin de l'initialisation avant de charger
    if (!hasInitialized) {
      return;
    }
    
    // Passer explicitement page et pageSize pour garantir les bonnes valeurs au premier chargement
    load(page, pageSize);
  }, [load, hasInitialized, page, pageSize]);

  useEffect(() => {
    // Attendre la fin de l'initialisation avant de charger les stats
    if (!hasInitialized) {
      return;
    }
    
    // Si le compte n'est pas encore défini après l'initialisation, ne pas charger les stats
    // (elles seront chargées une fois le compte défini via filtersKey)
    if (filters.trading_account === null && hasInitialized) {
      // Réinitialiser les stats pour éviter d'afficher de vieilles valeurs
      setStats(null);
      return;
    }
    
    // Capturer les valeurs de filters pour éviter les problèmes de closure
    const { trading_account, contract, type, start_date, end_date, profitable } = filters;
    const loadStats = async () => {
      try {
        const s = await tradesService.statistics({
          trading_account: trading_account ?? undefined,
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
  }, [filtersKey, filters.trading_account, hasInitialized]);

  useEffect(() => {
    const loadInstruments = async () => {
      try {
        const list = await tradesService.instruments();
        setInstruments(list);
      } catch (e) {
        console.error('[TradesPage] Error loading instruments', e);
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
            <div className="text-sm text-gray-700">{selectedIds.length} {t('trades:selected')}</div>
            <div className="flex gap-2">
              <button onClick={() => setSelectedIds([])} className="px-3 py-2 bg-gray-100 rounded">{t('common:reset')}</button>
              <button onClick={handleBulkDelete} className="px-3 py-2 bg-rose-600 text-white rounded hover:bg-rose-700">{t('trades:deleteSelected')}</button>
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
            // Persister la taille de page dans localStorage
            localStorage.setItem('trades_page_size', String(size));
            // Le useEffect qui écoute pageSize déclenchera automatiquement le rechargement
          }}
          pageSizeOptions={[5, 10, 20, 25, 50, 100]}
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
      <FloatingActionButton onClick={() => setShowImport(true)} title={t('trades:import')} />
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
