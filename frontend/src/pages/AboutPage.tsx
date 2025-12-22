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
  
  console.log('📄 AboutPage - Langue détectée depuis URL/localStorage:', savedLang);
  console.log('📄 AboutPage - URL actuelle:', window.location.pathname);
  
  // Utiliser useTranslation
  const { t, i18n: i18nHook } = useTranslation();
  
  // Appliquer la langue immédiatement au montage et écouter les changements
  useEffect(() => {
    console.log('📄 AboutPage - useEffect - Langue i18n actuelle:', i18n.language);
    console.log('📄 AboutPage - useEffect - Langue cible:', savedLang);
    
    const applyLang = async () => {
      const currentI18nLang = i18n.language?.split('-')[0] || 'fr';
      if (currentI18nLang !== savedLang) {
        console.log('📄 AboutPage - Changement de langue:', currentI18nLang, '→', savedLang);
        // changeLanguage() sauvegarde automatiquement dans localStorage via LanguageDetector
        await changeLanguage(savedLang);
      } else {
        console.log('📄 AboutPage - Langue déjà correcte:', savedLang);
      }
      setIsLangApplied(true);
    };
    
    // Écouter les changements de langue pour forcer un re-rendu
    const handleLanguageChanged = (lng: string) => {
      console.log('📄 AboutPage - Événement languageChanged:', lng);
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

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-8 text-center">
              {t('about:title', { defaultValue: 'À Propos' })}
            </h1>

            <div className="space-y-6 text-lg text-gray-700 leading-relaxed">
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  {t('about:story.title', { defaultValue: 'Notre Histoire' })}
                </h2>
                <p className="mb-4">
                  {t('about:story.content1', {
                    defaultValue: 'K&C Trading Journal est né d\'une passion pour l\'informatique et les marchés financiers. En tant que trader, j\'ai rapidement réalisé l\'importance de suivre et d\'analyser ses performances pour progresser.',
                  })}
                </p>
                <p>
                  {t('about:story.content2', {
                    defaultValue: 'Cependant, la plupart des solutions disponibles étaient soit trop chères, soit limitées dans leurs fonctionnalités. J\'ai donc décidé de créer une plateforme complète, professionnelle et surtout 100% gratuite.',
                  })}
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  {t('about:mission.title', { defaultValue: 'Notre Mission' })}
                </h2>
                <p className="mb-4">
                  {t('about:mission.content1', {
                    defaultValue: 'Notre mission est simple : fournir à tous les traders, qu\'ils soient débutants ou expérimentés, un outil professionnel pour suivre, analyser et optimiser leurs performances de trading.',
                  })}
                </p>
                <p className="mb-4">
                  {t('about:mission.content2', {
                    defaultValue: 'Nous croyons fermement que suivre ses progrès ne devrait pas être un luxe payant, surtout quand on apprend encore et qu\'on ne gagne pas encore d\'argent du trading.',
                  })}
                </p>
                <p>
                  {t('about:mission.content3', {
                    defaultValue: 'C\'est pourquoi K&C Trading Journal est et restera 100% gratuit, sans frais cachés, sans limitations.',
                  })}
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  {t('about:values.title', { defaultValue: 'Nos Valeurs' })}
                </h2>
                <ul className="space-y-3 list-disc list-inside">
                  <li>
                    <strong>{t('about:values.free.title', { defaultValue: 'Gratuité' })}</strong> :{' '}
                    {t('about:values.free.content', {
                      defaultValue: 'Un outil professionnel accessible à tous, sans frais.',
                    })}
                  </li>
                  <li>
                    <strong>{t('about:values.transparency.title', { defaultValue: 'Transparence' })}</strong> :{' '}
                    {t('about:values.transparency.content', {
                      defaultValue: 'Aucun frais caché, aucune limitation surprise.',
                    })}
                  </li>
                  <li>
                    <strong>{t('about:values.quality.title', { defaultValue: 'Qualité' })}</strong> :{' '}
                    {t('about:values.quality.content', {
                      defaultValue: 'Des fonctionnalités professionnelles et une interface moderne.',
                    })}
                  </li>
                  <li>
                    <strong>{t('about:values.privacy.title', { defaultValue: 'Confidentialité' })}</strong> :{' '}
                    {t('about:values.privacy.content', {
                      defaultValue: 'Vos données sont sécurisées et vous appartiennent. Vous pouvez les supprimer à tout moment.',
                    })}
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  {t('about:future.title', { defaultValue: 'L\'Avenir' })}
                </h2>
                <p>
                  {t('about:future.content', {
                    defaultValue: 'Nous continuons d\'améliorer K&C Trading Journal en ajoutant de nouvelles fonctionnalités basées sur les retours de notre communauté. Notre objectif est de rester la meilleure solution gratuite de journal de trading disponible.',
                  })}
                </p>
              </section>
            </div>

            <div className="mt-12 text-center">
              <a
                href={`/?lang=${finalLang}`}
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
      </div>
    </>
  );
};

export default AboutPage;
