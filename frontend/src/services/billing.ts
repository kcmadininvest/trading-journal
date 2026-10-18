import { getApiBaseUrl } from '../utils/apiConfig';
import { fetchWithAuth } from './apiClient';

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

  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    const res = await fetchWithAuth(`${this.BASE_URL}/api/billing/subscription/`, { method: 'GET' });
    if (!res.ok) throw new Error('Unable to fetch subscription status');
    return res.json();
  }

  async createCheckoutSession(): Promise<{ session_id: string; checkout_url: string }> {
    const res = await fetchWithAuth(`${this.BASE_URL}/api/billing/checkout-session/`, {
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
    const res = await fetchWithAuth(`${this.BASE_URL}/api/billing/portal-session/`, {
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

