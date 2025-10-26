/**
 * Service de gestion d'erreurs robuste pour le système de cache
 * avec retry automatique et fallback intelligent
 */

interface ErrorConfig {
  maxRetries: number;
  retryDelay: number;
  exponentialBackoff: boolean;
  enableFallback: boolean;
  enableLogging: boolean;
  enableMetrics: boolean;
}

interface ErrorMetrics {
  totalErrors: number;
  cacheErrors: number;
  networkErrors: number;
  fallbackSuccesses: number;
  retrySuccesses: number;
}

interface RetryOptions {
  maxRetries?: number;
  delay?: number;
  exponentialBackoff?: boolean;
  onRetry?: (attempt: number, error: Error) => void;
  onSuccess?: (result: any) => void;
  onFailure?: (error: Error) => void;
}

class ErrorHandler {
  private config: ErrorConfig = {
    maxRetries: 3,
    retryDelay: 1000,
    exponentialBackoff: true,
    enableFallback: true,
    enableLogging: false,
    enableMetrics: true
  };
  
  private metrics: ErrorMetrics = {
    totalErrors: 0,
    cacheErrors: 0,
    networkErrors: 0,
    fallbackSuccesses: 0,
    retrySuccesses: 0
  };

  private fallbackStrategies = new Map<string, () => Promise<any>>();

  constructor(config?: Partial<ErrorConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Exécute une fonction avec retry automatique et gestion d'erreurs
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxRetries = this.config.maxRetries,
      delay = this.config.retryDelay,
      exponentialBackoff = this.config.exponentialBackoff,
      onRetry,
      onSuccess,
      onFailure
    } = options;

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await fn();
        
        if (attempt > 0) {
          this.metrics.retrySuccesses++;
          if (this.config.enableLogging) {
            console.log(`✅ [ERROR_HANDLER] Succès après ${attempt} tentative(s)`);
          }
        }
        
