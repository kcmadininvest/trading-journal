import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SEOHead, SchemaMarkup } from '../components/SEO';
import { changeLanguage } from '../i18n/config';
import i18n from '../i18n/config';

const AboutPage: React.FC = () => {
  const baseUrl = process.env.REACT_APP_BASE_URL || window.location.origin;
  
  // URLs selon la langue
  const urlMap: Record<string, string> = {
    fr: '/a-propos',
    en: '/about',
    es: '/acerca-de',
    de: '/uber-uns',
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
  const [isLangApplied, setIsLangApplied] = useState(false);
  
  
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
    applyLang();
    
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [savedLang]);
  
  // Utiliser la langue actuelle de i18n ou la langue sauvegardée
  const currentLang = i18nHook.language?.split('-')[0] || savedLang;
  const finalLang = isLangApplied ? currentLang : savedLang;
  
  const currentUrl = `${baseUrl}${urlMap[finalLang] || urlMap.fr}`;

  // Traductions SEO selon la langue
  const seoData: Record<string, { title: string; description: string; keywords: string; name: string }> = {
    fr: {
      title: 'À Propos | K&C Trading Journal',
      description: 'Découvrez l\'histoire et la mission de K&C Trading Journal. Une plateforme gratuite créée par passion pour aider les traders à suivre et améliorer leurs performances.',
      keywords: 'à propos, trading journal, histoire, mission, équipe',
      name: 'À Propos - K&C Trading Journal',
    },
    en: {
      title: 'About | K&C Trading Journal',
      description: 'Discover the story and mission of K&C Trading Journal. A free platform created with passion to help traders track and improve their performance.',
      keywords: 'about, trading journal, story, mission, team',
      name: 'About - K&C Trading Journal',
    },
    es: {
      title: 'Acerca de | K&C Trading Journal',
      description: 'Descubre la historia y la misión de K&C Trading Journal. Una plataforma gratuita creada con pasión para ayudar a los traders a seguir y mejorar su rendimiento.',
      keywords: 'acerca de, diario de trading, historia, misión, equipo',
      name: 'Acerca de - K&C Trading Journal',
    },
    de: {
      title: 'Über uns | K&C Trading Journal',
      description: 'Entdecken Sie die Geschichte und Mission von K&C Trading Journal. Eine kostenlose Plattform, die mit Leidenschaft geschaffen wurde, um Tradern zu helfen, ihre Leistung zu verfolgen und zu verbessern.',
      keywords: 'über uns, Trading-Journal, Geschichte, Mission, Team',
      name: 'Über uns - K&C Trading Journal',
    },
  };

  const currentSeo = seoData[finalLang] || seoData.fr;

  // Attendre que la langue soit appliquée et que i18n soit synchronisé
  const currentI18nLang = i18nHook.language?.split('-')[0] || 'fr';
  const langMatches = currentI18nLang === savedLang || isLangApplied;
  
  if (!langMatches || !isLangApplied) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

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

      <SchemaMarkup
        type="Organization"
        data={{
          name: 'K&C Trading Journal',
          url: baseUrl,
          logo: {
            '@type': 'ImageObject',
            url: `${baseUrl}/android-chrome-512x512.png`,
            width: 512,
            height: 512,
          },
          image: {
            '@type': 'ImageObject',
            url: `${baseUrl}/android-chrome-512x512.png`,
            width: 512,
            height: 512,
          },
          description: currentSeo.description,
        }}
      />

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Back Button */}
          <div className="mb-8">
            <a
              href={`/?lang=${finalLang}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-lg hover:shadow-xl border border-gray-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              {t('common:backToHome', { defaultValue: 'Retour à l\'accueil' })}
            </a>
          </div>

          {/* Hero Section */}
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 pb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent leading-tight">
              {t('about:title', { defaultValue: 'À Propos' })}
            </h1>
            <p className="text-xl text-gray-700 max-w-3xl mx-auto font-medium">
              {t('about:hero.subtitle')}
            </p>
          </div>

          {/* Story Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 mb-8">
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  {t('about:story.title', { defaultValue: 'Notre Histoire' })}
                </h2>
                <div className="space-y-4 text-lg text-gray-700 leading-relaxed">
                  <p>
                    {t('about:story.content1', {
                      defaultValue: 'K&C Trading Journal est né d\'une passion pour l\'informatique et les marchés financiers. En tant que trader, j\'ai rapidement réalisé l\'importance de suivre et d\'analyser ses performances pour progresser.',
                    })}
                  </p>
                  <p>
                    {t('about:story.content2', {
                      defaultValue: 'Cependant, la plupart des solutions disponibles étaient soit trop chères, soit limitées dans leurs fonctionnalités. J\'ai donc décidé de créer une plateforme complète, professionnelle et surtout 100% gratuite.',
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Mission Section */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 md:p-12 mb-8 border border-blue-100">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-lg mb-6">
                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                {t('about:mission.title', { defaultValue: 'Notre Mission' })}
              </h2>
            </div>
            <div className="max-w-4xl mx-auto space-y-4 text-lg text-gray-700 leading-relaxed text-center">
              <p>
                {t('about:mission.content1', {
                  defaultValue: 'Notre mission est simple : fournir à tous les traders, qu\'ils soient débutants ou expérimentés, un outil professionnel pour suivre, analyser et optimiser leurs performances de trading.',
                })}
              </p>
              <p>
                {t('about:mission.content2', {
                  defaultValue: 'Nous croyons fermement que suivre ses progrès ne devrait pas être un luxe payant, surtout quand on apprend encore et qu\'on ne gagne pas encore d\'argent du trading.',
                })}
              </p>
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full shadow-lg mt-6">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-white font-semibold text-lg">
                  {t('about:mission.content3', {
                    defaultValue: '100% Gratuit, pour toujours',
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Values Section */}
          <div className="mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-12">
              {t('about:values.title', { defaultValue: 'Nos Valeurs' })}
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Value 1: Gratuité */}
              <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100">
                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-4 shadow-md">
                  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {t('about:values.free.title', { defaultValue: 'Gratuité' })}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {t('about:values.free.content', {
                    defaultValue: 'Un outil professionnel accessible à tous, sans frais.',
                  })}
                </p>
              </div>

              {/* Value 2: Transparence */}
              <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4 shadow-md">
                  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {t('about:values.transparency.title', { defaultValue: 'Transparence' })}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {t('about:values.transparency.content', {
                    defaultValue: 'Aucun frais caché, aucune limitation surprise.',
                  })}
                </p>
              </div>

              {/* Value 3: Qualité */}
              <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 shadow-md">
                  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {t('about:values.quality.title', { defaultValue: 'Qualité' })}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {t('about:values.quality.content', {
                    defaultValue: 'Des fonctionnalités professionnelles et une interface moderne.',
                  })}
                </p>
              </div>

              {/* Value 4: Confidentialité */}
              <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100">
                <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center mb-4 shadow-md">
                  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {t('about:values.privacy.title', { defaultValue: 'Confidentialité' })}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {t('about:values.privacy.content', {
                    defaultValue: 'Vos données sont sécurisées et vous appartiennent. Vous pouvez les supprimer à tout moment.',
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Future Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 mb-8">
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-md">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  {t('about:future.title', { defaultValue: 'L\'Avenir' })}
                </h2>
                <p className="text-lg text-gray-700 leading-relaxed">
                  {t('about:future.content', {
                    defaultValue: 'Nous continuons d\'améliorer K&C Trading Journal en ajoutant de nouvelles fonctionnalités basées sur les retours de notre communauté. Notre objectif est de rester la meilleure solution gratuite de journal de trading disponible.',
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center">
            <a
              href={`/?lang=${finalLang}`}
              className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl text-lg"
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

export default AboutPage;
