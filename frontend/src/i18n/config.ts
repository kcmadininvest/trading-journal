import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import des traductions
import frCommon from './locales/fr/common.json';
import enCommon from './locales/en/common.json';
import esCommon from './locales/es/common.json';
import deCommon from './locales/de/common.json';
import itCommon from './locales/it/common.json';
import ptCommon from './locales/pt/common.json';
import jaCommon from './locales/ja/common.json';
import koCommon from './locales/ko/common.json';
import zhCommon from './locales/zh/common.json';

import frTrades from './locales/fr/trades.json';
import enTrades from './locales/en/trades.json';
import esTrades from './locales/es/trades.json';
import deTrades from './locales/de/trades.json';
import itTrades from './locales/it/trades.json';
import ptTrades from './locales/pt/trades.json';
import jaTrades from './locales/ja/trades.json';
import koTrades from './locales/ko/trades.json';
import zhTrades from './locales/zh/trades.json';

import frSettings from './locales/fr/settings.json';
import enSettings from './locales/en/settings.json';
import esSettings from './locales/es/settings.json';
import deSettings from './locales/de/settings.json';
import itSettings from './locales/it/settings.json';
import ptSettings from './locales/pt/settings.json';
import jaSettings from './locales/ja/settings.json';
import koSettings from './locales/ko/settings.json';
import zhSettings from './locales/zh/settings.json';

import frNavigation from './locales/fr/navigation.json';
import enNavigation from './locales/en/navigation.json';
import esNavigation from './locales/es/navigation.json';
import deNavigation from './locales/de/navigation.json';
import itNavigation from './locales/it/navigation.json';
import ptNavigation from './locales/pt/navigation.json';
import jaNavigation from './locales/ja/navigation.json';
import koNavigation from './locales/ko/navigation.json';
import zhNavigation from './locales/zh/navigation.json';

import frDashboard from './locales/fr/dashboard.json';
import enDashboard from './locales/en/dashboard.json';
import esDashboard from './locales/es/dashboard.json';
import deDashboard from './locales/de/dashboard.json';
import itDashboard from './locales/it/dashboard.json';
import ptDashboard from './locales/pt/dashboard.json';
import jaDashboard from './locales/ja/dashboard.json';
import koDashboard from './locales/ko/dashboard.json';
import zhDashboard from './locales/zh/dashboard.json';

import frCalendar from './locales/fr/calendar.json';
import enCalendar from './locales/en/calendar.json';
import esCalendar from './locales/es/calendar.json';
import deCalendar from './locales/de/calendar.json';
import itCalendar from './locales/it/calendar.json';
import ptCalendar from './locales/pt/calendar.json';
import jaCalendar from './locales/ja/calendar.json';
import koCalendar from './locales/ko/calendar.json';
import zhCalendar from './locales/zh/calendar.json';

import frStrategies from './locales/fr/strategies.json';
import enStrategies from './locales/en/strategies.json';
import esStrategies from './locales/es/strategies.json';
import deStrategies from './locales/de/strategies.json';
import itStrategies from './locales/it/strategies.json';
import ptStrategies from './locales/pt/strategies.json';
import jaStrategies from './locales/ja/strategies.json';
import koStrategies from './locales/ko/strategies.json';
import zhStrategies from './locales/zh/strategies.json';

import frStatistics from './locales/fr/statistics.json';
import enStatistics from './locales/en/statistics.json';
import esStatistics from './locales/es/statistics.json';
import deStatistics from './locales/de/statistics.json';
import itStatistics from './locales/it/statistics.json';
import ptStatistics from './locales/pt/statistics.json';
import jaStatistics from './locales/ja/statistics.json';
import koStatistics from './locales/ko/statistics.json';
import zhStatistics from './locales/zh/statistics.json';

import frAnalytics from './locales/fr/analytics.json';
import enAnalytics from './locales/en/analytics.json';
import esAnalytics from './locales/es/analytics.json';
import deAnalytics from './locales/de/analytics.json';
import itAnalytics from './locales/it/analytics.json';
import ptAnalytics from './locales/pt/analytics.json';
import jaAnalytics from './locales/ja/analytics.json';
import koAnalytics from './locales/ko/analytics.json';
import zhAnalytics from './locales/zh/analytics.json';

