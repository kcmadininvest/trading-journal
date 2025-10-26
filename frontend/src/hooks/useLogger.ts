import { useCallback } from 'react';
import { log } from '../utils';

/**
 * Hook pour utiliser le système de logging dans les composants React
 */
export const useLogger = (componentName: string) => {
  const debug = useCallback((message: string, ...args: any[]) => {
    log.component(componentName, message, ...args);
  }, [componentName]);

  const info = useCallback((message: string, ...args: any[]) => {
    log.info(`[${componentName}] ${message}`, ...args);
  }, [componentName]);

  const warn = useCallback((message: string, ...args: any[]) => {
    log.warn(`[${componentName}] ${message}`, ...args);
  }, [componentName]);

  const error = useCallback((message: string, ...args: any[]) => {
    log.error(`[${componentName}] ${message}`, ...args);
  }, [componentName]);

  const api = useCallback((endpoint: string, message: string, ...args: any[]) => {
    log.api(endpoint, `[${componentName}] ${message}`, ...args);
  }, [componentName]);

  return {
    debug,
    info,
    warn,
    error,
    api
  };
};

export default useLogger;