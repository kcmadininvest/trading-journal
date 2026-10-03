import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SEOHead, SchemaMarkup } from '../components/SEO';
import { changeLanguage } from '../i18n/config';
import i18n from '../i18n/config';
import FeatureShowcase from '../components/marketing/FeatureShowcase';
import {
  ADVANCED_MARKETING_FEATURES,
  CORE_MARKETING_FEATURES,
} from '../components/marketing/marketingFeatures';

const ADDITIONAL_KEYS = ['import', 'export', 'filters', 'customization'] as const;

const FeaturesPage: React.FC = () => {
  const baseUrl = import.meta.env.VITE_BASE_URL || window.location.origin;

  const urlMap: Record<string, string> = {
    fr: '/fonctionnalites',
    en: '/features',
    es: '/funcionalidades',
    de: '/funktionen',
  };

  const detectLanguageFromUrl = (): string | null => {
    const pathname = window.location.pathname;
    for (const [lang, url] of Object.entries(urlMap)) {
      if (pathname === url) {
        return lang;
      }
    }
    return null;
  };

  const getSavedLanguage = (): string => {
    const urlLang = detectLanguageFromUrl();
    if (urlLang) {
      return urlLang;
    }
    const savedLang = localStorage.getItem('i18nextLng');
    if (savedLang && ['fr', 'en', 'es', 'de'].includes(savedLang)) {
      return savedLang;
    }
    return 'fr';
  };

  const savedLang = getSavedLanguage();

  const [isLangApplied, setIsLangApplied] = useState(() => {
    return i18n.language?.split('-')[0] === savedLang;
  });

  const { t, i18n: i18nHook } = useTranslation();

  useEffect(() => {
    const applyLang = async () => {
      const currentI18nLang = i18n.language?.split('-')[0] || 'fr';
      if (currentI18nLang !== savedLang) {
        await changeLanguage(savedLang);
      }
      setIsLangApplied(true);
    };

    const handleLanguageChanged = () => {
      setIsLangApplied(true);
    };

    i18n.on('languageChanged', handleLanguageChanged);

    if (!isLangApplied) {
      applyLang();
    }

    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [savedLang, isLangApplied]);

  const currentLang = i18nHook.language?.split('-')[0] || savedLang;
  const finalLang = currentLang;

  const currentUrl = `${baseUrl}${urlMap[finalLang] || urlMap.fr}`;
  const homeUrl = '/';

  const currentI18nLang = i18nHook.language?.split('-')[0] || 'fr';

  if (!isLangApplied || currentI18nLang !== savedLang) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-200 to-indigo-300 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const seoData: Record<string, { title: string; description: string; keywords: string; name: string }> = {
    fr: {
      title: 'Fonctionnalités | K&C Trading Journal',
      description: 'Découvrez toutes les fonctionnalités de K&C Trading Journal : suivi de trades, analyses avancées, gestion de stratégies, statistiques, Market Replay, journal, objectifs, comportement et bien plus encore.',
      keywords: 'fonctionnalités, features, suivi trades, analyse trading, statistiques trading, journal trading, market replay, replay de session, journal de backtest, objectifs trading',
      name: 'Fonctionnalités - K&C Trading Journal',
    },
    en: {
      title: 'Trading Journal Features - Track, Analyze & Optimize | K&C Trading Journal',
      description: 'Discover all the features of K&C Trading Journal: trade tracking, advanced analytics, strategy management, detailed statistics, CSV import, multi-account support, Market Replay, journal, goals, behavior and much more. Free signup.',
      keywords: 'trading journal features, trade tracking software, trading analytics, performance tracking, trading statistics, strategy management, CSV import, multi-account trading, trading metrics, position tracking, trade analysis tools, market replay, session replay, backtest journal',
      name: 'Features - K&C Trading Journal',
    },
    es: {
      title: 'Funcionalidades | K&C Trading Journal',
      description: 'Descubre todas las funcionalidades de K&C Trading Journal: seguimiento de operaciones, análisis avanzados, gestión de estrategias, estadísticas, Market Replay, diario, objetivos, comportamiento y mucho más.',
      keywords: 'funcionalidades, features, seguimiento operaciones, análisis trading, estadísticas trading, diario trading, market replay, replay de sesión',
      name: 'Funcionalidades - K&C Trading Journal',
    },
    de: {
      title: 'Funktionen | K&C Trading Journal',
      description: 'Entdecken Sie alle Funktionen von K&C Trading Journal: Trade-Verfolgung, erweiterte Analysen, Strategieverwaltung, Statistiken, Market Replay, Tagebuch, Ziele, Verhalten und vieles mehr.',
      keywords: 'Funktionen, Features, Trade-Verfolgung, Trading-Analyse, Trading-Statistiken, Trading-Journal, Market Replay, Sitzungs-Replay',
      name: 'Funktionen - K&C Trading Journal',
    },
  };

  const currentSeo = seoData[finalLang] || seoData.fr;

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

      <div className="min-h-screen bg-gradient-to-br from-blue-200 to-indigo-300 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600 mb-3">
              K&C Trading Journal
            </p>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              {t('features:title')}
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {t('features:subtitle')}
            </p>
          </div>

          <FeatureShowcase
            title={t('features:coreTitle')}
            features={CORE_MARKETING_FEATURES}
            accent="core"
          />

          <FeatureShowcase
            title={t('features:advancedTitle')}
            features={ADVANCED_MARKETING_FEATURES}
            accent="advanced"
            autoPlayMs={6000}
          />

          <section className="bg-white rounded-2xl shadow-xl p-8 md:p-12 border border-gray-200">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
              {t('features:additional.title')}
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {ADDITIONAL_KEYS.map((key) => (
                <div
                  key={key}
                  className="rounded-xl border border-gray-200 bg-gradient-to-br from-slate-100 to-white p-6 hover:shadow-md transition-shadow duration-200"
                >
                  <h3 className="text-xl font-bold text-gray-900 mb-3">
                    {t(`features:additional.${key}.title`)}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {t(`features:additional.${key}.content`)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-12 text-center">
            <a
              href={homeUrl}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              {t('features:backHome')}
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default FeaturesPage;
