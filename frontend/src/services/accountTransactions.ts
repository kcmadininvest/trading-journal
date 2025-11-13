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
  total_deposits: string;
  total_withdrawals: string;
  net_transactions: string;
  current_balance: string;
  currency: string;
}

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

  /**
   * Liste toutes les transactions de l'utilisateur
   */
  async list(params?: {
    trading_account?: number;
    transaction_type?: 'deposit' | 'withdrawal';
    start_date?: string;
    end_date?: string;
  }): Promise<AccountTransaction[]> {
    const queryParams = new URLSearchParams();
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

    const queryString = queryParams.toString();
    const endpoint = `account-transactions/${queryString ? `?${queryString}` : ''}`;
    const response = await this.request<AccountTransaction[] | { results: AccountTransaction[] }>(endpoint);
    
    return Array.isArray(response) ? response : response.results;
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

