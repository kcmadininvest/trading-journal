import React, { useState, useEffect, useRef } from 'react';
// import { authService, User } from '../services/auth';
import AuthModal from '../components/auth';
import ContactModal from '../components/contact/ContactModal';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { changeLanguage } from '../i18n/config';
import { SEOHead, SchemaMarkup } from '../components/SEO';

const HomePage: React.FC = () => {
  const { t, i18n: i18nInstance } = useI18nTranslation();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [showLegalNotice, setShowLegalNotice] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const languageDropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  
  // URLs selon la langue pour les pages publiques
  const getFeaturesUrl = (lang: string): string => {
    const urlMap: Record<string, string> = {
      fr: '/fonctionnalites',
      en: '/features',
      es: '/funcionalidades',
      de: '/funktionen',
    };
    return urlMap[lang] || urlMap.fr;
  };
  
  const getAboutUrl = (lang: string): string => {
    const urlMap: Record<string, string> = {
      fr: '/a-propos',
      en: '/about',
      es: '/acerca-de',
      de: '/uber-uns',
    };
    return urlMap[lang] || urlMap.fr;
  };
  
  // Utiliser i18n.language comme source de vérité unique
  // i18next gère déjà localStorage automatiquement via LanguageDetector
  const [currentLanguage, setCurrentLanguage] = useState<string>(() => {
    return i18nInstance.language?.split('-')[0] || 'fr';
  });

  // Synchroniser currentLanguage avec i18n.language (source de vérité unique)
  // i18next gère déjà localStorage automatiquement via LanguageDetector
  useEffect(() => {
    // PRIORITÉ 1: Vérifier le paramètre URL ?lang= (passé depuis les autres pages)
    const urlParams = new URLSearchParams(window.location.search);
    const urlLang = urlParams.get('lang');
    
    const handleLanguageChanged = (lng: string) => {
      const langCode = lng.split('-')[0];
      if (['fr', 'en', 'es', 'de'].includes(langCode)) {
        setCurrentLanguage(langCode);
      }
    };
    
    // Écouter les changements de langue
    i18nInstance.on('languageChanged', handleLanguageChanged);
    
    let targetLang: string | null = null;
    
    // Si un paramètre lang est présent dans l'URL, l'utiliser en priorité
    if (urlLang && ['fr', 'en', 'es', 'de'].includes(urlLang)) {
      targetLang = urlLang;
      // Changer la langue et sauvegarder (changeLanguage sauvegarde automatiquement)
      changeLanguage(urlLang);
      // Nettoyer le paramètre URL pour une URL propre
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    } else {
      // Sinon, utiliser la langue actuelle de i18n (détectée automatiquement)
      // i18next a déjà fait la détection avec l'ordre: customNavigatorLanguages → localStorage → navigator
      // customNavigatorLanguages utilise navigator.languages en premier (comme YouTube)
      const currentLang = i18nInstance.language?.split('-')[0] || 'fr';
      targetLang = currentLang;
    }
    
    if (targetLang) {
      setCurrentLanguage(targetLang);
    }
    
    return () => {
      i18nInstance.off('languageChanged', handleLanguageChanged);
    };
  }, [i18nInstance]);

  const handleLanguageChange = (lang: string) => {
    // changeLanguage() sauvegarde automatiquement dans localStorage via LanguageDetector
    changeLanguage(lang);
    setCurrentLanguage(lang);
    setIsLanguageDropdownOpen(false);
  };

  // Fermer les dropdowns quand on clique en dehors ou appuie sur Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      
      // Fermer le dropdown de langue si on clique en dehors
      if (isLanguageDropdownOpen && languageDropdownRef.current && !languageDropdownRef.current.contains(target)) {
        setIsLanguageDropdownOpen(false);
      }
      
      // Fermer le menu mobile si on clique en dehors
      if (isMobileMenuOpen && mobileMenuRef.current && !mobileMenuRef.current.contains(target)) {
        setIsMobileMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isLanguageDropdownOpen) {
          setIsLanguageDropdownOpen(false);
        }
        if (isMobileMenuOpen) {
          setIsMobileMenuOpen(false);
        }
      }
    };

    if (isLanguageDropdownOpen || isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isLanguageDropdownOpen, isMobileMenuOpen]);

  const languageOptions = [
    { value: 'fr', label: 'Français', flag: '🇫🇷' },
    { value: 'en', label: 'English', flag: '🇬🇧' },
    { value: 'es', label: 'Español', flag: '🇪🇸' },
    { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
  ];

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    // L'utilisateur sera redirigé automatiquement vers l'application
    window.location.reload();
  };

  const baseUrl = process.env.REACT_APP_BASE_URL || window.location.origin;
  const currentUrl = `${baseUrl}${window.location.pathname}`;
  
  // Données SEO selon la langue
  const seoData = {
    fr: {
      title: 'Journal de Trading Gratuit | K&C Trading Journal',
      description: 'Journal de trading professionnel gratuit - Suivez, analysez et optimisez vos performances de trading avec des outils avancés. Import CSV, multi-comptes, statistiques détaillées. 100% gratuit, sans frais cachés.',
      keywords: 'journal de trading, trading journal, suivi de trades, analyse trading, performance trading, logiciel trading, application trading',
    },
    en: {
      title: 'Free Trading Journal | K&C Trading Journal',
      description: 'Free professional trading journal - Track, analyze and optimize your trading performance with advanced tools. CSV import, multi-account, detailed statistics. 100% free, no hidden fees.',
      keywords: 'trading journal, journal de trading, trade tracking, trading analysis, trading performance, trading software, trading application',
    },
    es: {
      title: 'Diario de Trading Gratuito | K&C Trading Journal',
      description: 'Diario de trading profesional gratuito - Rastrea, analiza y optimiza tu rendimiento de trading con herramientas avanzadas. Importación CSV, multi-cuenta, estadísticas detalladas. 100% gratuito, sin costos ocultos.',
      keywords: 'diario de trading, trading journal, seguimiento de trades, análisis de trading, rendimiento de trading, software de trading',
    },
    de: {
      title: 'Kostenloses Trading-Journal | K&C Trading Journal',
      description: 'Kostenloses professionelles Trading-Journal - Verfolgen, analysieren und optimieren Sie Ihre Trading-Leistung mit erweiterten Tools. CSV-Import, Multi-Konto, detaillierte Statistiken. 100% kostenlos, keine versteckten Gebühren.',
      keywords: 'Trading-Journal, Journal de trading, Trade-Tracking, Trading-Analyse, Trading-Leistung, Trading-Software',
    },
  };

  // Synchroniser currentLanguage avec i18n à chaque fois que i18n change
  useEffect(() => {
    const i18nLang = i18nInstance.language?.split('-')[0] || 'fr';
    if (i18nLang !== currentLanguage && ['fr', 'en', 'es', 'de'].includes(i18nLang)) {
      setCurrentLanguage(i18nLang);
    }
  }, [i18nInstance.language, currentLanguage]);
  
  const currentSeo = seoData[currentLanguage as keyof typeof seoData] || seoData.fr;

  return (
    <>
      {/* SEO Components */}
      <SEOHead
        title={currentSeo.title}
        description={currentSeo.description}
        keywords={currentSeo.keywords}
        url={currentUrl}
        type="website"
      />
      
      {/* Schema.org Markup - Traduit selon la langue */}
      {(() => {
        const schemaData = {
          fr: {
            organization: {
              name: 'K&C Trading Journal',
              description: 'Application de journal de trading professionnel',
              featureList: [
                'Suivi de trades',
                'Analyse de performance',
                'Import CSV',
                'Multi-comptes',
                'Statistiques détaillées',
                'Visualisations avancées',
              ],
            },
          },
          en: {
              organization: {
                name: 'K&C Trading Journal',
                description: 'Professional trading journal application',
                featureList: [
                  'Trade tracking',
                  'Performance analysis',
                  'CSV import',
                  'Multi-account',
                  'Detailed statistics',
                  'Advanced visualizations',
                ],
              },
            },
            es: {
              organization: {
                name: 'K&C Trading Journal',
                description: 'Aplicación de diario de trading profesional',
                featureList: [
                  'Seguimiento de trades',
                  'Análisis de rendimiento',
                  'Importación CSV',
                  'Multi-cuenta',
                  'Estadísticas detalladas',
                  'Visualizaciones avanzadas',
                ],
              },
            },
            de: {
              organization: {
                name: 'K&C Trading Journal',
                description: 'Professionelle Trading-Journal-Anwendung',
                featureList: [
                  'Trade-Tracking',
                  'Leistungsanalyse',
                  'CSV-Import',
                  'Multi-Konto',
                  'Detaillierte Statistiken',
                  'Erweiterte Visualisierungen',
                ],
              },
            },
          };
        
        const currentSchema = schemaData[currentLanguage as keyof typeof schemaData] || schemaData.fr;
        
        return (
          <>
            <SchemaMarkup
              type="Organization"
              data={{
                name: currentSchema.organization.name,
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
                description: currentSchema.organization.description,
                sameAs: [
                  // Ajouter les liens réseaux sociaux quand disponibles
                ],
              }}
            />
            
            <SchemaMarkup
              type="SoftwareApplication"
              data={{
                name: currentSchema.organization.name,
                applicationCategory: 'FinanceApplication',
                operatingSystem: 'Web',
                image: {
                  '@type': 'ImageObject',
                  url: `${baseUrl}/android-chrome-512x512.png`,
                  width: 512,
                  height: 512,
                },
                offers: {
                  '@type': 'Offer',
                  price: '0',
                  priceCurrency: 'EUR',
                },
                featureList: currentSchema.organization.featureList,
              }}
            />
            
            <SchemaMarkup
              type="WebSite"
              data={{
                name: currentSchema.organization.name,
                url: baseUrl,
                potentialAction: {
                  '@type': 'SearchAction',
                  target: {
                    '@type': 'EntryPoint',
                    urlTemplate: `${baseUrl}/search?q={search_term_string}`,
                  },
                  'query-input': 'required name=search_term_string',
                },
              }}
            />
          </>
        );
      })()}
      
      {/* Styles pour la scrollbar personnalisée */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 #f1f5f9;
        }
      `}</style>
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      {/* Header avec boutons et sélecteur de langue */}
      <div className="fixed top-4 right-4 z-50">
        {/* Menu desktop - visible sur écrans moyens et plus grands */}
        <div className="hidden md:flex items-center gap-3">
          {/* Boutons Login et Register */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setAuthMode('login');
                setShowAuthModal(true);
              }}
              className="px-5 py-2.5 bg-white text-gray-700 font-semibold rounded-xl border-2 border-gray-200 hover:border-blue-500 hover:text-blue-600 transition-all duration-200 shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {t('auth:login')}
            </button>
            <button
              onClick={() => {
                setAuthMode('register');
                setShowAuthModal(true);
              }}
              className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {t('auth:register')}
            </button>
          </div>
          
          {/* Sélecteur de langue */}
          <div ref={languageDropdownRef}>
            <div className="relative">
              <button
                onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
                className="inline-flex items-center justify-center w-10 h-10 bg-white rounded-xl shadow-lg border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 hover:shadow-xl"
                aria-label={t('settings:language', { defaultValue: 'Language' })}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
              </button>
              
              {isLanguageDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  {languageOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleLanguageChange(option.value)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-blue-50 transition-colors duration-150 ${
                        currentLanguage === option.value ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                      }`}
                    >
                      <span className="text-xl">{option.flag}</span>
                      <span className={`font-medium ${currentLanguage === option.value ? 'text-blue-600' : 'text-gray-700'}`}>
                        {option.label}
                      </span>
                      {currentLanguage === option.value && (
                        <svg className="ml-auto w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Menu mobile - bouton hamburger */}
        <div className="md:hidden" ref={mobileMenuRef}>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2.5 bg-white rounded-xl shadow-lg border border-gray-200 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
            aria-label="Menu"
          >
            <svg 
              className={`w-6 h-6 transition-transform duration-200 ${isMobileMenuOpen ? 'rotate-90' : ''}`}
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          {/* Menu mobile déroulant */}
          {isMobileMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Boutons d'authentification */}
              <div className="p-2 space-y-2 border-b border-gray-200">
                <button
                  onClick={() => {
                    setAuthMode('login');
                    setShowAuthModal(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full px-4 py-3 text-left bg-white text-gray-700 font-semibold rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200"
                >
                  {t('auth:login')}
                </button>
                <button
                  onClick={() => {
                    setAuthMode('register');
                    setShowAuthModal(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full px-4 py-3 text-left bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-all duration-200"
                >
                  {t('auth:register')}
                </button>
              </div>

              {/* Sélecteur de langue */}
              <div className="p-2">
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t('settings:language', { defaultValue: 'Language' })}
                </div>
                {languageOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      handleLanguageChange(option.value);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg hover:bg-blue-50 transition-colors duration-150 ${
                      currentLanguage === option.value ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                    }`}
                  >
                    <span className="text-xl">{option.flag}</span>
                    <span className={`font-medium ${currentLanguage === option.value ? 'text-blue-600' : 'text-gray-700'}`}>
                      {option.label}
                    </span>
                    {currentLanguage === option.value && (
                      <svg className="ml-auto w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl w-full">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-6xl md:text-7xl font-bold mb-8 pb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent leading-tight" style={{ lineHeight: '1.1' }}>
            {t('home:title')}
          </h1>
          <p className="text-2xl text-gray-700 max-w-3xl mx-auto mb-4 font-medium">
            {t('home:subtitle')}
          </p>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-6">
            {t('home:hero.tagline')}
          </p>
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full shadow-lg mb-4">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-white font-semibold text-lg">{t('home:hero.freeBadge')}</span>
          </div>
        </div>

        {/* Main Features Grid */}
        <div className="mb-8 text-center">
          <a
            href={getFeaturesUrl(currentLanguage)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl mb-8"
          >
            {t('home:features.viewAll', { defaultValue: 'Voir toutes les fonctionnalités' })}
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4 shadow-md">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">{t('home:features.tradeTracking.title')}</h3>
            <p className="text-gray-600 leading-relaxed">
              {t('home:features.tradeTracking.description')}
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100">
            <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-4 shadow-md">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">{t('home:features.advancedAnalysis.title')}</h3>
            <p className="text-gray-600 leading-relaxed">
              {t('home:features.advancedAnalysis.description')}
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 shadow-md">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">{t('home:features.strategies.title')}</h3>
            <p className="text-gray-600 leading-relaxed">
              {t('home:features.strategies.description')}
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100">
            <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mb-4 shadow-md">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">{t('home:features.statistics.title')}</h3>
            <p className="text-gray-600 leading-relaxed">
              {t('home:features.statistics.description')}
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100">
            <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center mb-4 shadow-md">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">{t('home:features.emotions.title')}</h3>
            <p className="text-gray-600 leading-relaxed">
              {t('home:features.emotions.description')}
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center mb-4 shadow-md">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">{t('home:features.calendar.title')}</h3>
            <p className="text-gray-600 leading-relaxed">
              {t('home:features.calendar.description')}
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100">
            <div className="w-14 h-14 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center mb-4 shadow-md">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">{t('home:features.multiAccount.title')}</h3>
            <p className="text-gray-600 leading-relaxed">
              {t('home:features.multiAccount.description')}
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100">
            <div className="w-14 h-14 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center mb-4 shadow-md">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">{t('home:features.insights.title')}</h3>
            <p className="text-gray-600 leading-relaxed">
              {t('home:features.insights.description')}
            </p>
          </div>
        </div>

        {/* Benefits Section */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 md:p-12 mb-16 border border-blue-100">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-12">
            {t('home:benefits.title')}
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl p-6 shadow-md">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{t('home:benefits.items.data.title')}</h3>
                  <p className="text-gray-600">{t('home:benefits.items.data.description')}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-md">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{t('home:benefits.items.visualization.title')}</h3>
                  <p className="text-gray-600">{t('home:benefits.items.visualization.description')}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-md">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{t('home:benefits.items.improvement.title')}</h3>
                  <p className="text-gray-600">{t('home:benefits.items.improvement.description')}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-md">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{t('home:benefits.items.discipline.title')}</h3>
                  <p className="text-gray-600">{t('home:benefits.items.discipline.description')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-10 md:p-12 shadow-2xl text-center text-white mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            {t('home:cta.title')}
          </h2>
          <p className="text-xl mb-2 text-blue-100 max-w-2xl mx-auto">
            {t('home:cta.description')}
          </p>
          <p className="text-lg mb-8 text-blue-200">
            {t('home:cta.subtitle')}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => {
                setAuthMode('register');
                setShowAuthModal(true);
              }}
              className="px-10 py-4 bg-white text-blue-600 font-bold text-lg rounded-xl hover:bg-blue-50 transition-all duration-300 shadow-xl transform hover:scale-105"
            >
              {t('home:cta.registerButton')}
            </button>
            <button
              onClick={() => {
                setAuthMode('login');
                setShowAuthModal(true);
              }}
              className="px-10 py-4 bg-transparent text-white font-semibold text-lg rounded-xl border-2 border-white hover:bg-white hover:text-blue-600 transition-all duration-300"
            >
              {t('auth:login')}
            </button>
          </div>
        </div>

        {/* About Section - Résumé */}
        <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl p-10 md:p-12 shadow-xl mb-12 border border-gray-200">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-6 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              {t('home:about.title')}
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed max-w-3xl mx-auto mb-6">
              {t('home:about.summary', {
                defaultValue: 'K&C Trading Journal est une plateforme 100% gratuite créée pour aider tous les traders à suivre et améliorer leurs performances. Un outil professionnel accessible à tous, sans frais cachés.',
              })}
            </p>
            <div className="mt-8">
              <a
                href={getAboutUrl(currentLanguage)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                {t('home:about.learnMore', { defaultValue: 'En savoir plus' })}
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-white rounded-2xl p-8 md:p-12 shadow-xl mb-12 border border-gray-200">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {t('home:faq.title')}
            </h2>
            <p className="text-lg text-gray-600">
              {t('home:faq.subtitle')}
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto space-y-4">
            {(() => {
              const faqItems = t('home:faq.items', { returnObjects: true });
              const itemsArray = Array.isArray(faqItems) ? faqItems : [];
              return itemsArray.map((item: any, index: number) => (
                <details
                  key={index}
                  className="group bg-gray-50 rounded-xl p-6 hover:bg-gray-100 transition-colors duration-200 border border-gray-200"
                >
                  <summary className="flex items-center justify-between cursor-pointer list-none">
                    <h3 className="text-lg font-semibold text-gray-900 pr-4">
                      {item.question}
                    </h3>
                    <svg
                      className="w-5 h-5 text-gray-500 group-open:rotate-180 transition-transform duration-200 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <p className="mt-4 text-gray-700 leading-relaxed pl-0">
                    {item.answer}
                  </p>
                </details>
              ));
            })()}
          </div>
        </div>

        {/* FAQ Schema.org */}
        {(() => {
          const faqItems = t('home:faq.items', { returnObjects: true });
          const itemsArray = Array.isArray(faqItems) ? faqItems : [];
          return (
            <SchemaMarkup
              type="FAQPage"
              data={{
                mainEntity: itemsArray.map((item: any) => ({
                  '@type': 'Question',
                  name: item.question,
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: item.answer,
                  },
                })),
              }}
            />
          );
        })()}

        {/* Contact Section */}
        <div className="text-center mb-12">
          <button
            onClick={() => setShowContactModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {t('home:contact.button')}
          </button>
        </div>

        {/* Footer */}
        <div className="relative flex justify-center items-center mt-12 text-gray-500 px-4">
          <p className="text-sm text-center">{t('home:footer.copyright')}</p>
          <button
            onClick={() => setShowLegalNotice(true)}
            className="absolute right-4 text-sm text-gray-500 hover:text-blue-600 underline transition-colors duration-200"
          >
            {t('legal:link')}
          </button>
        </div>
      </div>

      {/* Modal d'authentification */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
        initialMode={authMode}
      />

      {/* Modal de contact */}
      <ContactModal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
      />

      {/* Modal Mentions légales */}
      {showLegalNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm" onClick={() => setShowLegalNotice(false)}>
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-2xl flex justify-between items-center">
              <h2 className="text-2xl font-bold">{t('home:legalNotice.title')}</h2>
              <button
                onClick={() => setShowLegalNotice(false)}
                className="text-white hover:text-gray-200 transition-colors p-2 hover:bg-white hover:bg-opacity-20 rounded-lg"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-8 space-y-6 text-gray-700 overflow-y-auto max-h-[calc(90vh-200px)] custom-scrollbar">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{t('home:legalNotice.ownership.title')}</h3>
                <p className="leading-relaxed">{t('home:legalNotice.ownership.content')}</p>
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{t('home:legalNotice.liability.title')}</h3>
                <p className="leading-relaxed mb-3">{t('home:legalNotice.liability.content1')}</p>
                <p className="leading-relaxed">{t('home:legalNotice.liability.content2')}</p>
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{t('home:legalNotice.dataProtection.title')}</h3>
                <p className="leading-relaxed">{t('home:legalNotice.dataProtection.content')}</p>
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{t('home:legalNotice.cookies.title')}</h3>
                <p className="leading-relaxed mb-3">{t('home:legalNotice.cookies.intro')}</p>
                <ul className="list-disc list-inside space-y-2 ml-4 mb-3">
                  <li>{t('home:legalNotice.cookies.session')}</li>
                  <li>{t('home:legalNotice.cookies.csrf')}</li>
                  <li>{t('home:legalNotice.cookies.storage')}</li>
                </ul>
                <p className="leading-relaxed">{t('home:legalNotice.cookies.conclusion')}</p>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-50 p-6 rounded-b-2xl flex justify-end">
              <button
                onClick={() => setShowLegalNotice(false)}
                className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                {t('home:legalNotice.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default HomePage;