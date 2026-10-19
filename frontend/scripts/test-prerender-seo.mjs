/**
 * Recette B — régression SEO prerender + SSI (sans navigateur).
 * Usage: node scripts/test-prerender-seo.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const {
  SSI_NONCE_ECHO,
  applyCspAndOrganizationSeo,
  loadOrganizationSchemaJson,
  simulateSsiUniqueId,
} = require('./cspSeoBuild.js');

const FRONTEND_ROOT = path.join(__dirname, '..');
const SOURCE_INDEX = path.join(FRONTEND_ROOT, 'index.html');
const PUBLIC_SCHEMA = path.join(FRONTEND_ROOT, 'public', 'organization-schema.json');

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    failed += 1;
  } else {
    console.log(`OK: ${msg}`);
  }
}

function extractAttr(html, tagRe, attr) {
  const m = html.match(tagRe);
  if (!m) return null;
  const tag = m[0];
  const am = tag.match(new RegExp(`${attr}=["']([^"']*)["']`, 'i'));
  return am ? am[1] : null;
}

function buildFixtureShell() {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="csp-nonce" content="DEV_ONLY" />
    <script src="/theme-boot.js"></script>
    <meta name="description" content="Fixture description" />
    <meta name="keywords" content="fixture,seo" />
    <meta property="og:title" content="Fixture OG Title" />
    <meta property="og:description" content="Fixture OG Description" />
    <meta property="og:url" content="https://app.kctradingjournal.com/" />
    <link rel="canonical" href="https://app.kctradingjournal.com/" />
    <link rel="alternate" hreflang="fr" href="https://app.kctradingjournal.com/" />
    <link rel="alternate" hreflang="en" href="https://app.kctradingjournal.com/" />
    <link rel="alternate" hreflang="x-default" href="https://app.kctradingjournal.com/" />
    <title>Fixture Title | K&C Trading Journal</title>
  </head>
  <body><div id="root"></div></body>
</html>`;
}

function seoAsserts(html, label) {
  assert(/<title>[^<]+<\/title>/i.test(html), `${label}: title`);
  assert(/name=["']description["']\s+content=["'][^"']+["']/i.test(html), `${label}: description`);
  assert(/rel=["']canonical["']\s+href=["']https:\/\//i.test(html), `${label}: canonical https`);
  assert(/hreflang=["']fr["']/i.test(html) || /hreflang=["']en["']/i.test(html), `${label}: hreflang`);
  assert(/property=["']og:title["']\s+content=["'][^"']+["']/i.test(html), `${label}: og:title`);
  assert(/property=["']og:url["']\s+content=["']https:\/\//i.test(html), `${label}: og:url`);
  assert(!/<title>[^<]*<!--#/.test(html), `${label}: title sans SSI`);
  assert(!/name=["']description["'][^>]*<!--#/.test(html), `${label}: description sans SSI`);
}

function schemaAsserts(html, label, expectedNonce) {
  const scriptMatch = html.match(
    /<script[^>]*id=["']organization-schema["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  assert(!!scriptMatch, `${label}: script organization-schema`);
  if (!scriptMatch) return;

  assert(/data-seo-static=["']1["']/i.test(scriptMatch[0]), `${label}: data-seo-static`);
  const nonce = extractAttr(html, /<script[^>]*id=["']organization-schema["'][^>]*>/i, 'nonce');
  const metaNonce = extractAttr(html, /<meta[^>]*name=["']csp-nonce["'][^>]*>/i, 'content');
  assert(nonce === expectedNonce, `${label}: script nonce=${expectedNonce} (got ${nonce})`);
  assert(metaNonce === expectedNonce, `${label}: meta nonce=${expectedNonce} (got ${metaNonce})`);
  assert(!html.includes(SSI_NONCE_ECHO), `${label}: plus de marqueur SSI brut après sim`);

  let parsed;
  try {
    parsed = JSON.parse(scriptMatch[1].trim());
  } catch (e) {
    assert(false, `${label}: JSON-LD parse (${e.message})`);
    return;
  }
  assert(parsed['@type'] === 'Organization', `${label}: @type Organization`);
  assert(!!parsed.name, `${label}: name`);
  assert(typeof parsed.url === 'string' && parsed.url.startsWith('https://'), `${label}: url https`);
}

// --- B0 source ---
const source = fs.readFileSync(SOURCE_INDEX, 'utf8');
assert(source.includes('content="DEV_ONLY"') || source.includes("content='DEV_ONLY'"), 'B0: source DEV_ONLY');
assert(!source.includes('<!--#echo'), 'B0: source sans echo SSI');

// --- Helper on fixture (simule pages) ---
const orgJson = JSON.stringify(JSON.parse(fs.readFileSync(PUBLIC_SCHEMA, 'utf8')));
const pages = [
  { label: 'B6 / fr fixture', html: buildFixtureShell() },
  {
    label: 'B6 /a-propos',
    html: buildFixtureShell()
      .replace('Fixture Title', 'À Propos | K&C')
      .replace('https://app.kctradingjournal.com/', 'https://app.kctradingjournal.com/a-propos'),
  },
  {
    label: 'B6 /fonctionnalites',
    html: buildFixtureShell()
      .replace('Fixture Title', 'Fonctionnalités | K&C')
      .replace('https://app.kctradingjournal.com/', 'https://app.kctradingjournal.com/fonctionnalites'),
  },
  {
    label: 'B6 home EN',
    html: buildFixtureShell()
      .replace('lang="en"', 'lang="en"')
      .replace('Fixture Title', 'Free Trading Journal | K&C'),
  },
];

for (const page of pages) {
  const withSeo = applyCspAndOrganizationSeo(page.html, orgJson);
  assert(withSeo.includes(SSI_NONCE_ECHO), `${page.label}: B1 marqueurs SSI`);
  assert(/data-seo-static=["']1["']/i.test(withSeo), `${page.label}: B1 data-seo-static`);
  assert(/theme-boot\.js/.test(withSeo), `${page.label}: B5 theme-boot.js`);
  assert(!/<script[^>]*>\s*\(function\s*\(\)\s*\{\s*try\s*\{\s*var pref/i.test(withSeo), `${page.label}: B5 pas de thème inline`);

  seoAsserts(withSeo, `${page.label} B3`);

  const simulated = simulateSsiUniqueId(withSeo, 'testNonceABC');
  schemaAsserts(simulated, `${page.label} B2/B4`, 'testNonceABC');
}

// Idempotence
const once = applyCspAndOrganizationSeo(buildFixtureShell(), orgJson);
const twice = applyCspAndOrganizationSeo(once, orgJson);
const count = (twice.match(/id=["']organization-schema["']/g) || []).length;
assert(count === 1, 'idempotent: un seul organization-schema');

// loadOrganizationSchemaJson via public/
const loaded = loadOrganizationSchemaJson(path.join(FRONTEND_ROOT, 'public'));
assert(loaded.includes('Organization') || JSON.parse(loaded)['@type'] === 'Organization', 'loadOrganizationSchemaJson');

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nRecette B prerender SEO: OK');
