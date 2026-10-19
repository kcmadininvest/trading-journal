import React, { useEffect } from 'react';
import { canInjectInlineScript, getCspNonce } from '../../utils/cspNonce';

/**
 * Charge le schéma JSON-LD organisation.
 * Injection inline uniquement si nonce CSP dispo (prod) ou DEV_ONLY (Vite).
 */
const OrganizationSchema: React.FC = () => {
  useEffect(() => {
    if (!canInjectInlineScript()) {
      return undefined;
    }

    let cancelled = false;

    fetch('/organization-schema.json')
      .then((response) => response.json())
      .then((schema) => {
        if (cancelled) return;
        const existing = document.getElementById('organization-schema');
        if (existing) existing.remove();

        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = 'organization-schema';
        const nonce = getCspNonce();
        if (nonce) {
          script.nonce = nonce;
        }
        script.text = JSON.stringify(schema);
        document.head.appendChild(script);
      })
      .catch((error) => {
        console.error('Erreur lors du chargement du schéma JSON-LD:', error);
      });

    return () => {
      cancelled = true;
      const existingScript = document.getElementById('organization-schema');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, []);

  return null;
};

export default OrganizationSchema;
