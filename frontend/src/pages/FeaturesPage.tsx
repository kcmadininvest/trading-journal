import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SEOHead, SchemaMarkup } from '../components/SEO';
import { changeLanguage } from '../i18n/config';
import i18n from '../i18n/config';

const FeaturesPage: React.FC = () => {
  const baseUrl = process.env.REACT_APP_BASE_URL || window.location.origin;
  
  // URLs selon la langue
  const urlMap: Record<string, string> = {
    fr: '/fonctionnalites',
    en: '/features',
    es: '/funcionalidades',
    de: '/funktionen',
  };
  
  // Détecter la langue depuis l'URL en premier, puis localStorage
  const detectLanguageFromUrl = (): string | null => {
    const pathname = window.location.pathname;
    // Trouver la langue correspondant à l'URL actuelle
    for (const [lang, url] of Object.entries(urlMap)) {
      if (pathname === url) {
        return lang;
      }
    }
    return null;
  };
  
  const getSavedLanguage = (): string => {
    // D'abord, essayer de détecter depuis l'URL
    const urlLang = detectLanguageFromUrl();
    if (urlLang) {
      return urlLang;
    }
    // Sinon, utiliser localStorage
    const savedLang = localStorage.getItem('i18nextLng');
    if (savedLang && ['fr', 'en', 'es', 'de'].includes(savedLang)) {
      return savedLang;
    }
    return 'fr';
  };
  
  // Lire la langue depuis l'URL ou localStorage
  const savedLang = getSavedLanguage();
  
  
  const [isLangApplied, setIsLangApplied] = useState(() => {
    // Vérifier si la langue est déjà correcte
    return i18n.language?.split('-')[0] === savedLang;
  });
  
  // Utiliser useTranslation
  const { t, i18n: i18nHook } = useTranslation();
  
  // Appliquer la langue immédiatement au montage et écouter les changements
  useEffect(() => {
    
    const applyLang = async () => {
      const currentI18nLang = i18n.language?.split('-')[0] || 'fr';
      if (currentI18nLang !== savedLang) {
        // changeLanguage() sauvegarde automatiquement dans localStorage via LanguageDetector
        await changeLanguage(savedLang);
      } else {
      }
      setIsLangApplied(true);
    };
    
    // Écouter les changements de langue pour forcer un re-rendu
    const handleLanguageChanged = (lng: string) => {
      setIsLangApplied(true);
    };
    
    i18n.on('languageChanged', handleLanguageChanged);
    
    // Si la langue n'est pas déjà appliquée, l'appliquer
    if (!isLangApplied) {
      applyLang();
    } else {
    }
    
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [savedLang, isLangApplied]);
  
  // Utiliser la langue actuelle de i18n ou la langue sauvegardée
  const currentLang = i18nHook.language?.split('-')[0] || savedLang;
  const finalLang = currentLang;
  
  const currentUrl = `${baseUrl}${urlMap[finalLang] || urlMap.fr}`;

  // Attendre que la langue soit appliquée et que i18n soit synchronisé
  const currentI18nLang = i18nHook.language?.split('-')[0] || 'fr';
  
  if (!isLangApplied || currentI18nLang !== savedLang) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Traductions SEO selon la langue
  const seoData: Record<string, { title: string; description: string; keywords: string; name: string }> = {
    fr: {
      title: 'Fonctionnalités | K&C Trading Journal',
      description: 'Découvrez toutes les fonctionnalités de K&C Trading Journal : suivi de trades, analyses avancées, gestion de stratégies, statistiques détaillées et bien plus encore.',
      keywords: 'fonctionnalités, features, suivi trades, analyse trading, statistiques trading, journal trading',
      name: 'Fonctionnalités - K&C Trading Journal',
    },
    en: {
      title: 'Trading Journal Features - Track, Analyze & Optimize | K&C Trading Journal',
      description: 'Discover all the features of K&C Trading Journal: trade tracking, advanced analytics, strategy management, detailed statistics, CSV import, multi-account support, performance metrics, and much more. 100% free trading journal software.',
      keywords: 'trading journal features, trade tracking software, trading analytics, performance tracking, trading statistics, strategy management, CSV import, multi-account trading, trading metrics, position tracking, trade analysis tools',
      name: 'Features - K&C Trading Journal',
    },
    es: {
      title: 'Funcionalidades | K&C Trading Journal',
      description: 'Descubre todas las funcionalidades de K&C Trading Journal: seguimiento de operaciones, análisis avanzados, gestión de estrategias, estadísticas detalladas y mucho más.',
      keywords: 'funcionalidades, features, seguimiento operaciones, análisis trading, estadísticas trading, diario trading',
      name: 'Funcionalidades - K&C Trading Journal',
    },
    de: {
      title: 'Funktionen | K&C Trading Journal',
      description: 'Entdecken Sie alle Funktionen von K&C Trading Journal: Trade-Verfolgung, erweiterte Analysen, Strategieverwaltung, detaillierte Statistiken und vieles mehr.',
      keywords: 'Funktionen, Features, Trade-Verfolgung, Trading-Analyse, Trading-Statistiken, Trading-Journal',
      name: 'Funktionen - K&C Trading Journal',
    },
  };

  const currentSeo = seoData[finalLang] || seoData.fr;

  const features = [
    {
      key: 'tradeTracking',
      icon: '📊',
      color: 'from-blue-500 to-blue-600',
    },
    {
      key: 'advancedAnalysis',
      icon: '📈',
      color: 'from-green-500 to-green-600',
    },
    {
      key: 'strategies',
      icon: '⚡',
      color: 'from-purple-500 to-purple-600',
    },
    {
      key: 'statistics',
      icon: '📊',
      color: 'from-orange-500 to-orange-600',
    },
    {
      key: 'emotions',
      icon: '❤️',
      color: 'from-pink-500 to-pink-600',
    },
    {
      key: 'calendar',
      icon: '📅',
      color: 'from-indigo-500 to-indigo-600',
    },
    {
      key: 'multiAccount',
      icon: '👥',
      color: 'from-teal-500 to-teal-600',
    },
    {
      key: 'insights',
      icon: '💡',
      color: 'from-yellow-500 to-yellow-600',
    },
  ];

  return (
    <>
      <SEOHead
        title={currentSeo.title}
        description={currentSeo.description}
        keywords={currentSeo.keywords}
        url={currentUrl}
        type="website"
      />

      <SchemaMarkup
        type="WebPage"
        data={{
          name: currentSeo.name,
          url: currentUrl,
          description: currentSeo.description,
        }}
      />

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              {t('features:title', { defaultValue: 'Fonctionnalités' })}
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {t('features:subtitle', {
                defaultValue: 'Toutes les fonctionnalités dont vous avez besoin pour suivre et améliorer vos performances de trading.',
              })}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {features.map((feature) => (
              <div
                key={feature.key}
                className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100"
              >
                <div className={`w-14 h-14 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center mb-4 shadow-md text-2xl`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {t(`home:features.${feature.key}.title`)}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {t(`home:features.${feature.key}.description`)}
                </p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">
              {t('features:additional.title', { defaultValue: 'Fonctionnalités Additionnelles' })}
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {t('features:additional.import.title', { defaultValue: 'Import CSV' })}
                </h3>
                <p className="text-gray-600">
                  {t('features:additional.import.content', {
                    defaultValue: 'Importez facilement vos trades depuis un fichier CSV. Compatible avec la plupart des plateformes de trading.',
                  })}
                </p>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {t('features:additional.export.title', { defaultValue: 'Export CSV' })}
                </h3>
                <p className="text-gray-600">
                  {t('features:additional.export.content', {
                    defaultValue: 'Exportez vos données filtrées pour une analyse externe ou une sauvegarde.',
                  })}
                </p>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {t('features:additional.filters.title', { defaultValue: 'Filtres Avancés' })}
                </h3>
                <p className="text-gray-600">
                  {t('features:additional.filters.content', {
                    defaultValue: 'Filtrez vos trades par compte, date, instrument, stratégie et bien plus encore.',
                  })}
                </p>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {t('features:additional.customization.title', { defaultValue: 'Personnalisation' })}
                </h3>
                <p className="text-gray-600">
                  {t('features:additional.customization.content', {
                    defaultValue: 'Personnalisez votre interface : format de date, format de nombre, langue, fuseau horaire, thème et taille de police.',
                  })}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12 text-center">
            <a
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              {t('common:backToHome', { defaultValue: 'Retour à l\'accueil' })}
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default FeaturesPage;
