import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast/headless';
import { ConfirmModal, PaginationControls, Tooltip } from '../ui';
import { SimpleDateTimeInput } from '../common/SimpleDateTimeInput';
import { usePreferences } from '../../hooks/usePreferences';
import { DEFAULT_ITEMS_PER_PAGE } from '../../hooks/preferencesProvider';
import { formatDateTimeShort } from '../../utils/dateFormat';
import { formatNumber, parseLocalizedNumber, type NumberFormatType } from '../../utils/numberFormat';
import {
  backtestJournalService,
  type BacktestCampaign,
  type BacktestObservation,
  type ResultStatus,
} from '../../services/backtestJournal';
import { userService } from '../../services/userService';
import {
  datetimeLocalToIso,
  isoToDatetimeLocal,
  previewResultPoints,
  previewResultR,
  statusFromPoints,
} from './datetimeLocal';
import {
  replayCardClass,
  replaySecondaryButtonClass,
} from '../replay/replayStyles';

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100];
const GRID_COLUMNS = [
  'colNumber',
  'datetime',
  'direction',
  'tradeTaken',
  'entry',
  'stop',
  'exit',
  'resultPoints',
  'result',
  'resultR',
  'context',
  'structure',
  'actions',
] as const;

type GridRow = {
  key: string;
  id?: number;
  dirty: boolean;
  errors: Record<string, string>;
  market_datetime: string;
  direction: 'LONG' | 'SHORT';
  setup_valid: boolean;
  trade_taken: boolean;
  refusal_reason: string;
  entry_price: string;
  initial_stop_price: string;
  target_price: string;
  exit_price: string;
  result_status: ResultStatus;
  result_r: string;
  result_r_source: 'calculated' | 'manual';
  context: string;
  structure: string;
  notes: string;
  mfe: string;
  mae: string;
  fees: string;
  slippage: string;
  screenshot_before_url: string;
  screenshot_after_url: string;
  created_at?: string;
  updated_at?: string;
  warnings: string[];
};

function emptyRow(carry: Partial<GridRow> = {}): GridRow {
  return {
    key: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    dirty: true,
    errors: {},
    market_datetime: carry.market_datetime || '',
    direction: carry.direction || 'LONG',
    setup_valid: true,
    trade_taken: true,
    refusal_reason: '',
    entry_price: '',
    initial_stop_price: '',
    target_price: '',
    exit_price: '',
    result_status: 'OPEN',
    result_r: '',
    result_r_source: 'calculated',
    context: carry.context || '',
    structure: carry.structure || '',
    notes: '',
    mfe: '',
    mae: '',
    fees: '',
    slippage: '',
    screenshot_before_url: '',
    screenshot_after_url: '',
    warnings: [],
  };
}

function formatEditableNumber(
  value: string | number | null | undefined,
  digits: number,
  numberFormat: NumberFormatType,
): string {
  if (value === null || value === undefined || value === '') return '';
  const parsed = parseLocalizedNumber(String(value), numberFormat);
  if (parsed == null) return String(value);
  return formatNumber(parsed, digits, numberFormat);
}

function fromApi(
  obs: BacktestObservation,
  timeZone: string,
  numberFormat: NumberFormatType,
): GridRow {
  return {
    key: String(obs.id),
    id: obs.id,
    dirty: false,
    errors: {},
    market_datetime: isoToDatetimeLocal(obs.market_datetime, timeZone),
    direction: obs.direction,
    setup_valid: obs.setup_valid,
    trade_taken: obs.trade_taken,
    refusal_reason: obs.refusal_reason || '',
    entry_price: formatEditableNumber(obs.entry_price, 4, numberFormat),
    initial_stop_price: formatEditableNumber(obs.initial_stop_price, 4, numberFormat),
    target_price: formatEditableNumber(obs.target_price, 4, numberFormat),
    exit_price: formatEditableNumber(obs.exit_price, 4, numberFormat),
    result_status: obs.result_status,
    result_r: formatEditableNumber(obs.result_r, 2, numberFormat),
    result_r_source: obs.result_r_source,
    context: obs.context || '',
    structure: obs.structure || '',
    notes: obs.notes || '',
    mfe: formatEditableNumber(obs.mfe, 4, numberFormat),
    mae: formatEditableNumber(obs.mae, 4, numberFormat),
    fees: formatEditableNumber(obs.fees, 2, numberFormat),
    slippage: formatEditableNumber(obs.slippage, 4, numberFormat),
    screenshot_before_url: obs.screenshot_before_url || '',
    screenshot_after_url: obs.screenshot_after_url || '',
    created_at: obs.created_at,
    updated_at: obs.updated_at,
    warnings: obs.warnings || [],
  };
}

