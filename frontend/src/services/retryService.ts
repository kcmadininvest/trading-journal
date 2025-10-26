/**
 * Service de retry automatique avec stratégies intelligentes
 * et adaptation dynamique basée sur le contexte
 */

interface RetryStrategy {
  name: string;
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryCondition: (error: Error) => boolean;
}

interface RetryContext {
  operation: string;
  attempt: number;
  totalAttempts: number;
  lastError: Error;
  startTime: number;
  strategy: string;
}

interface RetryConfig {
  defaultStrategy: string;
  strategies: Map<string, RetryStrategy>;
  enableAdaptiveRetry: boolean;
  enableMetrics: boolean;
  enableLogging: boolean;
}

interface RetryMetrics {
  totalRetries: number;
  successfulRetries: number;
  failedRetries: number;
  averageRetryTime: number;
  strategyUsage: Map<string, number>;
}

class RetryService {
  private config: RetryConfig = {
    defaultStrategy: 'exponential',
    strategies: new Map(),
    enableAdaptiveRetry: true,
    enableMetrics: true,
    enableLogging: true
  };
  
  private metrics: RetryMetrics = {
    totalRetries: 0,
    successfulRetries: 0,
    failedRetries: 0,
    averageRetryTime: 0,
    strategyUsage: new Map()
  };

  private retryHistory: RetryContext[] = [];

  constructor() {
    this.initializeDefaultStrategies();
  }

  /**
   * Initialise les stratégies de retry par défaut
   */
  private initializeDefaultStrategies(): void {
    // Stratégie exponentielle classique
    this.addStrategy('exponential', {
      name: 'exponential',
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitter: true,
      retryCondition: (error) => {
        // Retry sur les erreurs réseau et de timeout
        return error.name === 'NetworkError' || 
               error.name === 'TimeoutError' ||
               error.message.includes('fetch');
      }
    });

    // Stratégie linéaire pour les erreurs de cache
    this.addStrategy('linear', {
      name: 'linear',
      maxRetries: 5,
      baseDelay: 500,
      maxDelay: 5000,
      backoffMultiplier: 1,
      jitter: false,
      retryCondition: (error) => {
        return error.message.includes('localStorage') ||
               error.message.includes('cache');
      }
    });

    // Stratégie rapide pour les erreurs temporaires
    this.addStrategy('fast', {
      name: 'fast',
      maxRetries: 2,
      baseDelay: 100,
      maxDelay: 1000,
      backoffMultiplier: 1.5,
      jitter: true,
      retryCondition: (error) => {
        return error.message.includes('temporary') ||
               error.message.includes('rate limit');
      }
    });

    // Stratégie conservative pour les erreurs critiques
    this.addStrategy('conservative', {
      name: 'conservative',
      maxRetries: 1,
      baseDelay: 2000,
      maxDelay: 2000,
      backoffMultiplier: 1,
      jitter: false,
      retryCondition: (error) => {
        return !error.message.includes('permission') &&
               !error.message.includes('authentication');
      }
    });
  }

  /**
   * Ajoute une stratégie de retry personnalisée
   */
  addStrategy(name: string, strategy: RetryStrategy): void {
    this.config.strategies.set(name, strategy);
  }

