// Test de détection d'environnement
import { log } from '../utils/logger';

export const testEnvironmentDetection = () => {
  console.log('=== TEST DE DÉTECTION D\'ENVIRONNEMENT ===');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('isDevelopment:', process.env.NODE_ENV === 'development');
  
  log.debug('Ce message ne devrait apparaître qu\'en développement');
  log.info('Ce message ne devrait apparaître qu\'en développement');
  log.warn('Ce message ne devrait apparaître qu\'en développement');
  log.error('Ce message devrait toujours apparaître (même en production)');
  
  console.log('=== FIN DU TEST ===');
};