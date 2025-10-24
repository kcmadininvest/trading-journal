import apiClient from '../lib/apiClient';

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
      rules: Array<{
        id: number;
        text: string;
      }>;
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
  status: string;
  version_notes: string;
  is_current: boolean;
  is_latest_version: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePositionStrategyData {
  title: string;
  description: string;
  status: 'active' | 'archived' | 'draft';
  strategy_content: {
    sections: Array<{
      title: string;
      rules: Array<{
        id: number;
        text: string;
      }>;
    }>;
  };
  version_notes: string;
}

export interface UpdatePositionStrategyData {
  title?: string;
  description?: string;
  status?: 'active' | 'archived' | 'draft';
  strategy_content?: {
    sections: Array<{
      title: string;
      rules: Array<{
        id: number;
        text: string;
      }>;
    }>;
  };
  version_notes?: string;
  create_new_version?: boolean;
}

class PositionStrategiesService {
  private baseUrl = '/trades/position-strategies/';

  async getStrategies(params?: {
    status?: string;
    is_current?: boolean;
    search?: string;
  }): Promise<PositionStrategy[]> {
    const response = await apiClient.get(this.baseUrl, { params });
    return response.data.results || response.data;
  }

  async getArchives(params?: {
    status?: string;
    search?: string;
  }): Promise<PositionStrategy[]> {
    const response = await apiClient.get(`${this.baseUrl}archives/`, { params });
    return response.data.results || response.data;
  }

  async getStrategy(id: number): Promise<PositionStrategy> {
    const response = await apiClient.get(`${this.baseUrl}${id}/`);
    return response.data;
  }

  async createStrategy(data: CreatePositionStrategyData): Promise<PositionStrategy> {
    const response = await apiClient.post(this.baseUrl, data);
    return response.data;
  }

  async updateStrategy(id: number, data: UpdatePositionStrategyData): Promise<PositionStrategy> {
    const response = await apiClient.patch(`${this.baseUrl}${id}/`, data);
    return response.data;
  }

  async deleteStrategy(id: number): Promise<void> {
    await apiClient.delete(`${this.baseUrl}${id}/`);
  }

  async getStrategyVersions(id: number): Promise<PositionStrategyVersion[]> {
    const response = await apiClient.get(`${this.baseUrl}${id}/versions/`);
    return response.data;
  }

  async restoreVersion(id: number, versionId: number): Promise<PositionStrategy> {
    const response = await apiClient.post(`${this.baseUrl}${id}/restore_version/`, {
      version_id: versionId
    });
    return response.data;
  }

  async getPrintView(id: number): Promise<any> {
    const response = await apiClient.get(`${this.baseUrl}${id}/print_view/`);
    return response.data;
  }

  async getCurrentStrategies(): Promise<PositionStrategy[]> {
    const response = await apiClient.get(`${this.baseUrl}current_strategies/`);
    return response.data;
  }

  async getStrategiesByStatus(): Promise<{ [status: string]: PositionStrategy[] }> {
    const response = await apiClient.get(`${this.baseUrl}by_status/`);
    return response.data;
  }

  async duplicateStrategy(id: number): Promise<PositionStrategy> {
    const response = await apiClient.post(`${this.baseUrl}${id}/duplicate/`);
    return response.data;
  }

  async getReadMode(id: number): Promise<any> {
    const response = await apiClient.get(`${this.baseUrl}${id}/read_mode/`);
    return response.data;
  }
}

export const positionStrategiesService = new PositionStrategiesService();
