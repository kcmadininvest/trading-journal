import { request as playwrightRequest, type APIRequestContext } from '@playwright/test';

const apiURL = process.env.E2E_API_URL ?? 'http://127.0.0.1:8100';

export const TEST_EMAIL = 'e2e@localhost';

export function testPassword(): string {
  const password = process.env.E2E_TEST_PASSWORD;
  if (!password) {
    throw new Error('E2E_TEST_PASSWORD est requis.');
  }
  return password;
}

export type LoginPayload = {
  access: string;
  refresh: string;
  user: Record<string, unknown>;
};

export async function apiContext(): Promise<APIRequestContext> {
  return playwrightRequest.newContext({ baseURL: apiURL });
}

export async function login(api: APIRequestContext, email = TEST_EMAIL, password = testPassword()): Promise<LoginPayload> {
  const response = await api.post('/api/accounts/auth/login/', {
    data: { email, password },
  });
  if (!response.ok()) {
    throw new Error(`Login API ${response.status()} ${await response.text()}`);
  }
  return response.json() as Promise<LoginPayload>;
}

function authHeaders(access: string): { Authorization: string } {
  return { Authorization: `Bearer ${access}` };
}

export async function createTradingAccount(api: APIRequestContext, access: string, name: string): Promise<number> {
  const response = await api.post('/api/trades/trading-accounts/', {
    headers: authHeaders(access),
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

export async function deleteTradingAccount(api: APIRequestContext, access: string, id: number): Promise<void> {
  const response = await api.delete(`/api/trades/trading-accounts/${id}/`, {
    headers: authHeaders(access),
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
  access: string,
  sessionDate?: string,
): Promise<SessionRow | null> {
  const qs = new URLSearchParams();
  if (sessionDate) {
    qs.set('date_from', sessionDate);
    qs.set('date_to', sessionDate);
  }
  const query = qs.toString();
  const response = await api.get(`/api/trades/replay/sessions/${query ? `?${query}` : ''}`, {
    headers: authHeaders(access),
  });
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
  access: string,
): Promise<{ instrument: string; date: string } | null> {
  const instrumentsResponse = await api.get('/api/market-data/instruments/?with_bars=1', {
    headers: authHeaders(access),
  });
  if (!instrumentsResponse.ok()) {
    throw new Error(`Instruments ${instrumentsResponse.status()} ${await instrumentsResponse.text()}`);
  }
  const instruments = await instrumentsResponse.json();
  const list = Array.isArray(instruments) ? instruments : [];
  const instrument = list[0]?.instrument as string | undefined;
  if (!instrument) return null;
  const sessionsResponse = await api.get(
    `/api/market-data/instruments/${encodeURIComponent(instrument)}/available-sessions/`,
    { headers: authHeaders(access) },
  );
  if (!sessionsResponse.ok()) {
    throw new Error(`Séances ${sessionsResponse.status()} ${await sessionsResponse.text()}`);
  }
  const sessionsBody = await sessionsResponse.json();
  const date = (sessionsBody.latest as string | null) ?? sessionsBody.sessions?.[0];
  if (!date) return null;
  return { instrument, date };
}
