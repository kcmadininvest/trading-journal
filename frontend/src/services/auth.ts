import { getApiBaseUrl } from '../utils/apiConfig';
import { clearTradingJournalFilterStorageKeys } from '../hooks/usePersistedPeriodAndStrategyFilters';
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

  async login(username: string, password: string): Promise<LoginResponse> {
    await this.ensureCsrf();
    try {
      const response = await fetchWithAuth(`${this.BASE_URL}/api/accounts/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: username, password }),
        retry: false,
        baseUrl: this.BASE_URL,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Erreur de connexion');
      }

      const data = await response.json();
      const user = data.user as User;
      this.saveUser(user);
      resetSessionExpiredFlag();

      window.dispatchEvent(new CustomEvent('user:login', { detail: { user } }));

      return { user };
    } catch (error: any) {
      throw new Error(error.message || 'Erreur de connexion');
    }
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

  /** @deprecated Tokens plus en JS — conservé pour compat WS legacy / tests. */
  getAccessToken(): string | null {
    return null;
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
}

export const authService = new AuthService();
export default authService;
