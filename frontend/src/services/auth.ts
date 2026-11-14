import { getApiBaseUrl } from '../utils/apiConfig';
import { clearTradingJournalFilterStorageKeys } from '../hooks/usePersistedPeriodAndStrategyFilters';
import { parseRequestOptions, serializeCredential, splitChallengeResponse } from '../utils/webauthn';
import { bootstrapCsrf, fetchWithAuth, resetSessionExpiredFlag } from './apiClient';

export interface User {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: 'user' | 'admin';
  is_verified: boolean;
  is_active: boolean;
  is_admin: boolean;
  is_regular_user: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginResponse {
  user: User;
}

export interface LoginRequires2FA {
  requires_2fa: true;
  challenge: string;
}

export type LoginResult = LoginResponse | LoginRequires2FA;

function isRequires2FA(data: any): data is LoginRequires2FA {
  return Boolean(data && data.requires_2fa && data.challenge);
}

/** Erreur API auth avec métadonnées (ex. rate limit 429). */
export class AuthRequestError extends Error {
  status?: number;
  code?: string;
  wait?: number | null;

  constructor(
    message: string,
    opts?: { status?: number; code?: string; wait?: number | null },
  ) {
    super(message);
    this.name = 'AuthRequestError';
    this.status = opts?.status;
    this.code = opts?.code;
    this.wait = opts?.wait ?? null;
  }
}

export function parseThrottleWaitSeconds(detail: unknown): number | null {
  if (typeof detail !== 'string') return null;
  const match = detail.match(/(\d+)\s*seconds?/i) || detail.match(/(\d+)\s*secondes?/i);
  if (!match) return null;
  const n = Number.parseInt(match[1], 10);
  return Number.isFinite(n) ? n : null;
}

export function isAuthThrottledError(err: unknown): err is AuthRequestError {
  if (err instanceof AuthRequestError) {
    return err.status === 429 || err.code === 'throttled';
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes('throttl') ||
      msg.includes('ralentie') ||
      msg.includes('trop de tentatives') ||
      msg.includes('expected available') ||
      msg.includes('too many')
    );
  }
  return false;
}

function throwFromAuthResponse(response: Response, data: any, fallback: string): never {
  const detail = typeof data?.detail === 'string' && data.detail.trim() ? data.detail : fallback;
  const wait =
    typeof data?.wait === 'number'
      ? data.wait
      : parseThrottleWaitSeconds(detail);
  if (response.status === 429 || data?.code === 'throttled') {
    throw new AuthRequestError(detail, {
      status: 429,
      code: 'throttled',
      wait,
    });
  }
  throw new AuthRequestError(detail, {
    status: response.status,
    code: typeof data?.code === 'string' ? data.code : undefined,
  });
}

class AuthService {
  private readonly BASE_URL = getApiBaseUrl();
  private user: User | null = null;
  private bootstrapPromise: Promise<User | null> | null = null;

  constructor() {
    this.loadUserFromStorage();
  }

