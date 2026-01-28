import { getApiBaseUrl } from '../utils/apiConfig';
import axios from 'axios';

const API_BASE_URL = getApiBaseUrl();

export interface ExportTemplate {
  id: number;
  name: string;
  format: 'pdf' | 'excel';
  is_default: boolean;
  configuration: ExportConfiguration;
  created_at: string;
  updated_at: string;
}

export interface ExportConfiguration {
  sections: {
    header?: boolean;
    metrics?: boolean;
    trades_list?: string;
  };
  options: {
    watermark?: boolean;
    page_numbers?: boolean;
    period_start?: string;
    period_end?: string;
  };
}

export interface ExportRequest {
  trading_account_id: number;
  format: 'pdf' | 'excel';
  template_id?: number;
  configuration?: ExportConfiguration;
  start_date?: string;
  end_date?: string;
}

class ExportService {
  private getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async getTemplates(format?: 'pdf' | 'excel'): Promise<ExportTemplate[]> {
    const params = format ? { template_format: format } : {};
    const response = await axios.get(`${API_BASE_URL}/api/trades/export-templates/`, {
      headers: this.getAuthHeaders(),
      params,
    });
    return response.data.results || response.data;
  }

  async createTemplate(data: Partial<ExportTemplate>): Promise<ExportTemplate> {
    const response = await axios.post(`${API_BASE_URL}/api/trades/export-templates/`, data, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async updateTemplate(id: number, data: Partial<ExportTemplate>): Promise<ExportTemplate> {
    const response = await axios.put(`${API_BASE_URL}/api/trades/export-templates/${id}/`, data, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async deleteTemplate(id: number): Promise<void> {
    await axios.delete(`${API_BASE_URL}/api/trades/export-templates/${id}/`, {
      headers: this.getAuthHeaders(),
    });
  }

  async setDefaultTemplate(id: number): Promise<void> {
    await axios.post(`${API_BASE_URL}/api/trades/export-templates/${id}/set-default/`, {}, {
      headers: this.getAuthHeaders(),
    });
  }

  async getDefaultTemplates(): Promise<{ pdf: ExportTemplate | null; excel: ExportTemplate | null }> {
    const response = await axios.get(`${API_BASE_URL}/api/trades/export-templates/defaults/`, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async generateExport(request: ExportRequest): Promise<Blob> {
    const response = await axios.post(
      `${API_BASE_URL}/api/trades/portfolio-export/generate/`,
      request,
      {
        headers: this.getAuthHeaders(),
        responseType: 'blob',
      }
    );
    return response.data;
  }
}

const exportService = new ExportService();
export default exportService;
