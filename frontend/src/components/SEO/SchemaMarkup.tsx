import { useEffect } from 'react';
import { canInjectInlineScript, getCspNonce } from '../../utils/cspNonce';

interface SchemaMarkupProps {
  type: 'Organization' | 'SoftwareApplication' | 'WebSite' | 'FAQPage' | 'BreadcrumbList' | 'WebPage';
  data: Record<string, any>;
}

const SchemaMarkup: React.FC<SchemaMarkupProps> = ({ type, data }) => {
  useEffect(() => {
    if (!canInjectInlineScript()) {
      return;
    }

    const schema = {
      '@context': 'https://schema.org',
      '@type': type,
      ...data,
    };

    const scriptId = `schema-${type.toLowerCase()}`;
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      const nonce = getCspNonce();
      if (nonce) {
        script.nonce = nonce;
      }
      document.head.appendChild(script);
    }

    script.textContent = JSON.stringify(schema, null, 2);
  }, [type, data]);

  return null;
};

export default SchemaMarkup;
