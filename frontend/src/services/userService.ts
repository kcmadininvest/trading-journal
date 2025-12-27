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
  last_login?: string;
  trades_count?: number;
}

export interface PaginatedUsersResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: User[];
}

export interface UserUpdateData {
  first_name?: string;
  last_name?: string;
  username?: string;
  role?: 'user' | 'admin';
  is_verified?: boolean;
  is_active?: boolean;
}

export interface PasswordChangeData {
  old_password: string;
  new_password: string;
  new_password_confirm: string;
}

export interface PrivacyOverrides {
  [pageContext: string]: {
    [field: string]: boolean | null;
  };
}

export interface UserPreferences {
  language: 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh';
  timezone: string;
  date_format: 'US' | 'EU';
  number_format: 'point' | 'comma';
  theme: 'light' | 'dark';
  font_size: 'small' | 'medium' | 'large';
  sidebar_collapsed?: boolean;
  email_goal_alerts?: boolean;
  privacy_overrides?: PrivacyOverrides;
  created_at?: string;
  updated_at?: string;
}

export interface ActiveSession {
  jti: string;
  created_at: string;
  expires_at: string;
  is_current: boolean;
  device_info?: string;
}

export interface LoginHistoryEntry {
  date: string;
  ip_address?: string;
  user_agent?: string;
  success: boolean;
}

class UserService {
  private readonly BASE_URL = getApiBaseUrl();

  private getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private async refreshAccessToken(): Promise<boolean> {
    const refresh = localStorage.getItem('refresh_token');
    if (!refresh) return false;
    try {
      const res = await fetch(`${this.BASE_URL}/api/accounts/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh })
      });
      if (!res.ok) return false;
      const data = await res.json();
      const newAccess = data.access as string | undefined;
      if (newAccess) {
        localStorage.setItem('access_token', newAccess);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private async fetchWithAuth(input: string, init: RequestInit = {}, retry = true): Promise<Response> {
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string> || {}),
      ...this.getAuthHeaders(),
    };
    const res = await fetch(input, { ...init, headers });
    if (res.status === 401 && retry) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        const headers2: Record<string, string> = {
          ...(init.headers as Record<string, string> || {}),
          ...this.getAuthHeaders(),
        };
        return fetch(input, { ...init, headers: headers2 });
      }
    }
    return res;
  }

  // Récupérer la liste des utilisateurs avec pagination (admin seulement)
  async getUsers(page: number = 1, pageSize: number = 10): Promise<PaginatedUsersResponse> {
    const response = await this.fetchWithAuth(`${this.BASE_URL}/api/accounts/admin/users/?page=${page}&page_size=${pageSize}`);

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des utilisateurs');
    }

    return response.json();
  }

  // Récupérer tous les utilisateurs (admin seulement) - pour compatibilité
  async getAllUsers(): Promise<User[]> {
    let allUsers: User[] = [];
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage) {
      const response = await this.fetchWithAuth(`${this.BASE_URL}/api/accounts/admin/users/?page=${page}&page_size=100`);

      if (!response.ok) {
        throw new Error('Erreur lors de la récupération des utilisateurs');
      }

      const data = await response.json();
      
      // Ajouter les utilisateurs de cette page
      if (data.results && Array.isArray(data.results)) {
        allUsers = [...allUsers, ...data.results];
      }
      
      // Vérifier s'il y a une page suivante
      hasNextPage = !!data.next;
      page++;
      
      // Sécurité : éviter les boucles infinies
      if (page > 100) {
        console.warn('Limite de pages atteinte (100)');
        break;
      }
    }

    return allUsers;
  }

  // Récupérer un utilisateur spécifique (admin seulement)
  async getUser(id: number): Promise<User> {
    const response = await this.fetchWithAuth(`${this.BASE_URL}/api/accounts/admin/users/${id}/`);

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération de l\'utilisateur');
    }

    return response.json();
  }

  // Mettre à jour un utilisateur (admin seulement)
  async updateUser(id: number, data: UserUpdateData): Promise<User> {
    const response = await this.fetchWithAuth(`${this.BASE_URL}/api/accounts/admin/users/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Erreur lors de la mise à jour de l\'utilisateur');
    }

    return response.json();
  }

  // Supprimer un utilisateur (admin seulement)
  async deleteUser(id: number): Promise<void> {
    const response = await this.fetchWithAuth(`${this.BASE_URL}/api/accounts/admin/users/${id}/`, { method: 'DELETE' });

    if (!response.ok) {
      throw new Error('Erreur lors de la suppression de l\'utilisateur');
    }
  }

