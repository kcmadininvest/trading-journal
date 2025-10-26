/**
 * Service de gestion du cache optimisé pour assurer l'isolation des données entre utilisateurs
 * avec gestion d'erreurs robuste et système de retry automatique
 */

interface CacheEntry {
  data: any;
  userId: string;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  retryCount?: number;
  lastError?: string;
}

interface CacheConfig {
  maxRetries: number;
  retryDelay: number;
  enableLogging: boolean;
  enableBatchOperations: boolean;
}

interface BatchOperation {
  key: string;
  data: any;
  ttl: number;
}

class CacheManager {
  private cachePrefix = 'tj_cache_';
  private currentUserId: string | null = null;
  private config: CacheConfig = {
    maxRetries: 3,
    retryDelay: 1000, // 1 seconde
    enableLogging: false, // Désactivé pour réduire le bruit dans la console
    enableBatchOperations: true
  };
  private pendingOperations = new Map<string, Promise<any>>();
  private batchQueue: BatchOperation[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;

  constructor(config?: Partial<CacheConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Définit l'utilisateur actuel et nettoie le cache des autres utilisateurs
   */
  setCurrentUser(userId: string | null) {
    if (this.config.enableLogging) {
      console.log('🔄 [CACHE] Changement d\'utilisateur:', this.currentUserId, '->', userId);
    }
    
    if (this.currentUserId !== userId) {
      // Nettoyer le cache de l'ancien utilisateur
      if (this.config.enableLogging) {
        console.log('🧹 [CACHE] Nettoyage du cache pour le changement d\'utilisateur');
      }
      this.clearAllCaches();
      this.currentUserId = userId;
      if (this.config.enableLogging) {
        console.log('✅ [CACHE] Utilisateur actuel mis à jour:', userId);
      }
    } else {
      if (this.config.enableLogging) {
        console.log('ℹ️ [CACHE] Même utilisateur, pas de nettoyage nécessaire');
      }
    }
  }

  /**
   * Stocke des données dans le cache avec isolation par utilisateur et retry automatique
   */
  set(key: string, data: any, ttl: number = 5 * 60 * 1000): Promise<void> {
    return this.setWithRetry(key, data, ttl, 0);
  }

  /**
   * Stocke des données avec retry automatique
   */
  private async setWithRetry(key: string, data: any, ttl: number, retryCount: number): Promise<void> {
    if (!this.currentUserId) {
      if (this.config.enableLogging) {
        console.warn('⚠️ [CACHE] Aucun utilisateur défini, impossible de mettre en cache');
      }
      return;
    }

    const cacheKey = `${this.cachePrefix}${this.currentUserId}_${key}`;
    const entry: CacheEntry = {
      data,
      userId: this.currentUserId,
      timestamp: Date.now(),
      ttl,
      retryCount
    };

    try {
      localStorage.setItem(cacheKey, JSON.stringify(entry));
      if (this.config.enableLogging) {
        console.log('💾 [CACHE] Données mises en cache:', key, 'pour utilisateur:', this.currentUserId, 'clé:', cacheKey);
      }
    } catch (error) {
      if (retryCount < this.config.maxRetries) {
        if (this.config.enableLogging) {
          console.warn(`❌ [CACHE] Erreur lors de la mise en cache (tentative ${retryCount + 1}/${this.config.maxRetries}):`, error);
        }
        
        // Retry avec délai exponentiel
        await this.delay(this.config.retryDelay * Math.pow(2, retryCount));
        return this.setWithRetry(key, data, ttl, retryCount + 1);
      } else {
        console.error('❌ [CACHE] Échec définitif de la mise en cache après', this.config.maxRetries, 'tentatives:', error);
        throw new Error(`Impossible de mettre en cache après ${this.config.maxRetries} tentatives: ${error}`);
      }
    }
  }

  /**
   * Récupère des données du cache pour l'utilisateur actuel avec gestion d'erreurs robuste
   */
  get(key: string): any | null {
    if (!this.currentUserId) {
      if (this.config.enableLogging) {
        console.log('⚠️ [CACHE] Aucun utilisateur défini, impossible de récupérer du cache');
      }
      return null;
    }

    const cacheKey = `${this.cachePrefix}${this.currentUserId}_${key}`;
    
    try {
      const cached = localStorage.getItem(cacheKey);
      if (!cached) {
        if (this.config.enableLogging) {
          console.log('🔍 [CACHE] Aucune donnée en cache pour:', key);
        }
        return null;
      }

      const entry: CacheEntry = JSON.parse(cached);
      
      // Vérifier que l'entrée appartient à l'utilisateur actuel
      if (entry.userId !== this.currentUserId) {
        if (this.config.enableLogging) {
          console.log('🚫 [CACHE] Données d\'un autre utilisateur, suppression:', key);
        }
        this.remove(key);
        return null;
      }

      // Vérifier l'expiration
      if (Date.now() - entry.timestamp > entry.ttl) {
        if (this.config.enableLogging) {
          console.log('⏰ [CACHE] Données expirées, suppression:', key);
        }
        this.remove(key);
        return null;
      }

      if (this.config.enableLogging) {
        console.log('✅ [CACHE] Données récupérées du cache:', key);
      }
      return entry.data;
    } catch (error) {
      console.warn('❌ [CACHE] Erreur lors de la récupération du cache:', error);
      this.remove(key);
      return null;
    }
  }

  /**
   * Récupère des données avec retry automatique en cas d'échec
   */
  async getWithRetry(key: string, maxRetries: number = 3): Promise<any | null> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = this.get(key);
        if (result !== null) {
          return result;
        }
        
        if (attempt < maxRetries - 1) {
          await this.delay(this.config.retryDelay * Math.pow(2, attempt));
        }
      } catch (error) {
        if (attempt === maxRetries - 1) {
          console.error('❌ [CACHE] Échec définitif de la récupération après', maxRetries, 'tentatives:', error);
          throw error;
        }
        await this.delay(this.config.retryDelay * Math.pow(2, attempt));
      }
    }
    return null;
  }

  /**
   * Supprime une entrée du cache
   */
  remove(key: string): void {
    if (!this.currentUserId) return;

    const cacheKey = `${this.cachePrefix}${this.currentUserId}_${key}`;
    try {
      localStorage.removeItem(cacheKey);
    } catch (error) {
      console.warn('❌ [CACHE] Erreur lors de la suppression du cache:', error);
    }
  }

  /**
   * Nettoie tout le cache de l'utilisateur actuel
   */
  clearUserCache(): void {
    if (!this.currentUserId) return;

    const keysToRemove: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`${this.cachePrefix}${this.currentUserId}_`)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.warn('❌ [CACHE] Erreur lors du nettoyage du cache utilisateur:', error);
    }
  }

  /**
   * Nettoie tout le cache de l'application
   */
  clearAllCaches(): void {
    const keysToRemove: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.cachePrefix)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Nettoyer aussi les caches spécifiques
      const specificCaches = [
        'trading_accounts',
        'trades_cache', 
        'statistics_cache',
        'strategy_cache',
        'analytics_cache',
        'user_data'
      ];
      
      specificCaches.forEach(cacheKey => {
        localStorage.removeItem(cacheKey);
      });
    } catch (error) {
      console.warn('❌ [CACHE] Erreur lors du nettoyage complet du cache:', error);
    }
  }

  /**
   * Invalide toutes les clés de cache qui correspondent à un pattern
   */
  invalidatePattern(pattern: string): void {
    if (!this.currentUserId) return;

    const keysToRemove: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes(`${this.cachePrefix}${this.currentUserId}_`) && key.includes(pattern)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        if (this.config.enableLogging) {
          console.log(`🗑️ [CACHE] Clé invalidée: ${key}`);
        }
      });

      if (this.config.enableLogging && keysToRemove.length > 0) {
        console.log(`🔄 [CACHE] ${keysToRemove.length} clés invalidées pour le pattern: ${pattern}`);
      }
    } catch (error) {
      console.warn('❌ [CACHE] Erreur lors de l\'invalidation par pattern:', error);
    }
  }

  /**
   * Vérifie si une clé existe dans le cache
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Obtient les statistiques du cache
   */
  getCacheStats(): { totalEntries: number; userEntries: number; totalSize: number; errorCount: number } {
    let totalEntries = 0;
    let userEntries = 0;
    let totalSize = 0;
    let errorCount = 0;

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.cachePrefix)) {
          totalEntries++;
          const item = localStorage.getItem(key);
          if (item) {
            totalSize += item.length;
            try {
              const entry = JSON.parse(item);
              if (entry.lastError) {
                errorCount++;
              }
            } catch (e) {
              // Ignore parsing errors for stats
            }
          }
          
          if (this.currentUserId && key.includes(`_${this.currentUserId}_`)) {
            userEntries++;
          }
        }
      }
    } catch (error) {
      console.warn('❌ [CACHE] Erreur lors du calcul des statistiques:', error);
    }

    return { totalEntries, userEntries, totalSize, errorCount };
  }

  /**
   * Opérations par lot pour optimiser les performances
   */
  setBatch(operations: BatchOperation[]): Promise<void[]> {
    if (!this.config.enableBatchOperations) {
      return Promise.all(operations.map(op => this.set(op.key, op.data, op.ttl)));
    }

    return new Promise((resolve, reject) => {
      this.batchQueue.push(...operations);
      
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
      }

      this.batchTimeout = setTimeout(async () => {
        try {
          const results = await this.processBatch();
          resolve(results);
        } catch (error) {
          reject(error);
        }
      }, 100); // Traiter le lot après 100ms
    });
  }

  /**
   * Traite un lot d'opérations de cache
   */
  private async processBatch(): Promise<void[]> {
    const operations = [...this.batchQueue];
    this.batchQueue = [];
    
    const results: void[] = [];
    for (const operation of operations) {
      try {
        await this.set(operation.key, operation.data, operation.ttl);
        results.push();
      } catch (error) {
        console.warn('❌ [CACHE] Erreur dans l\'opération par lot:', error);
        results.push();
      }
    }
    
    return results;
  }

  /**
   * Précharge des données pour optimiser les performances
   */
  async preloadData(keys: string[], dataFetcher: (key: string) => Promise<any>, ttl: number = 5 * 60 * 1000): Promise<void> {
    const promises = keys.map(async (key) => {
      if (!this.has(key)) {
        try {
          const data = await dataFetcher(key);
          await this.set(key, data, ttl);
        } catch (error) {
          console.warn(`❌ [CACHE] Erreur lors du préchargement de ${key}:`, error);
        }
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Groupe les requêtes de calendrier pour optimiser les performances
   */
  async getCalendarDataBatch(dates: string[], tradingAccountId?: number): Promise<Map<string, any>> {
    const results = new Map<string, any>();
    const uncachedDates: string[] = [];

    // Vérifier le cache pour chaque date
    for (const date of dates) {
      const cacheKey = `calendar_${date}_${tradingAccountId || 'all'}`;
      const cached = this.get(cacheKey);
      if (cached) {
        results.set(date, cached);
      } else {
        uncachedDates.push(date);
      }
    }

    // Si toutes les données sont en cache, retourner immédiatement
    if (uncachedDates.length === 0) {
      return results;
    }

    // Sinon, faire une requête groupée pour les dates manquantes
    try {
      // Ici, vous pourriez implémenter une API backend qui accepte plusieurs dates
      // Pour l'instant, on fait des requêtes individuelles mais en parallèle
      const promises = uncachedDates.map(async (date) => {
        try {
          // Simuler l'appel API - à remplacer par votre logique réelle
          const data = await this.fetchCalendarDataForDate(date, tradingAccountId);
          const cacheKey = `calendar_${date}_${tradingAccountId || 'all'}`;
          await this.set(cacheKey, data, 5 * 60 * 1000);
          results.set(date, data);
        } catch (error) {
          console.warn(`❌ [CACHE] Erreur lors de la récupération de ${date}:`, error);
        }
      });

      await Promise.allSettled(promises);
    } catch (error) {
      console.error('❌ [CACHE] Erreur lors du chargement par lot:', error);
    }

    return results;
  }

  /**
   * Méthode helper pour simuler la récupération de données de calendrier
   */
  private async fetchCalendarDataForDate(date: string, tradingAccountId?: number): Promise<any> {
    // À remplacer par votre logique de récupération réelle
    return { date, data: [] };
  }

  /**
   * Utilitaires
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Configure le niveau de logging
   */
  setLogging(enabled: boolean): void {
    this.config.enableLogging = enabled;
  }

  /**
   * Configure les opérations par lot
   */
  setBatchOperations(enabled: boolean): void {
    this.config.enableBatchOperations = enabled;
  }

  /**
   * Nettoie les entrées expirées
   */
  cleanupExpiredEntries(): void {
    if (!this.currentUserId) return;

    const keysToRemove: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`${this.cachePrefix}${this.currentUserId}_`)) {
          try {
            const item = localStorage.getItem(key);
            if (item) {
              const entry: CacheEntry = JSON.parse(item);
              if (Date.now() - entry.timestamp > entry.ttl) {
                keysToRemove.push(key);
              }
            }
          } catch (error) {
            // Si on ne peut pas parser l'entrée, la supprimer
            keysToRemove.push(key);
          }
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      if (this.config.enableLogging && keysToRemove.length > 0) {
        console.log(`🧹 [CACHE] Nettoyage de ${keysToRemove.length} entrées expirées`);
      }
    } catch (error) {
      console.warn('❌ [CACHE] Erreur lors du nettoyage des entrées expirées:', error);
    }
  }
}

// Instance singleton
export const cacheManager = new CacheManager();

// Nettoyage automatique des entrées expirées toutes les 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    cacheManager.cleanupExpiredEntries();
  }, 5 * 60 * 1000);

  // Écouter les événements de changement d'utilisateur
  window.addEventListener('user:login', (event: any) => {
    const userId = event.detail?.user?.id;
    cacheManager.setCurrentUser(userId);
  });

  window.addEventListener('user:logout', () => {
    cacheManager.setCurrentUser(null);
    cacheManager.clearAllCaches();
  });
}

export default cacheManager;