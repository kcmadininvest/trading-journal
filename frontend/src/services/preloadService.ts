/**
 * Service de préchargement intelligent pour optimiser les performances
 * et réduire les appels API redondants
 */

import cacheManager from './cacheManager';
import { tradesService } from './trades';
import { tradingAccountService } from './tradingAccountService';

interface PreloadConfig {
  enableCalendarPreload: boolean;
  enableStrategiesPreload: boolean;
  enableAnalyticsPreload: boolean;
  preloadDays: number;
  maxConcurrentRequests: number;
}

interface PreloadTask {
  id: string;
  priority: number;
  execute: () => Promise<any>;
  dependencies?: string[];
}

class PreloadService {
  private config: PreloadConfig = {
    enableCalendarPreload: true,
    enableStrategiesPreload: true,
    enableAnalyticsPreload: true,
    preloadDays: 7,
    maxConcurrentRequests: 3
  };
  
  private taskQueue: PreloadTask[] = [];
  private runningTasks = new Set<string>();
  private completedTasks = new Set<string>();
  private isProcessing = false;

  constructor(config?: Partial<PreloadConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Précharge les données essentielles pour l'utilisateur actuel
   */
  async preloadEssentialData(tradingAccountId?: number): Promise<void> {
    const tasks: PreloadTask[] = [];

    // 1. Précharger les comptes de trading (priorité haute)
    tasks.push({
      id: 'trading_accounts',
      priority: 10,
      execute: async () => {
        const accounts = await tradingAccountService.getAccounts();
        return accounts;
      }
    });

    // 2. Précharger les données de calendrier pour les 7 prochains jours
    if (this.config.enableCalendarPreload) {
      const today = new Date();
      for (let i = 0; i < this.config.preloadDays; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        tasks.push({
          id: `calendar_${dateStr}`,
          priority: 8,
          execute: async () => {
            return await tradesService.getCalendarData(
              date.getFullYear(),
              date.getMonth() + 1,
              tradingAccountId
            );
          }
        });
      }
    }

    // 3. Précharger les stratégies pour les dates récentes
    if (this.config.enableStrategiesPreload) {
      const today = new Date();
      for (let i = 0; i < 3; i++) { // 3 derniers jours
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        tasks.push({
          id: `strategies_${dateStr}`,
          priority: 7,
          execute: async () => {
            return await tradesService.getTradeStrategiesByDate(dateStr, tradingAccountId);
          }
        });
      }
    }

    // 4. Précharger les données d'analytics
    if (this.config.enableAnalyticsPreload) {
      tasks.push({
        id: 'analytics_data',
        priority: 6,
        execute: async () => {
          return await tradesService.getAnalyticsData(tradingAccountId);
        }
      });
    }

    // Exécuter les tâches en parallèle avec limitation de concurrence
    await this.executeTasks(tasks);
  }

  /**
   * Précharge les données pour une période spécifique
   */
  async preloadDateRange(startDate: Date, endDate: Date, tradingAccountId?: number): Promise<void> {
    const tasks: PreloadTask[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // Données de calendrier
      tasks.push({
        id: `calendar_${dateStr}`,
        priority: 8,
        execute: async () => {
          return await tradesService.getCalendarData(
            currentDate.getFullYear(),
            currentDate.getMonth() + 1,
            tradingAccountId
          );
        }
      });

      // Stratégies pour cette date
      tasks.push({
        id: `strategies_${dateStr}`,
        priority: 7,
        execute: async () => {
          return await tradesService.getTradeStrategiesByDate(dateStr, tradingAccountId);
        }
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    await this.executeTasks(tasks);
  }

  /**
   * Précharge les données pour le mois actuel
   */
  async preloadCurrentMonth(tradingAccountId?: number): Promise<void> {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    await this.preloadDateRange(firstDay, lastDay, tradingAccountId);
  }

  /**
   * Précharge les données pour le mois suivant
   */
  async preloadNextMonth(tradingAccountId?: number): Promise<void> {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const lastDayNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    
    await this.preloadDateRange(nextMonth, lastDayNextMonth, tradingAccountId);
  }

  /**
   * Exécute les tâches avec limitation de concurrence
   */
  private async executeTasks(tasks: PreloadTask[]): Promise<void> {
    // Trier par priorité (plus haute priorité = plus petit nombre)
    tasks.sort((a, b) => a.priority - b.priority);

    const promises: Promise<void>[] = [];
    const runningCount = { value: 0 };

    for (const task of tasks) {
      // Attendre qu'une place se libère si on a atteint la limite
      while (runningCount.value >= this.config.maxConcurrentRequests) {
        await Promise.race(promises);
        runningCount.value--;
      }

      const executeTaskWithCleanup = async () => {
        try {
          return await this.executeTask(task);
        } finally {
          runningCount.value--;
        }
      };

      promises.push(executeTaskWithCleanup());
      runningCount.value++;
    }

    // Attendre que toutes les tâches se terminent
    await Promise.allSettled(promises);
  }

  /**
   * Exécute une tâche individuelle
   */
  private async executeTask(task: PreloadTask): Promise<void> {
    if (this.completedTasks.has(task.id)) {
      return;
    }

    // Vérifier les dépendances
    if (task.dependencies) {
      const unmetDependencies = task.dependencies.filter(dep => !this.completedTasks.has(dep));
      if (unmetDependencies.length > 0) {
        // Réajouter la tâche à la fin de la queue
        setTimeout(() => {
          this.executeTask(task);
        }, 100);
        return;
      }
    }

    try {
      this.runningTasks.add(task.id);
      
      // Vérifier si les données sont déjà en cache
      const cacheKey = this.getCacheKeyForTask(task);
      if (cacheManager.has(cacheKey)) {
        this.completedTasks.add(task.id);
        return;
      }

      // Exécuter la tâche
      const result = await task.execute();
      
      // Mettre en cache le résultat
      await cacheManager.set(cacheKey, result, 10 * 60 * 1000); // 10 minutes
      
      this.completedTasks.add(task.id);
      
      console.log(`✅ [PRELOAD] Tâche ${task.id} terminée avec succès`);
    } catch (error) {
      console.warn(`❌ [PRELOAD] Erreur lors de l'exécution de la tâche ${task.id}:`, error);
    } finally {
      this.runningTasks.delete(task.id);
    }
  }

  /**
   * Génère une clé de cache pour une tâche
   */
  private getCacheKeyForTask(task: PreloadTask): string {
    return `preload_${task.id}`;
  }

  /**
   * Précharge les données en arrière-plan
   */
  async preloadInBackground(tradingAccountId?: number): Promise<void> {
    // Ne pas bloquer l'interface utilisateur
    setTimeout(async () => {
      try {
        await this.preloadEssentialData(tradingAccountId);
        
        // Précharger le mois suivant en arrière-plan
        await this.preloadNextMonth(tradingAccountId);
      } catch (error) {
        console.warn('❌ [PRELOAD] Erreur lors du préchargement en arrière-plan:', error);
      }
    }, 0);
  }

  /**
   * Prédit les données qui seront probablement nécessaires
   */
  async predictivePreload(tradingAccountId?: number): Promise<void> {
    const today = new Date();
    const tasks: PreloadTask[] = [];

    // Précharger les données pour les 3 prochains jours ouvrables
    for (let i = 1; i <= 3; i++) {
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + i);
      
      // Ignorer les weekends
      if (futureDate.getDay() === 0 || futureDate.getDay() === 6) {
        continue;
      }

      const dateStr = futureDate.toISOString().split('T')[0];
      
      tasks.push({
        id: `predictive_calendar_${dateStr}`,
        priority: 5,
        execute: async () => {
          return await tradesService.getCalendarData(
            futureDate.getFullYear(),
            futureDate.getMonth() + 1,
            tradingAccountId
          );
        }
      });
    }

    // Précharger les statistiques générales
    tasks.push({
      id: 'predictive_statistics',
      priority: 4,
      execute: async () => {
        return await tradesService.getStatistics(tradingAccountId);
      }
    });

    await this.executeTasks(tasks);
  }

  /**
   * Nettoie les données de préchargement expirées
   */
  cleanupPreloadData(): void {
    const keysToRemove: string[] = [];
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('tj_cache_') && key.includes('preload_')) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      console.log(`🧹 [PRELOAD] Nettoyage de ${keysToRemove.length} entrées de préchargement`);
    } catch (error) {
      console.warn('❌ [PRELOAD] Erreur lors du nettoyage:', error);
    }
  }

  /**
   * Obtient les statistiques de préchargement
   */
  getPreloadStats(): { completedTasks: number; runningTasks: number; queueLength: number } {
    return {
      completedTasks: this.completedTasks.size,
      runningTasks: this.runningTasks.size,
      queueLength: this.taskQueue.length
    };
  }

  /**
   * Configure le service de préchargement
   */
  configure(config: Partial<PreloadConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Instance singleton
export const preloadService = new PreloadService();

// Nettoyage automatique des données de préchargement toutes les heures
if (typeof window !== 'undefined') {
  setInterval(() => {
    preloadService.cleanupPreloadData();
  }, 60 * 60 * 1000);
}

export default preloadService;