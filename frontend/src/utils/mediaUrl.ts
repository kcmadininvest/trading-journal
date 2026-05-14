/**
 * Utilitaire pour construire les URLs complètes des fichiers media
 */

/** Événement global : ImageLightboxProvider affiche l’image en plein écran (PWA / pas de grand vide). */
export const IMAGE_LIGHTBOX_OPEN_EVENT = 'tj:image-lightbox-open';

const DIRECT_IMAGE_PATH_RE = /\.(webp|png|jpe?g|gif|avif|bmp)(\?|#|$)/i;

function shouldOpenInAppLightbox(originalUrl: string, fullUrl: string): boolean {
  if (originalUrl.startsWith('/media/')) {
    return true;
  }
  try {
    return DIRECT_IMAGE_PATH_RE.test(new URL(fullUrl).pathname);
  } catch {
    return DIRECT_IMAGE_PATH_RE.test(fullUrl);
  }
}

function openUrlInNewTab(fullUrl: string): void {
  const a = document.createElement('a');
  a.href = fullUrl;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Construit l'URL complète pour un fichier media
 * @param url - L'URL du fichier (peut être relative ou absolue)
 * @returns L'URL complète avec le domaine du backend, ou chaîne vide si absente
 */
export const getFullMediaUrl = (url: string | undefined | null): string => {
  if (!url) return '';

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
 * Ouvre un media : lightbox plein écran pour les images (screenshots / fichiers directs),
 * sinon nouvel onglet (liens vers une page web).
 */
export const openMediaUrl = (url: string): void => {
  if (!url) return;
  const fullUrl = getFullMediaUrl(url);

  if (shouldOpenInAppLightbox(url, fullUrl)) {
    window.dispatchEvent(
      new CustomEvent(IMAGE_LIGHTBOX_OPEN_EVENT, { detail: { url: fullUrl } })
    );
    return;
  }

  openUrlInNewTab(fullUrl);
};
