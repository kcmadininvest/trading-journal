/**
 * Service de cache optimisé qui intègre tous les services d'optimisation
 * pour offrir une expérience utilisateur fluide et performante
 */

import cacheManager from './cacheManager';
import preloadService from './preloadService';
import errorHandler from './errorHandler';
import retryService from './retryService';
import { tradesService } from './trades';
import { tradingAccountService } from './tradingAccountService';

interface OptimizedCacheConfig {
  enablePreloading: boolean;
  enableErrorHandling: boolean;
  enableRetry: boolean;
  enableBatchOperations: boolean;
  enableAdaptiveStrategies: boolean;
  preloadDays: number;
  maxConcurrentRequests: number;
}

interface CacheStats {
  cache: {
    totalEntries: number;
    userEntries: number;
    totalSize: number;
    errorCount: number;
  };
  preload: {
    completedTasks: number;
    runningTasks: number;
    queueLength: number;
  };
  errors: {
    totalErrors: number;
    cacheErrors: number;
    networkErrors: number;
    fallbackSuccesses: number;
    retrySuccesses: number;
  };
  retry: {
    totalRetries: number;
    successfulRetries: number;
    failedRetries: number;
    averageRetryTime: number;
    strategyUsage: Map<string, number>;
  };
}

class OptimizedCacheService {
  private config: OptimizedCacheConfig = {
    enablePreloading: true,
    enableErrorHandling: true,
    enableRetry: true,
    enableBatchOperations: true,
    enableAdaptiveStrategies: true,
    preloadDays: 7,
    maxConcurrentRequests: 3
  };

  private isInitialized = false;

  constructor(config?: Partial<OptimizedCacheConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Initialise le service de cache optimisé
   */
  async initialize(tradingAccountId?: number): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('🚀 [OPTIMIZED_CACHE] Initialisation du service de cache optimisé');

    try {
      // Configurer les services
      this.configureServices();

      // Précharger les données essentielles
      if (this.config.enablePreloading) {
        await this.preloadEssentialData(tradingAccountId);
      }

      // Démarrer le préchargement en arrière-plan
      if (this.config.enablePreloading) {
        preloadService.preloadInBackground(tradingAccountId);
      }

      this.isInitialized = true;
      console.log('✅ [OPTIMIZED_CACHE] Service initialisé avec succès');
    } catch (error) {
      console.error('❌ [OPTIMIZED_CACHE] Erreur lors de l\'initialisation:', error);
      throw error;
    }
  }

  /**
   * Configure tous les services
   */
  private configureServices(): void {
    // Configurer le cache manager
    cacheManager.setLogging(this.config.enableErrorHandling);
    cacheManager.setBatchOperations(this.config.enableBatchOperations);

    // Configurer le service de préchargement
    preloadService.configure({
      enableCalendarPreload: this.config.enablePreloading,
      enableStrategiesPreload: this.config.enablePreloading,
      enableAnalyticsPreload: this.config.enablePreloading,
      preloadDays: this.config.preloadDays,
      maxConcurrentRequests: this.config.maxConcurrentRequests
    });

    // Configurer le service de retry
    retryService.configure({
      enableAdaptiveRetry: this.config.enableAdaptiveStrategies,
      enableLogging: this.config.enableErrorHandling
    });
  }

  /**
   * Précharge les données essentielles
   */
  private async preloadEssentialData(tradingAccountId?: number): Promise<void> {
    if (!this.config.enablePreloading) {
      return;
    }

    try {
      await preloadService.preloadEssentialData(tradingAccountId);
      console.log('✅ [OPTIMIZED_CACHE] Données essentielles préchargées');
    } catch (error) {
      console.warn('⚠️ [OPTIMIZED_CACHE] Erreur lors du préchargement des données essentielles:', error);
    }
  }

  /**
   * Récupère les données de calendrier avec optimisation
   */
  async getCalendarData(
    year: number,
    month: number,
    tradingAccountId?: number
  ): Promise<any> {
    const cacheKey = `calendar_${year}_${month}_${tradingAccountId || 'all'}`;
    
    return this.executeWithOptimization(
      () => tradesService.getCalendarData(year, month, tradingAccountId),
      cacheKey,
      'calendar_data',
      {
        fallback: () => this.getFallbackCalendarData(year, month, tradingAccountId)
      }
    );
  }

  /**
   * Récupère les stratégies de trading avec optimisation
   */
  async getTradeStrategies(
    filters?: {
      trade_id?: string;
      strategy_respected?: boolean;
      contract_name?: string;
    }
  ): Promise<any> {
    const cacheKey = `trade_strategies_${JSON.stringify(filters || {})}`;
    
    return this.executeWithOptimization(
      () => tradesService.getTradeStrategies(filters),
      cacheKey,
      'trade_strategies',
      {
        fallback: () => this.getFallbackStrategies(filters)
      }
    );
  }

  /**
   * Récupère les stratégies par date avec optimisation
   */
  async getTradeStrategiesByDate(
    date: string,
    tradingAccountId?: number
  ): Promise<any> {
    const cacheKey = `trade_strategies_by_date_${date}_${tradingAccountId || 'all'}`;
    
    return this.executeWithOptimization(
      () => tradesService.getTradeStrategiesByDate(date, tradingAccountId),
      cacheKey,
      'trade_strategies_by_date',
      {
        fallback: () => this.getFallbackStrategiesByDate(date, tradingAccountId)
      }
    );
  }