  /**
   * Exécute une fonction avec retry automatique
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    options: {
      strategy?: string;
      maxRetries?: number;
      onRetry?: (context: RetryContext) => void;
      onSuccess?: (result: T, context: RetryContext) => void;
      onFailure?: (error: Error, context: RetryContext) => void;
    } = {}
  ): Promise<T> {
    const {
      strategy = this.config.defaultStrategy,
      maxRetries,
      onRetry,
      onSuccess,
      onFailure
    } = options;

    const retryStrategy = this.config.strategies.get(strategy);
    if (!retryStrategy) {
      throw new Error(`Stratégie de retry inconnue: ${strategy}`);
    }

    const effectiveMaxRetries = maxRetries ?? retryStrategy.maxRetries;
    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= effectiveMaxRetries; attempt++) {
      const context: RetryContext = {
        operation: fn.name || 'anonymous',
        attempt: attempt + 1,
        totalAttempts: effectiveMaxRetries + 1,
        lastError: lastError || new Error('No previous error'),
        startTime,
        strategy
      };

      try {
        const result = await fn();
        
        if (attempt > 0) {
          this.recordSuccessfulRetry(context, Date.now() - startTime);
          if (this.config.enableLogging) {
            console.log(`✅ [RETRY] Succès après ${attempt} tentative(s) avec la stratégie ${strategy}`);
          }
        }
        
        onSuccess?.(result, context);
        return result;
      } catch (error) {
        lastError = error as Error;
        
        if (this.config.enableLogging) {
          console.warn(`❌ [RETRY] Tentative ${attempt + 1}/${effectiveMaxRetries + 1} échouée:`, error);
        }

        // Vérifier si on doit retry
        if (attempt === effectiveMaxRetries || !retryStrategy.retryCondition(lastError)) {
          this.recordFailedRetry(context, Date.now() - startTime);
          onFailure?.(lastError, context);
          throw lastError;
        }

        // Calculer le délai avant le prochain retry
        const delay = this.calculateDelay(retryStrategy, attempt);
        
        if (this.config.enableLogging) {
          console.log(`⏳ [RETRY] Attente de ${delay}ms avant la prochaine tentative`);
        }

        await this.delay(delay);
        onRetry?.(context);
      }
    }

    throw lastError || new Error('Unknown error occurred');
  }

  /**
   * Exécute avec retry adaptatif basé sur l'historique
   */
  async executeWithAdaptiveRetry<T>(
    fn: () => Promise<T>,
    operationType: string,
    options: {
      onRetry?: (context: RetryContext) => void;
      onSuccess?: (result: T, context: RetryContext) => void;
      onFailure?: (error: Error, context: RetryContext) => void;
    } = {}
  ): Promise<T> {
    if (!this.config.enableAdaptiveRetry) {
      return this.executeWithRetry(fn, options);
    }

    // Analyser l'historique pour cette opération
    const operationHistory = this.retryHistory.filter(
      ctx => ctx.operation === operationType
    );

    // Choisir la stratégie basée sur l'historique
    const strategy = this.selectOptimalStrategy(operationHistory);
    
    if (this.config.enableLogging) {
      console.log(`🧠 [RETRY] Stratégie adaptative sélectionnée: ${strategy} pour ${operationType}`);
    }

    return this.executeWithRetry(fn, {
      ...options,
      strategy
    });
  }

  /**
   * Exécute avec retry en parallèle pour plusieurs opérations
   */
  async executeParallelWithRetry<T>(
    operations: Array<{
      id: string;
      fn: () => Promise<T>;
      strategy?: string;
    }>,
    options: {
      maxConcurrent?: number;
      onRetry?: (id: string, context: RetryContext) => void;
      onSuccess?: (id: string, result: T, context: RetryContext) => void;
      onFailure?: (id: string, error: Error, context: RetryContext) => void;
    } = {}
  ): Promise<Map<string, T>> {
    const { maxConcurrent = 3 } = options;
    const results = new Map<string, T>();
    const promises: Promise<void>[] = [];
    const runningCount = { value: 0 };

    for (const operation of operations) {
      // Attendre qu'une place se libère
      while (runningCount.value >= maxConcurrent) {
        await Promise.race(promises);
        runningCount.value--;
      }

      const executeOperationWithCleanup = async (): Promise<void> => {
        try {
          await this.executeWithRetry(operation.fn, {
            strategy: operation.strategy,
            onRetry: (context) => options.onRetry?.(operation.id, context),
            onSuccess: (result, context) => {
              results.set(operation.id, result);
              options.onSuccess?.(operation.id, result, context);
            },
            onFailure: (error, context) => {
              options.onFailure?.(operation.id, error, context);
            }
          });
        } finally {
          runningCount.value--;
        }
      };

      promises.push(executeOperationWithCleanup());
      runningCount.value++;
    }

    await Promise.allSettled(promises);
    return results;
  }

  /**
   * Calcule le délai pour le prochain retry
   */
  private calculateDelay(strategy: RetryStrategy, attempt: number): number {
    let delay = strategy.baseDelay * Math.pow(strategy.backoffMultiplier, attempt);
    
    // Limiter au délai maximum
    delay = Math.min(delay, strategy.maxDelay);
    
    // Ajouter du jitter pour éviter les collisions
    if (strategy.jitter) {
      const jitterRange = delay * 0.1; // 10% de jitter
      delay += (Math.random() - 0.5) * 2 * jitterRange;
    }
    
    return Math.max(0, Math.floor(delay));
  }

