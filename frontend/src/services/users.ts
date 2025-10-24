import { authService } from './auth';
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
  trades_count: number;
  created_at: string;
  last_login: string | null;
}

export interface UsersResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: User[];
}

export interface UserFilters {
  search?: string;
  role?: string;
  is_active?: boolean;
  is_verified?: boolean;
  page?: number;
  limit?: number;
}

class UsersService {
  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = authService.getAccessToken();
    
    if (!token) {
      throw new Error('Token d\'authentification manquant');
    }

    try {
      const response = await apiClient.get(`/accounts${endpoint}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('Permission refusée. Seuls les administrateurs peuvent accéder à cette fonctionnalité.');
      }
      if (error.response?.status === 401) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }
      throw new Error(error.response?.data?.detail || `Erreur ${error.response?.status}: ${error.message}`);
    }
  }

  async getUsers(filters: UserFilters = {}): Promise<UsersResponse> {
    const params = new URLSearchParams();
    
    if (filters.search) params.append('search', filters.search);
    if (filters.role) params.append('role', filters.role);
    if (filters.is_active !== undefined) params.append('is_active', filters.is_active.toString());
    if (filters.is_verified !== undefined) params.append('is_verified', filters.is_verified.toString());
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const queryString = params.toString();
    const endpoint = `/admin/users/${queryString ? `?${queryString}` : ''}`;
    
    return this.makeRequest<UsersResponse>(endpoint);
  }

  async getUserById(id: number): Promise<User> {
    return this.makeRequest<User>(`/admin/users/${id}/`);
  }

  async updateUser(id: number, data: Partial<User>): Promise<User> {
    try {
      const response = await apiClient.patch(`/accounts/admin/users/${id}/`, data);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('Permission refusée. Seuls les administrateurs peuvent accéder à cette fonctionnalité.');
      }
      if (error.response?.status === 401) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }
      throw new Error(error.response?.data?.detail || `Erreur ${error.response?.status}: ${error.message}`);
    }
  }

  async deleteUser(id: number): Promise<void> {
    try {
      await apiClient.delete(`/accounts/admin/users/${id}/`);
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('Permission refusée. Seuls les administrateurs peuvent accéder à cette fonctionnalité.');
      }
      if (error.response?.status === 401) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }
      throw new Error(error.response?.data?.detail || `Erreur ${error.response?.status}: ${error.message}`);
    }
  }

  async toggleUserStatus(id: number, isActive: boolean): Promise<User> {
    return this.updateUser(id, { is_active: isActive });
  }

  async changeUserRole(id: number, role: 'user' | 'admin'): Promise<User> {
    return this.updateUser(id, { role });
  }
}

export const usersService = new UsersService();