  /**
   * Récupère les comptes de trading avec optimisation
   */
  async getTradingAccounts(): Promise<any> {
    const cacheKey = 'trading_accounts';
    
    return this.executeWithOptimization(
      () => tradingAccountService.getAccounts(),
      cacheKey,
      'trading_accounts',
      {
        fallback: () => this.getFallbackTradingAccounts()
      }
    );
  }

  /**
   * Récupère les données d'analytics avec optimisation
   */
  async getAnalyticsData(tradingAccountId?: number): Promise<any> {
    const cacheKey = `analytics_${tradingAccountId || 'all'}`;
    
    return this.executeWithOptimization(
      () => tradesService.getAnalyticsData(tradingAccountId),
      cacheKey,
      'analytics_data',
      {
        fallback: () => this.getFallbackAnalyticsData(tradingAccountId)
      }
    );
  }

  /**
   * Exécute une opération avec toutes les optimisations
   */
  private async executeWithOptimization<T>(
    operation: () => Promise<T>,
    cacheKey: string,
    operationType: string,
    options: {
      fallback?: () => Promise<T>;
      strategy?: string;
    } = {}
  ): Promise<T> {
    // Vérifier le cache d'abord
    const cachedData = cacheManager.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    // Exécuter avec retry et gestion d'erreurs
    if (this.config.enableRetry && this.config.enableErrorHandling) {
      return retryService.executeWithAdaptiveRetry(
        async () => {
          return errorHandler.handleCacheError(
            cacheKey,
            operation,
            {
              maxRetries: 3,
              onRetry: (attempt, error) => {
                console.log(`🔄 [OPTIMIZED_CACHE] Retry ${attempt} pour ${operationType}:`, error.message);
              }
            }
          );
        },
        operationType,
        {
          onSuccess: (result) => {
            // Mettre en cache le résultat
            cacheManager.set(cacheKey, result, 5 * 60 * 1000);
          },
          onFailure: (error) => {
            console.error(`❌ [OPTIMIZED_CACHE] Échec définitif pour ${operationType}:`, error);
          }
        }
      );
    } else if (this.config.enableErrorHandling) {
      // Utiliser seulement la gestion d'erreurs
      return errorHandler.handleCacheError(
        cacheKey,
        operation,
        {
          maxRetries: 3
        }
      );
    } else {
      // Exécution simple
      const result = await operation();
      cacheManager.set(cacheKey, result, 5 * 60 * 1000);
      return result;
    }
  }

  /**
   * Précharge les données pour une période
   */
  async preloadDateRange(
    startDate: Date,
    endDate: Date,
    tradingAccountId?: number
  ): Promise<void> {
    if (!this.config.enablePreloading) {
      return;
    }

    try {
      await preloadService.preloadDateRange(startDate, endDate, tradingAccountId);
    } catch (error) {
      console.warn('⚠️ [OPTIMIZED_CACHE] Erreur lors du préchargement de la période:', error);
    }
  }

  /**
   * Précharge les données prédictives
   */
  async preloadPredictiveData(tradingAccountId?: number): Promise<void> {
    if (!this.config.enablePreloading) {
      return;
    }

    try {
      await preloadService.predictivePreload(tradingAccountId);
    } catch (error) {
      console.warn('⚠️ [OPTIMIZED_CACHE] Erreur lors du préchargement prédictif:', error);
    }
  }

  /**
   * Nettoie le cache et les données temporaires
   */
  cleanup(): void {
    try {
      cacheManager.cleanupExpiredEntries();
      preloadService.cleanupPreloadData();
      retryService.cleanupHistory();
      console.log('🧹 [OPTIMIZED_CACHE] Nettoyage effectué');
    } catch (error) {
      console.warn('⚠️ [OPTIMIZED_CACHE] Erreur lors du nettoyage:', error);
    }
  }

  /**
   * Obtient les statistiques complètes
   */
  getStats(): CacheStats {
    return {
      cache: cacheManager.getCacheStats(),
      preload: preloadService.getPreloadStats(),
      errors: errorHandler.getMetrics(),
      retry: retryService.getMetrics()
    };
  }

  /**
   * Réinitialise toutes les métriques
   */
  resetMetrics(): void {
    errorHandler.resetMetrics();
    retryService.resetMetrics();
  }

  /**
   * Configure le service
   */
  configure(config: Partial<OptimizedCacheConfig>): void {
    this.config = { ...this.config, ...config };
    this.configureServices();
  }

  /**
   * Méthodes de fallback
   */
  private async getFallbackCalendarData(year: number, month: number, tradingAccountId?: number): Promise<any> {
    // Retourner des données vides en cas d'échec
    return {
      year,
      month,
      data: [],
      fallback: true
    };
  }

  private async getFallbackStrategies(filters?: any): Promise<any> {
    return [];
  }

  private async getFallbackStrategiesByDate(date: string, tradingAccountId?: number): Promise<any> {
    return [];
  }

  private async getFallbackTradingAccounts(): Promise<any> {
    return [];
  }

  private async getFallbackAnalyticsData(tradingAccountId?: number): Promise<any> {
    return {
      fallback: true,
      data: {}
    };
  }
}

// Instance singleton
export const optimizedCacheService = new OptimizedCacheService();

// Nettoyage automatique toutes les 30 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    optimizedCacheService.cleanup();
  }, 30 * 60 * 1000);
}

export default optimizedCacheService;