/**
 * Serveur SSR pour pré-rendering des pages React
 * 
 * Ce serveur utilise ReactDOMServer pour générer du HTML statique
 * avec le contenu déjà rendu, améliorant ainsi le SEO.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// Configuration
const BUILD_DIR = path.join(__dirname, '..', 'build');
const PRERENDER_DIR = path.join(BUILD_DIR, 'prerendered');

// Pages à pré-rendre
const PAGES_TO_PRERENDER = [
  { path: '/', lang: 'fr' },
  { path: '/', lang: 'en' },
  { path: '/', lang: 'es' },
  { path: '/', lang: 'de' },
  { path: '/a-propos', lang: 'fr' },
  { path: '/about', lang: 'en' },
  { path: '/acerca-de', lang: 'es' },
  { path: '/uber-uns', lang: 'de' },
  { path: '/fonctionnalites', lang: 'fr' },
  { path: '/features', lang: 'en' },
  { path: '/funcionalidades', lang: 'es' },
  { path: '/funktionen', lang: 'de' },
];

/**
 * Fonction helper pour forcer une URL à être en HTTPS (bonne pratique SEO)
 */
function ensureHttps(urlString) {
  if (!urlString) return 'https://app.kctradingjournal.com';
  // Si l'URL commence par http://, la remplacer par https://
  return urlString.replace(/^http:\/\//i, 'https://');
}

/**
 * Génère le HTML pré-rendu pour une route
 */
async function generatePrerenderedHTML(route, lang, query = '') {
  try {
    // Lire le template HTML de base
    const indexPath = path.join(BUILD_DIR, 'index.html');
    if (!fs.existsSync(indexPath)) {
      throw new Error(`Fichier index.html non trouvé: ${indexPath}`);
    }
    
    let html = fs.readFileSync(indexPath, 'utf8');
    
    // Données SEO selon la langue et la page (KEYWORDS AMÉLIORÉS)
    const seoDataByPage = {
      '/': {
        fr: {
          title: 'Journal de Trading Gratuit | K&C Trading Journal',
          description: 'Journal de trading professionnel gratuit - Suivez, analysez et optimisez vos performances de trading avec des outils avancés. Import CSV, multi-comptes, statistiques détaillées. 100% gratuit, sans frais cachés.',
          keywords: 'journal de trading, trading journal, suivi de trades, analyse trading, performance trading, logiciel trading, application trading',
          locale: 'fr_FR',
        },
        en: {
          title: 'Free Trading Journal & Performance Tracker | K&C Trading Journal',
          description: 'Professional trading journal software to track trades, analyze performance, and improve your strategy. Free forever with CSV import, multi-account support, advanced statistics, and analytics. No hidden fees.',
          keywords: 'trading journal, trading diary, trade tracker, trading log, stock trading journal, forex trading journal, crypto trading journal, day trading journal, trading performance tracker, trading analytics, free trading journal software, trading journal app, trade management, position tracking',
          locale: 'en_US',
        },
        es: {
          title: 'Diario de Trading Gratuito | K&C Trading Journal',
          description: 'Diario de trading profesional gratuito - Rastrea, analiza y optimiza tu rendimiento de trading con herramientas avanzadas. Importación CSV, multi-cuenta, estadísticas detalladas. 100% gratuito, sin costos ocultos.',
          keywords: 'diario de trading, trading journal, seguimiento de trades, análisis de trading, rendimiento de trading, software de trading',
          locale: 'es_ES',
        },
        de: {
          title: 'Kostenloses Trading-Journal | K&C Trading Journal',
          description: 'Kostenloses professionelles Trading-Journal - Verfolgen, analysieren und optimieren Sie Ihre Trading-Leistung mit erweiterten Tools. CSV-Import, Multi-Konto, detaillierte Statistiken. 100% kostenlos, keine versteckten Gebühren.',
          keywords: 'Trading-Journal, Journal de trading, Trade-Tracking, Trading-Analyse, Trading-Leistung, Trading-Software',
          locale: 'de_DE',
        },
      },
      '/about': {
        en: {
          title: 'About Us - Free Trading Journal Platform | K&C Trading Journal',
          description: 'Discover the story and mission of K&C Trading Journal. A free platform created with passion to help traders track and improve their performance. Learn about our commitment to providing the best free trading journal software.',
          keywords: 'about trading journal, free trading software, trading platform, trading journal mission, professional trading tools, trading performance tracking, trader community',
          locale: 'en_US',
        },
      },
      '/a-propos': {
        fr: {
          title: 'À Propos | K&C Trading Journal',
          description: 'Découvrez l\'histoire et la mission de K&C Trading Journal. Une plateforme gratuite créée par passion pour aider les traders à suivre et améliorer leurs performances.',
          keywords: 'à propos, trading journal, histoire, mission, équipe',
          locale: 'fr_FR',
        },
      },
      '/features': {
        en: {
          title: 'Trading Journal Features - Track, Analyze & Optimize | K&C Trading Journal',
          description: 'Discover all the features of K&C Trading Journal: trade tracking, advanced analytics, strategy management, detailed statistics, CSV import, multi-account support, performance metrics, and much more. 100% free trading journal software.',
          keywords: 'trading journal features, trade tracking software, trading analytics, performance tracking, trading statistics, strategy management, CSV import, multi-account trading, trading metrics, position tracking, trade analysis tools',
          locale: 'en_US',
        },
      },
      '/fonctionnalites': {
        fr: {
          title: 'Fonctionnalités | K&C Trading Journal',
          description: 'Découvrez toutes les fonctionnalités de K&C Trading Journal : suivi de trades, analyses avancées, gestion de stratégies, statistiques détaillées et bien plus encore.',
          keywords: 'fonctionnalités, features, suivi trades, analyse trading, statistiques trading, journal trading',
          locale: 'fr_FR',
        },
      },
    };
    
    // Récupérer les données SEO pour la page et la langue
    const pageSeo = seoDataByPage[route] || seoDataByPage['/'];
    const currentSeo = pageSeo[lang] || pageSeo['en'] || seoDataByPage['/']['en'];
    
    // Forcer baseUrl à toujours être en HTTPS
    const rawBaseUrl = process.env.REACT_APP_BASE_URL || 'https://app.kctradingjournal.com';
    const baseUrl = ensureHttps(rawBaseUrl);
    // URL canonique: conserver ?lang uniquement pour la home
    const fullUrl = route === '/'
      ? ensureHttps(`${baseUrl}/?lang=${lang}`)
      : ensureHttps(`${baseUrl}${route}`);
    
    // Remplacer les balises meta avec des regex plus robustes
    html = html.replace(/<title>.*?<\/title>/i, `<title>${currentSeo.title}</title>`);
    html = html.replace(/<meta\s+name=["']description["']\s+content=["'][^"']*["']\s*\/?>/i, `<meta name="description" content="${currentSeo.description.replace(/"/g, '&quot;')}" />`);
    html = html.replace(/<meta\s+name=["']keywords["']\s+content=["'][^"']*["']\s*\/?>/i, `<meta name="keywords" content="${currentSeo.keywords.replace(/"/g, '&quot;')}" />`);
    
    // Mettre à jour og:locale et autres balises Open Graph
    html = html.replace(/<meta\s+property=["']og:locale["']\s+content=["'][^"']*["']\s*\/?>/i, `<meta property="og:locale" content="${currentSeo.locale}" />`);
    html = html.replace(/<meta\s+property=["']og:title["']\s+content=["'][^"']*["']\s*\/?>/i, `<meta property="og:title" content="${currentSeo.title.replace(/"/g, '&quot;')}" />`);
    html = html.replace(/<meta\s+property=["']og:description["']\s+content=["'][^"']*["']\s*\/?>/i, `<meta property="og:description" content="${currentSeo.description.replace(/"/g, '&quot;')}" />`);
    html = html.replace(/<meta\s+property=["']og:url["']\s+content=["'][^"']*["']\s*\/?>/i, `<meta property="og:url" content="${fullUrl}" />`);
    
    // S'assurer que og:logo est présent
    if (!html.includes('property="og:logo"')) {
      html = html.replace(/<meta\s+property=["']og:image["']/i, `<meta property="og:logo" content="${baseUrl}/logo.png" />\n    <meta property="og:image"`);
    } else {
      html = html.replace(/<meta\s+property=["']og:logo["']\s+content=["'][^"']*["']\s*\/?>/i, `<meta property="og:logo" content="${baseUrl}/logo.png" />`);
    }
    
    // Mettre à jour la langue HTML
    html = html.replace(/<html\s+lang=["'][^"']*["']/i, `<html lang="${lang}"`);
    
    // Mettre à jour le canonical
    html = html.replace(/<link\s+rel=["']canonical["']\s+href=["'][^"']*["']\s*\/?>/i, `<link rel="canonical" href="${fullUrl}" />`);
    
    // Mettre à jour les balises hreflang
    const hreflangUrls = {
      '/': baseUrl,
      '/about': `${baseUrl}/about`,
      '/a-propos': `${baseUrl}/a-propos`,
      '/acerca-de': `${baseUrl}/acerca-de`,
      '/uber-uns': `${baseUrl}/uber-uns`,
      '/features': `${baseUrl}/features`,
      '/fonctionnalites': `${baseUrl}/fonctionnalites`,
      '/funcionalidades': `${baseUrl}/funcionalidades`,
      '/funktionen': `${baseUrl}/funktionen`,
    };
    
    const currentHreflangUrl = hreflangUrls[route] || baseUrl;
    
    // Pour la page d'accueil, pointer vers les variantes linguistiques en query param
    if (route === '/') {
      const hreflangReplacements = {
        fr: `<link rel="alternate" hreflang="fr" href="${baseUrl}/?lang=fr" />`,
        en: `<link rel="alternate" hreflang="en" href="${baseUrl}/?lang=en" />`,
        es: `<link rel="alternate" hreflang="es" href="${baseUrl}/?lang=es" />`,
        de: `<link rel="alternate" hreflang="de" href="${baseUrl}/?lang=de" />`,
      };
      
      ['fr', 'en', 'es', 'de'].forEach((l) => {
        const regex = new RegExp(`<link\\s+rel=["']alternate["']\\s+hreflang=["']${l}["']\\s+href=["'][^"']*["']\\s*\\/?>`, 'i');
        html = html.replace(regex, hreflangReplacements[l]);
      });

      const xDefaultRegex = /<link\s+rel=["']alternate["']\s+hreflang=["']x-default["']\s+href=["'][^"']*["']\s*\/?>/i;
      html = html.replace(xDefaultRegex, `<link rel="alternate" hreflang="x-default" href="${baseUrl}/?lang=fr" />`);
    }
    
    // Ajouter un commentaire pour indiquer que c'est pré-rendu
    html = html.replace('</head>', `<!-- Pré-rendu SSR pour ${route} (${lang}) - SEO optimisé -->
</head>`);
    
    return html;
    
  } catch (error) {
    console.error(`Erreur lors de la génération du HTML pour ${route} (${lang}):`, error);
    throw error;
  }
}

/**
 * Route pour pré-rendre une page
 */
app.get('/prerender/:route(*)', async (req, res) => {
  try {
    const route = req.params.route || '/';
    const lang = req.query.lang || 'fr';
    const query = req.query.query || '';
    
    const html = await generatePrerenderedHTML(route, lang, query);
    res.send(html);
  } catch (error) {
    res.status(500).send(`Erreur: ${error.message}`);
  }
});

/**
 * Fonction pour pré-rendre toutes les pages
 */
async function prerenderAllPages() {
  console.log('🚀 Démarrage du pré-rendering SSR...\n');
  
  // Vérifier que le répertoire build existe
  if (!fs.existsSync(BUILD_DIR)) {
    console.error(`❌ Le répertoire build n'existe pas: ${BUILD_DIR}`);
    console.error('   Veuillez d\'abord exécuter: npm run build');
    process.exit(1);
  }
  
  // Créer le répertoire de pré-rendering
  if (!fs.existsSync(PRERENDER_DIR)) {
    fs.mkdirSync(PRERENDER_DIR, { recursive: true });
  }
  
  // Pré-rendre toutes les pages
  for (const page of PAGES_TO_PRERENDER) {
    try {
      const html = await generatePrerenderedHTML(page.path, page.lang, '');
      
      // Créer le répertoire de destination
      const outputDir = path.join(PRERENDER_DIR, page.path === '/' ? '' : page.path.replace(/^\//, ''));
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Déterminer le nom du fichier
      let filename = 'index.html';
      if (page.path === '/') {
        filename = `index.${page.lang}.html`;
      }
      
      const outputPath = path.join(outputDir, filename);
      fs.writeFileSync(outputPath, html, 'utf8');
      
      console.log(`✅ Pré-rendu généré: ${page.path} (${page.lang})`);
      
      // Pour la page d'accueil en français, mettre à jour aussi index.html par défaut
      if (page.path === '/' && page.lang === 'fr') {
        const defaultIndexPath = path.join(BUILD_DIR, 'index.html');
        fs.writeFileSync(defaultIndexPath, html, 'utf8');
        console.log(`✅ Fichier index.html par défaut mis à jour`);
      }
      
    } catch (error) {
      console.error(`❌ Erreur lors du pré-rendering de ${page.path} (${page.lang}):`, error.message);
    }
  }
  
  console.log('\n✨ Pré-rendering SSR terminé!');
  console.log(`📁 Fichiers générés dans: ${PRERENDER_DIR}`);
}

// Si exécuté directement, lancer le pré-rendering
if (require.main === module) {
  prerenderAllPages()
    .then(() => {
      console.log('\n✅ Toutes les pages ont été pré-rendues avec succès!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Erreur lors du pré-rendering:', error);
      process.exit(1);
    });
}

// Exporter pour utilisation comme module
module.exports = { app, prerenderAllPages, generatePrerenderedHTML };

