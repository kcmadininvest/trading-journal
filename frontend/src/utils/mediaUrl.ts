/**
 * Utilitaire pour construire les URLs complètes des fichiers media
 */

/**
 * Construit l'URL complète pour un fichier media
 * @param url - L'URL du fichier (peut être relative ou absolue)
 * @returns L'URL complète avec le domaine du backend
 */
export const getFullMediaUrl = (url: string): string => {
  if (!url) return url;
  
  // Si l'URL est déjà complète (commence par http:// ou https://), la retourner telle quelle
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Si l'URL commence par /media/, construire l'URL complète avec le backend
  if (url.startsWith('/media/')) {
    const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    // Retirer /api si présent dans REACT_APP_API_URL
    const baseUrl = apiBaseUrl.replace(/\/api\/?$/, '');
    return `${baseUrl}${url}`;
  }
  
  // Sinon, retourner l'URL telle quelle (peut être une URL externe)
  return url;
};

/**
 * Ouvre un fichier media dans un nouvel onglet
 * @param url - L'URL du fichier
 */
export const openMediaUrl = (url: string): void => {
  if (!url) return;
  const fullUrl = getFullMediaUrl(url);
  window.open(fullUrl, '_blank', 'noopener,noreferrer');
};

