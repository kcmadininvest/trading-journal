import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast/headless';
import { PageShell } from '../components/layout';
import { DeleteConfirmModal, Tooltip } from '../components/ui';
import { useColonBeforeValue } from '../hooks/useColonBeforeValue';
import { usePreferences } from '../hooks/usePreferences';
import {
  tradingActivityService,
  CurrencySummaryBlock,
  ExpenseCategory,
  TradingActivityExpense,
  TradingActivityCredit,
  TradingActivitySummary,
  WithdrawalSuggestion,
} from '../services/tradingActivity';
import { normalizeDecimalForApi, parseUserDecimal } from '../utils/normalizeDecimalForApi';
import { formatDate, formatDateTimeShort, type DateFormatType } from '../utils/dateFormat';
import { formatNumber, type NumberFormatType } from '../utils/numberFormat';

/** Même principe que PageSizeSelector : pas de flèche native du navigateur sur les <select>. */
const MODAL_SELECT_CLASS =
  'w-full cursor-pointer appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-10 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100';

function ModalSelectChevron(): React.ReactElement {
  return (
    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3" aria-hidden>
      <svg
        className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </span>
  );
}

const MODAL_DATE_INPUT_CLASS =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 [color-scheme:light] dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70';

type TradingActivityT = (key: string) => string;

function TradingActivityLedgerActions({
  editLabel,
  deleteLabel,
  onEdit,
  onRequestDelete,
  compact,
}: {
  editLabel: string;
  deleteLabel: string;
  onEdit: () => void;
  onRequestDelete: () => void;
  compact: boolean;
}) {
  const pad = compact ? 'p-1.5' : 'p-2';
  const icon = compact ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <div className={`inline-flex items-center ${compact ? 'justify-end gap-2' : 'justify-end gap-3'}`}>
      <Tooltip content={editLabel} position="top">
        <button
          type="button"
          onClick={onEdit}
          aria-label={editLabel}
          className={`${pad} rounded-lg text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-blue-400 dark:hover:bg-blue-900/30 dark:hover:text-blue-300`}
        >
          <svg className={icon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </button>
      </Tooltip>
      <Tooltip content={deleteLabel} position="top">
        <button
          type="button"
          onClick={onRequestDelete}
          aria-label={deleteLabel}
          className={`${pad} rounded-lg text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-500 dark:text-rose-400 dark:hover:bg-rose-900/30 dark:hover:text-rose-300`}
        >
          <svg className={icon} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0a1 1 0 001-1V5a1 1 0 011-1h4a1 1 0 011 1v1a1 1 0 001 1m-7 0h8"
            />
          </svg>
        </button>
      </Tooltip>
    </div>
  );
}

