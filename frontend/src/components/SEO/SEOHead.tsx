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
  const baseUrl = process.env.REACT_APP_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://app.kctradingjournal.com');

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

    // Open Graph
    updateMetaTag('og:title', title || 'K&C Trading Journal', true);
    updateMetaTag('og:description', description || '', true);
    updateMetaTag('og:image', `${baseUrl}${image}`, true);
    updateMetaTag('og:url', url, true);
    updateMetaTag('og:type', type, true);
    updateMetaTag('og:locale', currentLang === 'fr' ? 'fr_FR' : currentLang === 'en' ? 'en_US' : currentLang === 'es' ? 'es_ES' : 'de_DE', true);

    // Twitter Card
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', title || 'K&C Trading Journal');
    updateMetaTag('twitter:description', description || '');
    updateMetaTag('twitter:image', `${baseUrl}${image}`);

    // Canonical URL
    updateLinkTag('canonical', url);

    // Hreflang tags - Générer les URLs pour chaque langue selon la page actuelle
    const languages = ['fr', 'en', 'es', 'de'];
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    
    // URLs selon la page et la langue
    const getUrlForLanguage = (lang: string): string => {
      // Page d'accueil - toutes les langues pointent vers la même URL (le contenu change selon la langue détectée)
      if (currentPath === '/' || currentPath === '' || currentPath === '/#') {
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
      
      // Par défaut, retourner l'URL de base
      return baseUrl;
    };
    
    languages.forEach((lang) => {
      const langUrl = getUrlForLanguage(lang);
      updateLinkTag('alternate', langUrl, lang);
    });
    updateLinkTag('alternate', baseUrl, 'x-default');

    // Mettre à jour la langue HTML
    document.documentElement.lang = currentLang;
  }, [title, description, keywords, image, url, type, noindex, currentLang, baseUrl]);

  return null; // Ce composant ne rend rien
};

export default SEOHead;
