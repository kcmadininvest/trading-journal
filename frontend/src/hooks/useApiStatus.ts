import { useState, useEffect } from 'react';
import { getApiBaseUrl } from '../utils/apiConfig';

type ApiStatus = 'online' | 'offline' | 'checking';

export const useApiStatus = () => {
  const [status, setStatus] = useState<ApiStatus>('checking');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkApiStatus = async () => {
    try {
      const baseUrl = getApiBaseUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // Utiliser l'endpoint /api/test/ pour vérifier le statut de l'API
      // Cet endpoint ne nécessite pas d'authentification et répond rapidement
      const response = await fetch(`${baseUrl}/api/test/`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Le endpoint /api/test/ retourne 200 si l'API est disponible
      if (response.ok && response.status === 200) {
        setStatus('online');
        setLastChecked(new Date());
      } else {
        setStatus('offline');
        setLastChecked(new Date());
      }
    } catch {
      // Erreur réseau, timeout, ou API inaccessible
      setStatus('offline');
      setLastChecked(new Date());
    }
  };

  useEffect(() => {
    // Vérifier immédiatement au montage
    checkApiStatus();

    // Vérifier périodiquement toutes les 30 secondes
    const interval = setInterval(() => {
      checkApiStatus();
    }, 30000);

    // Écouter les événements de connexion/déconnexion du navigateur
    const handleOnline = () => {
      checkApiStatus();
    };

    const handleOffline = () => {
      setStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { status, lastChecked };
};

