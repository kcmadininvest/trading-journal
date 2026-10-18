import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emitSessionExpired,
  fetchWithAuth,
  resetSessionExpiredFlag,
} from './apiClient';

describe('apiClient refresh mutex', () => {
  beforeEach(() => {
    resetSessionExpiredFlag();
    vi.stubGlobal('fetch', vi.fn());
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => 'csrftoken=test-csrf',
      set: () => undefined,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('ne lance qu\'un seul refresh pour plusieurs 401 parallèles', async () => {
    const fetchMock = vi.mocked(fetch);
    let refreshCalls = 0;

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/auth/refresh/')) {
        refreshCalls += 1;
        await new Promise((r) => setTimeout(r, 30));
        return new Response('{}', { status: 200 });
      }
      if (url.includes('/auth/csrf/')) {
        return new Response('{}', { status: 200 });
      }
      // Premier passage : 401 ; après refresh : 200
      if (init?.headers && refreshCalls > 0) {
        return new Response('{"ok":true}', { status: 200 });
      }
      return new Response('Unauthorized', { status: 401 });
    });

    const results = await Promise.all([
      fetchWithAuth('http://localhost/api/trades/imported/', { method: 'GET' }),
      fetchWithAuth('http://localhost/api/trades/imported/', { method: 'GET' }),
      fetchWithAuth('http://localhost/api/trades/imported/', { method: 'GET' }),
    ]);

    expect(refreshCalls).toBe(1);
    expect(results.every((r) => r.status === 200)).toBe(true);
  });

  it('émet auth:session-expired une seule fois si refresh échoue', async () => {
    localStorage.setItem('user', JSON.stringify({ id: 1 }));
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/auth/refresh/')) {
        return new Response('{}', { status: 401 });
      }
      if (url.includes('/auth/csrf/')) {
        return new Response('{}', { status: 200 });
      }
      return new Response('Unauthorized', { status: 401 });
    });

    const events: Event[] = [];
    const handler = (e: Event) => events.push(e);
    window.addEventListener('auth:session-expired', handler);

    await Promise.all([
      fetchWithAuth('http://localhost/api/x/', { method: 'GET' }),
      fetchWithAuth('http://localhost/api/y/', { method: 'GET' }),
    ]);

    window.removeEventListener('auth:session-expired', handler);
    expect(events).toHaveLength(1);
    localStorage.removeItem('user');
  });

  it('emitSessionExpired est idempotent jusqu\'au reset', () => {
    const events: Event[] = [];
    const handler = (e: Event) => events.push(e);
    window.addEventListener('auth:session-expired', handler);
    emitSessionExpired();
    emitSessionExpired();
    expect(events).toHaveLength(1);
    resetSessionExpiredFlag();
    emitSessionExpired();
    expect(events).toHaveLength(2);
    window.removeEventListener('auth:session-expired', handler);
  });
});