function MobileCurrencySummaryCard({
  code,
  block,
  t,
  numberFormat,
  summaryVariant = 'primary',
}: {
  code: string;
  block: CurrencySummaryBlock;
  t: TradingActivityT;
  numberFormat: NumberFormatType;
  summaryVariant?: 'primary' | 'secondary';
}) {
  const bal = parseFloat(String(block.balance));
  const balanceTone =
    bal >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-pink-600 dark:text-pink-400';
  const headingId = `summary-mobile-${summaryVariant}-${code}`;
  return (
    <article
      className="flex w-full flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 xl:hidden"
      aria-labelledby={headingId}
    >
      <h3 id={headingId} className="text-base font-bold tracking-wide text-gray-900 dark:text-gray-100">
        {code}
      </h3>
      <dl className="grid gap-2 text-sm">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2 dark:border-gray-700/80">
          <dt className="text-gray-500 dark:text-gray-400">{t('summary.credits')}</dt>
          <dd className="tabular-nums font-semibold text-gray-900 dark:text-gray-100">
            {formatNumber(block.credits, 2, numberFormat)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2 dark:border-gray-700/80">
          <dt className="text-gray-500 dark:text-gray-400">{t('summary.expenses')}</dt>
          <dd className="tabular-nums font-semibold text-gray-900 dark:text-gray-100">
            {formatNumber(block.expenses, 2, numberFormat)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 pt-0.5">
          <dt className="font-medium text-gray-700 dark:text-gray-300">{t('summary.balance')}</dt>
          <dd className={`tabular-nums text-base font-bold ${balanceTone}`}>
            {formatNumber(block.balance, 2, numberFormat)}
          </dd>
        </div>
      </dl>
    </article>
  );
}

function DesktopCurrencySummaryStrip({
  code,
  block,
  colonFr,
  t,
  numberFormat,
}: {
  code: string;
  block: CurrencySummaryBlock;
  colonFr: string;
  t: TradingActivityT;
  numberFormat: NumberFormatType;
}) {
  const bal = parseFloat(String(block.balance));
  const balanceTone =
    bal >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-pink-600 dark:text-pink-400';
  return (
    <div
      className="hidden w-full max-w-full flex flex-wrap items-baseline gap-x-4 gap-y-2 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:px-5 sm:py-3.5 xl:flex"
      aria-label={code}
    >
      <span className="shrink-0 text-base font-semibold tracking-wide text-gray-700 dark:text-gray-200">{code}</span>
      <span className="shrink-0 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
        {`${t('summary.credits')}${colonFr} `}
        <span className="font-semibold text-gray-900 dark:text-gray-100">
          {formatNumber(block.credits, 2, numberFormat)}
        </span>
      </span>
      <span className="shrink-0 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
        {`${t('summary.expenses')}${colonFr} `}
        <span className="font-semibold text-gray-900 dark:text-gray-100">
          {formatNumber(block.expenses, 2, numberFormat)}
        </span>
      </span>
      <span className={`shrink-0 whitespace-nowrap text-base font-bold ${balanceTone}`}>
        {`${t('summary.balance')}${colonFr} `}
        {formatNumber(block.balance, 2, numberFormat)}
      </span>
    </div>
  );
}

function MobileExpenseCard({
  row,
  t,
  numberFormat,
  dateFormat,
  timezone,
  onEdit,
  onDelete,
}: {
  row: TradingActivityExpense;
  t: TradingActivityT;
  numberFormat: NumberFormatType;
  dateFormat: DateFormatType;
  timezone?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const dateLabel = formatDate(row.date, dateFormat, false, timezone);
  return (
    <article className="touch-pan-y rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 pb-3 dark:border-gray-700/80">
        <time className="text-sm font-semibold text-gray-900 dark:text-gray-100" dateTime={row.date}>
          {dateLabel}
        </time>
        <span className="max-w-[65%] truncate rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
          {row.category_name || '—'}
        </span>
      </div>
      {row.label ? (
        <p className="mt-2 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">{row.label}</p>
      ) : null}
      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-2 sm:col-span-2">
          <dt className="text-gray-500 dark:text-gray-400">{t('table.subtotal')}</dt>
          <dd className="tabular-nums text-right font-medium text-gray-900 dark:text-gray-100">
            {formatNumber(row.subtotal, 2, numberFormat)} {row.primary_currency}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-gray-500 dark:text-gray-400">{t('table.vat')}</dt>
          <dd className="tabular-nums text-right text-gray-900 dark:text-gray-100">
            {formatNumber(row.vat_amount, 2, numberFormat)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-gray-500 dark:text-gray-400">{t('table.total')}</dt>
          <dd className="tabular-nums text-right font-semibold text-gray-900 dark:text-gray-100">
            {formatNumber(row.total, 2, numberFormat)} {row.primary_currency}
          </dd>
        </div>
        <div className="flex justify-between gap-2 sm:col-span-2">
          <dt className="text-gray-500 dark:text-gray-400">{t('table.ref')}</dt>
          <dd className="max-w-[60%] truncate text-right text-gray-900 dark:text-gray-100">
            {row.invoice_reference || '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-2 sm:col-span-2">
          <dt className="text-gray-500 dark:text-gray-400">{t('table.secondary')}</dt>
          <dd className="tabular-nums text-right text-gray-900 dark:text-gray-100">
            {row.secondary_amount
              ? `${formatNumber(row.secondary_amount, 2, numberFormat)} ${row.secondary_currency}`
              : '—'}
          </dd>
        </div>
      </dl>
      <div
        className="mt-4 flex w-full flex-row justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-600"
        onClick={(e) => e.stopPropagation()}
      >
        <TradingActivityLedgerActions
          editLabel={t('actions.edit')}
          deleteLabel={t('actions.delete')}
          onEdit={onEdit}
          onRequestDelete={onDelete}
          compact={false}
        />
      </div>
    </article>
  );
}

function MobileCreditCard({
  row,
  t,
  numberFormat,
  dateFormat,
  timezone,
  onEdit,
  onDelete,
}: {
  row: TradingActivityCredit;
  t: TradingActivityT;
  numberFormat: NumberFormatType;
  dateFormat: DateFormatType;
  timezone?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const dateLabel = formatDate(row.date, dateFormat, false, timezone);
  const linkLabel = row.linked_account_transaction_detail
    ? `#${row.linked_account_transaction_detail.id} ${row.linked_account_transaction_detail.trading_account_name}`
    : '—';
  return (
    <article className="touch-pan-y rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3 dark:border-gray-700/80">
        <time className="text-sm font-semibold text-gray-900 dark:text-gray-100" dateTime={row.date}>
          {dateLabel}
        </time>
        <span className="tabular-nums text-base font-bold text-gray-900 dark:text-gray-100">
          {formatNumber(row.amount, 2, numberFormat)} {row.primary_currency}
        </span>
      </div>
      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-gray-500 dark:text-gray-400">{t('table.secondary')}</dt>
          <dd className="mt-0.5 tabular-nums text-gray-900 dark:text-gray-100">
            {row.secondary_amount
              ? `${formatNumber(row.secondary_amount, 2, numberFormat)} ${row.secondary_currency}`
              : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500 dark:text-gray-400">{t('credits.linkedWithdrawal')}</dt>
          <dd className="mt-0.5 break-words text-xs text-gray-800 dark:text-gray-200">{linkLabel}</dd>
        </div>
      </dl>
      <div
        className="mt-4 flex w-full flex-row justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-600"
        onClick={(e) => e.stopPropagation()}
      >
        <TradingActivityLedgerActions
          editLabel={t('actions.edit')}
          deleteLabel={t('actions.delete')}
          onEdit={onEdit}
          onRequestDelete={onDelete}
          compact={false}
        />
      </div>
    </article>
  );
}

const TradingActivityPage: React.FC = () => {
  const { t } = useI18nTranslation('trading_activity');
  const { t: tCommon } = useI18nTranslation('common');
  const { preferences } = usePreferences();
  const colonFr = useColonBeforeValue();
  const defaultCurrency = preferences.default_currency || 'USD';
  const numberFormat: NumberFormatType = preferences.number_format || 'comma';
  const dateFormatPref: DateFormatType = preferences.date_format ?? 'EU';
  const timezonePref = preferences.timezone;

  const [summary, setSummary] = useState<TradingActivitySummary | null>(null);
  const [expenses, setExpenses] = useState<TradingActivityExpense[]>([]);
  const [credits, setCredits] = useState<TradingActivityCredit[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [currencies, setCurrencies] = useState<string[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  const [expenseModal, setExpenseModal] = useState(false);
  const [creditModal, setCreditModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<TradingActivityExpense | null>(null);
  const [editingCredit, setEditingCredit] = useState<TradingActivityCredit | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [ledgerTab, setLedgerTab] = useState<'debit' | 'credit'>('debit');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'expense' | 'credit'; id: number } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const refreshWithdrawalSuggestions = useCallback(async () => {
    try {
      const wd = await tradingActivityService.listWithdrawalSuggestions(
        creditModal && editingCredit?.id != null ? { editingCreditId: editingCredit.id } : undefined,
      );
      setWithdrawals(Array.isArray(wd?.withdrawals) ? wd.withdrawals : []);
    } catch (e) {
      console.warn('[trading-activity] retraits:', e);
    }
  }, [creditModal, editingCredit?.id]);

  const withdrawalSelectOptions = useMemo(() => {
    const byId = new Map<number, WithdrawalSuggestion>();
    for (const w of withdrawals) {
      byId.set(w.id, w);
    }
    if (editingCredit?.linked_account_transaction != null && editingCredit.linked_account_transaction_detail) {
      const lid = editingCredit.linked_account_transaction;
      const d = editingCredit.linked_account_transaction_detail;
      if (!byId.has(lid)) {
        byId.set(lid, {
          id: lid,
          amount: d.amount,
          transaction_date: d.transaction_date,
          trading_account_id: d.trading_account_id,
          trading_account_name: d.trading_account_name,
          currency: d.currency,
        });
      }
    }
    return Array.from(byId.values()).sort(
      (a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime(),
    );
  }, [withdrawals, editingCredit]);

  const [expForm, setExpForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    primary_currency: defaultCurrency,
    subtotal: '',
    vat_amount: '',
    total: '',
    invoice_reference: '',
    category: '' as string,
    label: '',
    notes: '',
    secondary_amount: '',
    secondary_currency: '',
  });

  const [credForm, setCredForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    primary_currency: defaultCurrency,
    amount: '',
    notes: '',
    secondary_amount: '',
    secondary_currency: '',
    linked_account_transaction: '' as string,
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sum, ex, cr, cat, cur] = await Promise.all([
        tradingActivityService.getSummary(),
        tradingActivityService.listExpenses(),
        tradingActivityService.listCredits(),
        tradingActivityService.listCategories(),
        tradingActivityService.listCurrencies(),
      ]);
      setSummary(sum);
      setExpenses(ex);
      setCredits(cr);
      setCategories(cat);
      setCurrencies(cur.currencies);
      await refreshWithdrawalSuggestions();
    } catch (e: any) {
      toast.error(e?.message || t('errors.load'));
    } finally {
      setLoading(false);
    }
  }, [t, refreshWithdrawalSuggestions]);

  useEffect(() => {
    if (creditModal) {
      void refreshWithdrawalSuggestions();
    }
  }, [creditModal, editingCredit?.id, refreshWithdrawalSuggestions]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    setExpForm((f) => ({ ...f, primary_currency: f.primary_currency || defaultCurrency }));
    setCredForm((f) => ({ ...f, primary_currency: f.primary_currency || defaultCurrency }));
  }, [defaultCurrency]);

  const openNewExpense = () => {
    setEditingExpense(null);
    const st = '';
    setExpForm({
      date: new Date().toISOString().slice(0, 10),
      primary_currency: defaultCurrency,
      subtotal: st,
      vat_amount: '',
      total: '',
      invoice_reference: '',
      category: '',
      label: '',
      notes: '',
      secondary_amount: '',
      secondary_currency: '',
    });
    setNewCategoryName('');
    setExpenseModal(true);
  };

  const openEditExpense = (row: TradingActivityExpense) => {
    setEditingExpense(row);
    setExpForm({
      date: row.date,
      primary_currency: row.primary_currency,
      subtotal: formatNumber(row.subtotal, 2, numberFormat),
      vat_amount: formatNumber(row.vat_amount, 2, numberFormat),
      total: formatNumber(row.total, 2, numberFormat),
      invoice_reference: row.invoice_reference || '',
      category: row.category != null ? String(row.category) : '',
      label: row.label || '',
      notes: row.notes || '',
      secondary_amount:
        row.secondary_amount != null && String(row.secondary_amount).trim() !== ''
          ? formatNumber(row.secondary_amount, 2, numberFormat)
          : '',
      secondary_currency: row.secondary_currency || '',
    });
    setNewCategoryName('');
    setExpenseModal(true);
  };

  const applyVatFromSubtotal = (subtotalStr: string) => {
    const st = parseUserDecimal(subtotalStr, numberFormat);
    const vat = Math.round(st * 0.2 * 100) / 100;
    const tot = Math.round((st + vat) * 100) / 100;
    return { vat: formatNumber(vat, 2, numberFormat), total: formatNumber(tot, 2, numberFormat) };
  };

  const onExpenseSubtotalChange = (v: string) => {
    const { vat, total } = applyVatFromSubtotal(v);
    setExpForm((f) => ({ ...f, subtotal: v, vat_amount: vat, total }));
  };

  const openNewCredit = () => {
    setEditingCredit(null);
    setCredForm({
      date: new Date().toISOString().slice(0, 10),
      primary_currency: defaultCurrency,
      amount: '',
      notes: '',
      secondary_amount: '',
      secondary_currency: '',
      linked_account_transaction: '',
    });
    setCreditModal(true);
  };

  const openEditCredit = (row: TradingActivityCredit) => {
    setEditingCredit(row);
    setCredForm({
      date: row.date,
      primary_currency: row.primary_currency,
      amount: formatNumber(row.amount, 2, numberFormat),
      notes: row.notes || '',
      secondary_amount:
        row.secondary_amount != null && String(row.secondary_amount).trim() !== ''
          ? formatNumber(row.secondary_amount, 2, numberFormat)
          : '',
      secondary_currency: row.secondary_currency || '',
      linked_account_transaction:
        row.linked_account_transaction != null ? String(row.linked_account_transaction) : '',
    });
    setCreditModal(true);
  };

  const pickWithdrawal = (idStr: string) => {
    const w = withdrawalSelectOptions.find((x) => String(x.id) === idStr);
    if (!w) {
      setCredForm((f) => ({ ...f, linked_account_transaction: idStr }));
      return;
    }
    setCredForm((f) => ({
      ...f,
      linked_account_transaction: idStr,
      amount: formatNumber(w.amount, 2, numberFormat),
      primary_currency: w.currency.toUpperCase(),
    }));
  };

  const saveExpense = async () => {
    try {
      const subtotalApi = normalizeDecimalForApi(expForm.subtotal, numberFormat);
      const vatApi = normalizeDecimalForApi(expForm.vat_amount, numberFormat);
      const totalApi = normalizeDecimalForApi(expForm.total, numberFormat);
      const secRaw = expForm.secondary_amount.trim();
      const secondaryApi = secRaw ? normalizeDecimalForApi(secRaw, numberFormat) : '';
      const payload: Record<string, unknown> = {
        date: expForm.date,
        primary_currency: expForm.primary_currency,
        subtotal: subtotalApi,
        vat_amount: vatApi,
        total: totalApi,
        invoice_reference: expForm.invoice_reference || '',
        label: expForm.label || '',
        notes: expForm.notes || '',
        category: expForm.category ? Number(expForm.category) : null,
        secondary_amount: secondaryApi ? secondaryApi : null,
        secondary_currency: expForm.secondary_currency || '',
      };
      if (editingExpense) {
        await tradingActivityService.updateExpense(editingExpense.id, payload);
        toast.success(t('toast.expenseUpdated'));
      } else {
        await tradingActivityService.createExpense(payload);
        toast.success(t('toast.expenseCreated'));
      }
      setExpenseModal(false);
      await loadAll();
    } catch (e: any) {
      toast.error(e?.message || t('errors.save'));
    }
  };

  const saveCredit = async () => {
    try {
      const amountApi = normalizeDecimalForApi(credForm.amount, numberFormat);
      const secCredRaw = credForm.secondary_amount.trim();
      const secondaryCredApi = secCredRaw ? normalizeDecimalForApi(secCredRaw, numberFormat) : '';
      const payload: Record<string, unknown> = {
        date: credForm.date,
        primary_currency: credForm.primary_currency,
        amount: amountApi,
        notes: credForm.notes || '',
        secondary_amount: secondaryCredApi ? secondaryCredApi : null,
        secondary_currency: credForm.secondary_currency || '',
        linked_account_transaction: credForm.linked_account_transaction
          ? Number(credForm.linked_account_transaction)
          : null,
      };
      if (editingCredit) {
        await tradingActivityService.updateCredit(editingCredit.id, payload);
        toast.success(t('toast.creditUpdated'));
      } else {
        await tradingActivityService.createCredit(payload);
        toast.success(t('toast.creditCreated'));
      }
      setCreditModal(false);
      await loadAll();
    } catch (e: any) {
      toast.error(e?.message || t('errors.save'));
    }
  };

  const requestDeleteExpense = (id: number) => {
    setDeleteTarget({ kind: 'expense', id });
    setDeleteModalOpen(true);
  };

  const requestDeleteCredit = (id: number) => {
    setDeleteTarget({ kind: 'credit', id });
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (deleteLoading) return;
    setDeleteModalOpen(false);
    setDeleteTarget(null);
  };

  const confirmDeleteLedgerRow = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      if (deleteTarget.kind === 'expense') {
        await tradingActivityService.deleteExpense(deleteTarget.id);
      } else {
        await tradingActivityService.deleteCredit(deleteTarget.id);
      }
      toast.success(t('toast.deleted'));
      setDeleteModalOpen(false);
      setDeleteTarget(null);
      await loadAll();
    } catch (e: any) {
      toast.error(e?.message || t('errors.save'));
    } finally {
      setDeleteLoading(false);
    }
  };

  const createInlineCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    try {
      const c = await tradingActivityService.createCategory({ name });
      setCategories((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)));
      setExpForm((f) => ({ ...f, category: String(c.id) }));
      setNewCategoryName('');
      toast.success(t('toast.categoryCreated'));
    } catch (e: any) {
      toast.error(e?.message || t('errors.save'));
    }
  };

  const primaryCards = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.primary_by_currency).sort(([a], [b]) => a.localeCompare(b));
  }, [summary]);

  const secondaryCards = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.secondary_by_currency).sort(([a], [b]) => a.localeCompare(b));
  }, [summary]);

  return (
    <PageShell variant="fluid">
      <div className="w-full space-y-6 py-4 sm:space-y-8 sm:py-6">
        <div className="max-w-3xl">
          <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-2xl">{t('title')}</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{t('subtitle')}</p>
        </div>

        <div
          className={
            secondaryCards.length > 0
              ? 'grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start xl:gap-8'
              : 'grid grid-cols-1 gap-6'
          }
        >
          {/* Soldes devise principale */}
          <section className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">{t('summary.primaryTitle')}</h2>
            {loading && !summary ? (
              <p className="text-gray-500">{t('loading')}</p>
            ) : (
              <div className="flex w-full max-w-full flex-col items-stretch gap-3 sm:gap-4">
                {primaryCards.map(([code, block]) => (
                  <React.Fragment key={code}>
                    <MobileCurrencySummaryCard
                      code={code}
                      block={block}
                      t={t}
                      numberFormat={numberFormat}
                      summaryVariant="primary"
                    />
                    <DesktopCurrencySummaryStrip
                      code={code}
                      block={block}
                      colonFr={colonFr}
                      t={t}
                      numberFormat={numberFormat}
                    />
                  </React.Fragment>
                ))}
                {primaryCards.length === 0 && (
                  <p className="text-gray-500 text-sm">{t('summary.empty')}</p>
                )}
              </div>
            )}
          </section>

          {secondaryCards.length > 0 && (
            <section className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">{t('summary.secondaryTitle')}</h2>
              <div className="flex w-full max-w-full flex-col items-stretch gap-3 sm:gap-4">
                {secondaryCards.map(([code, block]) => (
                  <React.Fragment key={code}>
                    <MobileCurrencySummaryCard
                      code={code}
                      block={block}
                      t={t}
                      numberFormat={numberFormat}
                      summaryVariant="secondary"
                    />
                    <DesktopCurrencySummaryStrip
                      code={code}
                      block={block}
                      colonFr={colonFr}
                      t={t}
                      numberFormat={numberFormat}
                    />
                  </React.Fragment>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-800">
          <div
            className="flex w-full shrink-0 gap-1 border-b border-gray-200 px-1 pt-1 dark:border-gray-700 sm:px-3 sm:pt-2"
            role="tablist"
            aria-label={t('tabs.ariaLabel')}
          >
            <button
              type="button"
              role="tab"
              id="trading-ledger-tab-debit"
              aria-selected={ledgerTab === 'debit'}
              aria-controls="trading-ledger-panel-debit"
              tabIndex={ledgerTab === 'debit' ? 0 : -1}
              onClick={() => setLedgerTab('debit')}
              className={`min-h-[44px] flex-1 rounded-t-lg px-3 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 sm:min-h-0 sm:flex-none sm:px-4 ${
                ledgerTab === 'debit'
                  ? 'border-b-2 border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400'
                  : 'border-b-2 border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {t('tabs.debit')}
            </button>
            <button
              type="button"
              role="tab"
              id="trading-ledger-tab-credit"
              aria-selected={ledgerTab === 'credit'}
              aria-controls="trading-ledger-panel-credit"
              tabIndex={ledgerTab === 'credit' ? 0 : -1}
              onClick={() => setLedgerTab('credit')}
              className={`min-h-[44px] flex-1 rounded-t-lg px-3 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 sm:min-h-0 sm:flex-none sm:px-4 ${
                ledgerTab === 'credit'
                  ? 'border-b-2 border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400'
                  : 'border-b-2 border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {t('tabs.credit')}
            </button>
          </div>

          {ledgerTab === 'debit' && (
            <section
              id="trading-ledger-panel-debit"
              role="tabpanel"
              aria-labelledby="trading-ledger-tab-debit"
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
            >
              <div className="flex shrink-0 flex-col gap-3 border-b border-gray-200 px-3 py-3 dark:border-gray-700 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 sm:text-lg">{t('expenses.title')}</h2>
                <button
                  type="button"
                  onClick={openNewExpense}
                  className="min-h-[44px] w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 sm:min-h-0 sm:w-auto sm:py-2"
                >
                  {t('expenses.add')}
                </button>
              </div>
              {expenses.length === 0 && !loading ? (
                <p className="p-4 text-sm text-gray-500">{t('expenses.empty')}</p>
              ) : (
                <>
                  <div
                    className="touch-pan-y space-y-3 p-3 pb-8 xl:hidden"
                    role="list"
                    aria-label={t('expenses.title')}
                  >
                    {expenses.map((row) => (
                      <div key={row.id} role="listitem">
                        <MobileExpenseCard
                          row={row}
                          t={t}
                          numberFormat={numberFormat}
                          dateFormat={dateFormatPref}
                          timezone={timezonePref}
                          onEdit={() => openEditExpense(row)}
                          onDelete={() => requestDeleteExpense(row.id)}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="hidden min-h-0 min-w-0 flex-1 flex-col overflow-hidden xl:flex">
                    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-y-contain">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-left text-gray-600 dark:bg-gray-900/50 dark:text-gray-300">
                          <tr>
                            <th className="px-3 py-2">{t('table.date')}</th>
                            <th className="px-3 py-2">{t('table.category')}</th>
                            <th className="px-3 py-2">{t('table.label')}</th>
                            <th className="px-3 py-2">{t('table.subtotal')}</th>
                            <th className="px-3 py-2">{t('table.vat')}</th>
                            <th className="px-3 py-2">{t('table.total')}</th>
                            <th className="px-3 py-2">{t('table.ref')}</th>
                            <th className="px-3 py-2">{t('table.secondary')}</th>
                            <th className="w-28 px-3 py-2" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {expenses.map((row) => (
                            <tr key={row.id} className="text-gray-800 dark:text-gray-200">
                              <td className="whitespace-nowrap px-3 py-2">
                                {formatDate(row.date, dateFormatPref, false, timezonePref)}
                              </td>
                              <td className="px-3 py-2">{row.category_name || '—'}</td>
                              <td className="max-w-[140px] truncate px-3 py-2">{row.label || '—'}</td>
                              <td className="px-3 py-2">
                                {formatNumber(row.subtotal, 2, numberFormat)} {row.primary_currency}
                              </td>
                              <td className="px-3 py-2">{formatNumber(row.vat_amount, 2, numberFormat)}</td>
                              <td className="px-3 py-2 font-medium">
                                {formatNumber(row.total, 2, numberFormat)} {row.primary_currency}
                              </td>
                              <td className="px-3 py-2">{row.invoice_reference || '—'}</td>
                              <td className="px-3 py-2">
                                {row.secondary_amount
                                  ? `${formatNumber(row.secondary_amount, 2, numberFormat)} ${row.secondary_currency}`
                                  : '—'}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-right">
                                <TradingActivityLedgerActions
                                  editLabel={t('actions.edit')}
                                  deleteLabel={t('actions.delete')}
                                  onEdit={() => openEditExpense(row)}
                                  onRequestDelete={() => requestDeleteExpense(row.id)}
                                  compact
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          {ledgerTab === 'credit' && (
            <section
              id="trading-ledger-panel-credit"
              role="tabpanel"
              aria-labelledby="trading-ledger-tab-credit"
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
            >
              <div className="flex shrink-0 flex-col gap-3 border-b border-gray-200 px-3 py-3 dark:border-gray-700 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 sm:text-lg">{t('credits.title')}</h2>
                <button
                  type="button"
                  onClick={openNewCredit}
                  className="min-h-[44px] w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 sm:min-h-0 sm:w-auto sm:py-2"
                >
                  {t('credits.add')}
                </button>
              </div>
              {credits.length === 0 && !loading ? (
                <p className="p-4 text-sm text-gray-500">{t('credits.empty')}</p>
              ) : (
                <>
                  <div
                    className="touch-pan-y space-y-3 p-3 pb-8 xl:hidden"
                    role="list"
                    aria-label={t('credits.title')}
                  >
                    {credits.map((row) => (
                      <div key={row.id} role="listitem">
                        <MobileCreditCard
                          row={row}
                          t={t}
                          numberFormat={numberFormat}
                          dateFormat={dateFormatPref}
                          timezone={timezonePref}
                          onEdit={() => openEditCredit(row)}
                          onDelete={() => requestDeleteCredit(row.id)}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="hidden min-h-0 min-w-0 flex-1 flex-col overflow-hidden xl:flex">
                    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-y-contain">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50 text-left text-gray-600 dark:bg-gray-900/50 dark:text-gray-300">
                          <tr>
                            <th className="px-3 py-2">{t('table.date')}</th>
                            <th className="px-3 py-2">{t('table.amount')}</th>
                            <th className="px-3 py-2">{t('table.secondary')}</th>
                            <th className="px-3 py-2">{t('credits.linkedWithdrawal')}</th>
                            <th className="w-28 px-3 py-2" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {credits.map((row) => (
                            <tr key={row.id} className="text-gray-800 dark:text-gray-200">
                              <td className="whitespace-nowrap px-3 py-2">
                                {formatDate(row.date, dateFormatPref, false, timezonePref)}
                              </td>
                              <td className="px-3 py-2 font-medium">
                                {formatNumber(row.amount, 2, numberFormat)} {row.primary_currency}
                              </td>
                              <td className="px-3 py-2">
                                {row.secondary_amount
                                  ? `${formatNumber(row.secondary_amount, 2, numberFormat)} ${row.secondary_currency}`
                                  : '—'}
                              </td>
                              <td className="px-3 py-2 text-xs">
                                {row.linked_account_transaction_detail
                                  ? `#${row.linked_account_transaction_detail.id} ${row.linked_account_transaction_detail.trading_account_name}`
                                  : '—'}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-right">
                                <TradingActivityLedgerActions
                                  editLabel={t('actions.edit')}
                                  deleteLabel={t('actions.delete')}
                                  onEdit={() => openEditCredit(row)}
                                  onRequestDelete={() => requestDeleteCredit(row.id)}
                                  compact
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      </div>

      {/* Modal dépense — alignée sur TransactionFormModal / CreateTradeModal */}
      {expenseModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] backdrop-blur-sm dark:bg-black/70 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !loading) setExpenseModal(false);
          }}
        >
          <div
            className="flex max-h-[min(92dvh,100vh-1rem)] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-2xl dark:bg-gray-800 sm:max-h-[90vh] sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-shrink-0 items-start justify-between gap-3 rounded-t-2xl border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-3 dark:border-gray-700 dark:from-blue-900/20 dark:to-indigo-900/20 sm:items-center sm:rounded-t-xl sm:px-6 sm:py-5">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-orange-600 dark:bg-orange-500">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
                    {editingExpense ? t('expenses.edit') : t('expenses.add')}
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                    {editingExpense ? t('expenses.modalEditDesc') : t('expenses.modalNewDesc')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={() => setExpenseModal(false)}
                className="w-8 h-8 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-colors disabled:opacity-50 flex-shrink-0"
                aria-label={t('actions.closeModal')}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('form.date')}</label>
                  <input
                    type="date"
                    className={MODAL_DATE_INPUT_CLASS}
                    value={expForm.date}
                    onChange={(e) => setExpForm({ ...expForm, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('form.primaryCurrency')}</label>
                  <div className="relative">
                    <select
                      className={MODAL_SELECT_CLASS}
                      value={expForm.primary_currency}
                      onChange={(e) => setExpForm({ ...expForm, primary_currency: e.target.value })}
                    >
                      {currencies.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <ModalSelectChevron />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('form.subtotal')}</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    value={expForm.subtotal}
                    onChange={(e) => onExpenseSubtotalChange(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('form.vat')}</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    value={expForm.vat_amount}
                    onChange={(e) => {
                      const vat = e.target.value;
                      const st = parseUserDecimal(expForm.subtotal, numberFormat);
                      const v = parseUserDecimal(vat, numberFormat);
                      setExpForm({
                        ...expForm,
                        vat_amount: vat,
                        total: formatNumber(st + v, 2, numberFormat),
                      });
                    }}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('form.total')}</label>
                  <input
                    type="text"
                    readOnly
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800/80 text-gray-900 dark:text-gray-100"
                    value={expForm.total}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('form.ref')}</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    value={expForm.invoice_reference}
                    onChange={(e) => setExpForm({ ...expForm, invoice_reference: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('form.category')}</label>
                  <div className="relative">
                    <select
                      className={MODAL_SELECT_CLASS}
                      value={expForm.category}
                      onChange={(e) => setExpForm({ ...expForm, category: e.target.value })}
                    >
                      <option value="">{t('form.categoryNone')}</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <ModalSelectChevron />
                  </div>
                </div>
                <div className="sm:col-span-2 flex flex-col sm:flex-row gap-2 sm:items-end">
                  <input
                    type="text"
                    aria-label={t('form.newCategoryPlaceholder')}
                    placeholder={t('form.newCategoryPlaceholder')}
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={createInlineCategory}
                    className="px-3 sm:px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shrink-0"
                  >
                    {t('form.newCategory')}
                  </button>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('form.label')}</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    value={expForm.label}
                    onChange={(e) => setExpForm({ ...expForm, label: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('form.secondaryAmount')}</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    value={expForm.secondary_amount}
                    onChange={(e) => setExpForm({ ...expForm, secondary_amount: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('form.secondaryCurrency')}</label>
                  <div className="relative">
                    <select
                      className={MODAL_SELECT_CLASS}
                      value={expForm.secondary_currency}
                      onChange={(e) => setExpForm({ ...expForm, secondary_currency: e.target.value })}
                    >
                      <option value="">{t('form.none')}</option>
                      {currencies.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <ModalSelectChevron />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('form.notes')}</label>
                  <textarea
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
                    value={expForm.notes}
                    onChange={(e) => setExpForm({ ...expForm, notes: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-shrink-0 flex-col gap-2 rounded-b-2xl border-t border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-900/50 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:rounded-b-xl sm:px-6 sm:py-4">
              <button
                type="button"
                disabled={loading}
                onClick={() => setExpenseModal(false)}
                className="px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors w-full sm:w-auto"
              >
                {t('actions.cancel')}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={saveExpense}
                className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors w-full sm:w-auto"
              >
                {t('actions.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crédit — alignée sur TransactionFormModal / CreateTradeModal */}
      {creditModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] backdrop-blur-sm dark:bg-black/70 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !loading) setCreditModal(false);
          }}
        >
          <div
            className="flex max-h-[min(92dvh,100vh-1rem)] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl dark:bg-gray-800 sm:max-h-[90vh] sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-shrink-0 items-start justify-between gap-3 rounded-t-2xl border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-3 dark:border-gray-700 dark:from-blue-900/20 dark:to-indigo-900/20 sm:items-center sm:rounded-t-xl sm:px-6 sm:py-5">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-green-600 dark:bg-green-500">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
                    {editingCredit ? t('credits.edit') : t('credits.add')}
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                    {editingCredit ? t('credits.modalEditDesc') : t('credits.modalNewDesc')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={() => setCreditModal(false)}
                className="w-8 h-8 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-colors disabled:opacity-50 flex-shrink-0"
                aria-label={t('actions.closeModal')}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('credits.linkWithdrawal')}</label>
                <div className="relative">
                  <select
                    className={MODAL_SELECT_CLASS}
                    value={credForm.linked_account_transaction}
                    onChange={(e) => pickWithdrawal(e.target.value)}
                  >
                    <option value="">{t('credits.noLink')}</option>
                    {withdrawalSelectOptions.map((w) => (
                      <option key={w.id} value={w.id}>
                        #{w.id} — {formatNumber(w.amount, 2, numberFormat)} {w.currency} — {w.trading_account_name} ({formatDateTimeShort(w.transaction_date, dateFormatPref, timezonePref)})
                      </option>
                    ))}
                  </select>
                  <ModalSelectChevron />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('form.date')}</label>
                  <input
                    type="date"
                    className={MODAL_DATE_INPUT_CLASS}
                    value={credForm.date}
                    onChange={(e) => setCredForm({ ...credForm, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('form.primaryCurrency')}</label>
                  <div className="relative">
                    <select
                      className={MODAL_SELECT_CLASS}
                      value={credForm.primary_currency}
                      onChange={(e) => setCredForm({ ...credForm, primary_currency: e.target.value })}
                    >
                      {currencies.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <ModalSelectChevron />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('form.amount')}</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    value={credForm.amount}
                    onChange={(e) => setCredForm({ ...credForm, amount: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('form.secondaryAmount')}</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    value={credForm.secondary_amount}
                    onChange={(e) => setCredForm({ ...credForm, secondary_amount: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('form.secondaryCurrency')}</label>
                  <div className="relative">
                    <select
                      className={MODAL_SELECT_CLASS}
                      value={credForm.secondary_currency}
                      onChange={(e) => setCredForm({ ...credForm, secondary_currency: e.target.value })}
                    >
                      <option value="">{t('form.none')}</option>
                      {currencies.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <ModalSelectChevron />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('form.notes')}</label>
                  <textarea
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
                    value={credForm.notes}
                    onChange={(e) => setCredForm({ ...credForm, notes: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-shrink-0 flex-col gap-2 rounded-b-2xl border-t border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-900/50 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:rounded-b-xl sm:px-6 sm:py-4">
              <button
                type="button"
                disabled={loading}
                onClick={() => setCreditModal(false)}
                className="px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors w-full sm:w-auto"
              >
                {t('actions.cancel')}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={saveCredit}
                className="px-3 sm:px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors w-full sm:w-auto"
              >
                {t('actions.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDeleteLedgerRow}
        title={
          deleteTarget?.kind === 'expense'
            ? t('confirm.deleteExpense')
            : deleteTarget?.kind === 'credit'
              ? t('confirm.deleteCredit')
              : t('actions.delete')
        }
        message={
          <p className="text-gray-600 dark:text-gray-400">
            {tCommon('deleteConfirmGeneric', { defaultValue: 'This action cannot be undone.' })}
          </p>
        }
        isLoading={deleteLoading}
        confirmButtonText={t('actions.delete')}
      />
    </PageShell>
  );
};

export default TradingActivityPage;
