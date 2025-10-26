/**
 * Service d'initialisation de l'application avec optimisations de cache
 * Appelé au démarrage pour configurer tous les services optimisés
 */

import cacheManager from './cacheManager';
import preloadService from './preloadService';
import errorHandler from './errorHandler';
import retryService from './retryService';
import { tradesService } from './trades';
import { tradingAccountService } from './tradingAccountService';
import { getCacheConfig, CacheOptimizationConfig } from '../config/cacheConfig';

interface AppInitializerConfig {
  enablePreloading: boolean;
  enableErrorHandling: boolean;
  enableRetry: boolean;
  enableBatchOperations: boolean;
  preloadDays: number;
  maxConcurrentRequests: number;
}

class AppInitializer {
  private config: AppInitializerConfig = {
    enablePreloading: true,
    enableErrorHandling: true,
    enableRetry: true,
    enableBatchOperations: true,
    preloadDays: 7,
    maxConcurrentRequests: 3
  };

  private cacheConfig: CacheOptimizationConfig;
  private isInitialized = false;
  private currentTradingAccountId: number | null = null;

  constructor(config?: Partial<AppInitializerConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    // Charger la configuration selon l'environnement
    this.cacheConfig = getCacheConfig();
  }

  /**
   * Initialise l'application avec toutes les optimisations
   */
  async initialize(tradingAccountId?: number): Promise<void> {
    if (this.isInitialized && this.currentTradingAccountId === tradingAccountId) {
      return;
    }

    try {
      // 1. Configurer tous les services
      this.configureServices();

      // 2. Précharger les données essentielles
      if (this.config.enablePreloading) {
        await this.preloadEssentialData(tradingAccountId);
      }

      // 3. Démarrer le préchargement en arrière-plan
      if (this.config.enablePreloading) {
        this.startBackgroundPreloading(tradingAccountId);
      }

      this.isInitialized = true;
      this.currentTradingAccountId = tradingAccountId || null;
    } catch (error) {
      console.error('❌ [APP_INITIALIZER] Erreur lors de l\'initialisation:', error);
      throw error;
    }
  }

  /**
   * Configure tous les services d'optimisation
   */
  private configureServices(): void {
    // Configurer le cache manager
    cacheManager.setLogging(this.cacheConfig.cache.enableLogging);
    cacheManager.setBatchOperations(this.cacheConfig.cache.enableBatchOperations);

    // Configurer le service de préchargement
    preloadService.configure({
      enableCalendarPreload: this.cacheConfig.preload.enableCalendarPreload,
      enableStrategiesPreload: this.cacheConfig.preload.enableStrategiesPreload,
      enableAnalyticsPreload: this.cacheConfig.preload.enableAnalyticsPreload,
      preloadDays: this.cacheConfig.preload.preloadDays,
      maxConcurrentRequests: this.cacheConfig.preload.maxConcurrentRequests
    });

    // Configurer le service de retry
    retryService.configure({
      enableAdaptiveRetry: this.cacheConfig.retry.enableAdaptiveRetry,
      enableLogging: this.cacheConfig.retry.enableLogging
    });

    // Configurer le gestionnaire d'erreurs
    errorHandler.configure({
      enableLogging: this.cacheConfig.errorHandler.enableLogging,
      enableFallback: this.cacheConfig.errorHandler.enableFallback,
      maxRetries: this.cacheConfig.errorHandler.maxRetries
    });

  }

  /**
   * Précharge les données essentielles
   */
  private async preloadEssentialData(tradingAccountId?: number): Promise<void> {
    try {
      // Vérifier si l'utilisateur est authentifié avant de précharger
      const token = localStorage.getItem('access_token');
      if (!token) {
        return;
      }

      // Précharger les comptes de trading
      await tradingAccountService.getAccounts();

      // Préchargement des données du mois actuel temporairement désactivé pour éviter les boucles infinies
      // TODO: Réactiver une fois le problème de boucle résolu
      /*
      if (tradingAccountId) {
        await tradesService.preloadCurrentMonth(tradingAccountId);
      }
      */

      // Précharger les données d'analytics
      if (tradingAccountId) {
        await tradesService.getAnalyticsData(tradingAccountId);
      }
    } catch (error) {
      console.warn('⚠️ [APP_INITIALIZER] Erreur lors du préchargement des données essentielles:', error);
    }
  }

  /**
   * Démarre le préchargement en arrière-plan
   */
  private startBackgroundPreloading(tradingAccountId?: number): void {
    // Vérifier si l'utilisateur est authentifié
    const token = localStorage.getItem('access_token');
    if (!token) {
      return;
    }

    // Ne pas bloquer l'interface utilisateur
    setTimeout(async () => {
      try {
        if (tradingAccountId) {
          // Précharger le mois suivant
          await tradesService.preloadNextMonth(tradingAccountId);

          // Précharger les données prédictives
          await tradesService.preloadPredictiveData(tradingAccountId);
        }
      } catch (error) {
        console.warn('⚠️ [APP_INITIALIZER] Erreur lors du préchargement en arrière-plan:', error);
      }
    }, 2000); // Attendre 2 secondes avant de commencer
  }

  /**
   * Met à jour la configuration
   */
  configure(config: Partial<AppInitializerConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (this.isInitialized) {
      this.configureServices();
    }
  }

  /**
   * Obtient l'état d'initialisation
   */
  getInitializationStatus(): {
    isInitialized: boolean;
    currentTradingAccountId: number | null;
    config: AppInitializerConfig;
  } {
    return {
      isInitialized: this.isInitialized,
      currentTradingAccountId: this.currentTradingAccountId,
      config: { ...this.config }
    };
  }

  /**
   * Nettoie les données et réinitialise
   */
  cleanup(): void {
    try {
      cacheManager.cleanupExpiredEntries();
      preloadService.cleanupPreloadData();
      retryService.cleanupHistory();
      
      this.isInitialized = false;
      this.currentTradingAccountId = null;
    } catch (error) {
      console.warn('⚠️ [APP_INITIALIZER] Erreur lors du nettoyage:', error);
    }
  }

  /**
   * Obtient les statistiques de tous les services
   */
  getStats(): {
    cache: any;
    preload: any;
    errors: any;
    retry: any;
  } {
    return {
      cache: cacheManager.getCacheStats(),
      preload: preloadService.getPreloadStats(),
      errors: errorHandler.getMetrics(),
      retry: retryService.getMetrics()
    };
  }
}

// Instance singleton
export const appInitializer = new AppInitializer();

// Auto-initialisation désactivée - sera gérée par le Layout component
// L'initialisation se fait maintenant uniquement quand l'utilisateur est connecté

export default appInitializer;