function numOrNull(value: string, numberFormat: NumberFormatType): number | null | undefined {
  if (value === '') return undefined;
  return parseLocalizedNumber(value, numberFormat);
}

interface Props {
  campaign: BacktestCampaign;
  onStatsInvalidate: () => void;
}

export function ObservationGrid({ campaign, onStatsInvalidate }: Props) {
  const { t } = useTranslation('backtestJournal');
  const { preferences, loading: preferencesLoading } = usePreferences();
  const numberFormat = preferences.number_format;
  const dateFormat = preferences.date_format;
  const timezone = preferences.timezone || 'Europe/Paris';
  const [rows, setRows] = useState<GridRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const [compact, setCompact] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(
    () => preferences.items_per_page ?? DEFAULT_ITEMS_PER_PAGE,
  );
  const tableRef = useRef<HTMLTableElement>(null);
  const rowsRef = useRef<GridRow[]>([]);
  const savingRef = useRef(false);
  const lastAutoSaveAttemptRef = useRef('');
  const lastPrefPageSizeRef = useRef(preferences.items_per_page ?? DEFAULT_ITEMS_PER_PAGE);

  useEffect(() => {
    if (preferencesLoading) return;
    const prefSize = preferences.items_per_page ?? DEFAULT_ITEMS_PER_PAGE;
    if (prefSize === lastPrefPageSizeRef.current) return;
    lastPrefPageSizeRef.current = prefSize;
    setPageSize(prefSize);
    setPage(1);
  }, [preferencesLoading, preferences.items_per_page]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await backtestJournalService.listObservations(campaign.id);
      setRows(list.map((obs) => fromApi(obs, timezone, numberFormat)));
    } catch {
      toast.error(t('error'));
    } finally {
      setLoading(false);
    }
  }, [campaign.id, timezone, numberFormat, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const dirty = rows.some((row) => row.dirty);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const draftKey = `btj-draft-${campaign.id}`;
  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify(rows.filter((row) => row.dirty)));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [rows, dirty, draftKey]);

  const patchRow = (key: string, partial: Partial<GridRow>) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row, ...partial, dirty: true, errors: {} };
        const points = previewResultPoints(
          next.direction,
          parseLocalizedNumber(next.entry_price, numberFormat),
          parseLocalizedNumber(next.exit_price, numberFormat),
        );
        next.result_status = statusFromPoints(points, next.trade_taken);
        return next;
      })
    );
  };

  const toPayload = useCallback((row: GridRow) => {
    const points = previewResultPoints(
      row.direction,
      parseLocalizedNumber(row.entry_price, numberFormat),
      parseLocalizedNumber(row.exit_price, numberFormat),
    );
    const payload: Record<string, unknown> = {
      client_key: row.key,
      market_datetime: datetimeLocalToIso(row.market_datetime, timezone),
      direction: row.direction,
      setup_valid: row.setup_valid,
      trade_taken: row.trade_taken,
      refusal_reason: row.refusal_reason,
      result_status: statusFromPoints(points, row.trade_taken),
      result_r_source: row.result_r_source,
      context: row.context,
      structure: row.structure,
      notes: row.notes,
    };
    if (row.id) payload.id = row.id;
    const assign = (field: string, value: string) => {
      const parsed = numOrNull(value, numberFormat);
      payload[field] = parsed === undefined ? null : parsed;
    };
    assign('entry_price', row.entry_price);
    assign('initial_stop_price', row.initial_stop_price);
    assign('target_price', row.target_price);
    assign('exit_price', row.exit_price);
    assign('mfe', row.mfe);
    assign('mae', row.mae);
    assign('fees', row.fees);
    assign('slippage', row.slippage);
    if (row.result_r_source === 'manual' || row.result_r !== '') {
      assign('result_r', row.result_r);
    }
    return payload;
  }, [numberFormat, timezone]);

  const isRowReadyToSave = useCallback(
    (row: GridRow) => Boolean(row.market_datetime && datetimeLocalToIso(row.market_datetime, timezone)),
    [timezone],
  );

  const saveRows = useCallback(async (targets: GridRow[], options?: { silent?: boolean }) => {
    if (!targets.length || savingRef.current) return;
    const silent = Boolean(options?.silent);
    const snapshot = targets.map((row) => ({
      key: row.key,
      signature: JSON.stringify(toPayload(row)),
      payload: toPayload(row),
    }));
    savingRef.current = true;
    setSaving(true);
    try {
      const res = await backtestJournalService.saveObservationsBulk(
        campaign.id,
        snapshot.map((item) => item.payload)
      );
      const byClient = new Map(res.items.map((item) => [item.client_key || String(item.id), item]));
      const signatures = new Map(snapshot.map((item) => [item.key, item.signature]));
      setRows((prev) =>
        prev.map((row) => {
          const saved =
            byClient.get(row.key) ||
            (row.id ? res.items.find((item) => item.id === row.id) : undefined);
          if (!saved) return row;
          const savedSig = signatures.get(row.key);
          if (savedSig && JSON.stringify(toPayload(row)) !== savedSig) {
            return { ...row, id: saved.id || row.id, dirty: true };
          }
          return fromApi(saved, timezone, numberFormat);
        })
      );
      localStorage.removeItem(draftKey);
      lastAutoSaveAttemptRef.current = '';
      if (!silent) toast.success(t('saved'));
      onStatsInvalidate();
    } catch (err) {
      const fields = (err as { fields?: { errors?: Array<{ index: number; errors: Record<string, unknown> }> } }).fields;
      if (fields?.errors) {
        setRows((prev) => {
          const next = [...prev];
          fields.errors!.forEach((item) => {
            const target = targets[item.index];
            if (!target) return;
            const idx = next.findIndex((row) => row.key === target.key);
            if (idx >= 0) {
              const mapped: Record<string, string> = {};
              Object.entries(item.errors || {}).forEach(([key, value]) => {
                mapped[key] = Array.isArray(value) ? String(value[0]) : String(value);
              });
              next[idx] = { ...next[idx], errors: mapped };
            }
          });
          return next;
        });
      }
      toast.error(t('saveError'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [campaign.id, draftKey, numberFormat, onStatsInvalidate, t, timezone, toPayload]);

  useEffect(() => {
    if (!dirty || saving) return;
    const timer = window.setTimeout(() => {
      const targets = rowsRef.current.filter((row) => row.dirty && isRowReadyToSave(row));
      if (!targets.length) return;
      const attemptKey = targets
        .map((row) => `${row.key}:${JSON.stringify(toPayload(row))}`)
        .join('|');
      if (attemptKey === lastAutoSaveAttemptRef.current) return;
      lastAutoSaveAttemptRef.current = attemptKey;
      void saveRows(targets, { silent: true });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [rows, dirty, saving, isRowReadyToSave, saveRows, toPayload]);

  const safePageSize = pageSize > 0 ? pageSize : DEFAULT_ITEMS_PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(rows.length / safePageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageStart = (page - 1) * safePageSize;
  const pagedRows = useMemo(
    () => rows.slice(pageStart, pageStart + safePageSize),
    [rows, pageStart, safePageSize],
  );
  const paginationStartIndex = rows.length === 0 ? 0 : pageStart;
  const paginationEndIndex = rows.length === 0 ? 0 : Math.min(page * safePageSize, rows.length);

  const handlePageSizeChange = async (size: number) => {
    const sanitized = Number.isFinite(size) && size > 0 ? size : DEFAULT_ITEMS_PER_PAGE;
    setPageSize(sanitized);
    setPage(1);
    lastPrefPageSizeRef.current = sanitized;
    try {
      await userService.updatePreferences({ items_per_page: sanitized });
      window.dispatchEvent(new CustomEvent('preferences:updated'));
    } catch (error) {
      console.error('[ObservationGrid] Failed to persist items_per_page', error);
    }
  };

  const addRow = (position: 'top' | 'bottom') => {
    const source = position === 'top' ? rows[0] : rows[rows.length - 1];
    const carry = source
      ? {
          direction: source.direction,
          context: source.context,
          structure: source.structure,
        }
      : {};
    const row = emptyRow(carry);
    setRows((prev) => (position === 'top' ? [row, ...prev] : [...prev, row]));
    if (position === 'top') {
      setPage(1);
    } else {
      setPage(Math.max(1, Math.ceil((rows.length + 1) / safePageSize)));
    }
  };

  const duplicateRow = useCallback((row: GridRow) => {
    const clone = emptyRow({
      direction: row.direction,
      context: row.context,
      structure: row.structure,
    });
    clone.setup_valid = row.setup_valid;
    clone.trade_taken = row.trade_taken;
    setRows((prev) => {
      const idx = prev.findIndex((item) => item.key === row.key);
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      setPage(Math.floor((idx + 1) / safePageSize) + 1);
      return next;
    });
  }, [safePageSize]);

  const confirmDelete = async () => {
    const row = rows.find((item) => item.key === deleteKey);
    if (!row) return;
    try {
      if (row.id) {
        await backtestJournalService.deleteObservation(row.id);
      }
      setRows((prev) => prev.filter((item) => item.key !== deleteKey));
      setDeleteKey(null);
      toast.success(t('deleted'));
      onStatsInvalidate();
    } catch {
      toast.error(t('saveError'));
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        const targets = rowsRef.current.filter((row) => row.dirty && isRowReadyToSave(row));
        void saveRows(targets, { silent: false });
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
        const selected = detailKey
          ? rowsRef.current.find((row) => row.key === detailKey)
          : rowsRef.current[0];
        if (selected) {
          event.preventDefault();
          duplicateRow(selected);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailKey, duplicateRow, isRowReadyToSave, saveRows]);

  const addRowButton = (
    paddingClass: string,
  ) => (
    <Tooltip content={t('addRow')} position="top">
      <button
        type="button"
        className={`${paddingClass} rounded-lg text-gray-600 transition-all duration-200 hover:bg-green-50 hover:text-green-600 dark:text-gray-400 dark:hover:bg-green-900/20 dark:hover:text-green-400`}
        onClick={() => addRow('bottom')}
        aria-label={t('addRow')}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </Tooltip>
  );
  const cellClass = compact ? 'px-1 py-1 text-xs' : 'px-2 py-1.5 text-sm';
  const inputClass =
    'w-full min-w-[5.5rem] rounded border border-transparent bg-transparent px-1 py-0.5 tabular-nums focus:border-blue-500 focus:outline-none dark:focus:border-blue-400';
  /** Même principe que PageSizeSelector : pas de flèche native du navigateur. */
  const selectClass = `${inputClass} cursor-pointer appearance-none pr-5`;
  const selectChevron = (
    <span
      className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-0.5"
      aria-hidden
    >
      <svg
        className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-500"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </span>
  );
  const detail = rows.find((row) => row.key === detailKey) || null;

  const formatCellNumber = (value: string, digits = 2) => {
    if (value === '') return '';
    const parsed = parseLocalizedNumber(value, numberFormat);
    return parsed == null ? value : formatNumber(parsed, digits, numberFormat);
  };

  const onNumberBlur = (key: string, field: keyof GridRow, raw: string, digits = 4) => {
    if (raw.trim() === '') {
      patchRow(key, { [field]: '' } as Partial<GridRow>);
      return;
    }
    const parsed = parseLocalizedNumber(raw, numberFormat);
    patchRow(key, {
      [field]:
        parsed == null ? raw : formatNumber(parsed, digits, numberFormat),
    } as Partial<GridRow>);
  };

  if (loading) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{t('loading')}</p>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={replaySecondaryButtonClass}
          onClick={() => setCompact((value) => !value)}
        >
          {compact ? t('comfortable') : t('compact')}
        </button>
        {saving ? (
          <span className="text-xs text-gray-500 dark:text-gray-400">{t('saving')}</span>
        ) : dirty ? (
          <span className="text-xs text-amber-700 dark:text-amber-400">{t('unsaved')}</span>
        ) : null}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{t('shortcuts')}</p>

      <div className={`${replayCardClass} min-h-0 flex-1 overflow-auto`}>
        <table ref={tableRef} className="min-w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-gray-800">
            <tr>
              {GRID_COLUMNS.map((col) => (
                <th
                  key={col}
                  className={`${cellClass} whitespace-nowrap text-[11px] font-medium uppercase tracking-wide text-gray-600 dark:text-gray-300 ${
                    col === 'colNumber' ? 'w-10 min-w-[2.5rem] text-center' : 'text-left'
                  }`}
                >
                  {col === 'actions' ? (
                    <div className="flex items-center gap-1">
                      <span>{t(col)}</span>
                      {addRowButton('p-1')}
                    </div>
                  ) : (
                    t(col)
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className={`${cellClass} text-gray-500`} colSpan={GRID_COLUMNS.length - 1}>
                  {t('emptyObservations')}
                </td>
                <td className={`${cellClass} whitespace-nowrap`}>
                  {addRowButton('p-2')}
                </td>
              </tr>
            )}
            {pagedRows.map((row, rowIndex) => {
              const entryNum = parseLocalizedNumber(row.entry_price, numberFormat);
              const stopNum = parseLocalizedNumber(row.initial_stop_price, numberFormat);
              const exitNum = parseLocalizedNumber(row.exit_price, numberFormat);
              const preview = previewResultR(row.direction, entryNum, stopNum, exitNum);
              const pointsPreview = previewResultPoints(row.direction, entryNum, exitNum);
              const derivedStatus = statusFromPoints(pointsPreview, row.trade_taken);
              const rowNumber = pageStart + rowIndex + 1;
              return (
                <tr
                  key={row.key}
                  className={`border-t border-gray-100 dark:border-gray-800 ${
                    row.dirty ? 'bg-amber-50/70 dark:bg-amber-900/20' : ''
                  } ${Object.keys(row.errors).length ? 'bg-red-50/80 dark:bg-red-900/20' : ''}`}
                >
                  <td
                    className={`${cellClass} w-10 min-w-[2.5rem] text-center tabular-nums text-gray-500 dark:text-gray-400`}
                    aria-label={t('colNumber')}
                  >
                    {rowNumber}
                  </td>
                  <td className={`${cellClass} min-w-[12.5rem]`}>
                    <SimpleDateTimeInput
                      className={inputClass}
                      value={row.market_datetime}
                      onChange={(value) => patchRow(row.key, { market_datetime: value })}
                      aria-label={t('datetime')}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          const inputs = tableRef.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
                            'tbody input, tbody select'
                          );
                          if (!inputs) return;
                          const list = Array.from(inputs);
                          const idx = list.indexOf(event.currentTarget);
                          const nextRowStart = list.findIndex(
                            (el, i) => i > idx && el.closest('tr') !== event.currentTarget.closest('tr')
                          );
                          if (nextRowStart >= 0) list[nextRowStart].focus();
                        }
                      }}
                    />
                    {row.errors.market_datetime && (
                      <div className="text-[11px] text-red-600">{row.errors.market_datetime}</div>
                    )}
                  </td>
                  <td className={`${cellClass} min-w-[5.5rem]`}>
                    <div className="relative">
                      <select
                        className={selectClass}
                        value={row.direction}
                        onChange={(event) =>
                          patchRow(row.key, { direction: event.target.value as 'LONG' | 'SHORT' })
                        }
                      >
                        <option value="LONG">{t('long')}</option>
                        <option value="SHORT">{t('short')}</option>
                      </select>
                      {selectChevron}
                    </div>
                  </td>
                  <td className={`${cellClass} min-w-[4.5rem]`}>
                    <div className="relative">
                      <select
                        className={selectClass}
                        value={row.trade_taken ? 'yes' : 'no'}
                        aria-label={t('tradeTaken')}
                        onChange={(event) => {
                          patchRow(row.key, { trade_taken: event.target.value === 'yes' });
                        }}
                      >
                        <option value="yes">{t('yes')}</option>
                        <option value="no">{t('no')}</option>
                      </select>
                      {selectChevron}
                    </div>
                  </td>
                  {(['entry_price', 'initial_stop_price', 'exit_price'] as const).map((field) => (
                    <td key={field} className={`${cellClass} min-w-[5.5rem]`}>
                      <input
                        className={inputClass}
                        value={row[field]}
                        onChange={(event) => patchRow(row.key, { [field]: event.target.value })}
                        onBlur={(event) => onNumberBlur(row.key, field, event.target.value, 4)}
                        aria-label={t(
                          field === 'entry_price'
                            ? 'entry'
                            : field === 'initial_stop_price'
                              ? 'stop'
                              : 'exit',
                        )}
                      />
                      {row.errors[field] && (
                        <div className="text-[11px] text-red-600">{row.errors[field]}</div>
                      )}
                    </td>
                  ))}
                  <td className={`${cellClass} min-w-[5.5rem]`}>
                    <span
                      className={`tabular-nums ${
                        pointsPreview == null
                          ? 'text-gray-400'
                          : pointsPreview > 0
                            ? 'text-green-600 dark:text-green-400'
                            : pointsPreview < 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-gray-600 dark:text-gray-300'
                      }`}
                      aria-label={t('resultPoints')}
                    >
                      {pointsPreview == null
                        ? '—'
                        : formatNumber(pointsPreview, 4, numberFormat)}
                    </span>
                  </td>
                  <td className={`${cellClass} min-w-[7rem]`}>
                    <span
                      className={`font-medium ${
                        derivedStatus === 'WIN'
                          ? 'text-green-600 dark:text-green-400'
                          : derivedStatus === 'LOSS'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-700 dark:text-gray-200'
                      }`}
                      aria-label={t('result')}
                    >
                      {t(`result${derivedStatus}`)}
                    </span>
                    {!row.trade_taken && (
                      <div className="text-[11px] text-amber-700 dark:text-amber-400">{t('theoretical')}</div>
                    )}
                  </td>
                  <td className={`${cellClass} min-w-[5rem]`}>
                    <input
                      className={inputClass}
                      value={
                        row.result_r_source === 'manual'
                          ? row.result_r
                          : row.result_r !== ''
                            ? formatCellNumber(row.result_r, 2)
                            : preview != null
                              ? formatNumber(preview, 2, numberFormat)
                              : ''
                      }
                      onChange={(event) =>
                        patchRow(row.key, { result_r: event.target.value, result_r_source: 'manual' })
                      }
                      onBlur={(event) => {
                        if (row.result_r_source === 'manual') {
                          onNumberBlur(row.key, 'result_r', event.target.value, 2);
                        }
                      }}
                      aria-label={t('resultR')}
                    />
                    {row.warnings.includes('r_divergence') && (
                      <div className="text-[11px] text-amber-700">{t('rDivergence')}</div>
                    )}
                  </td>
                  <td className={`${cellClass} min-w-[8rem]`}>
                    <input
                      className={inputClass}
                      value={row.context}
                      maxLength={128}
                      onChange={(event) => patchRow(row.key, { context: event.target.value })}
                      aria-label={t('context')}
                    />
                  </td>
                  <td className={`${cellClass} min-w-[8rem]`}>
                    <input
                      className={inputClass}
                      value={row.structure}
                      maxLength={128}
                      onChange={(event) => patchRow(row.key, { structure: event.target.value })}
                      aria-label={t('structure')}
                    />
                  </td>
                  <td className={`${cellClass} whitespace-nowrap`}>
                    <div className="flex items-center gap-2">
                      <Tooltip content={t('edit')} position="top">
                        <button
                          type="button"
                          className="rounded-lg p-2 text-gray-600 transition-all duration-200 hover:bg-blue-50 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
                          onClick={() => setDetailKey(row.key)}
                          aria-label={t('edit')}
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </Tooltip>
                      <Tooltip content={t('duplicate')} position="top">
                        <button
                          type="button"
                          className="rounded-lg p-2 text-gray-600 transition-all duration-200 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
                          onClick={() => duplicateRow(row)}
                          aria-label={t('duplicate')}
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </Tooltip>
                      <Tooltip content={t('delete')} position="top">
                        <button
                          type="button"
                          className="rounded-lg p-2 text-gray-600 transition-all duration-200 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                          onClick={() => setDeleteKey(row.key)}
                          aria-label={t('delete')}
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length > 0 && (
              <tr className="border-t border-gray-100 dark:border-gray-800">
                <td className={cellClass} colSpan={GRID_COLUMNS.length - 1} />
                <td className={`${cellClass} whitespace-nowrap`}>
                  {addRowButton('p-2')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-800">
          <PaginationControls
            currentPage={page}
            totalPages={totalPages}
            totalItems={rows.length}
            itemsPerPage={safePageSize}
            startIndex={paginationStartIndex}
            endIndex={paginationEndIndex}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            className="border-t-0"
          />
        </div>
      )}

      {detail && (
        <aside className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium">{t('detail')}</h3>
            <button type="button" className={replaySecondaryButtonClass} onClick={() => setDetailKey(null)}>
              {t('closeDetail')}
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={detail.setup_valid}
                onChange={(event) => patchRow(detail.key, { setup_valid: event.target.checked })}
              />
              {t('setupValid')}
            </label>
            <label className="text-sm">
              {t('target')}
              <input
                className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2 tabular-nums dark:border-gray-600 dark:bg-gray-700"
                value={detail.target_price}
                onChange={(event) => patchRow(detail.key, { target_price: event.target.value })}
                onBlur={(event) => onNumberBlur(detail.key, 'target_price', event.target.value, 4)}
              />
            </label>
            <label className="text-sm">
              {t('refusalReason')}
              <textarea
                className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2 dark:border-gray-600 dark:bg-gray-700"
                value={detail.refusal_reason}
                onChange={(event) => patchRow(detail.key, { refusal_reason: event.target.value })}
              />
            </label>
            <label className="text-sm">
              {t('notes')}
              <textarea
                className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2 dark:border-gray-600 dark:bg-gray-700"
                value={detail.notes}
                onChange={(event) => patchRow(detail.key, { notes: event.target.value })}
              />
            </label>
            <label className="text-sm">
              {t('mfe')}
              <input
                className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2 tabular-nums dark:border-gray-600 dark:bg-gray-700"
                value={detail.mfe}
                onChange={(event) => patchRow(detail.key, { mfe: event.target.value })}
                onBlur={(event) => onNumberBlur(detail.key, 'mfe', event.target.value, 4)}
              />
            </label>
            <label className="text-sm">
              {t('mae')}
              <input
                className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2 tabular-nums dark:border-gray-600 dark:bg-gray-700"
                value={detail.mae}
                onChange={(event) => patchRow(detail.key, { mae: event.target.value })}
                onBlur={(event) => onNumberBlur(detail.key, 'mae', event.target.value, 4)}
              />
            </label>
            {detail.id && (
              <>
                <ScreenshotField
                  label={t('before')}
                  url={detail.screenshot_before_url}
                  onUpload={async (file) => {
                    const res = await backtestJournalService.uploadScreenshot(detail.id!, file, 'before');
                    patchRow(detail.key, {
                      screenshot_before_url: res.screenshot_before_url || '',
                      dirty: false,
                    });
                  }}
                />
                <ScreenshotField
                  label={t('after')}
                  url={detail.screenshot_after_url}
                  onUpload={async (file) => {
                    const res = await backtestJournalService.uploadScreenshot(detail.id!, file, 'after');
                    patchRow(detail.key, {
                      screenshot_after_url: res.screenshot_after_url || '',
                      dirty: false,
                    });
                  }}
                />
              </>
            )}
            {detail.created_at && (
              <p className="text-xs text-gray-500">
                {t('createdAt')}: {formatDateTimeShort(detail.created_at, dateFormat, timezone)}
              </p>
            )}
            {detail.updated_at && (
              <p className="text-xs text-gray-500">
                {t('updatedAt')}: {formatDateTimeShort(detail.updated_at, dateFormat, timezone)}
              </p>
            )}
          </div>
        </aside>
      )}

      <ConfirmModal
        isOpen={!!deleteKey}
        onClose={() => setDeleteKey(null)}
        onConfirm={confirmDelete}
        title={t('delete')}
        message={t('confirmDeleteRow')}
        variant="warning"
      />
    </div>
  );
}

function ScreenshotField({
  label,
  url,
  onUpload,
}: {
  label: string;
  url: string;
  onUpload: (file: File) => Promise<void>;
}) {
  return (
    <label className="text-sm">
      {label}
      {url && (
        <img src={url} alt="" className="mt-1 max-h-32 rounded border border-gray-200 dark:border-gray-700" />
      )}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="mt-1 block text-xs"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onUpload(file);
        }}
      />
    </label>
  );
}
