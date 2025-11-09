import { getApiBaseUrl } from '../utils/apiConfig';

export interface PositionStrategy {
  id: number;
  user: number;
  user_username: string;
  version: number;
  parent_strategy: number | null;
  title: string;
  description: string;
  status: 'active' | 'archived' | 'draft';
  strategy_content: {
    sections: Array<{
      title: string;
      rules: string[];
    }>;
  };
  version_notes: string;
  is_current: boolean;
  is_latest_version: boolean;
  version_count: number;
  created_at: string;
  updated_at: string;
}

export interface PositionStrategyVersion {
  id: number;
  version: number;
  title: string;
  status: 'active' | 'archived' | 'draft';
  version_notes: string;
  is_current: boolean;
  is_latest_version: boolean;
  created_at: string;
  updated_at: string;
}

export interface PositionStrategyFilters {
  status?: 'active' | 'archived' | 'draft';
  is_current?: boolean;
  search?: string;
  include_archived?: boolean;
}

class PositionStrategiesService {
  private readonly BASE_URL = getApiBaseUrl();

  private getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    } as Record<string, string>;
  }

  private async refreshAccessToken(): Promise<boolean> {
    const refresh = localStorage.getItem('refresh_token');
    if (!refresh) return false;
    try {
      const res = await fetch(`${this.BASE_URL}/api/accounts/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh })
      });
      if (!res.ok) return false;
      const data = await res.json();
      const newAccess = data.access as string | undefined;
      if (newAccess) {
        localStorage.setItem('access_token', newAccess);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    let res = await fetch(url, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers,
      },
    });

    if (res.status === 401) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        res = await fetch(url, {
          ...options,
          headers: {
            ...this.getAuthHeaders(),
            ...options.headers,
          },
        });
      }
    }

    return res;
  }

  async list(filters?: PositionStrategyFilters): Promise<PositionStrategy[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.is_current !== undefined) params.append('is_current', String(filters.is_current));
    if (filters?.search) params.append('search', filters.search);
    if (filters?.include_archived) params.append('include_archived', String(filters.include_archived));
    // Demander un grand nombre d'éléments pour éviter la pagination
    params.append('page_size', '10000');

    const url = `${this.BASE_URL}/api/trades/position-strategies${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await this.fetchWithAuth(url);

    if (!res.ok) {
      throw new Error(`Failed to fetch position strategies: ${res.statusText}`);
    }

    const data = await res.json();
    // Gérer la réponse paginée de DRF
    return Array.isArray(data) ? data : (data?.results || []);
  }

  async get(id: number): Promise<PositionStrategy> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/position-strategies/${id}/`);

    if (!res.ok) {
      throw new Error(`Failed to fetch position strategy: ${res.statusText}`);
    }

    return res.json();
  }

  async create(data: {
    title: string;
    description?: string;
    status?: 'active' | 'archived' | 'draft';
    strategy_content: {
      sections: Array<{
        title: string;
        rules: string[];
      }>;
    };
    version_notes?: string;
  }): Promise<PositionStrategy> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/position-strategies/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || `Failed to create position strategy: ${res.statusText}`);
    }

    return res.json();
  }

  async update(
    id: number,
    data: {
      title?: string;
      description?: string;
      status?: 'active' | 'archived' | 'draft';
      strategy_content?: {
        sections: Array<{
          title: string;
          rules: string[];
        }>;
      };
      version_notes?: string;
      create_new_version?: boolean;
    }
  ): Promise<PositionStrategy> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/position-strategies/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || `Failed to update position strategy: ${res.statusText}`);
    }

    return res.json();
  }

  async delete(id: number): Promise<void> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/position-strategies/${id}/`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      throw new Error(`Failed to delete position strategy: ${res.statusText}`);
    }
  }

  async getVersions(id: number): Promise<PositionStrategyVersion[]> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/position-strategies/${id}/versions/`);

    if (!res.ok) {
      throw new Error(`Failed to fetch versions: ${res.statusText}`);
    }

    return res.json();
  }

  async restoreVersion(id: number, versionId: number): Promise<PositionStrategy> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/trades/position-strategies/${id}/restore_version/`, {
      method: 'POST',
      body: JSON.stringify({ version_id: versionId }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || `Failed to restore version: ${res.statusText}`);
    }

    return res.json();
  }
}

export const positionStrategiesService = new PositionStrategiesService();

