import { getApiBaseUrl } from '../utils/apiConfig';

export interface AccountTransaction {
  id: number;
  user: number;
  user_username?: string;
  trading_account: number;
  trading_account_name?: string;
  transaction_type: 'deposit' | 'withdrawal';
  amount: string | number;
  signed_amount?: string | number;
  transaction_date: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AccountBalance {
  trading_account_id: number;
  trading_account_name: string;
  initial_capital: string;
  total_pnl: string;
  /** Somme PnL brut (coalesce pnl → net_pnl), pour affichage si préférence gross */
  total_pnl_gross?: string;
  /** Capital initial + PnL trades uniquement (sans dépôts/retraits) */
  trading_equity?: string;
  trading_equity_gross?: string;
  total_deposits: string;
  total_withdrawals: string;
  net_transactions: string;
  /** Solde réel (net) — retraits / formulaires */
  current_balance: string;
  /** Solde si l’on cumule le PnL brut + mêmes flux — aligné préférence affichage gross */
  current_balance_gross?: string;
  currency: string;
}

export interface AccountTransactionsListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: AccountTransaction[];
}

export interface AccountTransactionsStats {
  total: number;
  deposits_count: number;
  withdrawals_count: number;
  total_deposits: string;
  total_withdrawals: string;
  net_flow: string;
}

export type AccountTransactionsListParams = {
  trading_account?: number;
  transaction_type?: 'deposit' | 'withdrawal';
  start_date?: string;
  end_date?: string;
  /** Fuseau IANA (ex. Europe/Paris) : bornes de période interprétées comme jours civils dans ce fuseau (aligné dashboard). */
  timezone?: string;
  q?: string;
  page?: number;
  page_size?: number;
};

class AccountTransactionsService {
  private readonly BASE_URL = getApiBaseUrl();

  private getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    } as Record<string, string>;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers = {
      ...this.getAuthHeaders(),
      ...options.headers,
    };

    const response = await fetch(`${this.BASE_URL}/api/trades/${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Une erreur est survenue' }));
      throw new Error(error.detail || error.message || 'Une erreur est survenue');
    }

    // Pour les requêtes DELETE, la réponse peut être vide (204 No Content)
    if (options.method === 'DELETE' || response.status === 204) {
      return undefined as T;
    }

    // Vérifier si la réponse a du contenu avant de parser le JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return undefined as T;
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }

    return JSON.parse(text);
  }

  private appendListQueryParams(
    queryParams: URLSearchParams,
    params?: AccountTransactionsListParams
  ) {
    if (params?.trading_account) {
      queryParams.append('trading_account', params.trading_account.toString());
    }
    if (params?.transaction_type) {
      queryParams.append('transaction_type', params.transaction_type);
    }
    if (params?.start_date) {
      queryParams.append('start_date', params.start_date);
    }
    if (params?.end_date) {
      queryParams.append('end_date', params.end_date);
    }
    if (params?.timezone) {
      queryParams.append('timezone', params.timezone);
    }
    if (params?.q) {
      queryParams.append('q', params.q);
    }
    if (params?.page != null) {
      queryParams.append('page', String(params.page));
    }
    if (params?.page_size != null) {
      queryParams.append('page_size', String(params.page_size));
    }
  }

  /**
   * Liste paginée des transactions (réponse DRF standard).
   */
  async list(params?: AccountTransactionsListParams): Promise<AccountTransactionsListResponse> {
    const queryParams = new URLSearchParams();
    this.appendListQueryParams(queryParams, params);
    const queryString = queryParams.toString();
    const endpoint = `account-transactions/${queryString ? `?${queryString}` : ''}`;
    const response = await this.request<AccountTransactionsListResponse | AccountTransaction[]>(endpoint);

    if (Array.isArray(response)) {
      return {
        count: response.length,
        next: null,
        previous: null,
        results: response,
      };
    }
    return {
      count: typeof response.count === 'number' ? response.count : 0,
      next: response.next ?? null,
      previous: response.previous ?? null,
      results: Array.isArray(response.results) ? response.results : [],
    };
  }

  /**
   * Agrégats (comptages et sommes) pour les mêmes filtres compte / dates / recherche, sans filtre par type.
   */
  async stats(params?: Omit<AccountTransactionsListParams, 'page' | 'page_size' | 'transaction_type'>): Promise<AccountTransactionsStats> {
    const queryParams = new URLSearchParams();
    this.appendListQueryParams(queryParams, params);
    const queryString = queryParams.toString();
    return this.request<AccountTransactionsStats>(
      `account-transactions/stats/${queryString ? `?${queryString}` : ''}`
    );
  }

  /**
   * Récupère une transaction par son ID
   */
  async get(id: number): Promise<AccountTransaction> {
    return this.request<AccountTransaction>(`account-transactions/${id}/`);
  }

  /**
   * Crée une nouvelle transaction
   */
  async create(data: {
    trading_account: number;
    transaction_type: 'deposit' | 'withdrawal';
    amount: number;
    transaction_date: string;
    description?: string;
  }): Promise<AccountTransaction> {
    return this.request<AccountTransaction>('account-transactions/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Met à jour une transaction existante
   */
  async update(id: number, data: Partial<{
    trading_account: number;
    transaction_type: 'deposit' | 'withdrawal';
    amount: number;
    transaction_date: string;
    description?: string;
  }>): Promise<AccountTransaction> {
    return this.request<AccountTransaction>(`account-transactions/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Supprime une transaction
   */
  async delete(id: number): Promise<void> {
    await this.request(`account-transactions/${id}/`, {
      method: 'DELETE',
    });
  }

  /**
   * Récupère le solde actuel d'un compte en tenant compte des transactions
   */
  async getBalance(trading_account_id: number): Promise<AccountBalance> {
    return this.request<AccountBalance>(
      `account-transactions/balance/?trading_account=${trading_account_id}`
    );
  }
}

export const accountTransactionsService = new AccountTransactionsService();
