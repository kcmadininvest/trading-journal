import React, { useEffect, useMemo, useRef, useState } from 'react';
import { tradingAccountsService, TradingAccount } from '../services/tradingAccounts';
import { currenciesService, Currency } from '../services/currencies';
import PaginationControls from '../components/ui/PaginationControls';
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
  });
  const [saving, setSaving] = useState(false);
  const selectedCurrency = useMemo(() => {
    const code = form.currency || 'USD';
    return currencies.find(c => c.code === code) || (currencies.length ? currencies[0] : undefined);
  }, [currencies, form.currency]);

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
        await tradingAccountsService.update(editingAccountId, form);
      } else {
        // Mode création
        await tradingAccountsService.create(form);
      }
      // Recharger depuis le backend pour refléter l'unicité du compte par défaut
      await load();
      setForm({ name: '', account_type: 'topstep', currency: 'USD', status: 'active', description: '' });
      setEditingAccountId(null);
    } catch {
      // noop
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (acc: TradingAccount) => {
    setForm({
      name: acc.name,
      account_type: acc.account_type,
      currency: acc.currency,
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
    setForm({ name: '', account_type: 'topstep', currency: 'USD', status: 'active', description: '' });
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
    const msg = t('accounts:deleteConfirm', { name: acc.name });
    if (!window.confirm(msg)) return;
    try {
      await tradingAccountsService.remove(acc.id);
      setAccounts(prev => {
        const filtered = prev.filter(a => a.id !== acc.id);
        // Si on supprime le dernier élément de la page et qu'on n'est pas sur la première page, reculer d'une page
        if (filtered.length > 0 && page > 1 && (page - 1) * pageSize >= filtered.length) {
          setPage(page - 1);
        }
        return filtered;
      });
    } catch (e) {
      // noop (on peut ajouter un toast plus tard)
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Table */}
        <div className="flex-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {accounts.length === 1 
                  ? t('accounts:accountCount', { count: accounts.length })
                  : t('accounts:accountCountPlural', { count: accounts.length })}
              </div>
            </div>
            <div className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('accounts:columns.account')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('accounts:columns.type')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('accounts:columns.status')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('accounts:columns.trades')}</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('accounts:columns.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={`skeleton-${i}`}>
                          <td className="px-6 py-4"><div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-1/3 animate-pulse" /></td>
                          <td className="px-6 py-4"><div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-20 animate-pulse" /></td>
                          <td className="px-6 py-4"><div className="h-5 bg-gray-100 dark:bg-gray-700 rounded w-16 animate-pulse" /></td>
                          <td className="px-6 py-4"><div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-12 animate-pulse" /></td>
                          <td className="px-6 py-4 text-right"><div className="h-8 bg-gray-100 dark:bg-gray-700 rounded w-40 ml-auto animate-pulse" /></td>
                        </tr>
                      ))
                    ) : accounts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center">
                          <div className="text-gray-500 dark:text-gray-400">{t('accounts:noAccounts')}</div>
                        </td>
                      </tr>
                    ) : (
                      (Array.isArray(paginatedAccounts) ? paginatedAccounts : []).map(acc => (
                        <tr key={acc.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-700/50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 dark:text-gray-100">{acc.name}</span>
                              {acc.is_default && (
                                <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 text-xs">{t('common:default')}</span>
                              )}
                            </div>
                            {acc.description && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{acc.description}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 text-xs capitalize">
                              {t(`accounts:accountTypes.${acc.account_type}`)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs ${acc.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : acc.status === 'inactive' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'}`}>
                              {acc.status === 'active' 
                                ? t('accounts:status.active') 
                                : acc.status === 'inactive' 
                                ? t('accounts:status.inactive') 
                                : t('accounts:status.archived')}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300">
                            {acc.trades_count ?? 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="inline-flex items-center gap-2">
                              {!acc.is_default && (
                                <button
                                  onClick={() => handleSetDefault(acc.id)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600"
                                  title={t('accounts:actions.setDefault')}
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                  {t('accounts:actions.default')}
                                </button>
                              )}
                              <button
                                onClick={() => handleEdit(acc)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-600 dark:bg-indigo-500 text-white rounded hover:bg-indigo-700 dark:hover:bg-indigo-600"
                                title={t('accounts:actions.edit')}
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                {t('accounts:actions.editLabel')}
                              </button>
                              <button
                                onClick={() => handleToggleStatus(acc)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                              >
                                {acc.status === 'active' ? (
                                  <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" /></svg>
                                    {t('accounts:actions.disable')}
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" /></svg>
                                    {t('accounts:actions.enable')}
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleDelete(acc)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-rose-600 dark:bg-rose-500 text-white rounded hover:bg-rose-700 dark:hover:bg-rose-600"
                                title={t('accounts:actions.delete')}
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0a1 1 0 001-1V5a1 1 0 011-1h4a1 1 0 011 1v1a1 1 0 001 1m-7 0h8" /></svg>
                                {t('accounts:actions.deleteLabel')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {accounts.length > 0 && (
              <PaginationControls
                currentPage={page}
                totalPages={totalPages}
                totalItems={accounts.length}
                itemsPerPage={pageSize}
                startIndex={(page - 1) * pageSize + 1}
                endIndex={Math.min(page * pageSize, accounts.length)}
                onPageChange={(p) => {
                  setPage(p);
                  // Scroll to top of table
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
                pageSizeOptions={[5, 10, 25, 50, 100]}
              />
            )}
          </div>
        </div>

        {/* Create/Edit form */}
        <div className="w-full lg:w-96" data-form-section>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{editingAccountId ? t('accounts:form.editTitle') : t('accounts:form.newTitle')}</h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{editingAccountId ? t('accounts:form.editDescription') : t('accounts:form.newDescription')}</p>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('accounts:form.name')}</label>
                  <input
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-base px-2 py-1"
                    value={form.name || ''}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={t('accounts:form.namePlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('accounts:form.type')}</label>
                  <div ref={typeRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setIsTypeOpen(v => !v)}
                      className="w-full inline-flex items-center justify-between rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                    >
                      <span className="inline-flex items-center gap-2 capitalize">
                        {t(`accounts:accountTypes.${form.account_type || 'topstep'}`)}
                      </span>
                      <svg className={`h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform ${isTypeOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {isTypeOpen && (
                      <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden">
                        <ul className="py-1 text-sm text-gray-700 dark:text-gray-300">
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
                                className={`w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${opt.value === (form.account_type || 'topstep') ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
                              >
                                <span className="text-gray-900 dark:text-gray-100">{t(`accounts:accountTypes.${opt.value}`)}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('accounts:form.typeDescription')}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('accounts:form.brokerId')}</label>
                <input
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm px-2 py-1"
                  value={(form as any).broker_account_id || ''}
                  onChange={(e) => setForm(prev => ({ ...prev, broker_account_id: e.target.value } as any))}
                  placeholder={t('accounts:form.brokerIdPlaceholder')}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('accounts:form.currency')}</label>
                  <div ref={currencyRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setIsCurrencyOpen(v => !v)}
                      className="w-full inline-flex items-center justify-between rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                    >
                      <span>{(selectedCurrency?.symbol || '$') + ' ' + (selectedCurrency?.code || 'USD')}</span>
                      <svg className={`h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform ${isCurrencyOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {isCurrencyOpen && (
                      <div className="absolute z-10 mt-1 w-full min-w-[16rem] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg max-h-60 overflow-auto">
                        <ul className="py-1 text-sm text-gray-700 dark:text-gray-300">
                          {((orderedCurrencies.length ? orderedCurrencies : (currencies.length ? currencies : [{ code: 'USD', name: t('accounts:defaultCurrencyName'), symbol: '$', id: 0 } as any]))).map(c => (
                            <li key={c.code}>
                              <button
                                type="button"
                                onClick={() => { setForm(prev => ({ ...prev, currency: c.code })); setIsCurrencyOpen(false); }}
                                className={`w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${c.code === (form.currency || 'USD') ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
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
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('accounts:form.currencyDescription')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('accounts:form.status')}</label>
                  <div ref={statusRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setIsStatusOpen(v => !v)}
                      className="w-full inline-flex items-center justify-between rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs ${
                        (form.status || 'active') === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300'
                      }`}>
                        {(form.status || 'active') === 'active' ? t('accounts:status.active') : t('accounts:status.inactive')}
                      </span>
                      <svg className={`h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform ${isStatusOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {isStatusOpen && (
                      <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden">
                        <ul className="py-1 text-sm text-gray-700 dark:text-gray-300">
                          {[{ value: 'active' }, { value: 'inactive' }].map(opt => (
                            <li key={opt.value}>
                              <button
                                type="button"
                                onClick={() => { setForm(prev => ({ ...prev, status: opt.value as TradingAccount['status'] })); setIsStatusOpen(false); }}
                                className={`w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 ${opt.value === (form.status || 'active') ? 'bg-gray-50 dark:bg-gray-700' : ''}`}
                              >
                                <span>{t(`accounts:status.${opt.value}`)}</span>
                                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs ${
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
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('accounts:form.statusDescription')}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('accounts:form.description')}</label>
                <textarea
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm px-2 py-1"
                  value={form.description || ''}
                  onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  placeholder={t('accounts:form.descriptionPlaceholder')}
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-400 focus:ring-blue-500 bg-white dark:bg-gray-700 appearance-none checked:bg-blue-600 dark:checked:bg-blue-400"
                    checked={Boolean((form as any).is_default)}
                    onChange={(e) => setForm(prev => ({ ...prev, is_default: e.target.checked } as any))}
                  />
                  {t('accounts:form.setAsDefault')}
                </label>
                <div className="text-xs text-gray-500 dark:text-gray-400">{t('accounts:form.onlyOneDefault')}</div>
              </div>

              <div className="pt-2 space-y-2">
                <div className="flex gap-2">
                  {editingAccountId && (
                    <button
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
                      onClick={handleCancel}
                      disabled={saving}
                    >
                      {t('accounts:form.cancel')}
                    </button>
                  )}
                  <button
                    className={`${editingAccountId ? 'flex-1' : 'w-full'} inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50`}
                    onClick={handleCreate}
                    disabled={saving || !form.name}
                  >
                    {saving ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>
                        {editingAccountId ? t('accounts:form.saving') : t('accounts:form.creating')}
                      </>
                    ) : (
                      <>
                        {editingAccountId ? (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            {t('accounts:form.save')}
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" /></svg>
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
    </div>
  );
};

export default TradingAccountsPage;