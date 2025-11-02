import { getApiBaseUrl } from '../utils/apiConfig';

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
  private readonly BASE_URL = getApiBaseUrl();
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

  async register(username: string, email: string, password: string, firstName: string, lastName: string): Promise<LoginResponse> {
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
          first_name: firstName,
          last_name: lastName,
          password_confirm: password
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Gérer les erreurs de validation du backend
        if (errorData && typeof errorData === 'object') {
          // Créer un mapping des champs pour des messages plus clairs
          const fieldLabels: { [key: string]: string } = {
            'email': 'Adresse email',
            'username': 'Nom d\'utilisateur',
            'password': 'Mot de passe',
            'password_confirm': 'Confirmation du mot de passe',
            'first_name': 'Prénom',
            'last_name': 'Nom',
          };
          
          // Formater les messages d'erreur de manière plus lisible
          const errorMessages: string[] = [];
          
          Object.entries(errorData).forEach(([key, value]: [string, any]) => {
            const fieldLabel = fieldLabels[key] || key;
            
            if (Array.isArray(value)) {
              // Pour chaque erreur du champ
              value.forEach((msg: string) => {
                // Format standardisé : "Champ : Message"
                // Le composant se chargera de la traduction
                errorMessages.push(`${fieldLabel} : ${msg}`);
              });
            } else if (typeof value === 'string') {
              errorMessages.push(`${fieldLabel} : ${value}`);
            }
          });
          
          // Retourner les messages formatés, un par ligne
          if (errorMessages.length > 0) {
            throw new Error(errorMessages.join('\n'));
          }
        }
        throw new Error(errorData.detail || errorData.message || errorData.error || 'Erreur d\'inscription');
      }

      const data = await response.json();
      
      // Le compte n'est pas activé, donc pas de tokens
      // On ne doit pas sauvegarder les tokens si le compte n'est pas actif
      if (data.is_active === false || !data.access) {
        // Le compte nécessite une activation par email
        // Ne pas connecter l'utilisateur automatiquement
        throw new Error(data.message || 'Votre compte a été créé. Veuillez vérifier votre email pour l\'activer.');
      }
      
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

  /**
   * Rafraîchit le token d'accès en utilisant le refresh token
   * Retourne le nouveau token d'accès ou null en cas d'échec
   */
  async refreshAccessToken(): Promise<string | null> {
    const refresh = this.refreshToken || localStorage.getItem('refresh_token');
    if (!refresh) {
      return null;
    }

    try {
      const response = await fetch(`${this.BASE_URL}/api/accounts/auth/refresh/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const newAccess = data.access as string | undefined;

      if (newAccess) {
        this.accessToken = newAccess;
        localStorage.setItem('access_token', newAccess);
        return newAccess;
      }

      return null;
    } catch (error) {
      console.error('Erreur lors du rafraîchissement du token:', error);
      return null;
    }
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