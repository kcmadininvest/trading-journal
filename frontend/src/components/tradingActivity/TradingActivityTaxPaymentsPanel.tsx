import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { DateInput } from '../common/DateInput';
import { PaginationControls } from '../ui';
import {
  TradingActivityTaxPayment,
  isBuiltinTaxPaymentTypeCode,
  type BuiltinTaxPaymentLabels,
  type BuiltinTaxPaymentType,
  type TaxPaymentCustomType,
  type TaxPaymentTypeCode,
} from '../../services/tradingActivity';
import { formatDate, type DateFormatType } from '../../utils/dateFormat';
import { formatNumber, type NumberFormatType } from '../../utils/numberFormat';
import { TradingActivityLedgerDeleteAction } from './TradingActivityLedgerDeleteAction';
import {
  buildTaxPaymentTypeSelectOptions,
  taxPaymentTypeLabel,
  type TradingActivityT,
} from './taxPaymentTypeUtils';
export type { TradingActivityT } from './taxPaymentTypeUtils';

const MODAL_SELECT_CLASS =
  'w-full cursor-pointer appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-10 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100';

const MODAL_DATE_INPUT_CLASS =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 [color-scheme:light] dark:[color-scheme:dark]';

function ModalSelectChevron(): React.ReactElement {
  return (
    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3" aria-hidden>
      <svg className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </span>
  );
}

function MobileTaxPaymentCard({
  row,
  t,
  numberFormat,
  dateFormat,
  timezone,
  onEdit,
  onDelete,
  customPaymentTypes,
  builtinLabels,
}: {
  row: TradingActivityTaxPayment;
  t: TradingActivityT;
  numberFormat: NumberFormatType;
  dateFormat: DateFormatType;
  timezone?: string;
  customPaymentTypes?: TaxPaymentCustomType[];
  builtinLabels?: BuiltinTaxPaymentLabels;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      onClick={onEdit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEdit();
        }
      }}
      role="button"
      tabIndex={0}
      title={t('actions.clickToEdit')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {formatDate(row.date, dateFormat, false, timezone)}
          </p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {taxPaymentTypeLabel(t, row.payment_type, customPaymentTypes, builtinLabels)}
          </p>
        </div>
        <p className="shrink-0 text-base font-bold tabular-nums text-gray-900 dark:text-gray-100">
          {formatNumber(row.amount, 2, numberFormat)} {row.currency}
        </p>
      </div>
      {(row.label || row.reference) && (
        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 truncate">
          {[row.label, row.reference].filter(Boolean).join(' · ')}
        </p>
      )}
      <div className="mt-4 flex justify-end border-t border-gray-200 pt-3 dark:border-gray-600">
        <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <TradingActivityLedgerDeleteAction
            deleteLabel={t('actions.delete')}
            onRequestDelete={onDelete}
            compact={false}
          />
        </div>
      </div>
    </article>
  );
}

export type TaxPaymentFormState = {
  date: string;
  currency: string;
  amount: string;
  payment_type: TaxPaymentTypeCode;
  label: string;
  reference: string;
  notes: string;
};

