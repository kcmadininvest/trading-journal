import { getApiBaseUrl } from '../utils/apiConfig';

export interface IntegrationStatus {
  provider: string;
  display_name: string;
  configured: boolean;
  external_username: string;
  secrets_hint: Record<string, string>;
  is_connected: boolean;
  last_validated_at: string | null;
  required_secret_fields: string[];
  public_fields: string[];
}

export interface IntegrationListResponse {
  integrations: IntegrationStatus[];
}

export interface IntegrationInput {
  external_username?: string;
  api_key?: string;
}

export interface IntegrationTestResult {
  success: boolean;
  message: string;
  error_code?: string | null;
  integration?: IntegrationStatus;
}

class IntegrationsService {
  private readonly BASE_URL = getApiBaseUrl();

  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('access_token');
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private async fetchWithAuth(input: string, init: RequestInit = {}): Promise<Response> {
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string>),
      ...this.getAuthHeaders(),
    };
    return fetch(input, { ...init, headers });
  }

  async listIntegrations(): Promise<IntegrationListResponse> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/accounts/integrations/`);
    if (!res.ok) {
      throw new Error('Erreur lors du chargement des intégrations API.');
    }
    return res.json();
  }

  async getIntegration(provider: string): Promise<IntegrationStatus> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/accounts/integrations/${provider}/`);
    if (!res.ok) {
      throw new Error('Erreur lors du chargement de l\'intégration.');
    }
    return res.json();
  }

  async saveIntegration(provider: string, data: IntegrationInput): Promise<IntegrationStatus> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/accounts/integrations/${provider}/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) {
      const msg =
        body?.error ||
        body?.api_key?.[0] ||
        'Erreur lors de l\'enregistrement de l\'intégration.';
      throw new Error(msg);
    }
    return body.integration as IntegrationStatus;
  }

  async deleteIntegration(provider: string): Promise<void> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/accounts/integrations/${provider}/`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error || 'Erreur lors de la suppression de l\'intégration.');
    }
  }

  async testConnection(provider: string, data?: IntegrationInput): Promise<IntegrationTestResult> {
    const res = await this.fetchWithAuth(
      `${this.BASE_URL}/api/accounts/integrations/${provider}/test-connection/`,
      {
        method: 'POST',
        body: JSON.stringify(data ?? {}),
      }
    );
    const body = await res.json();
    if (!res.ok && res.status !== 400) {
      throw new Error(body?.error || 'Erreur lors du test de connexion.');
    }
    return body as IntegrationTestResult;
  }
}

const integrationsService = new IntegrationsService();
export default integrationsService;