  private loadUserFromStorage() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        this.user = JSON.parse(userStr);
      } catch (e) {
        console.error('Erreur lors du parsing des données utilisateur:', e);
        this.clearStorage();
      }
    }
  }

  private saveUser(user: User) {
    this.user = user;
    localStorage.setItem('user', JSON.stringify(user));
  }

  private clearStorage() {
    clearTradingJournalFilterStorageKeys();
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    this.user = null;
  }

  async ensureCsrf(): Promise<void> {
    await bootstrapCsrf(this.BASE_URL);
  }

  /**
   * Vérifie la session cookie (profil). Utilisé au démarrage SPA.
   */
  async bootstrapSession(): Promise<User | null> {
    if (this.bootstrapPromise) {
      return this.bootstrapPromise;
    }
    this.bootstrapPromise = (async () => {
      await this.ensureCsrf();
      try {
        const response = await fetchWithAuth(`${this.BASE_URL}/api/accounts/profile/`, {
          method: 'GET',
          // Pas de refresh/emit au boot anonyme (évite ConfirmModal « session expirée » sur la home).
          retry: false,
          baseUrl: this.BASE_URL,
        });
        if (!response.ok) {
          if (response.status === 401) {
            this.clearStorage();
          }
          return null;
        }
        const user = (await response.json()) as User;
        this.saveUser(user);
        resetSessionExpiredFlag();
        return user;
      } catch {
        return this.user;
      } finally {
        this.bootstrapPromise = null;
      }
    })();
    return this.bootstrapPromise;
  }

  private finalizeLogin(user: User): LoginResponse {
    this.saveUser(user);
    resetSessionExpiredFlag();
    window.dispatchEvent(new CustomEvent('user:login', { detail: { user } }));
    return { user };
  }

  async login(username: string, password: string): Promise<LoginResult> {
    await this.ensureCsrf();
    try {
      const response = await fetchWithAuth(`${this.BASE_URL}/api/accounts/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: username, password }),
        retry: false,
        baseUrl: this.BASE_URL,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throwFromAuthResponse(response, data, 'Erreur de connexion');
      }
      if (isRequires2FA(data)) {
        return { requires_2fa: true, challenge: data.challenge };
      }
      return this.finalizeLogin(data.user as User);
    } catch (error: any) {
      if (error instanceof AuthRequestError) throw error;
      throw new AuthRequestError(error.message || 'Erreur de connexion');
    }
  }

  async beginPasskeyLogin(
    email?: string,
    signal?: AbortSignal,
  ): Promise<{ challengeId: string; options: any }> {
    await this.ensureCsrf();
    const response = await fetchWithAuth(`${this.BASE_URL}/api/accounts/auth/login/passkey/begin/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(email ? { email } : {}),
      retry: false,
      baseUrl: this.BASE_URL,
      signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throwFromAuthResponse(response, data, 'Erreur de connexion');
    }
    return splitChallengeResponse(data);
  }

  async finishPasskeyLogin(challengeId: string, credential: Record<string, unknown>): Promise<LoginResponse> {
    await this.ensureCsrf();
    const response = await fetchWithAuth(`${this.BASE_URL}/api/accounts/auth/login/passkey/finish/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge_id: challengeId, credential }),
      retry: false,
      baseUrl: this.BASE_URL,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throwFromAuthResponse(response, data, 'Erreur de connexion');
    }
    return this.finalizeLogin(data.user as User);
  }

  /**
   * Connexion par passkey. `conditional` : autofill du navigateur (sans email, annulable via `signal`).
   * Avec `email`, le serveur restreint les credentials autorisés à ce compte.
   */
  async loginWithPasskey(opts: {
    email?: string;
    conditional?: boolean;
    signal?: AbortSignal;
  } = {}): Promise<LoginResponse> {
    const { email, conditional = false, signal } = opts;
    const { challengeId, options } = await this.beginPasskeyLogin(email, signal);
    const credential = await navigator.credentials.get({
      publicKey: parseRequestOptions(options),
      ...(conditional ? { mediation: 'conditional' as CredentialMediationRequirement } : {}),
      signal,
    });
    if (!credential) {
      throw new Error('Connexion par passkey annulée');
    }
    return this.finishPasskeyLogin(challengeId, serializeCredential(credential));
  }

  async verifyTwoFactor(challenge: string, code: string): Promise<LoginResponse> {
    await this.ensureCsrf();
    const response = await fetchWithAuth(`${this.BASE_URL}/api/accounts/auth/login/2fa/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challenge, code }),
      retry: false,
      baseUrl: this.BASE_URL,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throwFromAuthResponse(response, data, 'Code invalide');
    }
    return this.finalizeLogin(data.user as User);
  }

  async requestTwoFactorRecovery(email: string): Promise<string> {
    await this.ensureCsrf();
    const response = await fetchWithAuth(`${this.BASE_URL}/api/accounts/auth/2fa-recovery/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      retry: false,
      baseUrl: this.BASE_URL,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || 'Erreur de récupération');
    }
    return data.message || '';
  }

  async confirmTwoFactorRecovery(token: string): Promise<string> {
    await this.ensureCsrf();
    const response = await fetchWithAuth(`${this.BASE_URL}/api/accounts/auth/2fa-recovery/confirm/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      retry: false,
      baseUrl: this.BASE_URL,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || 'Lien invalide ou expiré');
    }
    return data.message || '';
  }

  async cancelTwoFactorRecovery(cancelToken: string): Promise<string> {
    await this.ensureCsrf();
    const response = await fetchWithAuth(`${this.BASE_URL}/api/accounts/auth/2fa-recovery/cancel/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancel_token: cancelToken }),
      retry: false,
      baseUrl: this.BASE_URL,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || 'Erreur');
    }
    return data.message || '';
  }

  async register(username: string, email: string, password: string, firstName: string, lastName: string): Promise<LoginResponse> {
    await this.ensureCsrf();
    try {
      const response = await fetchWithAuth(`${this.BASE_URL}/api/accounts/auth/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          password_confirm: password,
        }),
        retry: false,
        baseUrl: this.BASE_URL,
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData && typeof errorData === 'object') {
          const fieldLabels: { [key: string]: string } = {
            email: 'Adresse email',
            username: "Nom d'utilisateur",
            password: 'Mot de passe',
            password_confirm: 'Confirmation du mot de passe',
            first_name: 'Prénom',
            last_name: 'Nom',
          };
          const errorMessages: string[] = [];
          Object.entries(errorData).forEach(([key, value]: [string, any]) => {
            const fieldLabel = fieldLabels[key] || key;
            if (Array.isArray(value)) {
              value.forEach((msg: string) => {
                errorMessages.push(`${fieldLabel} : ${msg}`);
              });
            } else if (typeof value === 'string') {
              errorMessages.push(`${fieldLabel} : ${value}`);
            }
          });
          if (errorMessages.length > 0) {
            throw new Error(errorMessages.join('\n'));
          }
        }
        throw new Error(errorData.detail || errorData.message || errorData.error || "Erreur d'inscription");
      }

      const data = await response.json();

      if (data.is_active === false || !data.user) {
        throw new Error(data.message || 'Votre compte a été créé. Veuillez vérifier votre email pour l\'activer.');
      }

      // Si le backend pose déjà des cookies (compte actif), synchroniser le user
      if (data.user) {
        this.saveUser(data.user);
        resetSessionExpiredFlag();
        window.dispatchEvent(new CustomEvent('user:login', { detail: { user: data.user } }));
        return { user: data.user };
      }

      throw new Error(data.message || "Erreur d'inscription");
    } catch (error: any) {
      throw new Error(error.message || "Erreur d'inscription");
    }
  }

  async logout(): Promise<void> {
    try {
      await this.ensureCsrf();
      await fetchWithAuth(`${this.BASE_URL}/api/accounts/auth/logout/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        retry: false,
        baseUrl: this.BASE_URL,
      });
    } catch (error: any) {
      console.error('Erreur lors de la déconnexion:', error);
    } finally {
      this.clearStorage();
      resetSessionExpiredFlag();
      window.dispatchEvent(new CustomEvent('user:logout'));
    }
  }

  /** Purge locale après expiration (ne réémet pas l'event — déjà émis par apiClient). */
  handleSessionExpired(): void {
    this.clearStorage();
    resetSessionExpiredFlag();
  }

  isAuthenticated(): boolean {
    return !!this.user;
  }

  getCurrentUser(): User | null {
    return this.user;
  }

  /**
   * Rafraîchit la session via cookie (mutex dans apiClient).
   * Retourne true si OK.
   */
  async refreshAccessToken(): Promise<string | null> {
    await this.ensureCsrf();
    const response = await fetchWithAuth(`${this.BASE_URL}/api/accounts/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      retry: false,
      baseUrl: this.BASE_URL,
    });
    if (!response.ok) {
      return null;
    }
    window.dispatchEvent(new CustomEvent('auth:token-refreshed'));
    return 'ok';
  }

  updateUser(userData: Partial<User>): void {
    if (this.user) {
      this.user = { ...this.user, ...userData };
      localStorage.setItem('user', JSON.stringify(this.user));
    }
  }

  async requestPasswordReset(email: string): Promise<string> {
    await this.ensureCsrf();
    const response = await fetchWithAuth(`${this.BASE_URL}/api/accounts/auth/password-reset/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      retry: false,
      baseUrl: this.BASE_URL,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.detail || data.error || data.message || 'Erreur de réinitialisation');
    }
    return data.message || '';
  }

  async confirmPasswordReset(
    token: string,
    newPassword: string,
    newPasswordConfirm: string,
  ): Promise<string> {
    await this.ensureCsrf();
    const response = await fetchWithAuth(`${this.BASE_URL}/api/accounts/auth/password-reset/confirm/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        new_password: newPassword,
        new_password_confirm: newPasswordConfirm,
      }),
      retry: false,
      baseUrl: this.BASE_URL,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (data && typeof data === 'object') {
        const parts: string[] = [];
        Object.values(data).forEach((value) => {
          if (Array.isArray(value)) {
            value.forEach((msg) => parts.push(String(msg)));
          } else if (typeof value === 'string') {
            parts.push(value);
          }
        });
        if (parts.length > 0) {
          throw new Error(parts.join('\n'));
        }
      }
      throw new Error(data.detail || data.error || data.message || 'Erreur de réinitialisation');
    }
    // Cookies JWT cleared côté serveur — purger le user local
    this.clearStorage();
    resetSessionExpiredFlag();
    return data.message || '';
  }
}

export const authService = new AuthService();
export default authService;