export function TradingActivityTaxPaymentModal({
  open,
  editing,
  form,
  currencies,
  loading,
  t,
  onClose,
  onChange,
  onSave,
  customPaymentTypes,
  builtinLabels,
  newPaymentTypeName,
  onNewPaymentTypeNameChange,
  onCreatePaymentType,
  onRenamePaymentType,
  onUpsertBuiltinLabel,
}: {
  open: boolean;
  editing: TradingActivityTaxPayment | null;
  form: TaxPaymentFormState;
  currencies: string[];
  customPaymentTypes: TaxPaymentCustomType[];
  builtinLabels: BuiltinTaxPaymentLabels;
  loading: boolean;
  t: TradingActivityT;
  onClose: () => void;
  onChange: (next: TaxPaymentFormState) => void;
  onSave: () => void;
  newPaymentTypeName: string;
  onNewPaymentTypeNameChange: (value: string) => void;
  onCreatePaymentType: () => void;
  onRenamePaymentType: (id: number, name: string) => Promise<void>;
  onUpsertBuiltinLabel: (code: BuiltinTaxPaymentType, label: string) => Promise<void>;
}) {
  const selectedCustom = useMemo(
    () => customPaymentTypes.find((row) => row.code === form.payment_type),
    [customPaymentTypes, form.payment_type],
  );
  const selectedBuiltin = useMemo((): BuiltinTaxPaymentType | null => {
    if (!isBuiltinTaxPaymentTypeCode(form.payment_type)) return null;
    return form.payment_type;
  }, [form.payment_type]);
  const isEditingCustom = selectedCustom != null;
  const isEditingBuiltin = selectedBuiltin != null && !isEditingCustom;
  const isEditingType = isEditingCustom || isEditingBuiltin;
  const trimmedTypeName = newPaymentTypeName.trim();

  const effectiveBuiltinLabel = useCallback(
    (code: BuiltinTaxPaymentType) => builtinLabels[code] ?? t(`paymentType.${code}`),
    [builtinLabels, t],
  );

  const canSaveRename =
    isEditingCustom && trimmedTypeName !== '' && trimmedTypeName !== selectedCustom.name
      ? true
      : isEditingBuiltin &&
        selectedBuiltin != null &&
        trimmedTypeName !== '' &&
        trimmedTypeName !== effectiveBuiltinLabel(selectedBuiltin);
  const canCreateType = !isEditingType && trimmedTypeName !== '';

  const paymentTypeSyncRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      paymentTypeSyncRef.current = null;
      return;
    }
    if (paymentTypeSyncRef.current === form.payment_type) return;
    paymentTypeSyncRef.current = form.payment_type;
    const custom = customPaymentTypes.find((row) => row.code === form.payment_type);
    if (custom) {
      onNewPaymentTypeNameChange(custom.name);
      return;
    }
    if (isBuiltinTaxPaymentTypeCode(form.payment_type)) {
      onNewPaymentTypeNameChange(effectiveBuiltinLabel(form.payment_type));
      return;
    }
    onNewPaymentTypeNameChange('');
  }, [
    open,
    form.payment_type,
    customPaymentTypes,
    builtinLabels,
    onNewPaymentTypeNameChange,
    effectiveBuiltinLabel,
  ]);

  const handleCustomTypeNameAction = async () => {
    if (isEditingCustom && selectedCustom) {
      if (!canSaveRename) return;
      await onRenamePaymentType(selectedCustom.id, trimmedTypeName);
      return;
    }
    if (isEditingBuiltin && selectedBuiltin) {
      if (!canSaveRename) return;
      await onUpsertBuiltinLabel(selectedBuiltin, trimmedTypeName);
      return;
    }
    if (!canCreateType) return;
    onCreatePaymentType();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] backdrop-blur-sm dark:bg-black/70 sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        className="flex max-h-[min(92dvh,100vh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800 sm:max-h-[90vh] sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-3 dark:border-gray-700 dark:from-blue-900/20 dark:to-indigo-900/20 sm:items-center sm:px-6 sm:py-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 sm:text-xl">
              {editing ? t('taxPayments.edit') : t('taxPayments.add')}
            </h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 sm:text-sm">
              {editing ? t('taxPayments.modalEditDesc') : t('taxPayments.modalNewDesc')}
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
            aria-label={t('actions.closeModal')}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-3 sm:p-6">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('taxPayments.help')}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('form.date')}</label>
              <DateInput value={form.date} onChange={(value) => onChange({ ...form, date: value })} className={MODAL_DATE_INPUT_CLASS} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('table.currency')}</label>
              <div className="relative">
                <select
                  className={MODAL_SELECT_CLASS}
                  value={form.currency}
                  onChange={(e) => onChange({ ...form, currency: e.target.value })}
                >
                  {currencies.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ModalSelectChevron />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('form.amount')}</label>
              <input
                type="text"
                inputMode="decimal"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                value={form.amount}
                onChange={(e) => onChange({ ...form, amount: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('form.paymentType')}</label>
              <div className="relative">
                <select
                  className={MODAL_SELECT_CLASS}
                  value={form.payment_type}
                  onChange={(e) => onChange({ ...form, payment_type: e.target.value })}
                >
                  {buildTaxPaymentTypeSelectOptions(t, customPaymentTypes, builtinLabels).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ModalSelectChevron />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {isEditingType
                  ? t('form.customPaymentTypeEditLabel')
                  : t('form.customPaymentTypeAddLabel')}
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <input
                  type="text"
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  value={newPaymentTypeName}
                  onChange={(e) => onNewPaymentTypeNameChange(e.target.value)}
                  placeholder={
                    isEditingType ? undefined : t('form.customPaymentTypeAddPlaceholder')
                  }
                />
                <button
                  type="button"
                  disabled={loading || (isEditingType ? !canSaveRename : !canCreateType)}
                  onClick={handleCustomTypeNameAction}
                  className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 sm:px-4"
                >
                  {isEditingType ? t('actions.save') : t('form.newPaymentType')}
                </button>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('form.label')}</label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                value={form.label}
                onChange={(e) => onChange({ ...form, label: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('form.reference')}</label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                value={form.reference}
                onChange={(e) => onChange({ ...form, reference: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('form.notes')}</label>
              <textarea
                rows={3}
                className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                value={form.notes}
                onChange={(e) => onChange({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-col gap-2 border-t border-gray-200 bg-gray-50 px-3 py-3 dark:border-gray-700 dark:bg-gray-900/50 sm:flex-row sm:justify-end sm:px-6 sm:py-4">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-300 sm:w-auto"
          >
            {t('actions.cancel')}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onSave}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
          >
            {t('actions.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function TradingActivityTaxPaymentsLedgerPanel({
  t,
  numberFormat,
  dateFormat,
  timezone,
  rows,
  loading,
  total,
  page,
  pageSize,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
  onEdit,
  onDelete,
  handleLedgerRowActivate,
  customPaymentTypes,
  builtinLabels,
}: {
  t: TradingActivityT;
  numberFormat: NumberFormatType;
  dateFormat: DateFormatType;
  timezone?: string;
  customPaymentTypes: TaxPaymentCustomType[];
  builtinLabels: BuiltinTaxPaymentLabels;
  rows: TradingActivityTaxPayment[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  pageSizeOptions: readonly number[];
  onPageChange: (p: number) => void;
  onPageSizeChange: (size: number) => void;
  onEdit: (row: TradingActivityTaxPayment) => void;
  onDelete: (id: number) => void;
  handleLedgerRowActivate: (e: React.MouseEvent | React.KeyboardEvent, action: () => void) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const start0 = total === 0 ? 0 : (page - 1) * pageSize;
  const endInclusive = total === 0 ? 0 : Math.min(page * pageSize, total);

  if (loading && rows.length === 0) {
    return <p className="p-4 text-gray-500">{t('loading')}</p>;
  }
  if (!loading && total === 0) {
    return <p className="p-4 text-sm text-gray-500">{t('taxPayments.empty')}</p>;
  }

  return (
    <div className="flex min-w-0 flex-col">
      <div className="touch-pan-y space-y-3 p-3 xl:hidden" role="list" aria-label={t('taxPayments.title')}>
        {rows.map((row) => (
          <div key={row.id} role="listitem">
            <MobileTaxPaymentCard
              row={row}
              t={t}
              numberFormat={numberFormat}
              dateFormat={dateFormat}
              timezone={timezone}
              customPaymentTypes={customPaymentTypes}
              builtinLabels={builtinLabels}
              onEdit={() => onEdit(row)}
              onDelete={() => onDelete(row.id)}
            />
          </div>
        ))}
      </div>
      <div className="hidden min-w-0 flex-col xl:flex">
        <div className="min-w-0 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600 dark:bg-gray-900/50 dark:text-gray-300">
              <tr>
                <th className="px-3 py-2">{t('table.date')}</th>
                <th className="px-3 py-2">{t('table.paymentType')}</th>
                <th className="px-3 py-2">{t('table.label')}</th>
                <th className="px-3 py-2">{t('table.amount')}</th>
                <th className="px-3 py-2">{t('table.ref')}</th>
                <th className="w-14 px-3 py-2">
                  <span className="sr-only">{t('actions.delete')}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer text-gray-800 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/50"
                  onClick={(e) => handleLedgerRowActivate(e, () => onEdit(row))}
                  title={t('actions.clickToEdit')}
                >
                  <td className="whitespace-nowrap px-3 py-2">
                    {formatDate(row.date, dateFormat, false, timezone)}
                  </td>
                  <td className="px-3 py-2">
                    {taxPaymentTypeLabel(t, row.payment_type, customPaymentTypes, builtinLabels)}
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-2">{row.label || '—'}</td>
                  <td className="px-3 py-2 font-medium tabular-nums">
                    {formatNumber(row.amount, 2, numberFormat)} {row.currency}
                  </td>
                  <td className="px-3 py-2">{row.reference || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <TradingActivityLedgerDeleteAction
                      deleteLabel={t('actions.delete')}
                      onRequestDelete={() => onDelete(row.id)}
                      compact
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {total > 0 && (
        <PaginationControls
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          itemsPerPage={pageSize}
          startIndex={start0}
          endIndex={endInclusive}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          pageSizeOptions={[...pageSizeOptions]}
          className="border-t border-gray-200 dark:border-gray-700"
        />
      )}
    </div>
  );
}
