/**
 * Client HTTP authentifié par cookies HttpOnly (credentials include + CSRF).
 * Refresh single-flight pour éviter les races ROTATE+BLACKLIST.
 */

const CSRF_COOKIE = 'csrftoken';
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

let refreshPromise: Promise<boolean> | null = null;
let sessionExpiredEmitted = false;

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&')}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function resetSessionExpiredFlag(): void {
  sessionExpiredEmitted = false;
}

export function emitSessionExpired(): void {
  if (sessionExpiredEmitted) return;
  sessionExpiredEmitted = true;
  window.dispatchEvent(new CustomEvent('auth:session-expired'));
}

async function ensureCsrfCookie(baseUrl: string): Promise<void> {
  if (getCookie(CSRF_COOKIE)) return;
  try {
    await fetch(`${baseUrl}/api/accounts/auth/csrf/`, {
      method: 'GET',
      credentials: 'include',
    });
  } catch {
    // ignore — la requête suivante échouera clairement si CSRF manquant
  }
}

function withCsrfHeaders(method: string, headers: Record<string, string>): Record<string, string> {
  if (!UNSAFE_METHODS.has(method.toUpperCase())) {
    return headers;
  }
  const csrf = getCookie(CSRF_COOKIE);
  if (csrf) {
    headers['X-CSRFToken'] = csrf;
  }
  return headers;
}

/** DRF renvoie 415 si body JSON sans Content-Type (cas fréquent après migration cookie). */
function withJsonContentType(
  headers: Record<string, string>,
  body: BodyInit | null | undefined,
): Record<string, string> {
  if (typeof body !== 'string' || body.length === 0) {
    return headers;
  }
  const hasContentType = Object.keys(headers).some((k) => k.toLowerCase() === 'content-type');
  if (!hasContentType) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

async function refreshSession(baseUrl: string): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      await ensureCsrfCookie(baseUrl);
      const headers = withCsrfHeaders('POST', { 'Content-Type': 'application/json' });
      const response = await fetch(`${baseUrl}/api/accounts/auth/refresh/`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: '{}',
      });
      if (!response.ok) {
        return false;
      }
      window.dispatchEvent(new CustomEvent('auth:token-refreshed'));
      return true;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export type FetchWithAuthOptions = RequestInit & {
  /** Si false, ne tente pas de refresh sur 401 (défaut true). */
  retry?: boolean;
  /** Base URL (défaut dérivée de l'URL absolue ou vide). */
  baseUrl?: string;
};

function resolveBaseUrl(input: string, explicit?: string): string {
  if (explicit) return explicit.replace(/\/$/, '');
  try {
    if (input.startsWith('http://') || input.startsWith('https://')) {
      return new URL(input).origin;
    }
  } catch {
    // ignore
  }
  return typeof window !== 'undefined' ? window.location.origin : '';
}

/**
 * fetch authentifié : cookies HttpOnly + CSRF + retry refresh mutex.
 */
export async function fetchWithAuth(
  input: string,
  init: FetchWithAuthOptions = {},
): Promise<Response> {
  const { retry = true, baseUrl: explicitBase, ...rest } = init;
  const method = (rest.method || 'GET').toUpperCase();
  const baseUrl = resolveBaseUrl(input, explicitBase);

  if (UNSAFE_METHODS.has(method)) {
    await ensureCsrfCookie(baseUrl);
  }

  const headers: Record<string, string> = {
    ...((rest.headers as Record<string, string>) || {}),
  };
  withJsonContentType(headers, rest.body);
  withCsrfHeaders(method, headers);

  const res = await fetch(input, {
    ...rest,
    method,
    headers,
    credentials: 'include',
  });

  if (res.status === 401 && retry) {
    const refreshed = await refreshSession(baseUrl);
    if (refreshed) {
      const headers2: Record<string, string> = {
        ...((rest.headers as Record<string, string>) || {}),
      };
      withJsonContentType(headers2, rest.body);
      withCsrfHeaders(method, headers2);
      return fetch(input, {
        ...rest,
        method,
        headers: headers2,
        credentials: 'include',
      });
    }
    // Émettre seulement si une session était attendue (cookie refresh ou user LS).
    const hadSession =
      !!getCookie('tj_refresh') ||
      (typeof localStorage !== 'undefined' && !!localStorage.getItem('user'));
    if (hadSession) {
      emitSessionExpired();
    }
  }

  return res;
}

export async function bootstrapCsrf(baseUrl: string): Promise<void> {
  await ensureCsrfCookie(baseUrl.replace(/\/$/, ''));
}
