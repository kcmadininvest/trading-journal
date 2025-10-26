/**
 * Configuration centralisée pour les optimisations de cache
 */

export interface CacheOptimizationConfig {
  // Cache Manager
  cache: {
    enableLogging: boolean;
    enableBatchOperations: boolean;
    defaultTTL: number; // en millisecondes
    maxRetries: number;
    retryDelay: number;
  };
  
  // Preload Service
  preload: {
    enableCalendarPreload: boolean;
    enableStrategiesPreload: boolean;
    enableAnalyticsPreload: boolean;
    preloadDays: number;
    maxConcurrentRequests: number;
  };
  
  // Error Handler
  errorHandler: {
    enableLogging: boolean;
    enableFallback: boolean;
    maxRetries: number;
    retryDelay: number;
    exponentialBackoff: boolean;
  };
  
  // Retry Service
  retry: {
    enableAdaptiveRetry: boolean;
    enableLogging: boolean;
    defaultStrategy: string;
    maxRetries: number;
  };
}

// Configuration par défaut
export const defaultCacheConfig: CacheOptimizationConfig = {
  cache: {
    enableLogging: process.env.NODE_ENV === 'development',
    enableBatchOperations: true,
    defaultTTL: 5 * 60 * 1000, // 5 minutes
    maxRetries: 3,
    retryDelay: 1000
  },
  
  preload: {
    enableCalendarPreload: true,
    enableStrategiesPreload: true,
    enableAnalyticsPreload: true,
    preloadDays: 7,
    maxConcurrentRequests: 3
  },
  
  errorHandler: {
    enableLogging: process.env.NODE_ENV === 'development',
    enableFallback: true,
    maxRetries: 3,
    retryDelay: 1000,
    exponentialBackoff: true
  },
  
  retry: {
    enableAdaptiveRetry: true,
    enableLogging: process.env.NODE_ENV === 'development',
    defaultStrategy: 'exponential',
    maxRetries: 3
  }
};

// Configuration pour la production
export const productionCacheConfig: CacheOptimizationConfig = {
  cache: {
    enableLogging: false,
    enableBatchOperations: true,
    defaultTTL: 10 * 60 * 1000, // 10 minutes
    maxRetries: 2,
    retryDelay: 500
  },
  
  preload: {
    enableCalendarPreload: true,
    enableStrategiesPreload: true,
    enableAnalyticsPreload: false, // Désactiver en production pour économiser la bande passante
    preloadDays: 5,
    maxConcurrentRequests: 2
  },
  
  errorHandler: {
    enableLogging: false,
    enableFallback: true,
    maxRetries: 2,
    retryDelay: 500,
    exponentialBackoff: true
  },
  
  retry: {
    enableAdaptiveRetry: true,
    enableLogging: false,
    defaultStrategy: 'exponential',
    maxRetries: 2
  }
};

// Configuration pour le développement
export const developmentCacheConfig: CacheOptimizationConfig = {
  cache: {
    enableLogging: true,
    enableBatchOperations: true,
    defaultTTL: 2 * 60 * 1000, // 2 minutes
    maxRetries: 3,
    retryDelay: 1000
  },
  
  preload: {
    enableCalendarPreload: true,
    enableStrategiesPreload: true,
    enableAnalyticsPreload: true,
    preloadDays: 3, // Moins de données en développement
    maxConcurrentRequests: 2
  },
  
  errorHandler: {
    enableLogging: true,
    enableFallback: true,
    maxRetries: 3,
    retryDelay: 1000,
    exponentialBackoff: true
  },
  
  retry: {
    enableAdaptiveRetry: true,
    enableLogging: true,
    defaultStrategy: 'exponential',
    maxRetries: 3
  }
};

// Fonction pour obtenir la configuration selon l'environnement
export function getCacheConfig(): CacheOptimizationConfig {
  const env = process.env.NODE_ENV;
  
  switch (env) {
    case 'production':
      return productionCacheConfig;
    case 'development':
      return developmentCacheConfig;
    default:
      return defaultCacheConfig;
  }
}

// Fonction pour personnaliser la configuration
export function createCustomConfig(
  baseConfig: CacheOptimizationConfig,
  overrides: Partial<CacheOptimizationConfig>
): CacheOptimizationConfig {
  return {
    cache: { ...baseConfig.cache, ...overrides.cache },
    preload: { ...baseConfig.preload, ...overrides.preload },
    errorHandler: { ...baseConfig.errorHandler, ...overrides.errorHandler },
    retry: { ...baseConfig.retry, ...overrides.retry }
  };
}