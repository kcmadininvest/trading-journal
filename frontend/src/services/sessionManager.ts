/**
 * Service de gestion de session et déconnexion automatique
 * Gère l'expiration des tokens JWT et la déconnexion automatique
 */

import axios from './api';
import authService from './auth';

export interface SessionInfo {
  access_token_expires_at: string;
  refresh_token_expires_at: string;
  session_expires_at: string;
  auto_logout_warning_at: string;
  time_remaining: number;
  warning_time_remaining: number;
  is_expired: boolean;
  needs_refresh: boolean;
}

export interface SessionWarning {
  type: 'warning' | 'critical' | 'expired';
  message: string;
  timeRemaining: number;
  showExtendButton: boolean;
}

class SessionManager {
  private warningTimer: NodeJS.Timeout | null = null;
  private logoutTimer: NodeJS.Timeout | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private sessionInfo: SessionInfo | null = null;
  private warningCallback: ((warning: SessionWarning) => void) | null = null;
  private logoutCallback: (() => void) | null = null;
  private isActive = false;

  /**
   * Initialise le gestionnaire de session
   */
  public initialize(
    onWarning: (warning: SessionWarning) => void,
    onLogout: () => void
  ): void {
    this.warningCallback = onWarning;
    this.logoutCallback = onLogout;
    this.isActive = true;
    
    // Vérifier la session toutes les 30 secondes
    this.startSessionMonitoring();
  }

  /**
   * Arrête le gestionnaire de session
   */
  public stop(): void {
    this.isActive = false;
    this.clearTimers();
  }

  /**
   * Démarre la surveillance de la session
   */
  private startSessionMonitoring(): void {
    if (!this.isActive) return;

    // Vérifier la session immédiatement
    this.checkSession();

    // Vérifier la session toutes les 30 secondes
    this.refreshTimer = setInterval(() => {
      if (this.isActive) {
        this.checkSession();
      }
    }, 30000);
  }

  /**
   * Vérifie l'état de la session
   */
  private async checkSession(): Promise<void> {
    try {
      const response = await axios.get('/accounts/session/info/');
      this.sessionInfo = response.data;

      // Vérifier que sessionInfo n'est pas null après l'assignation
      if (!this.sessionInfo) {
        console.error('Informations de session non disponibles');
        return;
      }

      if (this.sessionInfo.is_expired) {
        this.handleSessionExpired();
        return;
      }

      if (this.sessionInfo.needs_refresh) {
        await this.refreshSession();
        return;
      }

      // Programmer les avertissements et la déconnexion
      this.scheduleWarnings();
      this.scheduleLogout();

    } catch (error: any) {
      console.error('Erreur lors de la vérification de la session:', error);
      
      // Si l'erreur est 401, la session a expiré
      if (error.response?.status === 401) {
        this.handleSessionExpired();
      }
    }
  }

  /**
   * Rafraîchit la session
   */
  private async refreshSession(): Promise<void> {
    try {
      const response = await axios.post('/accounts/session/extend/');
      const { access, refresh, session_info } = response.data;

      // Mettre à jour les tokens
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);

      // Mettre à jour les informations de session
      this.sessionInfo = session_info;

      // Reprogrammer les avertissements
      this.clearTimers();
      this.scheduleWarnings();
      this.scheduleLogout();

      console.log('Session rafraîchie avec succès');

    } catch (error: any) {
      console.error('Erreur lors du rafraîchissement de la session:', error);
      this.handleSessionExpired();
    }
  }

  /**
   * Programme les avertissements
   */
  private scheduleWarnings(): void {
    if (!this.sessionInfo || !this.warningCallback) return;

    const sessionInfo = this.sessionInfo; // Type assertion pour TypeScript
    const now = Date.now();
    const warningTime = new Date(sessionInfo.auto_logout_warning_at).getTime();
    const timeUntilWarning = warningTime - now;

    if (timeUntilWarning > 0) {
      this.warningTimer = setTimeout(() => {
        this.showWarning();
      }, timeUntilWarning);
    } else {
      // L'avertissement est déjà dû
      this.showWarning();
    }
  }

  /**
   * Programme la déconnexion automatique
   */
  private scheduleLogout(): void {
    if (!this.sessionInfo || !this.logoutCallback) return;

    const sessionInfo = this.sessionInfo; // Type assertion pour TypeScript
    const now = Date.now();
    const logoutTime = new Date(sessionInfo.session_expires_at).getTime();
    const timeUntilLogout = logoutTime - now;

    if (timeUntilLogout > 0) {
      this.logoutTimer = setTimeout(() => {
        this.handleSessionExpired();
      }, timeUntilLogout);
    } else {
      // La session a déjà expiré
      this.handleSessionExpired();
    }
  }

  /**
   * Affiche l'avertissement de déconnexion
   */
  private showWarning(): void {
    if (!this.sessionInfo || !this.warningCallback) return;

    const sessionInfo = this.sessionInfo; // Type assertion pour TypeScript
    const timeRemaining = sessionInfo.time_remaining;
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;

    const warning: SessionWarning = {
      type: timeRemaining <= 60 ? 'critical' : 'warning',
      message: `Votre session expire dans ${minutes}:${seconds.toString().padStart(2, '0')}. Voulez-vous l'étendre ?`,
      timeRemaining,
      showExtendButton: true
    };

    this.warningCallback(warning);
  }

  /**
   * Gère l'expiration de la session
   */
  private handleSessionExpired(): void {
    console.log('Session expirée - Déconnexion automatique');
    
    // Nettoyer les timers
    this.clearTimers();
    
    // Déconnecter l'utilisateur
    authService.logout();
    
    // Notifier l'application
    if (this.logoutCallback) {
      this.logoutCallback();
    }
  }

  /**
   * Nettoie tous les timers
   */
  private clearTimers(): void {
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
    if (this.logoutTimer) {
      clearTimeout(this.logoutTimer);
      this.logoutTimer = null;
    }
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Étend manuellement la session
   */
  public async extendSession(): Promise<boolean> {
    try {
      await this.refreshSession();
      return true;
    } catch (error) {
      console.error('Erreur lors de l\'extension de la session:', error);
      return false;
    }
  }

  /**
   * Retourne les informations de session actuelles
   */
  public getSessionInfo(): SessionInfo | null {
    return this.sessionInfo;
  }

  /**
   * Force la déconnexion
   */
  public forceLogout(): void {
    this.handleSessionExpired();
  }

  /**
   * Vérifie si la session est active
   */
  public isSessionActive(): boolean {
    return this.isActive && this.sessionInfo !== null && !this.sessionInfo.is_expired;
  }
}

// Instance singleton
const sessionManager = new SessionManager();
export default sessionManager;
