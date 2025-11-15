import React from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';

const LegalNoticePage: React.FC = () => {
  const { t } = useI18nTranslation();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          {t('legal:title', { defaultValue: 'Mentions légales' })}
        </h1>

        <div className="prose prose-sm sm:prose dark:prose-invert max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {t('legal:section1.title', { defaultValue: '1. Éditeur du site' })}
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4 text-justify">
              {t('legal:section1.content', { 
                defaultValue: 'Le présent site est édité par KC Trading Journal. Ce service est fourni à titre personnel et éducatif pour la gestion d\'un journal de trading.' 
              })}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {t('legal:section2.title', { defaultValue: '2. Avertissement général' })}
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4 text-justify">
              {t('legal:section2.content', { 
                defaultValue: 'Le trading sur les marchés financiers comporte des risques importants de perte en capital. Les performances passées ne préjugent pas des performances futures. Tout investissement comporte un risque de perte totale ou partielle du capital investi.' 
              })}
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-4 text-justify">
              {t('legal:section2.warning', { 
                defaultValue: 'Ce journal de trading est un outil de suivi personnel et ne constitue en aucun cas une recommandation d\'investissement, un conseil en investissement financier, ou une sollicitation d\'achat ou de vente d\'instruments financiers.' 
              })}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {t('legal:section3.title', { defaultValue: '3. Responsabilité' })}
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4 text-justify">
              {t('legal:section3.content', { 
                defaultValue: 'L\'éditeur ne saurait être tenu responsable des décisions de trading prises par les utilisateurs sur la base des informations contenues dans ce journal. Chaque utilisateur est seul responsable de ses décisions d\'investissement et de leurs conséquences.' 
              })}
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-4 text-justify">
              {t('legal:section3.data', { 
                defaultValue: 'L\'éditeur s\'efforce d\'assurer l\'exactitude des informations fournies, mais ne garantit pas l\'absence d\'erreurs, d\'omissions ou d\'interruptions de service. Les données sont fournies "en l\'état" sans garantie d\'aucune sorte.' 
              })}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {t('legal:section4.title', { defaultValue: '4. Protection des données' })}
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4 text-justify">
              {t('legal:section4.content', { 
                defaultValue: 'Les données personnelles et financières saisies dans ce journal sont stockées de manière sécurisée. L\'utilisateur est seul responsable de la confidentialité de ses identifiants et de l\'accès à son compte.' 
              })}
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-4 text-justify">
              {t('legal:section4.backup', { 
                defaultValue: 'Il est fortement recommandé à l\'utilisateur de conserver des sauvegardes de ses données et de ne pas se fier uniquement à ce service pour la conservation de ses informations de trading.' 
              })}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {t('legal:section5.title', { defaultValue: '5. Propriété intellectuelle' })}
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4 text-justify">
              {t('legal:section5.content', { 
                defaultValue: 'L\'ensemble du contenu de ce site (textes, images, logos, structure) est la propriété de l\'éditeur et est protégé par les lois relatives à la propriété intellectuelle. Toute reproduction non autorisée est interdite.' 
              })}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {t('legal:section6.title', { defaultValue: '6. Acceptation des conditions' })}
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4 text-justify">
              {t('legal:section6.content', { 
                defaultValue: 'L\'utilisation de ce service implique l\'acceptation pleine et entière des présentes mentions légales. En cas de désaccord, l\'utilisateur s\'engage à cesser immédiatement l\'utilisation du service.' 
              })}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {t('legal:section7.title', { defaultValue: '7. Modification des mentions légales' })}
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4 text-justify">
              {t('legal:section7.content', { 
                defaultValue: 'L\'éditeur se réserve le droit de modifier les présentes mentions légales à tout moment. Il est conseillé à l\'utilisateur de consulter régulièrement cette page pour prendre connaissance des éventuelles modifications.' 
              })}
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {t('legal:section8.title', { defaultValue: '8. Droit applicable et juridiction' })}
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4 text-justify">
              {t('legal:section8.content', { 
                defaultValue: 'Les présentes mentions légales sont régies par le droit applicable. En cas de litige, et à défaut d\'accord amiable, le litige sera porté devant les tribunaux compétents.' 
              })}
            </p>
          </section>

          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('legal:lastUpdated', { 
                defaultValue: 'Dernière mise à jour : Janvier 2025' 
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LegalNoticePage;

