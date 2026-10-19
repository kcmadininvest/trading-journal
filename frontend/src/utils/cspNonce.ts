/**
 * Nonce CSP injecté par Apache SSI (meta) pour scripts JSON-LD dynamiques.
 * DEV_ONLY / absent : Vite sans CSP enforce — injection libre.
 * Marqueur SSI non évalué (<!--#) : invalide (SSI off).
 */

const SSI_UNEVALUATED_PREFIX = '<!--#';

function readCspNonceMetaContent(): string | null {
  if (typeof document === 'undefined') return null;
  const meta = document.querySelector('meta[name="csp-nonce"]');
  const value = meta?.getAttribute('content')?.trim();
  return value || null;
}

export function isValidCspNonce(value: string | null | undefined): boolean {
  if (!value) return false;
  if (value === 'DEV_ONLY') return false;
  if (value.startsWith(SSI_UNEVALUATED_PREFIX)) return false;
  return true;
}

export function getCspNonce(): string | null {
  const value = readCspNonceMetaContent();
  if (!isValidCspNonce(value)) return null;
  return value;
}

/** true si on peut injecter un script inline (dev sans CSP, ou nonce dispo). */
export function canInjectInlineScript(): boolean {
  if (typeof document === 'undefined') return false;
  if (getCspNonce()) return true;
  const value = readCspNonceMetaContent();
  // Vite / meta absente / DEV_ONLY → OK
  if (!value || value === 'DEV_ONLY') return true;
  // SSI brut non évalué → ne pas injecter
  return false;
}