        onSuccess?.(result);
        return result;
      } catch (error) {
        lastError = error as Error;
        this.metrics.totalErrors++;
        
        if (this.config.enableLogging) {
          console.warn(`❌ [ERROR_HANDLER] Tentative ${attempt + 1}/${maxRetries + 1} échouée:`, error);
        }
        
        // Si c'est la dernière tentative, essayer le fallback
        if (attempt === maxRetries) {
          if (this.config.enableFallback) {
            try {
              const fallbackResult = await this.executeFallback(fn);
              this.metrics.fallbackSuccesses++;
              return fallbackResult;
            } catch (fallbackError) {
              if (this.config.enableLogging) {
                console.error('❌ [ERROR_HANDLER] Fallback également échoué:', fallbackError);
              }
            }
          }
          
          onFailure?.(lastError);
          throw lastError;
        }
        
        // Attendre avant la prochaine tentative
        if (attempt < maxRetries) {
          const waitTime = exponentialBackoff 
            ? delay * Math.pow(2, attempt)
            : delay;
          
          if (this.config.enableLogging) {
            console.log(`⏳ [ERROR_HANDLER] Attente de ${waitTime}ms avant la prochaine tentative`);
          }
          
          await this.delay(waitTime);
          onRetry?.(attempt + 1, lastError);
        }
      }
    }
    
    throw lastError || new Error('Unknown error occurred');
  }

  /**
   * Exécute une fonction avec fallback en cas d'échec
   */
  async executeWithFallback<T>(
    primaryFn: () => Promise<T>,
    fallbackFn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    try {
      return await this.executeWithRetry(primaryFn, options);
    } catch (error) {
      if (this.config.enableLogging) {
        console.log('🔄 [ERROR_HANDLER] Tentative de fallback...');
      }
      
      try {
        const result = await fallbackFn();
        this.metrics.fallbackSuccesses++;
        return result;
      } catch (fallbackError) {
        if (this.config.enableLogging) {
          console.error('❌ [ERROR_HANDLER] Fallback également échoué:', fallbackError);
        }
        throw fallbackError;
      }
    }
  }

  /**
   * Exécute une fonction avec circuit breaker
   */
  async executeWithCircuitBreaker<T>(
    fn: () => Promise<T>,
    circuitBreakerKey: string,
    options: {
      failureThreshold?: number;
      timeout?: number;
      resetTimeout?: number;
    } = {}
  ): Promise<T> {
    const {
      failureThreshold = 5,
      timeout = 30000,
      resetTimeout = 60000
    } = options;

    // Vérifier l'état du circuit breaker
    const circuitState = this.getCircuitBreakerState(circuitBreakerKey);
    
    if (circuitState === 'OPEN') {
      if (Date.now() - this.getCircuitBreakerLastFailure(circuitBreakerKey) > resetTimeout) {
        this.setCircuitBreakerState(circuitBreakerKey, 'HALF_OPEN');
      } else {
        throw new Error(`Circuit breaker ouvert pour ${circuitBreakerKey}`);
      }
    }

    try {
      const result = await Promise.race([
        fn(),
        this.timeoutPromise(timeout)
      ]);
      
      // Succès - réinitialiser le circuit breaker
      this.setCircuitBreakerState(circuitBreakerKey, 'CLOSED');
      this.resetCircuitBreakerFailures(circuitBreakerKey);
      
      return result;
    } catch (error) {
      // Échec - incrémenter le compteur d'échecs
      const failures = this.incrementCircuitBreakerFailures(circuitBreakerKey);
      
      if (failures >= failureThreshold) {
        this.setCircuitBreakerState(circuitBreakerKey, 'OPEN');
        this.setCircuitBreakerLastFailure(circuitBreakerKey, Date.now());
      }
      
      throw error;
    }
  }

  /**
   * Enregistre une stratégie de fallback
   */
  registerFallbackStrategy(key: string, fallbackFn: () => Promise<any>): void {
    this.fallbackStrategies.set(key, fallbackFn);
  }

  /**
   * Exécute le fallback enregistré
   */
  private async executeFallback(originalFn: () => Promise<any>): Promise<any> {
    // Essayer de trouver une stratégie de fallback appropriée
    const fallbackEntries = Array.from(this.fallbackStrategies.entries());
    for (const [key, fallbackFn] of fallbackEntries) {
      try {
        return await fallbackFn();
      } catch (error) {
        if (this.config.enableLogging) {
          console.warn(`❌ [ERROR_HANDLER] Fallback ${key} échoué:`, error);
        }
      }
    }
    
    throw new Error('Aucune stratégie de fallback disponible');
  }

  /**
   * Gestion des erreurs de cache avec retry intelligent
   */
  async handleCacheError<T>(
    cacheKey: string,
    fetchFn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    return this.executeWithRetry(async () => {
      try {
        return await fetchFn();
      } catch (error) {
        this.metrics.cacheErrors++;
        
        // Analyser le type d'erreur pour adapter la stratégie
        if (error instanceof TypeError && error.message.includes('localStorage')) {
          // Erreur de localStorage - essayer de nettoyer et réessayer
          this.cleanupLocalStorage();
          throw new Error('Erreur localStorage - nettoyage effectué');
        } else if (error instanceof SyntaxError) {
          // Erreur de parsing JSON - supprimer l'entrée corrompue
          this.removeCorruptedEntry(cacheKey);
          throw new Error('Entrée corrompue supprimée');
        }
        
        throw error;
      }
    }, {
      ...options,
      onRetry: (attempt, error) => {
        if (this.config.enableLogging) {
          console.log(`🔄 [ERROR_HANDLER] Retry ${attempt} pour ${cacheKey}:`, error.message);
        }
      }
    });
  }

  /**
   * Gestion des erreurs réseau avec retry et fallback
   */
  async handleNetworkError<T>(
    fetchFn: () => Promise<T>,
    fallbackData?: T,
    options: RetryOptions = {}
  ): Promise<T> {
    return this.executeWithFallback(
      fetchFn,
      async () => {
        this.metrics.networkErrors++;
        
        if (fallbackData !== undefined) {
          if (this.config.enableLogging) {
            console.log('🔄 [ERROR_HANDLER] Utilisation des données de fallback');
          }
          return fallbackData;
        }
        
        throw new Error('Aucune donnée de fallback disponible');
      },
      options
    );
  }

  /**
   * Nettoie le localStorage en cas d'erreur
   */
  private cleanupLocalStorage(): void {
    try {
      // Essayer de libérer de l'espace en supprimant les entrées les plus anciennes
      const entries: Array<{ key: string; timestamp: number }> = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('tj_cache_')) {
          try {
            const item = localStorage.getItem(key);
            if (item) {
              const parsed = JSON.parse(item);
              entries.push({
                key,
                timestamp: parsed.timestamp || 0
              });
            }
          } catch (e) {
            // Supprimer les entrées corrompues
            localStorage.removeItem(key);
          }
        }
      }
      
      // Trier par timestamp et supprimer les plus anciennes
      entries.sort((a, b) => a.timestamp - b.timestamp);
      const toRemove = entries.slice(0, Math.floor(entries.length * 0.2)); // Supprimer 20% des plus anciennes
      
      toRemove.forEach(entry => {
        localStorage.removeItem(entry.key);
      });
      
      if (this.config.enableLogging) {
        console.log(`🧹 [ERROR_HANDLER] Nettoyage de ${toRemove.length} entrées du localStorage`);
      }
    } catch (error) {
      console.error('❌ [ERROR_HANDLER] Erreur lors du nettoyage du localStorage:', error);
    }
  }

  /**
   * Supprime une entrée corrompue du cache
   */
  private removeCorruptedEntry(key: string): void {
    try {
      localStorage.removeItem(key);
      if (this.config.enableLogging) {
        console.log(`🗑️ [ERROR_HANDLER] Entrée corrompue supprimée: ${key}`);
      }
    } catch (error) {
      console.warn('❌ [ERROR_HANDLER] Impossible de supprimer l\'entrée corrompue:', error);
    }
  }

  /**
   * Gestion du circuit breaker
   */
  private getCircuitBreakerState(key: string): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    const state = localStorage.getItem(`circuit_breaker_${key}_state`);
    return (state as 'CLOSED' | 'OPEN' | 'HALF_OPEN') || 'CLOSED';
  }

  private setCircuitBreakerState(key: string, state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'): void {
    localStorage.setItem(`circuit_breaker_${key}_state`, state);
  }

  private getCircuitBreakerFailures(key: string): number {
    const failures = localStorage.getItem(`circuit_breaker_${key}_failures`);
    return parseInt(failures || '0', 10);
  }

  private incrementCircuitBreakerFailures(key: string): number {
    const failures = this.getCircuitBreakerFailures(key) + 1;
    localStorage.setItem(`circuit_breaker_${key}_failures`, failures.toString());
    return failures;
  }

  private resetCircuitBreakerFailures(key: string): void {
    localStorage.removeItem(`circuit_breaker_${key}_failures`);
  }

  private getCircuitBreakerLastFailure(key: string): number {
    const lastFailure = localStorage.getItem(`circuit_breaker_${key}_last_failure`);
    return parseInt(lastFailure || '0', 10);
  }

  private setCircuitBreakerLastFailure(key: string, timestamp: number): void {
    localStorage.setItem(`circuit_breaker_${key}_last_failure`, timestamp.toString());
  }

  /**
   * Utilitaires
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), ms);
    });
  }

  /**
   * Obtient les métriques d'erreurs
   */
  getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  /**
   * Réinitialise les métriques
   */
  resetMetrics(): void {
    this.metrics = {
      totalErrors: 0,
      cacheErrors: 0,
      networkErrors: 0,
      fallbackSuccesses: 0,
      retrySuccesses: 0
    };
  }

  /**
   * Configure le gestionnaire d'erreurs
   */
  configure(config: Partial<ErrorConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Instance singleton
export const errorHandler = new ErrorHandler();

export default errorHandler;