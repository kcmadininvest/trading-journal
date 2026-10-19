/**
 * Nonce CSP injecté par Apache (meta) pour scripts JSON-LD dynamiques.
 * DEV_ONLY / absent : pas de CSP enforce en Vite — injection libre.
 */
export function getCspNonce(): string | null {
  if (typeof document === 'undefined') return null;
  const meta = document.querySelector('meta[name="csp-nonce"]');
  const value = meta?.getAttribute('content')?.trim();
  if (!value || value === 'DEV_ONLY') return null;
  return value;
}

/** true si on peut injecter un script inline (dev sans CSP, ou nonce dispo). */
export function canInjectInlineScript(): boolean {
  if (typeof document === 'undefined') return false;
  if (getCspNonce()) return true;
  // Vite / pas de header CSP → OK
  const meta = document.querySelector('meta[name="csp-nonce"]');
  return !meta || meta.getAttribute('content') === 'DEV_ONLY';
}
