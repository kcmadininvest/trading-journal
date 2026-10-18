import { request as playwrightRequest, type APIRequestContext } from '@playwright/test';

/** Same-origin via proxy Vite (cookies HttpOnly) — défaut = front e2e. */
const apiURL = process.env.E2E_API_URL ?? process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3100';

export const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'e2e@localhost';

export function testPassword(): string {
  const password = process.env.E2E_TEST_PASSWORD;
  if (!password) {
    throw new Error('E2E_TEST_PASSWORD est requis.');
  }
  return password;
}

export type LoginResult = {
  user: Record<string, unknown>;
};

export async function apiContext(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({
    baseURL: apiURL,
    // Jar cookie pour tj_access / tj_refresh / csrftoken
  });
}

async function csrfHeaders(api: APIRequestContext): Promise<Record<string, string>> {
  await api.get('/api/accounts/auth/csrf/');
  const state = await api.storageState();
  const csrf = state.cookies.find((c) => c.name === 'csrftoken')?.value;
  return csrf ? { 'X-CSRFToken': csrf } : {};
}

/**
 * Login cookie-aware : Set-Cookie tj_* sur le contexte, pas de JWT dans le JSON.
 */
export async function login(
  api: APIRequestContext,
  email = TEST_EMAIL,
  password = testPassword(),
): Promise<LoginResult> {
  const headers = await csrfHeaders(api);
  const response = await api.post('/api/accounts/auth/login/', {
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    data: { email, password },
  });
  if (!response.ok()) {
    throw new Error(`Login API ${response.status()} ${await response.text()}`);
  }
  const body = (await response.json()) as { user?: Record<string, unknown> };
  if (!body.user) {
    throw new Error('Login API : user manquant dans la réponse');
  }
  return { user: body.user };
}

export async function createTradingAccount(api: APIRequestContext, name: string): Promise<number> {
  const headers = await csrfHeaders(api);
  const response = await api.post('/api/trades/trading-accounts/', {
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    data: {
      name,
      account_type: 'other',
      currency: 'USD',
      is_default: false,
    },
  });
  if (!response.ok()) {
    throw new Error(`Création compte ${response.status()} ${await response.text()}`);
  }
  const body = await response.json();
  return body.id as number;
}

export async function deleteTradingAccount(api: APIRequestContext, id: number): Promise<void> {
  const headers = await csrfHeaders(api);
  const response = await api.delete(`/api/trades/trading-accounts/${id}/`, {
    headers,
  });
  if (!response.ok() && response.status() !== 404) {
    throw new Error(`Suppression compte ${response.status()} ${await response.text()}`);
  }
}

type SessionRow = {
  id: number;
  trading_account: number;
  session_date: string;
  status: string;
  event_count?: number;
  market_data?: { status?: string } | null;
};

export async function findBuiltSession(
  api: APIRequestContext,
  sessionDate?: string,
): Promise<SessionRow | null> {
  const qs = new URLSearchParams();
  if (sessionDate) {
    qs.set('date_from', sessionDate);
    qs.set('date_to', sessionDate);
  }
  const query = qs.toString();
  const response = await api.get(`/api/trades/replay/sessions/${query ? `?${query}` : ''}`);
  if (!response.ok()) {
    throw new Error(`Sessions ${response.status()} ${await response.text()}`);
  }
  const body = await response.json();
  const rows: SessionRow[] = Array.isArray(body) ? body : (body.results ?? []);
  const built = rows.filter((row) => row.status === 'built' && (row.event_count ?? 0) > 0);
  const withTape = built.find((row) => row.market_data?.status === 'ok' || row.market_data?.status === 'partial');
  return withTape ?? built[0] ?? null;
}

export async function findMarketReplayTarget(
  api: APIRequestContext,
): Promise<{ instrument: string; date: string } | null> {
  const instrumentsResponse = await api.get('/api/market-data/instruments/?with_bars=1');
  if (!instrumentsResponse.ok()) {
    throw new Error(`Instruments ${instrumentsResponse.status()} ${await instrumentsResponse.text()}`);
  }
  const instruments = await instrumentsResponse.json();
  const list = Array.isArray(instruments) ? instruments : [];
  const instrument = list[0]?.instrument as string | undefined;
  if (!instrument) return null;
  const sessionsResponse = await api.get(
    `/api/market-data/instruments/${encodeURIComponent(instrument)}/available-sessions/`,
  );
  if (!sessionsResponse.ok()) {
    throw new Error(`Séances ${sessionsResponse.status()} ${await sessionsResponse.text()}`);
  }
  const sessionsBody = await sessionsResponse.json();
  const date = (sessionsBody.latest as string | null) ?? sessionsBody.sessions?.[0];
  if (!date) return null;
  return { instrument, date };
}
