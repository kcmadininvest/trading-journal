import { getApiBaseUrl } from '../utils/apiConfig';

const BASE = `${getApiBaseUrl()}/api/trading-activity`;

export interface ExpenseCategory {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface TradingActivityExpense {
  id: number;
  date: string;
  primary_currency: string;
  subtotal: string;
  vat_amount: string;
  total: string;
  invoice_reference: string;
  secondary_amount: string | null;
  secondary_currency: string;
  category: number | null;
  category_name?: string | null;
  label: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface TradingActivityCredit {
  id: number;
  date: string;
  primary_currency: string;
  amount: string;
  secondary_amount: string | null;
  secondary_currency: string;
  fx_rate: string | null;
  transfer_fee_amount: string | null;
  linked_account_transaction: number | null;
  linked_account_transaction_detail?: {
    id: number;
    amount: string;
    transaction_date: string;
    trading_account_id: number;
    trading_account_name: string;
    currency: string;
  } | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface CurrencySummaryBlock {
  expenses: string;
  credits: string;
  balance: string;
}

export interface ExpenseTotalsPrimaryBlock {
  primary_currency: string;
  subtotal: string;
  vat_amount: string;
  total: string;
}

export interface ExpenseTotalsSecondaryBlock {
  secondary_currency: string;
  secondary_amount: string;
}

export interface CreditTotalsPrimaryBlock {
  primary_currency: string;
  amount: string;
}

export interface CreditTotalsSecondaryBlock {
  secondary_currency: string;
  secondary_amount: string;
}

export interface CreditTotalsFeeBlock {
  secondary_currency: string;
  transfer_fee_amount: string;
}

export interface TradingActivitySummary {
  primary_by_currency: Record<string, CurrencySummaryBlock>;
  secondary_by_currency: Record<string, CurrencySummaryBlock>;
  expenses_by_category: Array<{
    category_id: number;
    category_name: string;
    primary_currency: string;
    total: string;
  }>;
  expense_totals?: {
    primary: ExpenseTotalsPrimaryBlock[];
    secondary: ExpenseTotalsSecondaryBlock[];
  };
  credit_totals?: {
    primary: CreditTotalsPrimaryBlock[];
    secondary: CreditTotalsSecondaryBlock[];
    fees: CreditTotalsFeeBlock[];
  };
}

export interface WithdrawalSuggestion {
  id: number;
  amount: string;
  transaction_date: string;
  trading_account_id: number;
  trading_account_name: string;
  currency: string;
}

export interface PaginatedResults<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('access_token');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body === 'object' && body) {
      if (body.detail) return String(body.detail);
      const firstKey = Object.keys(body)[0];
      if (firstKey && Array.isArray(body[firstKey])) return String(body[firstKey][0]);
    }
  } catch {
    /* ignore */
  }
  return res.statusText || 'Erreur';
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...options, headers: { ...authHeaders(), ...options.headers } });
  if (!res.ok) throw new Error(await parseError(res));
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type');
  if (!ct?.includes('application/json')) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export const tradingActivityService = {
  listCurrencies(): Promise<{ currencies: string[] }> {
    return request(`${BASE}/currencies/`);
  },

  getSummary(): Promise<TradingActivitySummary> {
    return request(`${BASE}/summary/`);
  },

  listWithdrawalSuggestions(params?: { editingCreditId?: number }): Promise<{ withdrawals: WithdrawalSuggestion[] }> {
    const q = new URLSearchParams();
    if (params?.editingCreditId != null) {
      q.set('editing_credit_id', String(params.editingCreditId));
    }
    const suffix = q.toString() ? `?${q.toString()}` : '';
    return request(`${BASE}/withdrawal-suggestions/${suffix}`);
  },

  listCategories(): Promise<ExpenseCategory[]> {
    return request(`${BASE}/expense-categories/`);
  },

  createCategory(data: { name: string }): Promise<ExpenseCategory> {
    return request(`${BASE}/expense-categories/`, { method: 'POST', body: JSON.stringify(data) });
  },

  updateCategory(id: number, data: { name: string }): Promise<ExpenseCategory> {
    return request(`${BASE}/expense-categories/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
  },

  deleteCategory(id: number): Promise<void> {
    return request(`${BASE}/expense-categories/${id}/`, { method: 'DELETE' });
  },

  listExpenses(params?: { page?: number; page_size?: number }): Promise<PaginatedResults<TradingActivityExpense>> {
    const q = new URLSearchParams();
    if (params?.page != null) q.set('page', String(params.page));
    if (params?.page_size != null) q.set('page_size', String(params.page_size));
    const suffix = q.toString() ? `?${q.toString()}` : '';
    return request(`${BASE}/expenses/${suffix}`);
  },

  createExpense(data: Record<string, unknown>): Promise<TradingActivityExpense> {
    return request(`${BASE}/expenses/`, { method: 'POST', body: JSON.stringify(data) });
  },

  updateExpense(id: number, data: Record<string, unknown>): Promise<TradingActivityExpense> {
    return request(`${BASE}/expenses/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
  },

  deleteExpense(id: number): Promise<void> {
    return request(`${BASE}/expenses/${id}/`, { method: 'DELETE' });
  },

  listCredits(params?: { page?: number; page_size?: number }): Promise<PaginatedResults<TradingActivityCredit>> {
    const q = new URLSearchParams();
    if (params?.page != null) q.set('page', String(params.page));
    if (params?.page_size != null) q.set('page_size', String(params.page_size));
    const suffix = q.toString() ? `?${q.toString()}` : '';
    return request(`${BASE}/credits/${suffix}`);
  },

  createCredit(data: Record<string, unknown>): Promise<TradingActivityCredit> {
    return request(`${BASE}/credits/`, { method: 'POST', body: JSON.stringify(data) });
  },

  updateCredit(id: number, data: Record<string, unknown>): Promise<TradingActivityCredit> {
    return request(`${BASE}/credits/${id}/`, { method: 'PATCH', body: JSON.stringify(data) });
  },

  deleteCredit(id: number): Promise<void> {
    return request(`${BASE}/credits/${id}/`, { method: 'DELETE' });
  },
};
