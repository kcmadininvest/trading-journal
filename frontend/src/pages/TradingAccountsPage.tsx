import React, { useEffect, useMemo, useRef, useState } from 'react';
import { tradingAccountsService, TradingAccount } from '../services/tradingAccounts';
import { currenciesService, Currency } from '../services/currencies';
import PaginationControls from '../components/ui/PaginationControls';
import { DeleteConfirmModal, Tooltip } from '../components/ui';
import TradingAccountModal from '../components/accounts/TradingAccountModal';
import { AccountsFilters } from '../components/accounts/AccountsFilters';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { usePreferences } from '../hooks/usePreferences';
import userService from '../services/userService';

const DEFAULT_ITEMS_PER_PAGE = 20;

type SortField = 'id' | 'name' | 'account_type' | 'broker_account_id' | 'status' | 'created_at' | 'initial_capital' | 'maximum_loss_limit' | 'trades_count';
type SortDirection = 'asc' | 'desc';

const TradingAccountsPage: React.FC = () => {
  const { t } = useI18nTranslation();
  const [allAccounts, setAllAccounts] = useState<TradingAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const { preferences, loading: preferencesLoading } = usePreferences();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_ITEMS_PER_PAGE);
  const lastPrefPageSizeRef = useRef<number | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filters, setFilters] = useState({
    account_type: '' as '' | 'topstep' | 'ibkr' | 'ninjatrader' | 'tradovate' | 'other',
    status: '' as '' | 'active' | 'inactive',
    search: '',
  });

  // Fonction de tri
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Inverser la direction si on clique sur la même colonne
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Nouvelle colonne, tri ascendant par défaut (sauf pour ID qui est desc par défaut)
      setSortField(field);
      setSortDirection(field === 'id' ? 'desc' : 'asc');
    }
  };

  useEffect(() => {
    if (preferencesLoading) {
      return;
    }
    const prefSize = preferences.items_per_page ?? DEFAULT_ITEMS_PER_PAGE;
    lastPrefPageSizeRef.current = prefSize;
    setPageSize(prev => (prev === prefSize ? prev : prefSize));
    setPage(1);
  }, [preferencesLoading, preferences.items_per_page]);

  const handlePageSizeChange = async (size: number) => {
    const sanitized = Number.isFinite(size) && size > 0 ? size : DEFAULT_ITEMS_PER_PAGE;
    setPageSize(sanitized);
    setPage(1);
    lastPrefPageSizeRef.current = sanitized;
    try {
      await userService.updatePreferences({ items_per_page: sanitized });
      window.dispatchEvent(new CustomEvent('preferences:updated'));
    } catch (error) {
      console.error('[TradingAccountsPage] Failed to persist items_per_page', error);
    }
  };

  // Filtrer et trier les comptes
  const filteredAccounts = useMemo(() => {
    let filtered = [...allAccounts];
    
    // Filtre par type de compte
    if (filters.account_type) {
      filtered = filtered.filter(acc => acc.account_type === filters.account_type);
    }
    
    // Filtre par statut
    if (filters.status) {
      filtered = filtered.filter(acc => acc.status === filters.status);
    }
    
    // Filtre par recherche (nom ou broker_account_id)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(acc => 
        acc.name.toLowerCase().includes(searchLower) ||
        (acc.broker_account_id && acc.broker_account_id.toLowerCase().includes(searchLower))
      );
    }
    
    // Tri selon le champ sélectionné
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'id':
          aValue = a.id;
          bValue = b.id;
          break;
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'account_type':
          aValue = a.account_type;
          bValue = b.account_type;
          break;
        case 'broker_account_id':
          aValue = a.broker_account_id?.toLowerCase() || '';
          bValue = b.broker_account_id?.toLowerCase() || '';
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'created_at':
          aValue = a.created_at ? new Date(a.created_at).getTime() : 0;
          bValue = b.created_at ? new Date(b.created_at).getTime() : 0;
          break;
        case 'initial_capital':
          aValue = parseFloat(String(a.initial_capital || 0));
          bValue = parseFloat(String(b.initial_capital || 0));
          break;
        case 'maximum_loss_limit':
          aValue = parseFloat(String(a.maximum_loss_limit || 0));
          bValue = parseFloat(String(b.maximum_loss_limit || 0));
          break;
        case 'trades_count':
          aValue = a.trades_count || 0;
          bValue = b.trades_count || 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return filtered;
  }, [allAccounts, filters, sortField, sortDirection]);

  // Pagination des comptes filtrés
  const paginatedAccounts = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredAccounts.slice(startIndex, endIndex);
  }, [filteredAccounts, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / pageSize));
  const [editingAccount, setEditingAccount] = useState<TradingAccount | null>(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<TradingAccount | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Composant pour les en-têtes de colonnes triables
  const SortableHeader: React.FC<{ field: SortField; label: string; className?: string }> = ({ field, label, className = '' }) => (
    <th 
      className={`px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-colors select-none ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        {sortField === field && (
          <svg className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        )}
      </div>
    </th>
  );

  // Helper pour obtenir le symbole de devise d'un compte
  const getCurrencySymbol = (currencyCode: string): string => {
    const currency = currencies.find(c => c.code === currencyCode);
    return currency?.symbol || '';
  };

  // Helper pour formater le capital initial
  const formatInitialCapital = (account: TradingAccount): string => {
    if (!account.initial_capital) return '-';
    const value = typeof account.initial_capital === 'string' 
      ? parseFloat(account.initial_capital) 
      : account.initial_capital;
    if (isNaN(value)) return '-';
    const symbol = getCurrencySymbol(account.currency);
    return `${symbol}${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Helper pour formater le Maximum Loss Limit
  const formatMaximumLossLimit = (account: TradingAccount): string => {
    // Afficher le MLL seulement si activé
    if (account.mll_enabled === false) return '-';
    if (!account.maximum_loss_limit) return '-';
    const value = typeof account.maximum_loss_limit === 'string' 
      ? parseFloat(account.maximum_loss_limit) 
      : account.maximum_loss_limit;
    if (isNaN(value)) return '-';
    const symbol = getCurrencySymbol(account.currency);
    return `${symbol}${value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const load = async () => {
    setLoading(true);
    try {
      const list = await tradingAccountsService.list({ include_inactive: true, include_archived: true });
      const arr = Array.isArray(list) ? list : (list as any)?.results ?? [];
      setAllAccounts(arr);
    } catch {
      setAllAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    (async () => {
      try {
        const cs = await currenciesService.list();
        setCurrencies(cs);
      } catch {
        setCurrencies([]);
      }
    })();
  }, []);


  const handleSaveAccount = async (accountId: number | null, data: Partial<TradingAccount>) => {
    try {
      if (accountId) {
        // Mode édition
        await tradingAccountsService.update(accountId, data);
      } else {
        // Mode création
        await tradingAccountsService.create(data);
      }
      // Recharger depuis le backend pour refléter l'unicité du compte par défaut
      await load();
      // Fermer la modale après la sauvegarde
      setShowAccountModal(false);
      setEditingAccount(null);
    } catch (error) {
      throw error;
    }
  };

  const handleCreateNew = () => {
    setEditingAccount(null);
    setShowAccountModal(true);
  };

  const handleEdit = (acc: TradingAccount) => {
    setEditingAccount(acc);
    setShowAccountModal(true);
  };

  const handleSetDefault = async (id: number) => {
    try {
      await tradingAccountsService.setDefault(id);
      await load();
    } catch {}
  };

  const handleToggleStatus = async (acc: TradingAccount) => {
    const nextStatus = acc.status === 'active' ? 'inactive' : 'active';
    try {
      const updated = await tradingAccountsService.update(acc.id, { status: nextStatus });
      setAllAccounts(prev => prev.map(a => (a.id === acc.id ? updated : a)));
    } catch {}
  };

  const handleDelete = async (acc: TradingAccount) => {
    setAccountToDelete(acc);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!accountToDelete) return;
    
    setDeleteLoading(true);
    try {
      await tradingAccountsService.remove(accountToDelete.id);
      setAllAccounts(prev => {
        const filtered = prev.filter(a => a.id !== accountToDelete.id);
        // Si on supprime le dernier élément de la page et qu'on n'est pas sur la première page, reculer d'une page
        if (filtered.length > 0 && page > 1 && (page - 1) * pageSize >= filtered.length) {
          setPage(page - 1);
        }
        return filtered;
      });
      setShowDeleteModal(false);
      setAccountToDelete(null);
    } catch {
      // noop (on peut ajouter un toast plus tard)
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleFilterChange = (next: Partial<typeof filters>) => {
    setFilters(prev => ({ ...prev, ...next }));
    setPage(1); // Réinitialiser à la première page lors d'un changement de filtre
  };

  const handleResetFilters = () => {
    setFilters({
      account_type: '',
      status: '',
      search: '',
    });
    setPage(1);
  };

  return (
    <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
      {/* Filtres */}
      <AccountsFilters
        values={filters}
        onChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      {/* Table */}
      <div className="max-w-full">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                {filteredAccounts.length === 1 
                  ? t('accounts:accountCount', { count: filteredAccounts.length })
                  : t('accounts:accountCountPlural', { count: filteredAccounts.length })}
              </div>
              <button
                onClick={handleCreateNew}
                className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600 text-white rounded-lg shadow-sm hover:shadow-md hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-600 dark:hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-all duration-200 active:scale-95"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
                </svg>
                {t('accounts:form.newTitle', { defaultValue: 'Nouveau compte' })}
              </button>
            </div>
            
            {/* Mobile Card View */}
            <div className="block md:hidden">
              <div className="p-3 space-y-3">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={`skeleton-${i}`} className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600 animate-pulse">
                      <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/3 mb-3" />
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/2" />
                        <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/3" />
                      </div>
                    </div>
                  ))
                ) : filteredAccounts.length === 0 ? (
                  <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    {allAccounts.length === 0 
                      ? t('accounts:noAccounts')
                      : t('accounts:noAccountsFiltered', { defaultValue: 'Aucun compte ne correspond aux filtres' })}
                  </div>
                ) : (
                  paginatedAccounts.map(acc => (
                    <div
                      key={acc.id}
                      onClick={() => handleEdit(acc)}
                      className="p-4 sm:p-5 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer transition-colors w-full"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="font-semibold text-base text-gray-900 dark:text-gray-100 truncate flex-1">{acc.name}</span>
                            {acc.is_default && (
                              <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2.5 py-0.5 text-xs flex-shrink-0">{t('common:default')}</span>
                            )}
                          </div>
                          {acc.description && (
                            <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">{acc.description}</div>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-4 w-full">
                        <div className="flex flex-col w-full">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">ID</div>
                          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 break-words font-mono">{acc.id}</div>
                        </div>
                        <div className="flex flex-col w-full">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">{t('accounts:columns.type')}</div>
                          <span className="inline-flex items-center rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2.5 py-1 text-xs capitalize w-full justify-center">
                            {t(`accounts:accountTypes.${acc.account_type}`)}
                          </span>
                        </div>
                        <div className="flex flex-col w-full">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">{t('accounts:columns.brokerId', { defaultValue: 'ID Broker' })}</div>
                          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 break-words">{acc.broker_account_id || '-'}</div>
                        </div>
                        <div className="flex flex-col w-full">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">{t('accounts:columns.status')}</div>
                          <span className={`inline-flex items-center justify-center rounded-md px-2.5 py-1 text-xs w-full ${acc.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 font-semibold' : acc.status === 'inactive' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 font-semibold' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 font-semibold'}`}>
                            {acc.status === 'active' 
                              ? t('accounts:status.active') 
                              : acc.status === 'inactive' 
                              ? t('accounts:status.inactive') 
                              : acc.status}
                          </span>
                        </div>
                        <div className="flex flex-col w-full">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">{t('accounts:columns.initialCapital')}</div>
                          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 break-words">{formatInitialCapital(acc)}</div>
                        </div>
                        <div className="flex flex-col w-full">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">{t('accounts:columns.maximumLossLimit', { defaultValue: 'Maximum Loss Limit' })}</div>
                          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 break-words">{formatMaximumLossLimit(acc)}</div>
                        </div>
                        <div className="flex flex-col w-full">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">{t('accounts:columns.trades')}</div>
                          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">{acc.trades_count ?? 0}</div>
                        </div>
                      </div>
                      
                      <div className="pt-4 border-t border-gray-200 dark:border-gray-600 flex flex-row gap-3 w-full justify-end" onClick={(e) => e.stopPropagation()}>
                        {!acc.is_default && (
                          <Tooltip content={t('accounts:actions.setDefault')} position="top">
                            <button
                              onClick={() => handleSetDefault(acc.id)}
                              className="p-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            </button>
                          </Tooltip>
                        )}
                        <Tooltip content={acc.status === 'active' ? t('accounts:actions.disable') : t('accounts:actions.enable')} position="top">
                          <button
                            onClick={() => handleToggleStatus(acc)}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
                          >
                            {acc.status === 'active' ? (
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" /></svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" /></svg>
                            )}
                          </button>
                        </Tooltip>
                        <Tooltip content={t('accounts:actions.delete')} position="top">
                          <button
                            onClick={() => handleDelete(acc)}
                            className="p-2 text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0a1 1 0 001-1V5a1 1 0 011-1h4a1 1 0 011 1v1a1 1 0 001 1m-7 0h8" /></svg>
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {filteredAccounts.length > 0 && (
                <div className="px-3 pb-3">
                  <PaginationControls
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={filteredAccounts.length}
                    itemsPerPage={pageSize}
                    startIndex={(page - 1) * pageSize + 1}
                    endIndex={Math.min(page * pageSize, filteredAccounts.length)}
                    onPageChange={(p) => {
                      setPage(p);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    onPageSizeChange={handlePageSizeChange}
                    pageSizeOptions={[5, 10, 25, 50, 100]}
                  />
                </div>
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <SortableHeader field="id" label="ID" />
                      <SortableHeader field="name" label={t('accounts:columns.account')} />
                      <SortableHeader field="account_type" label={t('accounts:columns.type')} />
                      <SortableHeader field="broker_account_id" label={t('accounts:columns.brokerId', { defaultValue: 'ID Broker' })} />
                      <SortableHeader field="status" label={t('accounts:columns.status')} />
                      <SortableHeader field="created_at" label={t('accounts:columns.createdAt', { defaultValue: 'Date de création' })} />
                      <SortableHeader field="initial_capital" label={t('accounts:columns.initialCapital')} />
                      <SortableHeader field="maximum_loss_limit" label={t('accounts:columns.maximumLossLimit', { defaultValue: 'Maximum Loss Limit' })} />
                      <SortableHeader field="trades_count" label={t('accounts:columns.trades')} />
                      <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('accounts:columns.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={`skeleton-${i}`}>
                          <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4"><div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-12 animate-pulse" /></td>
                          <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4"><div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-1/3 animate-pulse" /></td>
                          <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4"><div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-20 animate-pulse" /></td>
                          <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4"><div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-16 animate-pulse" /></td>
                          <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4"><div className="h-5 bg-gray-100 dark:bg-gray-700 rounded w-16 animate-pulse" /></td>
                          <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4"><div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-24 animate-pulse" /></td>
                          <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4"><div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-24 animate-pulse" /></td>
                          <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4"><div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-20 animate-pulse" /></td>
                          <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4"><div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-12 animate-pulse" /></td>
                          <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 text-right"><div className="h-8 bg-gray-100 dark:bg-gray-700 rounded w-40 ml-auto animate-pulse" /></td>
                        </tr>
                      ))
                    ) : filteredAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 sm:px-6 py-8 sm:py-10 text-center">
                          <div className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
                            {allAccounts.length === 0 
                              ? t('accounts:noAccounts')
                              : t('accounts:noAccountsFiltered', { defaultValue: 'Aucun compte ne correspond aux filtres' })}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      (Array.isArray(paginatedAccounts) ? paginatedAccounts : []).map(acc => (
                        <tr 
                          key={acc.id} 
                          onClick={() => handleEdit(acc)}
                          className="hover:bg-gray-50/60 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                        >
                          <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-mono">
                            {acc.id}
                          </td>
                          <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-medium text-xs sm:text-sm text-gray-900 dark:text-gray-100 truncate">{acc.name}</span>
                              {acc.is_default && (
                                <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs flex-shrink-0">{t('common:default')}</span>
                              )}
                            </div>
                            {acc.description && (
                              <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{acc.description}</div>
                            )}
                          </td>
                          <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">
                            <span className="inline-flex items-center rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs capitalize">
                              {t(`accounts:accountTypes.${acc.account_type}`)}
                            </span>
                          </td>
                          <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                            {acc.broker_account_id || '-'}
                          </td>
                          <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center rounded-md px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs ${acc.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : acc.status === 'inactive' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'}`}>
                              {acc.status === 'active' 
                                ? t('accounts:status.active') 
                                : acc.status === 'inactive' 
                                ? t('accounts:status.inactive') 
                                : acc.status}
                            </span>
                          </td>
                          <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                            {acc.created_at ? new Date(acc.created_at).toLocaleDateString('fr-FR', { 
                              year: 'numeric', 
                              month: '2-digit', 
                              day: '2-digit' 
                            }) : '-'}
                          </td>
                          <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                            {formatInitialCapital(acc)}
                          </td>
                          <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                            {formatMaximumLossLimit(acc)}
                          </td>
                          <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                            {acc.trades_count ?? 0}
                          </td>
                          <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-right">
                            <div className="inline-flex items-center gap-2 sm:gap-3 justify-end" onClick={(e) => e.stopPropagation()}>
                              {!acc.is_default && (
                                <Tooltip content={t('accounts:actions.setDefault')} position="top">
                                  <button
                                    onClick={() => handleSetDefault(acc.id)}
                                    className="p-1.5 sm:p-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  >
                                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                  </button>
                                </Tooltip>
                              )}
                              <Tooltip content={acc.status === 'active' ? t('accounts:actions.disable') : t('accounts:actions.enable')} position="top">
                                <button
                                  onClick={() => handleToggleStatus(acc)}
                                  className="p-1.5 sm:p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
                                >
                                  {acc.status === 'active' ? (
                                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" /></svg>
                                  ) : (
                                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" /></svg>
                                  )}
                                </button>
                              </Tooltip>
                              <Tooltip content={t('accounts:actions.delete')} position="top">
                                <button
                                  onClick={() => handleDelete(acc)}
                                  className="p-1.5 sm:p-2 text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500"
                                >
                                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0a1 1 0 001-1V5a1 1 0 011-1h4a1 1 0 011 1v1a1 1 0 001 1m-7 0h8" /></svg>
                                </button>
                              </Tooltip>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {filteredAccounts.length > 0 && (
                <div className="px-2 sm:px-4 md:px-6">
                  <PaginationControls
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={filteredAccounts.length}
                    itemsPerPage={pageSize}
                    startIndex={(page - 1) * pageSize + 1}
                    endIndex={Math.min(page * pageSize, filteredAccounts.length)}
                    onPageChange={(p) => {
                      setPage(p);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    onPageSizeChange={(size) => {
                      setPageSize(size);
                      setPage(1);
                    }}
                    pageSizeOptions={[5, 10, 25, 50, 100]}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Modal de création/édition */}
      <TradingAccountModal
        account={editingAccount}
        isOpen={showAccountModal}
        onClose={() => {
          setShowAccountModal(false);
          setEditingAccount(null);
        }}
        onSave={handleSaveAccount}
        currencies={currencies}
      />

      {/* Modal de suppression */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setAccountToDelete(null);
        }}
        onConfirm={confirmDelete}
        title={t('accounts:deleteTitle', { defaultValue: 'Delete Account' })}
        message={accountToDelete ? t('accounts:deleteConfirm', { name: accountToDelete.name }) : ''}
        isLoading={deleteLoading}
        confirmButtonText={t('accounts:actions.deleteLabel', { defaultValue: 'Delete' })}
      />
    </div>
  );
};

export default TradingAccountsPage;