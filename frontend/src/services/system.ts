import { authService } from './auth';
import api from './api';

export interface SystemStats {
  active_users_today: number;
  total_users: number;
  total_trades: number;
  disk_usage: string;
  last_backup: string | null;
  system_uptime: string;
}

class SystemService {
  private async makeRequest<T>(endpoint: string): Promise<T> {
    const token = authService.getAccessToken();
    
    if (!token) {
      throw new Error('Token d\'authentification manquant');
    }

    try {
      const response = await api.get(`/accounts${endpoint}`);
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

  async getSystemStats(): Promise<SystemStats> {
    return this.makeRequest<SystemStats>('/admin/system/stats/');
  }

  async createBackup(): Promise<{ message: string; backup_id: string }> {
    try {
      const response = await api.post('/accounts/admin/system/backup/');
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('Permission refusée. Seuls les administrateurs peuvent créer des sauvegardes.');
      }
      if (error.response?.status === 401) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }
      throw new Error(error.response?.data?.detail || `Erreur ${error.response?.status}: ${error.message}`);
    }
  }

  async cleanLogs(): Promise<{ message: string; logs_cleaned: number }> {
    try {
      const response = await api.post('/accounts/admin/system/clean-logs/');
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('Permission refusée. Seuls les administrateurs peuvent nettoyer les logs.');
      }
      if (error.response?.status === 401) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }
      throw new Error(error.response?.data?.detail || `Erreur ${error.response?.status}: ${error.message}`);
    }
  }

  async checkIntegrity(): Promise<{ message: string; issues_found: number }> {
    try {
      const response = await api.post('/accounts/admin/system/check-integrity/');
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('Permission refusée. Seuls les administrateurs peuvent vérifier l\'intégrité.');
      }
      if (error.response?.status === 401) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }
      throw new Error(error.response?.data?.detail || `Erreur ${error.response?.status}: ${error.message}`);
    }
  }
}

export const systemService = new SystemService();