import frUsers from './locales/fr/users.json';
import enUsers from './locales/en/users.json';
import esUsers from './locales/es/users.json';
import deUsers from './locales/de/users.json';
import itUsers from './locales/it/users.json';
import ptUsers from './locales/pt/users.json';
import jaUsers from './locales/ja/users.json';
import koUsers from './locales/ko/users.json';
import zhUsers from './locales/zh/users.json';

import frAccounts from './locales/fr/accounts.json';
import enAccounts from './locales/en/accounts.json';
import esAccounts from './locales/es/accounts.json';
import deAccounts from './locales/de/accounts.json';
import itAccounts from './locales/it/accounts.json';
import ptAccounts from './locales/pt/accounts.json';
import jaAccounts from './locales/ja/accounts.json';
import koAccounts from './locales/ko/accounts.json';
import zhAccounts from './locales/zh/accounts.json';

import frAuth from './locales/fr/auth.json';
import enAuth from './locales/en/auth.json';
import esAuth from './locales/es/auth.json';
import deAuth from './locales/de/auth.json';
import itAuth from './locales/it/auth.json';
import ptAuth from './locales/pt/auth.json';
import jaAuth from './locales/ja/auth.json';
import koAuth from './locales/ko/auth.json';
import zhAuth from './locales/zh/auth.json';

import frHome from './locales/fr/home.json';
import enHome from './locales/en/home.json';
import esHome from './locales/es/home.json';
import deHome from './locales/de/home.json';

import frStrategy from './locales/fr/strategy.json';
import enStrategy from './locales/en/strategy.json';
import esStrategy from './locales/es/strategy.json';
import deStrategy from './locales/de/strategy.json';

import frPositionStrategies from './locales/fr/positionStrategies.json';
import enPositionStrategies from './locales/en/positionStrategies.json';
import dePositionStrategies from './locales/de/positionStrategies.json';
import esPositionStrategies from './locales/es/positionStrategies.json';

const resources = {
  fr: {
    common: frCommon,
    trades: frTrades,
    settings: frSettings,
    navigation: frNavigation,
    dashboard: frDashboard,
    calendar: frCalendar,
    strategies: frStrategies,
    statistics: frStatistics,
    analytics: frAnalytics,
    users: frUsers,
    accounts: frAccounts,
    auth: frAuth,
    home: frHome,
    strategy: frStrategy,
    positionStrategies: frPositionStrategies,
  },
  en: {
    common: enCommon,
    trades: enTrades,
    settings: enSettings,
    navigation: enNavigation,
    dashboard: enDashboard,
    calendar: enCalendar,
    strategies: enStrategies,
    statistics: enStatistics,
    analytics: enAnalytics,
    users: enUsers,
    accounts: enAccounts,
    auth: enAuth,
    home: enHome,
    strategy: enStrategy,
    positionStrategies: enPositionStrategies,
  },
  es: {
    common: esCommon,
    trades: esTrades,
    settings: esSettings,
    navigation: esNavigation,
    dashboard: esDashboard,
    calendar: esCalendar,
    strategies: esStrategies,
    statistics: esStatistics,
    analytics: esAnalytics,
    users: esUsers,
    accounts: esAccounts,
    auth: esAuth,
    home: esHome,
    strategy: esStrategy,
    positionStrategies: esPositionStrategies,
  },
  de: {
    common: deCommon,
    trades: deTrades,
    settings: deSettings,
    navigation: deNavigation,
    dashboard: deDashboard,
    calendar: deCalendar,
    strategies: deStrategies,
    statistics: deStatistics,
    analytics: deAnalytics,
    users: deUsers,
    accounts: deAccounts,
    auth: deAuth,
    home: deHome,
    strategy: deStrategy,
    positionStrategies: dePositionStrategies,
  },
  it: {
    common: itCommon,
    trades: itTrades,
    settings: itSettings,
    navigation: itNavigation,
    dashboard: itDashboard,
    calendar: itCalendar,
    strategies: itStrategies,
    statistics: itStatistics,
    analytics: itAnalytics,
    users: itUsers,
    accounts: itAccounts,
    auth: itAuth,
  },
  pt: {
    common: ptCommon,
    trades: ptTrades,
    settings: ptSettings,
    navigation: ptNavigation,
    dashboard: ptDashboard,
    calendar: ptCalendar,
    strategies: ptStrategies,
    statistics: ptStatistics,
    analytics: ptAnalytics,
    users: ptUsers,
    accounts: ptAccounts,
    auth: ptAuth,
  },
  ja: {
    common: jaCommon,
    trades: jaTrades,
    settings: jaSettings,
    navigation: jaNavigation,
    dashboard: jaDashboard,
    calendar: jaCalendar,
    strategies: jaStrategies,
    statistics: jaStatistics,
    analytics: jaAnalytics,
    users: jaUsers,
    accounts: jaAccounts,
    auth: jaAuth,
  },
  ko: {
    common: koCommon,
    trades: koTrades,
    settings: koSettings,
    navigation: koNavigation,
    dashboard: koDashboard,
    calendar: koCalendar,
    strategies: koStrategies,
    statistics: koStatistics,
    analytics: koAnalytics,
    users: koUsers,
    accounts: koAccounts,
    auth: koAuth,
  },
  zh: {
    common: zhCommon,
    trades: zhTrades,
    settings: zhSettings,
    navigation: zhNavigation,
    dashboard: zhDashboard,
    calendar: zhCalendar,
    strategies: zhStrategies,
    statistics: zhStatistics,
    analytics: zhAnalytics,
    users: zhUsers,
    accounts: zhAccounts,
    auth: zhAuth,
  },
};

