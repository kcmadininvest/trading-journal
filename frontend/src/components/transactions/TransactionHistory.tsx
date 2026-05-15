import React, { useState, useEffect, useMemo, useCallback, useLayoutEffect } from 'react';
import {
  accountTransactionsService,
  AccountTransaction,
  AccountBalance,
  AccountTransactionsStats,
} from '../../services/accountTransactions';
import { usePreferences } from '../../hooks/usePreferences';
import { usePrivacySettings, maskValue } from '../../hooks/usePrivacySettings';
import { formatCurrency } from '../../utils/numberFormat';
import { formatDate } from '../../utils/dateFormat';
import DeleteConfirmModal from '../ui/DeleteConfirmModal';
import { PaginationControls } from '../ui';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { DateInput } from '../common/DateInput';

const LEDGER_PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100] as const;
const DEFAULT_LEDGER_PAGE_SIZE = 10;

function symbolForCurrencyCode(code: string): string {
  if (code === 'USD') return '$';
  if (code === 'EUR') return '€';
  return code || '$';
}

const emptyStats: AccountTransactionsStats = {
  total: 0,
  deposits_count: 0,
  withdrawals_count: 0,
  total_deposits: '0',
  total_withdrawals: '0',
  net_flow: '0',
};

interface TransactionHistoryProps {
  tradingAccountId?: number;
  onEdit?: (transaction: AccountTransaction) => void;
  onDelete?: (transactionId: number) => void;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({
  tradingAccountId,
  onEdit,
  onDelete,
}) => {
  const { t } = useI18nTranslation();
  const { preferences } = usePreferences();
  const privacySettings = usePrivacySettings('transactions');
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [listCount, setListCount] = useState(0);
  const [stats, setStats] = useState<AccountTransactionsStats>(emptyStats);
  const [listLoading, setListLoading] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [error, setError] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [debouncedSearchQ, setDebouncedSearchQ] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'deposit' | 'withdrawal'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_LEDGER_PAGE_SIZE);
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [balanceCurrencyCode, setBalanceCurrencyCode] = useState<string>('USD');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<AccountTransaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const h = window.setTimeout(() => {
      setDebouncedSearchQ(searchQ.trim());
    }, 300);
    return () => window.clearTimeout(h);
  }, [searchQ]);

  useLayoutEffect(() => {
    setPage(1);
  }, [tradingAccountId, dateFrom, dateTo, debouncedSearchQ, filterType]);

  const loadTransactions = useCallback(async () => {
    setListLoading(true);
    setError('');
    if (tradingAccountId) {
      setBalanceLoading(true);
    } else {
      setBalanceLoading(false);
      setCurrentBalance(null);
      setBalanceCurrencyCode('USD');
    }

    const common = {
      trading_account: tradingAccountId,
      start_date: dateFrom || undefined,
      end_date: dateTo || undefined,
      timezone: preferences.timezone,
      q: debouncedSearchQ || undefined,
    };

    const balancePromise: Promise<AccountBalance | null> = tradingAccountId
      ? accountTransactionsService.getBalance(tradingAccountId).catch((err) => {
          console.error('Erreur lors du chargement du solde:', err);
          return null;
        })
      : Promise.resolve(null);

    try {
      const [listRes, statsRes] = await Promise.all([
        accountTransactionsService.list({
          ...common,
          transaction_type: filterType === 'all' ? undefined : filterType,
          page,
          page_size: pageSize,
        }),
        accountTransactionsService.stats(common),
      ]);

      const totalPages = Math.max(1, Math.ceil(listRes.count / Math.max(1, pageSize)));
      const pageOutOfRange = listRes.count > 0 && page > totalPages;
      if (pageOutOfRange) {
        setPage(totalPages);
      } else {
        setTransactions(listRes.results);
        setListCount(listRes.count);
        setStats(statsRes);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des transactions');
      setTransactions([]);
      setListCount(0);
      setStats(emptyStats);
    } finally {
      setListLoading(false);
    }

    try {
      const balance = await balancePromise;
      if (balance) {
        setCurrentBalance(parseFloat(balance.current_balance));
        setBalanceCurrencyCode(balance.currency || 'USD');
      } else if (tradingAccountId) {
        setCurrentBalance(null);
      }
    } finally {
      setBalanceLoading(false);
    }
  }, [tradingAccountId, dateFrom, dateTo, debouncedSearchQ, filterType, page, pageSize, preferences.timezone]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const totalCount = stats.total;
  const depositCount = stats.deposits_count;
  const withdrawalCount = stats.withdrawals_count;

  const netAccountFlow = useMemo(() => parseFloat(stats.net_flow || '0'), [stats.net_flow]);
  const totalDeposits = useMemo(() => parseFloat(stats.total_deposits || '0'), [stats.total_deposits]);
  const totalWithdrawals = useMemo(() => parseFloat(stats.total_withdrawals || '0'), [stats.total_withdrawals]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(listCount / Math.max(1, pageSize))),
    [listCount, pageSize],
  );
  const paginationStart0 = listCount === 0 ? 0 : (page - 1) * pageSize;
  const paginationEndInclusive = listCount === 0 ? 0 : Math.min(page * pageSize, listCount);

  const balanceSymbol = symbolForCurrencyCode(balanceCurrencyCode);

  const renderAbsoluteAmount = (value: number): string => {
    if (privacySettings.hideCurrentBalance) {
      return maskValue(null, balanceSymbol);
    }
    return formatCurrency(value, balanceSymbol, preferences.number_format, 2);
  };

  const renderNetFlowFormatted = (): string => {
    if (privacySettings.hideCurrentBalance) {
      return maskValue(null, balanceSymbol);
    }
    if (netAccountFlow > 0) return `+${formatCurrency(netAccountFlow, balanceSymbol, preferences.number_format, 2)}`;
    if (netAccountFlow < 0) return `-${formatCurrency(Math.abs(netAccountFlow), balanceSymbol, preferences.number_format, 2)}`;
    return formatCurrency(0, balanceSymbol, preferences.number_format, 2);
  };

  const handleDeleteClick = (transaction: AccountTransaction) => {
    setTransactionToDelete(transaction);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!transactionToDelete || !transactionToDelete.id) return;

    setIsDeleting(true);
    try {
      await accountTransactionsService.delete(transactionToDelete.id);
      await loadTransactions();
      if (onDelete) {
        onDelete(transactionToDelete.id);
      }
      setDeleteModalOpen(false);
      setTransactionToDelete(null);
    } catch (err: any) {
      console.error('Erreur lors de la suppression:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return (
      formatDate(date.toISOString().split('T')[0], preferences.date_format) +
      ' ' +
      date.toTimeString().slice(0, 5)
    );
  };

  const rowCurrencySymbol = tradingAccountId ? balanceSymbol : symbolForCurrencyCode(balanceCurrencyCode);

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  if (listLoading && transactions.length === 0 && listCount === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500 dark:text-gray-400">{t('common:loading', { defaultValue: 'Chargement...' })}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
              {t('common:dailyJournal.startDate', { defaultValue: 'Date début' })}
            </label>
            <DateInput
              value={dateFrom}
              onChange={setDateFrom}
              className="w-full h-10 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
              {t('common:dailyJournal.endDate', { defaultValue: 'Date fin' })}
            </label>
            <DateInput
              value={dateTo}
              onChange={setDateTo}
              className="w-full h-10 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="md:col-span-2 lg:col-span-2">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
              {t('common:search')}
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder={t('common:dailyJournal.searchPlaceholder', { defaultValue: 'Rechercher…' })}
                className="w-full h-10 px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label={t('common:search')}
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <div className="w-full flex items-end">
            <button
              type="button"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setSearchQ('');
                setDebouncedSearchQ('');
                setPage(1);
              }}
              className="w-full h-10 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
            >
              {t('common:reset')}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap flex-shrink-0 ${
              filterType === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {t('transactions:all', { defaultValue: 'Tous' })}
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                filterType === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
              }`}
            >
              {totalCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('deposit')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap flex-shrink-0 ${
              filterType === 'deposit'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {t('transactions:deposits', { defaultValue: 'Dépôts' })}
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                filterType === 'deposit'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
              }`}
            >
              {depositCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('withdrawal')}
            className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap flex-shrink-0 ${
              filterType === 'withdrawal'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {t('transactions:withdrawals', { defaultValue: 'Retraits' })}
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                filterType === 'withdrawal'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
              }`}
            >
              {withdrawalCount}
            </span>
          </button>
        </div>

        {tradingAccountId && (
          <div className="grid w-full gap-2 sm:min-w-[26rem] sm:max-w-3xl sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700/40">
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {t('transactions:currentBalance', { defaultValue: 'Solde actuel' })}
              </div>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {balanceLoading && currentBalance === null ? (
                  <span className="text-gray-500 dark:text-gray-400 font-normal">
                    {t('common:loading', { defaultValue: 'Chargement...' })}
                  </span>
                ) : currentBalance !== null ? (
                  privacySettings.hideCurrentBalance ? (
                    maskValue(null, balanceSymbol)
                  ) : (
                    formatCurrency(currentBalance, balanceSymbol, preferences.number_format, 2)
                  )
                ) : null}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {t('transactions:netAccountImpact', { defaultValue: 'Impact net sur le compte' })}
              </div>
              <div
                className={`text-sm font-semibold ${
                  netAccountFlow > 0
                    ? 'text-green-600 dark:text-green-400'
                    : netAccountFlow < 0
                      ? 'text-orange-600 dark:text-orange-400'
                      : 'text-gray-900 dark:text-gray-100'
                }`}
              >
                {renderNetFlowFormatted()}
              </div>
            </div>
            <div className="rounded-lg bg-green-50 px-3 py-2 dark:bg-green-900/20">
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {t('transactions:totalDeposited', { defaultValue: 'Total déposé' })}
              </div>
              <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                {renderAbsoluteAmount(totalDeposits)}
              </div>
            </div>
            <div className="rounded-lg bg-orange-50 px-3 py-2 dark:bg-orange-900/20">
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {t('transactions:totalWithdrawn', { defaultValue: 'Total retiré' })}
              </div>
              <div className="text-sm font-semibold text-orange-600 dark:text-orange-400">
                {renderAbsoluteAmount(totalWithdrawals)}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}

      {listCount === 0 && !listLoading ? (
        <div className="text-center p-8 text-gray-500 dark:text-gray-400">
          {t('transactions:noTransactions', { defaultValue: 'Aucune transaction trouvée' })}
        </div>
      ) : (
        <div className="flex min-w-0 flex-col space-y-4 sm:space-y-6">
          <div className="flex min-w-0 flex-col overflow-x-auto overflow-y-hidden rounded-xl border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-800">
            <div className="md:hidden space-y-3 p-3">
            {transactions.map((transaction) => {
              const amount = parseFloat(transaction.amount.toString());

              return (
                <div
                  key={transaction.id}
                  className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            transaction.transaction_type === 'deposit'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                          }`}
                        >
                          {transaction.transaction_type === 'deposit'
                            ? t('transactions:deposit', { defaultValue: 'Dépôt' })
                            : t('transactions:withdrawal', { defaultValue: 'Retrait' })}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDateTime(transaction.transaction_date)}
                        </span>
                      </div>
                      <div
                        className={`text-lg font-semibold ${
                          transaction.transaction_type === 'deposit'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-orange-600 dark:text-orange-400'
                        }`}
                      >
                        {transaction.transaction_type === 'deposit' ? '+' : '-'}
                        {formatCurrency(amount, rowCurrencySymbol, preferences.number_format, 2)}
                      </div>
                    </div>
                    {(onEdit || onDelete) && (
                      <div className="flex items-center gap-2 ml-2">
                        {onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(transaction)}
                            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                            title={t('transactions:edit', { defaultValue: 'Modifier' })}
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(transaction)}
                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title={t('transactions:delete', { defaultValue: 'Supprimer' })}
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <span className="font-medium">{t('transactions:account', { defaultValue: 'Compte' })}: </span>
                    {transaction.trading_account_name || `Compte #${transaction.trading_account}`}
                  </div>
                  {transaction.description && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">{t('transactions:description', { defaultValue: 'Description' })}: </span>
                      {transaction.description}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('transactions:date', { defaultValue: 'Date' })}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('transactions:type', { defaultValue: 'Type' })}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('transactions:account', { defaultValue: 'Compte' })}
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('transactions:amount', { defaultValue: 'Montant' })}
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('transactions:description', { defaultValue: 'Description' })}
                  </th>
                  {(onEdit || onDelete) && (
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('transactions:actions', { defaultValue: 'Actions' })}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => {
                  const amount = parseFloat(transaction.amount.toString());

                  return (
                    <tr
                      key={transaction.id}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="py-3 px-4 text-sm text-gray-900 dark:text-gray-100">
                        {formatDateTime(transaction.transaction_date)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            transaction.transaction_type === 'deposit'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                          }`}
                        >
                          {transaction.transaction_type === 'deposit'
                            ? t('transactions:deposit', { defaultValue: 'Dépôt' })
                            : t('transactions:withdrawal', { defaultValue: 'Retrait' })}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                        {transaction.trading_account_name || `Compte #${transaction.trading_account}`}
                      </td>
                      <td
                        className={`py-3 px-4 text-sm text-right font-medium ${
                          transaction.transaction_type === 'deposit'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-orange-600 dark:text-orange-400'
                        }`}
                      >
                        {transaction.transaction_type === 'deposit' ? '+' : '-'}
                        {formatCurrency(amount, rowCurrencySymbol, preferences.number_format, 2)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                        {transaction.description || '-'}
                      </td>
                      {(onEdit || onDelete) && (
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            {onEdit && (
                              <button
                                type="button"
                                onClick={() => onEdit(transaction)}
                                className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                title={t('transactions:edit', { defaultValue: 'Modifier' })}
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                              </button>
                            )}
                            {onDelete && (
                              <button
                                type="button"
                                onClick={() => handleDeleteClick(transaction)}
                                className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                title={t('transactions:delete', { defaultValue: 'Supprimer' })}
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-800">
            <PaginationControls
              currentPage={page}
              totalPages={totalPages}
              totalItems={listCount}
              itemsPerPage={pageSize}
              startIndex={paginationStart0}
              endIndex={paginationEndInclusive}
              onPageChange={(p) => {
                setPage(p);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onPageSizeChange={handlePageSizeChange}
              pageSizeOptions={[...LEDGER_PAGE_SIZE_OPTIONS]}
              className="border-t-0"
            />
          </div>
        </div>
      )}

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setTransactionToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title={t('transactions:deleteConfirmTitle', { defaultValue: 'Supprimer la transaction' })}
        message={t('transactions:deleteConfirmMessage', {
          defaultValue: 'Êtes-vous sûr de vouloir supprimer cette transaction ? Cette action est irréversible.',
        })}
        isLoading={isDeleting}
        confirmButtonText={t('transactions:delete', { defaultValue: 'Supprimer' })}
      />
    </div>
  );
};
