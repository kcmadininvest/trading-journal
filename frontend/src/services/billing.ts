import { getApiBaseUrl } from '../utils/apiConfig';
import { authService } from './auth';

export type BillingAccessState = 'admin_bypass' | 'trialing' | 'active' | 'inactive';

export interface SubscriptionStatus {
  access_state: BillingAccessState;
  trial_days_left: number;
  can_subscribe: boolean;
  checkout_enabled: boolean;
  status: string;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
}

class BillingService {
  private readonly BASE_URL = getApiBaseUrl();

  private getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private async refreshAccessToken(): Promise<boolean> {
    const access = await authService.refreshAccessToken();
    return !!access;
  }

  private async fetchWithAuth(url: string, init: RequestInit = {}, retry = true): Promise<Response> {
    const res = await fetch(url, {
      ...init,
      headers: {
        ...(init.headers || {}),
        ...this.getAuthHeaders(),
      },
    });
    if (res.status === 401 && retry) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        return this.fetchWithAuth(url, init, false);
      }
    }
    return res;
  }

  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/billing/subscription/`, { method: 'GET' });
    if (!res.ok) throw new Error('Unable to fetch subscription status');
    return res.json();
  }

  async createCheckoutSession(): Promise<{ session_id: string; checkout_url: string }> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/billing/checkout-session/`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || 'Unable to start checkout');
    }
    return res.json();
  }

  async createPortalSession(): Promise<{ portal_url: string }> {
    const res = await this.fetchWithAuth(`${this.BASE_URL}/api/billing/portal-session/`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || 'Unable to open billing portal');
    }
    return res.json();
  }
}

export const billingService = new BillingService();