// Fonction pour obtenir la langue par défaut depuis le navigateur
// Utilise navigator.language (standard) ou navigator.userLanguage (IE legacy)
// Format retourné : 'fr-FR', 'en-US', 'es-ES', etc.
// On extrait le code langue principal (ex: 'fr' de 'fr-FR')
// Les langues complètement traduites sont : 'fr', 'en', et 'es'
// Les autres langues utiliseront 'en' par défaut
const getDefaultLanguage = (): string => {
  if (typeof navigator !== 'undefined') {
    // navigator.language est la propriété standard qui retourne la langue préférée du navigateur
    // Format BCP 47 : 'fr-FR', 'en-US', 'en-GB', 'es-ES', etc.
    // navigator.userLanguage est un fallback pour les anciennes versions d'Internet Explorer
    const browserLang = navigator.language || (navigator as any).userLanguage;
    if (browserLang) {
      // Extraire le code langue principal (ex: 'fr' de 'fr-FR')
      const lang = browserLang.split('-')[0].toLowerCase();
      
      // Les langues complètement traduites sont : français, anglais, espagnol, et allemand
      if (lang === 'fr') {
        return 'fr';
      }
      if (lang === 'es') {
        return 'es';
      }
      if (lang === 'de') {
        return 'de';
      }
      // Pour 'en' et toutes les autres langues, utiliser 'en'
      return 'en';
    }
  }
  // Par défaut, retourner 'en'
  return 'en';
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: getDefaultLanguage(),
    supportedLngs: ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'ko', 'zh'],
    defaultNS: 'common',
    ns: ['common', 'trades', 'settings', 'navigation', 'dashboard', 'calendar', 'strategies', 'statistics', 'analytics', 'users', 'accounts', 'auth', 'home', 'strategy', 'positionStrategies'],
    
    interpolation: {
      escapeValue: false, // React échappe déjà les valeurs
    },
    
    detection: {
      // Détecter la langue du navigateur, mais seulement si pas de langue sauvegardée
      // L'ordre est important : on vérifie d'abord localStorage (préférence utilisateur)
      // puis le navigateur si aucune préférence n'est sauvegardée
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
      // Fonction pour convertir la langue détectée par le navigateur
      // Les langues complètement traduites sont : 'fr', 'en', 'es', et 'de'
      convertDetectedLanguage: (lng: string): string => {
        if (!lng) return 'en';
        const lang = lng.split('-')[0].toLowerCase();
        // Les langues complètement traduites sont : français, anglais, espagnol, et allemand
        if (lang === 'fr') return 'fr';
        if (lang === 'es') return 'es';
        if (lang === 'de') return 'de';
        return 'en';
      },
    },
  });

// La détection de langue est gérée par i18next avec le fallbackLng qui utilise getDefaultLanguage()
// getDefaultLanguage() retourne 'fr' si le navigateur est en français, sinon 'en'

// Fonction pour changer la langue depuis les préférences utilisateur
export const changeLanguage = (lang: string) => {
  return i18n.changeLanguage(lang);
};

export default i18n;
