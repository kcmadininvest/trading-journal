import { useEffect } from 'react';

interface SchemaMarkupProps {
  type: 'Organization' | 'SoftwareApplication' | 'WebSite' | 'FAQPage' | 'BreadcrumbList' | 'WebPage';
  data: Record<string, any>;
}

const SchemaMarkup: React.FC<SchemaMarkupProps> = ({ type, data }) => {
  useEffect(() => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': type,
      ...data,
    };

    // Créer ou mettre à jour le script JSON-LD
    let script = document.getElementById(`schema-${type.toLowerCase()}`) as HTMLScriptElement;
    
    if (!script) {
      script = document.createElement('script');
      script.id = `schema-${type.toLowerCase()}`;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }

    script.textContent = JSON.stringify(schema, null, 2);
  }, [type, data]);

  return null;
};

export default SchemaMarkup;
