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
  access: string;
  refresh: string;
  user: User;
}

class AuthService {
  private readonly BASE_URL = 'http://localhost:8000';
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private user: User | null = null;

  constructor() {
    this.loadTokensFromStorage();
  }

  private loadTokensFromStorage() {
    this.accessToken = localStorage.getItem('access_token');
    this.refreshToken = localStorage.getItem('refresh_token');
    
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

  private saveTokensToStorage(access: string, refresh: string, user: User) {
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    localStorage.setItem('user', JSON.stringify(user));
    
    this.accessToken = access;
    this.refreshToken = refresh;
    this.user = user;
  }

  private clearStorage() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    try {
      const response = await fetch(`${this.BASE_URL}/api/accounts/auth/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erreur de connexion');
      }

      const data = await response.json();
      const { access, refresh, user } = data;
      
      this.saveTokensToStorage(access, refresh, user);
      
      // Déclencher un événement pour recharger les données du nouvel utilisateur
      window.dispatchEvent(new CustomEvent('user:login', { 
        detail: { user } 
      }));
      
      return { access, refresh, user };
    } catch (error: any) {
      throw new Error(error.message || 'Erreur de connexion');
    }
  }

  async register(username: string, email: string, password: string): Promise<LoginResponse> {
    try {
      const response = await fetch(`${this.BASE_URL}/api/accounts/auth/register/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username, 
          email, 
          password,
          first_name: '',
          last_name: '',
          password_confirm: password
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erreur d\'inscription');
      }

      const data = await response.json();
      const { access, refresh, user } = data;
      
      this.saveTokensToStorage(access, refresh, user);
      
      // Déclencher un événement pour recharger les données du nouvel utilisateur
      window.dispatchEvent(new CustomEvent('user:login', { 
        detail: { user } 
      }));
      
      return { access, refresh, user };
    } catch (error: any) {
      throw new Error(error.message || 'Erreur d\'inscription');
    }
  }

  async logout(): Promise<void> {
    try {
      if (this.refreshToken) {
        await fetch(`${this.BASE_URL}/api/accounts/auth/logout/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh: this.refreshToken }),
        });
      }
    } catch (error: any) {
      console.error('Erreur lors de la déconnexion:', error);
    } finally {
      this.clearStorage();
      window.dispatchEvent(new CustomEvent('user:logout'));
    }
  }

  isAuthenticated(): boolean {
    return !!this.accessToken && !!this.user;
  }

  getCurrentUser(): User | null {
    return this.user;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }
}

export const authService = new AuthService();
export default authService;