/**
 * Configuration de l'API
 * Utilise VITE_API_URL si défini, sinon utilise une URL par défaut
 *
 * Note: VITE_API_URL doit contenir l'URL complète jusqu'à /api (ex: https://app.kctradingjournal.com/api)
 * Les services ajoutent ensuite les endpoints spécifiques (ex: /accounts/auth/login/)
 */
export const getApiBaseUrl = (): string => {
  const apiUrl = import.meta.env.VITE_API_URL;

  if (apiUrl) {
    if (apiUrl.endsWith('/api') || apiUrl.endsWith('/api/')) {
      return apiUrl.replace(/\/api\/?$/, '');
    }
    return apiUrl;
  }

  // DEV : same-origin (proxy Vite /api et /ws) pour cookies HttpOnly
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.host}`;
  }
  return '';
};