  // Suppression en masse d'utilisateurs (admin seulement)
  async bulkDeleteUsers(userIds: number[]): Promise<{ 
    message: string;
    results: Array<{
      user_id: number;
      user_email: string;
      status: string;
      deleted_data: any;
    }>;
    errors: any[];
  }> {
    const response = await this.fetchWithAuth(`${this.BASE_URL}/api/accounts/admin/users/bulk-delete/`, {
      method: 'POST',
      body: JSON.stringify({ user_ids: userIds }),
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la suppression en masse');
    }

    return response.json();
  }

  // Aperçu avant suppression d'un utilisateur
  async getUserDeletionPreview(id: number): Promise<any> {
    const response = await this.fetchWithAuth(`${this.BASE_URL}/api/accounts/admin/users/${id}/deletion-preview/`);

    if (!response.ok) {
      throw new Error('Erreur lors de l\'aperçu de suppression');
    }

    return response.json();
  }

  // Récupérer le profil de l'utilisateur connecté
  async getCurrentUserProfile(): Promise<User> {
    const response = await this.fetchWithAuth(`${this.BASE_URL}/api/accounts/profile/`);

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération du profil');
    }

    return response.json();
  }

  // Mettre à jour le profil de l'utilisateur connecté
  async updateCurrentUserProfile(data: Partial<UserUpdateData & { email?: string }>): Promise<{ message: string; user: User }> {
    const response = await this.fetchWithAuth(`${this.BASE_URL}/api/accounts/profile/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || errorData.email?.[0] || 'Erreur lors de la mise à jour du profil');
    }

    return response.json();
  }

  // Changer le mot de passe de l'utilisateur connecté
  async changePassword(data: PasswordChangeData): Promise<void> {
    const response = await this.fetchWithAuth(`${this.BASE_URL}/api/accounts/profile/change-password/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Erreur lors du changement de mot de passe');
    }
  }

  // Supprimer le compte de l'utilisateur connecté
  async deleteCurrentUserAccount(): Promise<void> {
    const response = await this.fetchWithAuth(`${this.BASE_URL}/api/accounts/profile/`, { method: 'DELETE' });

    if (!response.ok) {
      throw new Error('Erreur lors de la suppression du compte');
    }
  }

  // Récupérer les permissions de l'utilisateur connecté
  async getUserPermissions(): Promise<{
    user_id: number;
    role: string;
    permissions: string[];
    is_admin: boolean;
  }> {
    const response = await this.fetchWithAuth(`${this.BASE_URL}/api/accounts/permissions/`);

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des permissions');
    }

    return response.json();
  }

  // Récupérer les préférences de l'utilisateur
  async getPreferences(): Promise<UserPreferences> {
    const response = await this.fetchWithAuth(`${this.BASE_URL}/api/accounts/preferences/`);

    if (!response.ok) {
      const error = new Error('Erreur lors de la récupération des préférences') as any;
      error.response = { status: response.status };
      throw error;
    }

    return response.json();
  }

  // Mettre à jour les préférences de l'utilisateur
  async updatePreferences(data: Partial<UserPreferences>): Promise<UserPreferences> {
    const response = await this.fetchWithAuth(`${this.BASE_URL}/api/accounts/preferences/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Erreur lors de la mise à jour des préférences');
    }

    const result = await response.json();
    return result.preferences || result;
  }

  // Récupérer les sessions actives
  async getActiveSessions(): Promise<ActiveSession[]> {
    const response = await this.fetchWithAuth(`${this.BASE_URL}/api/accounts/sessions/`);

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des sessions');
    }

    return response.json();
  }

  // Déconnecter une session spécifique
  async revokeSession(jti: string): Promise<void> {
    const response = await this.fetchWithAuth(`${this.BASE_URL}/api/accounts/sessions/`, {
      method: 'POST',
      body: JSON.stringify({ jti }),
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la déconnexion de la session');
    }
  }

  // Déconnecter toutes les autres sessions
  async revokeAllOtherSessions(): Promise<void> {
    const response = await this.fetchWithAuth(`${this.BASE_URL}/api/accounts/sessions/`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la déconnexion des sessions');
    }
  }

  // Récupérer l'historique des connexions
  async getLoginHistory(limit: number = 50): Promise<LoginHistoryEntry[]> {
    const response = await this.fetchWithAuth(`${this.BASE_URL}/api/accounts/login-history/?limit=${limit}`);

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération de l\'historique');
    }

    return response.json();
  }

  // Exporter toutes les données de l'utilisateur
  async exportData(): Promise<Blob> {
    const response = await this.fetchWithAuth(`${this.BASE_URL}/api/accounts/export-data/`);

    if (!response.ok) {
      throw new Error('Erreur lors de l\'export des données');
    }

    return response.blob();
  }
}

export const userService = new UserService();
export default userService;
