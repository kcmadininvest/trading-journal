/** Tri ledger trading-activity — aligné sur accounts + trading_activity.ordering */

export type LedgerSortTab = 'debit' | 'credit' | 'tax';
export type LedgerSortDirection = 'asc' | 'desc';

export type LedgerSortEntry = {
  field: string;
  direction: LedgerSortDirection;
};

export type TradingActivityLedgerSort = Partial<Record<LedgerSortTab, LedgerSortEntry>>;

export const DEFAULT_LEDGER_SORT_ENTRY: LedgerSortEntry = {
  field: 'date',
  direction: 'desc',
};

const DEBIT_FIELDS = new Set(['date', 'category', 'label', 'total', 'invoice_reference']);
const CREDIT_FIELDS = new Set(['date', 'amount']);
const TAX_FIELDS = new Set(['date', 'payment_type', 'label', 'amount', 'reference']);

const DESC_FIRST_FIELDS = new Set(['date', 'total', 'amount']);

export function allowedFieldsForTab(tab: LedgerSortTab): Set<string> {
  if (tab === 'debit') return DEBIT_FIELDS;
  if (tab === 'credit') return CREDIT_FIELDS;
  return TAX_FIELDS;
}

export function normalizeLedgerSortEntry(
  tab: LedgerSortTab,
  raw: unknown,
): LedgerSortEntry {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_LEDGER_SORT_ENTRY };
  const field = (raw as { field?: unknown }).field;
  const direction = (raw as { direction?: unknown }).direction;
  const allowed = allowedFieldsForTab(tab);
  if (typeof field !== 'string' || !allowed.has(field)) {
    return { ...DEFAULT_LEDGER_SORT_ENTRY };
  }
  if (direction !== 'asc' && direction !== 'desc') {
    return { ...DEFAULT_LEDGER_SORT_ENTRY };
  }
  return { field, direction };
}

export function resolveTabSort(
  store: TradingActivityLedgerSort | null | undefined,
  tab: LedgerSortTab,
): LedgerSortEntry {
  return normalizeLedgerSortEntry(tab, store?.[tab]);
}

export function toOrderingParam(entry: LedgerSortEntry): string {
  return entry.direction === 'desc' ? `-${entry.field}` : entry.field;
}

export function initialDirectionForField(field: string): LedgerSortDirection {
  return DESC_FIRST_FIELDS.has(field) ? 'desc' : 'asc';
}

/** Toggle même colonne, ou nouveau champ avec direction initiale selon le type. */
export function nextSortEntry(current: LedgerSortEntry, field: string): LedgerSortEntry {
  if (current.field === field) {
    return {
      field,
      direction: current.direction === 'desc' ? 'asc' : 'desc',
    };
  }
  return { field, direction: initialDirectionForField(field) };
}

export function mergeTabSort(
  store: TradingActivityLedgerSort | null | undefined,
  tab: LedgerSortTab,
  entry: LedgerSortEntry,
): TradingActivityLedgerSort {
  return {
    ...(store && typeof store === 'object' ? store : {}),
    [tab]: entry,
  };
}
