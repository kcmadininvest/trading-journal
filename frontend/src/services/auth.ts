import apiClient from '../lib/apiClient';

export interface User {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
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

export interface RegisterData {
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  password: string;
  password_confirm: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface PasswordChangeData {
  old_password: string;
  new_password: string;
  new_password_confirm: string;
}

export interface PasswordResetData {
  email: string;
}

class AuthService {
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
    localStorage.removeItem('session_info');
    
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
  }

  async login(credentials: LoginData): Promise<LoginResponse> {
    try {
      const response = await apiClient.post('/accounts/auth/login/', credentials);
      const { access, refresh, user, session_info } = response.data;
      
      this.saveTokensToStorage(access, refresh, user);
      
      // Stocker les informations de session si disponibles
      if (session_info) {
        localStorage.setItem('session_info', JSON.stringify(session_info));
      }
      
      return { access, refresh, user };
    } catch (error: any) {
      // Gestion des erreurs spécifiques
      if (error.response?.status === 400) {
        const errors = error.response?.data;
        if (errors && typeof errors === 'object') {
          // Gestion des erreurs de validation Django
          if (errors.non_field_errors && errors.non_field_errors.length > 0) {
            throw new Error(errors.non_field_errors[0]);
          } else if (errors.email && errors.email.length > 0) {
            throw new Error('Aucun compte trouvé avec cette adresse email');
          } else if (errors.password && errors.password.length > 0) {
            throw new Error('Mot de passe incorrect');
          } else {
            throw new Error('Email ou mot de passe incorrect');
          }
        } else if (typeof errors === 'string') {
          throw new Error(errors);
        } else {
          throw new Error('Email ou mot de passe incorrect');
        }
      } else if (error.response?.status === 401) {
        throw new Error('Email ou mot de passe incorrect');
      } else if (error.response?.status === 404) {
        throw new Error('Aucun compte trouvé avec cette adresse email');
      } else if (error.response?.status >= 500) {
        throw new Error('Erreur du serveur. Veuillez réessayer plus tard');
      } else {
        throw new Error(error.response?.data?.detail || 'Erreur de connexion');
      }
    }
  }

  async register(userData: RegisterData): Promise<LoginResponse> {
    try {
      const response = await apiClient.post('/accounts/auth/register/', userData);
      const { access, refresh, user } = response.data;
      
      this.saveTokensToStorage(access, refresh, user);
      return { access, refresh, user };
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Erreur d\'inscription');
    }
  }

  async logout(): Promise<void> {
    try {
      if (this.refreshToken) {
        await apiClient.post('/accounts/auth/logout/', {
          refresh: this.refreshToken
        });
      }
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    } finally {
      this.clearStorage();
    }
  }

  async refreshAccessToken(): Promise<string | null> {
    if (!this.refreshToken) {
      return null;
    }

    try {
      const response = await apiClient.post('/accounts/auth/refresh/', {
        refresh: this.refreshToken
      });
      
      const { access } = response.data;
      this.accessToken = access;
      localStorage.setItem('access_token', access);
      
      return access;
    } catch (error) {
      console.error('Erreur lors du refresh du token:', error);
      this.clearStorage();
      return null;
    }
  }

  async changePassword(passwordData: PasswordChangeData): Promise<void> {
    try {
      await apiClient.post('/accounts/auth/password/change/', passwordData);
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Erreur lors du changement de mot de passe');
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    try {
      await apiClient.post('/accounts/auth/password/reset/', { email });
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Erreur lors de la demande de réinitialisation');
    }
  }

  async getUserProfile(): Promise<User> {
    try {
      const response = await apiClient.get('/accounts/profile/');
      const user = response.data;
      this.user = user;
      localStorage.setItem('user', JSON.stringify(user));
      return user;
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Erreur lors de la récupération du profil');
    }
  }

  async updateUserProfile(userData: Partial<User>): Promise<User> {
    try {
      const response = await apiClient.patch('/accounts/profile/', userData);
      const user = response.data;
      this.user = user;
      localStorage.setItem('user', JSON.stringify(user));
      return user;
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Erreur lors de la mise à jour du profil');
    }
  }

  async updateProfile(profileData: {
    first_name?: string;
    last_name?: string;
    username?: string;
    role?: string;
    is_verified?: boolean;
    is_active?: boolean;
  }): Promise<User> {
    try {
      const response = await apiClient.put('/accounts/profile/', profileData);
      const { user } = response.data;
      this.user = user;
      localStorage.setItem('user', JSON.stringify(user));
      return user;
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Erreur lors de la mise à jour du profil');
    }
  }

  async deleteAccount(): Promise<void> {
    try {
      await apiClient.delete('/accounts/profile/');
      // Nettoyer les données locales
      this.user = null;
      localStorage.removeItem('user');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Erreur lors de la suppression du compte');
    }
  }

  isAuthenticated(): boolean {
    return !!this.accessToken && !!this.user;
  }

  isAdmin(): boolean {
    return this.user?.is_admin || false;
  }

  isRegularUser(): boolean {
    return this.user?.is_regular_user || false;
  }

  getCurrentUser(): User | null {
    return this.user;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  updateCurrentUser(updatedUser: User): void {
    // Mettre à jour l'utilisateur dans le localStorage
    const userData = localStorage.getItem('user');
    if (userData) {
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  }
}

export const authService = new AuthService();
export default authService;
