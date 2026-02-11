import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
  noindex?: boolean;
}

const SEOHead: React.FC<SEOHeadProps> = ({
  title,
  description,
  keywords,
  image = '/og-image.png',
  url = window.location.href,
  type = 'website',
  noindex = false,
}) => {
  const { i18n } = useTranslation();
  const currentLang = i18n.language || 'fr';
  
  // Fonction helper pour forcer une URL à être en HTTPS (bonne pratique SEO)
  const ensureHttps = (urlString: string): string => {
    if (!urlString) return 'https://app.kctradingjournal.com';
    // Si l'URL commence par http://, la remplacer par https://
    return urlString.replace(/^http:\/\//i, 'https://');
  };
  
  // Forcer baseUrl à toujours être en HTTPS
  const rawBaseUrl = process.env.REACT_APP_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://app.kctradingjournal.com');
  const baseUrl = ensureHttps(rawBaseUrl);
  
  // Forcer l'URL canonique à toujours être en HTTPS et SANS paramètres de requête
  // Cela évite les problèmes de contenu dupliqué avec Google
  const cleanCanonicalUrl = (() => {
    try {
      const urlObj = new URL(ensureHttps(url));
      // Supprimer tous les paramètres de requête (comme ?lang=en)
      urlObj.search = '';
      urlObj.hash = '';
      return urlObj.toString();
    } catch {
      // Fallback si l'URL n'est pas valide
      return ensureHttps(url).split('?')[0].split('#')[0];
    }
  })();
  const canonicalUrl = cleanCanonicalUrl;

  useEffect(() => {
    // Mettre à jour le titre
    if (title) {
      document.title = title;
    }

    // Fonction helper pour mettre à jour ou créer une meta tag
    const updateMetaTag = (name: string, content: string, isProperty = false) => {
      const attribute = isProperty ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement;
      
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attribute, name);
        document.head.appendChild(meta);
      }
      
      meta.setAttribute('content', content);
    };

    // Fonction helper pour mettre à jour ou créer un link tag
    const updateLinkTag = (rel: string, href: string, hreflang?: string) => {
      const selector = hreflang 
        ? `link[rel="${rel}"][hreflang="${hreflang}"]`
        : `link[rel="${rel}"]`;
      
      let link = document.querySelector(selector) as HTMLLinkElement;
      
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', rel);
        if (hreflang) {
          link.setAttribute('hreflang', hreflang);
        }
        document.head.appendChild(link);
      }
      
      link.setAttribute('href', href);
    };

    // Meta description
    if (description) {
      updateMetaTag('description', description);
    }

    // Meta keywords
    if (keywords) {
      updateMetaTag('keywords', keywords);
    }

    // Robots
    updateMetaTag('robots', noindex ? 'noindex, nofollow' : 'index, follow');
    
    // Content-Language pour indiquer la langue du contenu
    updateMetaTag('content-language', currentLang);

    // Open Graph
    updateMetaTag('og:title', title || 'K&C Trading Journal', true);
    updateMetaTag('og:description', description || '', true);
    updateMetaTag('og:image', `${baseUrl}${image}`, true);
    // Forcer og:url à toujours être en HTTPS
    updateMetaTag('og:url', canonicalUrl, true);
    updateMetaTag('og:type', type, true);
    // Logo pour les résultats de recherche (certains réseaux sociaux et moteurs de recherche)
    updateMetaTag('og:logo', `${baseUrl}/android-chrome-512x512.png`, true);
    
    // Locale mapping
    const localeMap: Record<string, string> = {
      fr: 'fr_FR',
      en: 'en_US',
      es: 'es_ES',
      de: 'de_DE',
    };
    const currentLocale = localeMap[currentLang] || 'fr_FR';
    updateMetaTag('og:locale', currentLocale, true);
    
    // Gérer og:locale:alternate pour toutes les langues supportées
    // Supprimer toutes les anciennes balises og:locale:alternate
    const existingAlternates = document.querySelectorAll('meta[property="og:locale:alternate"]');
    existingAlternates.forEach((meta) => meta.remove());
    
    // Ajouter les nouvelles balises og:locale:alternate pour toutes les langues sauf la langue actuelle
    const supportedLocales = ['fr_FR', 'en_US', 'es_ES', 'de_DE'];
    supportedLocales.forEach((locale) => {
      if (locale !== currentLocale) {
        const alternateMeta = document.createElement('meta');
        alternateMeta.setAttribute('property', 'og:locale:alternate');
        alternateMeta.setAttribute('content', locale);
        document.head.appendChild(alternateMeta);
      }
    });

    // Twitter Card
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', title || 'K&C Trading Journal');
    updateMetaTag('twitter:description', description || '');
    // Utiliser twitter-card.png pour Twitter, sinon fallback sur og-image
    const twitterImage = `${baseUrl}/twitter-card.png`;
    updateMetaTag('twitter:image', twitterImage);

    // Canonical URL - Toujours en HTTPS (bonne pratique SEO)
    updateLinkTag('canonical', canonicalUrl);

    // Hreflang tags - Générer les URLs pour chaque langue selon la page actuelle
    const languages = ['fr', 'en', 'es', 'de'];
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    
    // URLs selon la page et la langue
    const getUrlForLanguage = (lang: string): string => {
      // Page d'accueil - utiliser la même URL propre pour toutes les langues
      // La détection de langue se fait côté client via navigator.language
      // Cela évite les problèmes de contenu dupliqué avec Google
      if (currentPath === '/' || currentPath === '' || currentPath === '/#') {
        // Pour la page d'accueil, toutes les langues pointent vers la même URL
        // La langue est détectée automatiquement côté client
        return baseUrl;
      }
      
      // Page À Propos
      if (currentPath.includes('/a-propos') || currentPath.includes('/about') || 
          currentPath.includes('/acerca-de') || currentPath.includes('/uber-uns')) {
        const aboutUrls: Record<string, string> = {
          fr: '/a-propos',
          en: '/about',
          es: '/acerca-de',
          de: '/uber-uns',
        };
        return `${baseUrl}${aboutUrls[lang] || aboutUrls.fr}`;
      }
      
      // Page Fonctionnalités
      if (currentPath.includes('/fonctionnalites') || currentPath.includes('/features') || 
          currentPath.includes('/funcionalidades') || currentPath.includes('/funktionen')) {
        const featuresUrls: Record<string, string> = {
          fr: '/fonctionnalites',
          en: '/features',
          es: '/funcionalidades',
          de: '/funktionen',
        };
        return `${baseUrl}${featuresUrls[lang] || featuresUrls.fr}`;
      }
      
      // Par défaut, retourner l'URL de base sans paramètre
      return baseUrl;
    };
    
    // Supprimer les anciennes balises hreflang avant d'ajouter les nouvelles
    const existingHreflangs = document.querySelectorAll('link[rel="alternate"][hreflang]');
    existingHreflangs.forEach((link) => link.remove());
    
    languages.forEach((lang) => {
      const langUrl = getUrlForLanguage(lang);
      updateLinkTag('alternate', langUrl, lang);
    });
    
    // x-default pointe vers la langue par défaut (français) ou la version sans paramètre
    updateLinkTag('alternate', baseUrl, 'x-default');

    // Mettre à jour la langue HTML
    document.documentElement.lang = currentLang;
  }, [title, description, keywords, image, url, type, noindex, currentLang, baseUrl, canonicalUrl]);

  return null; // Ce composant ne rend rien
};

export default SEOHead;
