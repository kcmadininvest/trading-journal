import React, { useEffect } from 'react';

/**
 * Composant pour charger le schéma JSON-LD de l'organisation
 * de manière compatible avec la Content Security Policy (CSP)
 */
const OrganizationSchema: React.FC = () => {
  useEffect(() => {
    // Charger le JSON-LD depuis un fichier externe pour respecter la CSP
    fetch('/organization-schema.json')
      .then(response => response.json())
      .then(schema => {
        // Créer un élément script avec le type application/ld+json
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.text = JSON.stringify(schema);
        
        // Ajouter l'ID pour pouvoir le retrouver et le supprimer au démontage
        script.id = 'organization-schema';
        
        // Ajouter le script au head
        document.head.appendChild(script);
      })
      .catch(error => {
        console.error('Erreur lors du chargement du schéma JSON-LD:', error);
      });

    // Nettoyer le script au démontage du composant
    return () => {
      const existingScript = document.getElementById('organization-schema');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, []);

  return null; // Ce composant ne rend rien visuellement
};

export default OrganizationSchema;

