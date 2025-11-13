/**
 * Configuration de l'API
 * Utilise REACT_APP_API_URL si défini, sinon utilise une URL par défaut
 * 
 * Note: REACT_APP_API_URL doit contenir l'URL complète jusqu'à /api (ex: https://app.kctradingjournal.com/api)
 * Les services ajoutent ensuite les endpoints spécifiques (ex: /accounts/auth/login/)
 */
export const getApiBaseUrl = (): string => {
  // En production, utiliser REACT_APP_API_URL depuis .env.production
  // En développement, utiliser la variable d'environnement ou localhost par défaut
  const apiUrl = process.env.REACT_APP_API_URL;
  
  if (apiUrl) {
    // Si l'URL contient déjà /api, on la retourne telle quelle
    // Sinon, on l'ajoute
    if (apiUrl.endsWith('/api') || apiUrl.endsWith('/api/')) {
      // Retourner sans le /api final car les services l'ajoutent dans leurs appels
      return apiUrl.replace(/\/api\/?$/, '');
    }
    return apiUrl;
  }
  
  // Fallback par défaut pour le développement
  return process.env.NODE_ENV === 'development' 
    ? 'http://localhost:8000'
    : (typeof window !== 'undefined'
        ? `${window.location.protocol}//${window.location.host}`
        : '');
};

