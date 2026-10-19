import React, { useEffect } from 'react';
import { canInjectInlineScript, getCspNonce } from '../../utils/cspNonce';

const SCHEMA_ID = 'organization-schema';

function getExistingSchema(): HTMLElement | null {
  return document.getElementById(SCHEMA_ID);
}

function isSeoStaticSchema(el: HTMLElement | null): boolean {
  return !!el && el.getAttribute('data-seo-static') === '1';
}

/**
 * Charge le schéma JSON-LD organisation.
 * Si prerender a déjà posé data-seo-static="1", ne pas toucher (SEO crawlers).
 * Sinon injection inline si nonce CSP ou DEV_ONLY (Vite).
 */
const OrganizationSchema: React.FC = () => {
  useEffect(() => {
    if (isSeoStaticSchema(getExistingSchema())) {
      return undefined;
    }

    if (!canInjectInlineScript()) {
      return undefined;
    }

    let cancelled = false;
    let createdByReact: HTMLElement | null = null;

    fetch('/organization-schema.json')
      .then((response) => response.json())
      .then((schema) => {
        if (cancelled) return;
        if (isSeoStaticSchema(getExistingSchema())) {
          return;
        }

        const existing = getExistingSchema();
        if (existing && !isSeoStaticSchema(existing)) {
          existing.remove();
        }

        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = SCHEMA_ID;
        const nonce = getCspNonce();
        if (nonce) {
          script.nonce = nonce;
        }
        script.text = JSON.stringify(schema);
        document.head.appendChild(script);
        createdByReact = script;
      })
      .catch((error) => {
        console.error('Erreur lors du chargement du schéma JSON-LD:', error);
      });

    return () => {
      cancelled = true;
      if (createdByReact && createdByReact.parentNode && !isSeoStaticSchema(createdByReact)) {
        createdByReact.remove();
      }
    };
  }, []);

  return null;
};

export default OrganizationSchema;
