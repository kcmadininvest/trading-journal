/**
 * Système de logging conditionnel
 * Affiche les logs en développement, les masque en production
 */

interface LogLevel {
  DEBUG: 'debug';
  INFO: 'info';
  WARN: 'warn';
  ERROR: 'error';
}

const LOG_LEVELS: LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
};

class Logger {
  private isDevelopment: boolean;
  private isEnabled: boolean;

  constructor() {
    // Détecter l'environnement
    this.isDevelopment = process.env.NODE_ENV === 'development';
    
    // Permettre d'activer/désactiver les logs même en dev via localStorage
    this.isEnabled = this.isDevelopment && localStorage.getItem('debug_logs') !== 'false';
  }

  private shouldLog(level: keyof LogLevel): boolean {
    // Toujours afficher les erreurs
    if (level === 'ERROR') return true;
    
    // En production, ne rien afficher sauf les erreurs
    if (!this.isDevelopment) return false;
    
    // En développement, respecter le paramètre localStorage
    return this.isEnabled;
  }

  private formatMessage(level: string, message: string, ...args: any[]): [string, ...any[]] {
    const timestamp = new Date().toISOString().slice(11, 23); // HH:mm:ss.SSS
    const formattedMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    return [formattedMessage, ...args];
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('DEBUG')) {
      console.log(...this.formatMessage('DEBUG', message, ...args));
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('INFO')) {
      console.info(...this.formatMessage('INFO', message, ...args));
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('WARN')) {
      console.warn(...this.formatMessage('WARN', message, ...args));
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('ERROR')) {
      console.error(...this.formatMessage('ERROR', message, ...args));
    }
  }

  // Méthodes spécialisées pour les composants
  component(componentName: string, message: string, ...args: any[]): void {
    this.debug(`[${componentName}] ${message}`, ...args);
  }

  api(endpoint: string, message: string, ...args: any[]): void {
    this.debug(`[API:${endpoint}] ${message}`, ...args);
  }

  auth(message: string, ...args: any[]): void {
    this.debug(`[AUTH] ${message}`, ...args);
  }

  cache(message: string, ...args: any[]): void {
    this.debug(`[CACHE] ${message}`, ...args);
  }

  // Méthode pour activer/désactiver les logs dynamiquement
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    localStorage.setItem('debug_logs', enabled.toString());
  }

  // Méthode pour vérifier si les logs sont activés
  isLoggingEnabled(): boolean {
    return this.isEnabled;
  }
}

// Instance singleton
const logger = new Logger();

// Export des méthodes principales
export const log = {
  debug: logger.debug.bind(logger),
  info: logger.info.bind(logger),
  warn: logger.warn.bind(logger),
  error: logger.error.bind(logger),
  component: logger.component.bind(logger),
  api: logger.api.bind(logger),
  auth: logger.auth.bind(logger),
  cache: logger.cache.bind(logger),
  setEnabled: logger.setEnabled.bind(logger),
  isEnabled: logger.isLoggingEnabled.bind(logger)
};

// Export de l'instance complète si nécessaire
export default logger;

// Export des constantes
export { LOG_LEVELS };