  /**
   * Sélectionne la stratégie optimale basée sur l'historique
   */
  private selectOptimalStrategy(operationHistory: RetryContext[]): string {
    if (operationHistory.length === 0) {
      return this.config.defaultStrategy;
    }

    // Analyser les patterns d'échec
    const recentFailures = operationHistory
      .filter(ctx => ctx.attempt > 1)
      .slice(-10); // 10 dernières tentatives

    if (recentFailures.length === 0) {
      return this.config.defaultStrategy;
    }

    // Si beaucoup d'échecs récents, utiliser une stratégie plus conservative
    const failureRate = recentFailures.length / 10;
    if (failureRate > 0.7) {
      return 'conservative';
    } else if (failureRate > 0.4) {
      return 'linear';
    } else if (failureRate < 0.2) {
      return 'fast';
    }

    return this.config.defaultStrategy;
  }

  /**
   * Enregistre un retry réussi
   */
  private recordSuccessfulRetry(context: RetryContext, duration: number): void {
    this.metrics.totalRetries++;
    this.metrics.successfulRetries++;
    this.metrics.averageRetryTime = 
      (this.metrics.averageRetryTime * (this.metrics.totalRetries - 1) + duration) / 
      this.metrics.totalRetries;
    
    const usage = this.metrics.strategyUsage.get(context.strategy) || 0;
    this.metrics.strategyUsage.set(context.strategy, usage + 1);
    
    this.retryHistory.push(context);
    
    // Garder seulement les 100 derniers retries
    if (this.retryHistory.length > 100) {
      this.retryHistory = this.retryHistory.slice(-100);
    }
  }

  /**
   * Enregistre un retry échoué
   */
  private recordFailedRetry(context: RetryContext, duration: number): void {
    this.metrics.totalRetries++;
    this.metrics.failedRetries++;
    this.metrics.averageRetryTime = 
      (this.metrics.averageRetryTime * (this.metrics.totalRetries - 1) + duration) / 
      this.metrics.totalRetries;
    
    this.retryHistory.push(context);
    
    // Garder seulement les 100 derniers retries
    if (this.retryHistory.length > 100) {
      this.retryHistory = this.retryHistory.slice(-100);
    }
  }

  /**
   * Utilitaires
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obtient les métriques de retry
   */
  getMetrics(): RetryMetrics {
    return {
      ...this.metrics,
      strategyUsage: new Map(this.metrics.strategyUsage)
    };
  }

  /**
   * Réinitialise les métriques
   */
  resetMetrics(): void {
    this.metrics = {
      totalRetries: 0,
      successfulRetries: 0,
      failedRetries: 0,
      averageRetryTime: 0,
      strategyUsage: new Map()
    };
    this.retryHistory = [];
  }

  /**
   * Obtient l'historique des retries
   */
  getRetryHistory(): RetryContext[] {
    return [...this.retryHistory];
  }

  /**
   * Configure le service de retry
   */
  configure(config: Partial<RetryConfig>): void {
    if (config.defaultStrategy) {
      this.config.defaultStrategy = config.defaultStrategy;
    }
    if (config.enableAdaptiveRetry !== undefined) {
      this.config.enableAdaptiveRetry = config.enableAdaptiveRetry;
    }
    if (config.enableMetrics !== undefined) {
      this.config.enableMetrics = config.enableMetrics;
    }
    if (config.enableLogging !== undefined) {
      this.config.enableLogging = config.enableLogging;
    }
  }

  /**
   * Nettoie l'historique ancien
   */
  cleanupHistory(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 heures
    this.retryHistory = this.retryHistory.filter(
      ctx => ctx.startTime > cutoffTime
    );
  }
}

// Instance singleton
export const retryService = new RetryService();

// Nettoyage automatique de l'historique toutes les heures
if (typeof window !== 'undefined') {
  setInterval(() => {
    retryService.cleanupHistory();
  }, 60 * 60 * 1000);
}

export default retryService;