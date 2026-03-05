import axios from 'axios';
import { BiasThresholds, BiasThresholdsResponse } from '../types/analytics';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

class BiasThresholdsService {
  private getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
      'Authorization': `Bearer ${token}`,
    };
  }

  /**
   * Récupère les seuils de détection des biais (personnalisés + défauts)
   */
  async getThresholds(): Promise<BiasThresholdsResponse> {
    const response = await axios.get(`${API_URL}/api/accounts/preferences/bias-thresholds/`, {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }

  /**
   * Met à jour les seuils de détection des biais
   */
  async updateThresholds(thresholds: Partial<BiasThresholds>): Promise<BiasThresholdsResponse> {
    const response = await axios.put(`${API_URL}/api/accounts/preferences/bias-thresholds/`, {
      thresholds
    }, {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }

  /**
   * Réinitialise les seuils aux valeurs par défaut
   */
  async resetThresholds(): Promise<BiasThresholdsResponse> {
    const response = await axios.post(`${API_URL}/api/accounts/preferences/bias-thresholds/`, {
      action: 'reset'
    }, {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }
}

const biasThresholdsService = new BiasThresholdsService();
export default biasThresholdsService;
