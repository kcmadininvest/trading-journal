import React, { useEffect, useMemo, useRef, useState } from 'react';
import { tradingAccountsService, TradingAccount } from '../services/tradingAccounts';
import { currenciesService, Currency } from '../services/currencies';
import PaginationControls from '../components/ui/PaginationControls';
import { DeleteConfirmModal } from '../components/ui';
import { useTranslation as useI18nTranslation } from 'react-i18next';

const TradingAccountsPage: React.FC = () => {
  const { t } = useI18nTranslation();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const currencyRef = useRef<HTMLDivElement | null>(null);
  const typeRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);
  const orderedCurrencies = useMemo(() => {
    if (!currencies || currencies.length === 0) return [] as Currency[];
    const priority = ['USD', 'EUR', 'GBP'];
    const prioritySet = new Set(priority);
    const first = priority
      .map(code => currencies.find(c => c.code === code))
      .filter(Boolean) as Currency[];
    const rest = currencies
      .filter(c => !prioritySet.has(c.code))
      .sort((a, b) => a.code.localeCompare(b.code));
    return [...first, ...rest];
  }, [currencies]);

  // Pagination des comptes
  const paginatedAccounts = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return accounts.slice(startIndex, endIndex);
  }, [accounts, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(accounts.length / pageSize));
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<TradingAccount>>({
    name: '',
    account_type: 'topstep',
    currency: 'USD',
    status: 'active',
    description: '',
    maximum_loss_limit: undefined,
    mll_enabled: true,
  });
  const [saving, setSaving] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<TradingAccount | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const selectedCurrency = useMemo(() => {
    const code = form.currency || 'USD';
    return currencies.find(c => c.code === code) || (currencies.length ? currencies[0] : undefined);
  }, [currencies, form.currency]);

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
      setAccounts(arr);
    } catch {
      setAccounts([]);
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

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (isCurrencyOpen && currencyRef.current && !currencyRef.current.contains(t)) setIsCurrencyOpen(false);
      if (isTypeOpen && typeRef.current && !typeRef.current.contains(t)) setIsTypeOpen(false);
      if (isStatusOpen && statusRef.current && !statusRef.current.contains(t)) setIsStatusOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [isCurrencyOpen, isTypeOpen, isStatusOpen]);

  const handleCreate = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      if (editingAccountId) {
        // Mode édition
        const updated = await tradingAccountsService.update(editingAccountId, form);
        // Recharger depuis le backend pour refléter l'unicité du compte par défaut
        await load();
        
        // Mettre à jour le formulaire avec les données sauvegardées
        const mllValue = updated.maximum_loss_limit ? (typeof updated.maximum_loss_limit === 'string' ? parseFloat(updated.maximum_loss_limit) : updated.maximum_loss_limit) : undefined;
        
        setForm({
          name: updated.name,
          account_type: updated.account_type,
          currency: updated.currency,
          initial_capital: updated.initial_capital,
          maximum_loss_limit: mllValue,
          mll_enabled: updated.mll_enabled !== undefined ? updated.mll_enabled : true,
          status: updated.status,
          description: updated.description || '',
          broker_account_id: updated.broker_account_id || '',
          is_default: updated.is_default,
        });
      } else {
        // Mode création
        await tradingAccountsService.create(form);
        // Recharger depuis le backend pour refléter l'unicité du compte par défaut
        await load();
        setForm({ name: '', account_type: 'topstep', currency: 'USD', status: 'active', description: '', maximum_loss_limit: undefined, mll_enabled: true });
        setEditingAccountId(null);
      }
    } catch {
      // noop
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (acc: TradingAccount) => {
    const mllValue = acc.maximum_loss_limit ? (typeof acc.maximum_loss_limit === 'string' ? parseFloat(acc.maximum_loss_limit) : acc.maximum_loss_limit) : undefined;
    
    setForm({
      name: acc.name,
      account_type: acc.account_type,
      currency: acc.currency,
      initial_capital: acc.initial_capital,
      maximum_loss_limit: mllValue,
      mll_enabled: acc.mll_enabled !== undefined ? acc.mll_enabled : true,
      status: acc.status,
      description: acc.description || '',
      broker_account_id: acc.broker_account_id || '',
      is_default: acc.is_default,
    });
    setEditingAccountId(acc.id);
    // Scroll vers le formulaire
    setTimeout(() => {
      const formElement = document.querySelector('[data-form-section]');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleCancel = () => {
    setForm({ name: '', account_type: 'topstep', currency: 'USD', status: 'active', description: '', maximum_loss_limit: undefined });
    setEditingAccountId(null);
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
      setAccounts(prev => prev.map(a => (a.id === acc.id ? updated : a)));
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
      setAccounts(prev => {
        const filtered = prev.filter(a => a.id !== accountToDelete.id);
        // Si on supprime le dernier élément de la page et qu'on n'est pas sur la première page, reculer d'une page
        if (filtered.length > 0 && page > 1 && (page - 1) * pageSize >= filtered.length) {
          setPage(page - 1);
        }
        return filtered;
      });
      setShowDeleteModal(false);
      setAccountToDelete(null);
    } catch (e) {
      // noop (on peut ajouter un toast plus tard)
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
        {/* Table */}
        <div className="flex-1 min-w-0">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                {accounts.length === 1 
                  ? t('accounts:accountCount', { count: accounts.length })
                  : t('accounts:accountCountPlural', { count: accounts.length })}
              </div>
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
                ) : accounts.length === 0 ? (
                  <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    {t('accounts:noAccounts')}
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
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">{t('accounts:columns.type')}</div>
                          <span className="inline-flex items-center rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2.5 py-1 text-xs capitalize w-full justify-center">
                            {t(`accounts:accountTypes.${acc.account_type}`)}
                          </span>
                        </div>
                        <div className="flex flex-col w-full">
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">{t('accounts:columns.status')}</div>
                          <span className={`inline-flex items-center justify-center rounded-md px-2.5 py-1 text-xs w-full ${acc.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 font-semibold' : acc.status === 'inactive' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 font-semibold' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 font-semibold'}`}>
                            {acc.status === 'active' 
                              ? t('accounts:status.active') 
                              : acc.status === 'inactive' 
                              ? t('accounts:status.inactive') 
                              : t('accounts:status.archived')}
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
                      
                      <div className="pt-4 border-t border-gray-200 dark:border-gray-600 flex flex-row gap-2 w-full" onClick={(e) => e.stopPropagation()}>
                        {!acc.is_default && (
                          <button
                            onClick={() => handleSetDefault(acc.id)}
                            className="flex-1 inline-flex items-center justify-center gap-1 px-2 sm:gap-1.5 sm:px-3 py-2 text-xs sm:text-sm font-medium bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-600 dark:hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all active:scale-95"
                            title={t('accounts:actions.setDefault')}
                          >
                            <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            {t('accounts:actions.default')}
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleStatus(acc)}
                          className="flex-1 inline-flex items-center justify-center gap-1 px-2 sm:gap-1.5 sm:px-3 py-2 text-xs sm:text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all active:scale-95"
                        >
                          {acc.status === 'active' ? (
                            <>
                              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" /></svg>
                              {t('accounts:actions.disable')}
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" /></svg>
                              {t('accounts:actions.enable')}
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(acc)}
                          className="flex-1 inline-flex items-center justify-center gap-1 px-2 sm:gap-1.5 sm:px-3 py-2 text-xs sm:text-sm font-medium bg-gradient-to-r from-rose-600 to-rose-700 dark:from-rose-500 dark:to-rose-600 text-white rounded-lg hover:from-rose-700 hover:to-rose-800 dark:hover:from-rose-600 dark:hover:to-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all active:scale-95"
                          title={t('accounts:actions.delete')}
                        >
                          <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0a1 1 0 001-1V5a1 1 0 011-1h4a1 1 0 011 1v1a1 1 0 001 1m-7 0h8" /></svg>
                          {t('accounts:actions.deleteLabel')}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {accounts.length > 0 && (
                <div className="px-3 pb-3">
                  <PaginationControls
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={accounts.length}
                    itemsPerPage={pageSize}
                    startIndex={(page - 1) * pageSize + 1}
                    endIndex={Math.min(page * pageSize, accounts.length)}
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

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('accounts:columns.account')}</th>
                      <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('accounts:columns.type')}</th>
                      <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('accounts:columns.status')}</th>
                      <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('accounts:columns.initialCapital')}</th>
                      <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('accounts:columns.maximumLossLimit', { defaultValue: 'Maximum Loss Limit' })}</th>
                      <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('accounts:columns.trades')}</th>
                      <th className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('accounts:columns.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={`skeleton-${i}`}>
                          <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4"><div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-1/3 animate-pulse" /></td>
                          <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4"><div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-20 animate-pulse" /></td>
                          <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4"><div className="h-5 bg-gray-100 dark:bg-gray-700 rounded w-16 animate-pulse" /></td>
                          <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4"><div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-24 animate-pulse" /></td>
                          <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4"><div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-20 animate-pulse" /></td>
                          <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4"><div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-12 animate-pulse" /></td>
                          <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 text-right"><div className="h-8 bg-gray-100 dark:bg-gray-700 rounded w-40 ml-auto animate-pulse" /></td>
                        </tr>
                      ))
                    ) : accounts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 sm:px-6 py-8 sm:py-10 text-center">
                          <div className="text-sm sm:text-base text-gray-500 dark:text-gray-400">{t('accounts:noAccounts')}</div>
                        </td>
                      </tr>
                    ) : (
                      (Array.isArray(paginatedAccounts) ? paginatedAccounts : []).map(acc => (
                        <tr 
                          key={acc.id} 
                          onClick={() => handleEdit(acc)}
                          className="hover:bg-gray-50/60 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                        >
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
                          <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center rounded-md px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs ${acc.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : acc.status === 'inactive' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'}`}>
                              {acc.status === 'active' 
                                ? t('accounts:status.active') 
                                : acc.status === 'inactive' 
                                ? t('accounts:status.inactive') 
                                : t('accounts:status.archived')}
                            </span>
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
                          <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex items-center gap-1 sm:gap-2 flex-wrap justify-end">
                              {!acc.is_default && (
                                <button
                                  onClick={() => handleSetDefault(acc.id)}
                                  className="inline-flex items-center gap-1 px-2 sm:px-3.5 py-1.5 sm:py-2 text-[10px] sm:text-xs font-medium bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600 text-white rounded-lg shadow-sm hover:shadow-md hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-600 dark:hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-all duration-200 active:scale-95"
                                  title={t('accounts:actions.setDefault')}
                                >
                                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                  <span className="hidden sm:inline">{t('accounts:actions.default')}</span>
                                </button>
                              )}
                              <button
                                onClick={() => handleToggleStatus(acc)}
                                className="inline-flex items-center gap-1 px-2 sm:px-3.5 py-1.5 sm:py-2 text-[10px] sm:text-xs font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-all duration-200 active:scale-95"
                              >
                                {acc.status === 'active' ? (
                                  <>
                                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" /></svg>
                                    <span className="hidden sm:inline">{t('accounts:actions.disable')}</span>
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" /></svg>
                                    <span className="hidden sm:inline">{t('accounts:actions.enable')}</span>
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleDelete(acc)}
                                className="inline-flex items-center gap-1 px-2 sm:px-3.5 py-1.5 sm:py-2 text-[10px] sm:text-xs font-medium bg-gradient-to-r from-rose-600 to-rose-700 dark:from-rose-500 dark:to-rose-600 text-white rounded-lg shadow-sm hover:shadow-md hover:from-rose-700 hover:to-rose-800 dark:hover:from-rose-600 dark:hover:to-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-all duration-200 active:scale-95"
                                title={t('accounts:actions.delete')}
                              >
                                <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0a1 1 0 001-1V5a1 1 0 011-1h4a1 1 0 011 1v1a1 1 0 001 1m-7 0h8" /></svg>
                                <span className="hidden sm:inline">{t('accounts:actions.deleteLabel')}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {accounts.length > 0 && (
                <div className="px-2 sm:px-4 md:px-6">
                  <PaginationControls
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={accounts.length}
                    itemsPerPage={pageSize}
                    startIndex={(page - 1) * pageSize + 1}
                    endIndex={Math.min(page * pageSize, accounts.length)}
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

        {/* Create/Edit form */}
        <div className="w-full lg:w-96" data-form-section>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">{editingAccountId ? t('accounts:form.editTitle') : t('accounts:form.newTitle')}</h2>
              <p className="mt-1 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{editingAccountId ? t('accounts:form.editDescription') : t('accounts:form.newDescription')}</p>
            </div>
            <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5">
              <div className="grid grid-cols-1 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">{t('accounts:form.name')}</label>
                  <input
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm sm:text-base px-2 sm:px-3 py-1.5 sm:py-2"
                    value={form.name || ''}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={t('accounts:form.namePlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">{t('accounts:form.type')}</label>
                  <div ref={typeRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setIsTypeOpen(v => !v)}
                      className="w-full inline-flex items-center justify-between rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                    >
                      <span className="inline-flex items-center gap-1.5 sm:gap-2 capitalize truncate">
                        {t(`accounts:accountTypes.${form.account_type || 'topstep'}`)}
                      </span>
                      <svg className={`h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400 dark:text-gray-500 transition-transform flex-shrink-0 ${isTypeOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {isTypeOpen && (
                      <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden">
                        <ul className="py-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300 max-h-60 overflow-y-auto">
                          {[
                            { value: 'topstep' },
                            { value: 'ibkr' },
                            { value: 'ninjatrader' },
                            { value: 'tradovate' },
                            { value: 'other' },
                          ].map(opt => (
                            <li key={opt.value}>
                              <button
                                type="button"
                                onClick={() => { setForm(prev => ({ ...prev, account_type: opt.value as TradingAccount['account_type'] })); setIsTypeOpen(false); }}
                                className={`w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${opt.value === (form.account_type || 'topstep') ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
                              >
                                <span className="text-gray-900 dark:text-gray-100">{t(`accounts:accountTypes.${opt.value}`)}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t('accounts:form.typeDescription')}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">{t('accounts:form.brokerId')}</label>
                <input
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2"
                  value={(form as any).broker_account_id || ''}
                  onChange={(e) => setForm(prev => ({ ...prev, broker_account_id: e.target.value } as any))}
                  placeholder={t('accounts:form.brokerIdPlaceholder')}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">{t('accounts:form.currency')}</label>
                  <div ref={currencyRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setIsCurrencyOpen(v => !v)}
                      className="w-full inline-flex items-center justify-between rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                    >
                      <span className="truncate">{(selectedCurrency?.symbol || '$') + ' ' + (selectedCurrency?.code || 'USD')}</span>
                      <svg className={`h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400 dark:text-gray-500 transition-transform flex-shrink-0 ${isCurrencyOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {isCurrencyOpen && (
                      <div className="absolute z-10 mt-1 w-full min-w-[16rem] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg max-h-60 overflow-auto">
                        <ul className="py-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                          {((orderedCurrencies.length ? orderedCurrencies : (currencies.length ? currencies : [{ code: 'USD', name: t('accounts:defaultCurrencyName'), symbol: '$', id: 0 } as any]))).map(c => (
                            <li key={c.code}>
                              <button
                                type="button"
                                onClick={() => { setForm(prev => ({ ...prev, currency: c.code })); setIsCurrencyOpen(false); }}
                                className={`w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${c.code === (form.currency || 'USD') ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
                              >
                                <span className="font-medium mr-1">{c.symbol}</span>
                                <span className="text-gray-600 dark:text-gray-400 mr-1">{c.code}</span>
                                <span className="text-gray-500 dark:text-gray-500">— {c.name}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t('accounts:form.currencyDescription')}</p>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">{t('accounts:form.initialCapital')}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs sm:text-sm sm:text-base px-2 sm:px-3 py-1.5 sm:py-2"
                    value={(form as any).initial_capital || ''}
                    onChange={(e) => setForm(prev => ({ ...prev, initial_capital: e.target.value ? parseFloat(e.target.value) : null } as any))}
                    placeholder={t('accounts:form.initialCapitalPlaceholder')}
                  />
                  <p className="mt-1 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t('accounts:form.initialCapitalDescription')}</p>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="mll_enabled"
                  checked={(form as any).mll_enabled !== false}
                  onChange={(e) => setForm(prev => ({ ...prev, mll_enabled: e.target.checked } as any))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                />
                <label htmlFor="mll_enabled" className="ml-2 block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('accounts:form.enableMLL', { defaultValue: 'Activer le Maximum Loss Limit (MLL)' })}
                </label>
              </div>
              {(form as any).mll_enabled !== false && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                    {t('accounts:form.maximumLossLimit', { defaultValue: 'Maximum Loss Limit (MLL)' })}
                    <span className="text-gray-400 text-xs ml-1">({t('common:optional', { defaultValue: 'optionnel' })})</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs sm:text-sm sm:text-base px-2 sm:px-3 py-1.5 sm:py-2"
                    value={(() => {
                      const mll = (form as any).maximum_loss_limit;
                      if (mll === null || mll === undefined) return '';
                      // Convertir en nombre si c'est une string
                      const numValue = typeof mll === 'string' ? parseFloat(mll) : mll;
                      return isNaN(numValue) ? '' : numValue;
                    })()}
                    onChange={(e) => setForm(prev => ({ ...prev, maximum_loss_limit: e.target.value ? parseFloat(e.target.value) : null } as any))}
                    placeholder={t('accounts:form.maximumLossLimitPlaceholder', { defaultValue: 'Laissez vide pour calcul automatique' })}
                  />
                  <p className="mt-1 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                    {t('accounts:form.maximumLossLimitDescription', { defaultValue: 'Laissez vide pour calcul automatique selon le capital initial (50K=$2K, 100K=$3K, 150K=$4.5K)' })}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">{t('accounts:form.status')}</label>
                <div ref={statusRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsStatusOpen(v => !v)}
                    className="w-full inline-flex items-center justify-between rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <span className={`inline-flex items-center rounded-md px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs ${
                      (form.status || 'active') === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300'
                    }`}>
                      {(form.status || 'active') === 'active' ? t('accounts:status.active') : t('accounts:status.inactive')}
                    </span>
                    <svg className={`h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400 dark:text-gray-500 transition-transform flex-shrink-0 ${isStatusOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {isStatusOpen && (
                    <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden">
                      <ul className="py-1 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                        {[{ value: 'active' }, { value: 'inactive' }].map(opt => (
                          <li key={opt.value}>
                            <button
                              type="button"
                              onClick={() => { setForm(prev => ({ ...prev, status: opt.value as TradingAccount['status'] })); setIsStatusOpen(false); }}
                              className={`w-full flex items-center justify-between px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${opt.value === (form.status || 'active') ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
                            >
                              <span>{t(`accounts:status.${opt.value}`)}</span>
                              <span className={`inline-flex items-center rounded-md px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs ${
                                opt.value === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300'
                              }`}>
                                {t(`accounts:status.${opt.value}`)}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <p className="mt-1 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t('accounts:form.statusDescription')}</p>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">{t('accounts:form.description')}</label>
                <textarea
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 resize-y"
                  value={form.description || ''}
                  onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  placeholder={t('accounts:form.descriptionPlaceholder')}
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500 bg-white dark:bg-gray-700 appearance-none checked:bg-blue-600 dark:checked:bg-blue-400"
                    checked={Boolean((form as any).is_default)}
                    onChange={(e) => setForm(prev => ({ ...prev, is_default: e.target.checked } as any))}
                  />
                  {t('accounts:form.setAsDefault')}
                </label>
                <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{t('accounts:form.onlyOneDefault')}</div>
              </div>

              <div className="pt-2 space-y-2">
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                  {editingAccountId && (
                    <button
                      className="flex-1 inline-flex items-center justify-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-95"
                      onClick={handleCancel}
                      disabled={saving}
                    >
                      {t('accounts:form.cancel')}
                    </button>
                  )}
                  <button
                    className={`${editingAccountId ? 'flex-1' : 'w-full'} inline-flex items-center justify-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600 text-white rounded-lg shadow-sm hover:shadow-md hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-600 dark:hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-95`}
                    onClick={handleCreate}
                    disabled={saving || !form.name}
                  >
                    {saving ? (
                      <>
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>
                        {editingAccountId ? t('accounts:form.saving') : t('accounts:form.creating')}
                      </>
                    ) : (
                      <>
                        {editingAccountId ? (
                          <>
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            {t('accounts:form.save')}
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" /></svg>
                            {t('accounts:form.create')}
                          </>
                        )}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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