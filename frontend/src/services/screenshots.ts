import { getApiBaseUrl } from '../utils/apiConfig';

export interface ScreenshotUploadResponse {
  original_url: string;
  thumbnail_url: string;
  message: string;
}

class ScreenshotsService {
  private readonly BASE_URL = getApiBaseUrl();

  /**
   * Récupère le token d'authentification depuis le localStorage
   */
  private getAuthToken(): string | null {
    return localStorage.getItem('access_token');
  }

  /**
   * Effectue une requête authentifiée
   */
  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const token = this.getAuthToken();
    const headers = new Headers(options.headers);

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Si le token est expiré, essayer de le rafraîchir
    if (response.status === 401) {
      // Rediriger vers la page de connexion ou rafraîchir le token
      window.dispatchEvent(new CustomEvent('auth:token-expired'));
    }

    return response;
  }

  /**
   * Upload un screenshot pour un trade
   * @param file - Le fichier image à uploader
   * @returns Les URLs de l'image originale et de la miniature
   */
  async uploadTradeScreenshot(file: File): Promise<ScreenshotUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.fetchWithAuth(
      `${this.BASE_URL}/api/trades/trade-strategies/upload_screenshot/`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || errorData.detail || 'Erreur lors de l\'upload du screenshot'
      );
    }

    return await response.json();
  }

  /**
   * Upload un screenshot pour un jour sans trade
   * @param file - Le fichier image à uploader
   * @returns Les URLs de l'image originale et de la miniature
   */
  async uploadDayScreenshot(file: File): Promise<ScreenshotUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.fetchWithAuth(
      `${this.BASE_URL}/api/trades/day-strategy-compliances/upload_screenshot/`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || errorData.detail || 'Erreur lors de l\'upload du screenshot'
      );
    }

    return await response.json();
  }

  /**
   * Supprime un screenshot pour un trade
   * @param screenshotUrl - L'URL du screenshot à supprimer
   * @returns Message de confirmation
   */
  async deleteTradeScreenshot(screenshotUrl: string): Promise<{ message: string }> {
    const response = await this.fetchWithAuth(
      `${this.BASE_URL}/api/trades/trade-strategies/delete_screenshot/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ screenshot_url: screenshotUrl }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || errorData.detail || 'Erreur lors de la suppression du screenshot'
      );
    }

    return await response.json();
  }

  /**
   * Supprime un screenshot pour un jour sans trade
   * @param screenshotUrl - L'URL du screenshot à supprimer
   * @returns Message de confirmation
   */
  async deleteDayScreenshot(screenshotUrl: string): Promise<{ message: string }> {
    const response = await this.fetchWithAuth(
      `${this.BASE_URL}/api/trades/day-strategy-compliances/delete_screenshot/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ screenshot_url: screenshotUrl }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || errorData.detail || 'Erreur lors de la suppression du screenshot'
      );
    }

    return await response.json();
  }

  /**
   * Valide un fichier avant l'upload
   * @param file - Le fichier à valider
   * @returns true si le fichier est valide, sinon lance une erreur
   */
  validateFile(file: File): boolean {
    // Vérifier le type MIME
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error(
        'Type de fichier non autorisé. Formats acceptés : JPG, PNG, WebP'
      );
    }

    // Vérifier la taille (5 MB max)
    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      throw new Error(
        `Le fichier est trop volumineux. Taille maximale : ${maxSize / (1024 * 1024)} MB`
      );
    }

    // Vérifier que le fichier n'est pas vide
    if (file.size === 0) {
      throw new Error('Le fichier est vide');
    }

    return true;
  }
}

export const screenshotsService = new ScreenshotsService();
export default screenshotsService;

