/**
 * Post-build / prerender : marqueurs SSI nonce + JSON-LD Organization statique.
 * Ne pas utiliser sur la source Vite (garder DEV_ONLY pour le DX).
 */
const fs = require('fs');
const path = require('path');

const SSI_NONCE_ECHO = "<!--#echo encoding=\"none\" var=\"UNIQUE_ID\" -->";
const SSI_META_CONTENT = `content='${SSI_NONCE_ECHO}'`;
const SSI_NONCE_ATTR = `nonce='${SSI_NONCE_ECHO}'`;

/**
 * Remplace meta csp-nonce DEV_ONLY (ou déjà SSI) et injecte Organization ld+json
 * avec data-seo-static="1" si absent.
 *
 * @param {string} html
 * @param {string} organizationSchemaJsonString - JSON déjà stringify (compact ou pretty)
 */
function applyCspAndOrganizationSeo(html, organizationSchemaJsonString) {
  if (typeof html !== 'string' || !html) {
    throw new Error('applyCspAndOrganizationSeo: html requis');
  }

  let out = html;

  // Meta csp-nonce : DEV_ONLY → SSI (attribut simple-quoté)
  out = out.replace(
    /(<meta\s+name=["']csp-nonce["']\s+content=)["']DEV_ONLY["'](\s*\/?>)/i,
    `$1'${SSI_NONCE_ECHO}'$2`,
  );

  // Si déjà content="DEV_ONLY" avec ordre d'attributs inversé
  out = out.replace(
    /(<meta\s+content=)["']DEV_ONLY["'](\s+name=["']csp-nonce["']\s*\/?>)/i,
    `$1'${SSI_NONCE_ECHO}'$2`,
  );

  if (!/id=["']organization-schema["']/i.test(out)) {
    const schemaBlock = [
      `<script type="application/ld+json" id="organization-schema" data-seo-static="1" ${SSI_NONCE_ATTR}>`,
      organizationSchemaJsonString.trim(),
      '</script>',
    ].join('\n    ');
    if (!out.includes('</head>')) {
      throw new Error('applyCspAndOrganizationSeo: </head> introuvable');
    }
    out = out.replace('</head>', `    ${schemaBlock}\n  </head>`);
  }

  return out;
}

function loadOrganizationSchemaJson(buildDir) {
  const candidates = [
    path.join(buildDir, 'organization-schema.json'),
    path.join(buildDir, '..', 'public', 'organization-schema.json'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const raw = fs.readFileSync(candidate, 'utf8');
      // Valider + re-stringify compact (évite </script> dans le JSON)
      const parsed = JSON.parse(raw);
      return JSON.stringify(parsed);
    }
  }
  throw new Error(
    `organization-schema.json introuvable (cherché: ${candidates.join(', ')})`,
  );
}

/** Simule Apache SSI UniqueId pour les tests. */
function simulateSsiUniqueId(html, nonce = 'testNonceABC') {
  return html.split(SSI_NONCE_ECHO).join(nonce);
}

module.exports = {
  SSI_NONCE_ECHO,
  SSI_META_CONTENT,
  SSI_NONCE_ATTR,
  applyCspAndOrganizationSeo,
  loadOrganizationSchemaJson,
  simulateSsiUniqueId,
};
