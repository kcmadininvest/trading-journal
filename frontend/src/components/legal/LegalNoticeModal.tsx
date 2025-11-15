import React, { useEffect } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';

interface LegalNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LegalNoticeModal: React.FC<LegalNoticeModalProps> = ({ isOpen, onClose }) => {
  const { t } = useI18nTranslation();

  // Empêcher le scroll du body quand la modale est ouverte
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-2 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white dark:bg-gray-800 w-full max-w-4xl rounded-xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-3 sm:px-6 py-3 sm:py-5 border-b border-gray-200 dark:border-gray-700 flex items-start sm:items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-t-xl flex-shrink-0 gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-600 dark:bg-blue-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
                {t('legal:title', { defaultValue: 'Mentions légales' })}
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                {t('legal:subtitle', { defaultValue: 'Informations légales et conditions d\'utilisation' })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-white/80 dark:hover:bg-gray-700/80 flex items-center justify-center transition-colors flex-shrink-0"
            aria-label={t('common:close', { defaultValue: 'Close' })}
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          <div className="prose prose-sm sm:prose dark:prose-invert max-w-none">
            <section className="mb-6 sm:mb-8">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">
                {t('legal:section1.title', { defaultValue: '1. Éditeur du site' })}
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-3 sm:mb-4 text-justify text-sm sm:text-base">
                {t('legal:section1.content', { 
                  defaultValue: 'Le présent site est édité par KC Trading Journal. Ce service est fourni à titre personnel et éducatif pour la gestion d\'un journal de trading.' 
                })}
              </p>
            </section>

            <section className="mb-6 sm:mb-8">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">
                {t('legal:section2.title', { defaultValue: '2. Avertissement général' })}
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-3 sm:mb-4 text-justify text-sm sm:text-base">
                {t('legal:section2.content', { 
                  defaultValue: 'Le trading sur les marchés financiers comporte des risques importants de perte en capital. Les performances passées ne préjugent pas des performances futures. Tout investissement comporte un risque de perte totale ou partielle du capital investi.' 
                })}
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-3 sm:mb-4 text-justify text-sm sm:text-base">
                {t('legal:section2.warning', { 
                  defaultValue: 'Ce journal de trading est un outil de suivi personnel et ne constitue en aucun cas une recommandation d\'investissement, un conseil en investissement financier, ou une sollicitation d\'achat ou de vente d\'instruments financiers.' 
                })}
              </p>
            </section>

            <section className="mb-6 sm:mb-8">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">
                {t('legal:section3.title', { defaultValue: '3. Responsabilité' })}
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-3 sm:mb-4 text-justify text-sm sm:text-base">
                {t('legal:section3.content', { 
                  defaultValue: 'L\'éditeur ne saurait être tenu responsable des décisions de trading prises par les utilisateurs sur la base des informations contenues dans ce journal. Chaque utilisateur est seul responsable de ses décisions d\'investissement et de leurs conséquences.' 
                })}
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-3 sm:mb-4 text-justify text-sm sm:text-base">
                {t('legal:section3.data', { 
                  defaultValue: 'L\'éditeur s\'efforce d\'assurer l\'exactitude des informations fournies, mais ne garantit pas l\'absence d\'erreurs, d\'omissions ou d\'interruptions de service. Les données sont fournies "en l\'état" sans garantie d\'aucune sorte.' 
                })}
              </p>
            </section>

            <section className="mb-6 sm:mb-8">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">
                {t('legal:section4.title', { defaultValue: '4. Protection des données' })}
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-3 sm:mb-4 text-justify text-sm sm:text-base">
                {t('legal:section4.content', { 
                  defaultValue: 'Les données personnelles et financières saisies dans ce journal sont stockées de manière sécurisée. L\'utilisateur est seul responsable de la confidentialité de ses identifiants et de l\'accès à son compte.' 
                })}
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-3 sm:mb-4 text-justify text-sm sm:text-base">
                {t('legal:section4.backup', { 
                  defaultValue: 'Il est fortement recommandé à l\'utilisateur de conserver des sauvegardes de ses données et de ne pas se fier uniquement à ce service pour la conservation de ses informations de trading.' 
                })}
              </p>
            </section>

            <section className="mb-6 sm:mb-8">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">
                {t('legal:section5.title', { defaultValue: '5. Propriété intellectuelle' })}
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-3 sm:mb-4 text-justify text-sm sm:text-base">
                {t('legal:section5.content', { 
                  defaultValue: 'L\'ensemble du contenu de ce site (textes, images, logos, structure) est la propriété de l\'éditeur et est protégé par les lois relatives à la propriété intellectuelle. Toute reproduction non autorisée est interdite.' 
                })}
              </p>
            </section>

            <section className="mb-6 sm:mb-8">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">
                {t('legal:section6.title', { defaultValue: '6. Acceptation des conditions' })}
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-3 sm:mb-4 text-justify text-sm sm:text-base">
                {t('legal:section6.content', { 
                  defaultValue: 'L\'utilisation de ce service implique l\'acceptation pleine et entière des présentes mentions légales. En cas de désaccord, l\'utilisateur s\'engage à cesser immédiatement l\'utilisation du service.' 
                })}
              </p>
            </section>

            <section className="mb-6 sm:mb-8">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">
                {t('legal:section7.title', { defaultValue: '7. Modification des mentions légales' })}
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-3 sm:mb-4 text-justify text-sm sm:text-base">
                {t('legal:section7.content', { 
                  defaultValue: 'L\'éditeur se réserve le droit de modifier les présentes mentions légales à tout moment. Il est conseillé à l\'utilisateur de consulter régulièrement cette page pour prendre connaissance des éventuelles modifications.' 
                })}
              </p>
            </section>

            <section className="mb-6 sm:mb-8">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 sm:mb-4">
                {t('legal:section8.title', { defaultValue: '8. Droit applicable et juridiction' })}
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-3 sm:mb-4 text-justify text-sm sm:text-base">
                {t('legal:section8.content', { 
                  defaultValue: 'Les présentes mentions légales sont régies par le droit applicable. En cas de litige, et à défaut d\'accord amiable, le litige sera porté devant les tribunaux compétents.' 
                })}
              </p>
            </section>

            <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                {t('legal:lastUpdated', { 
                  defaultValue: 'Dernière mise à jour : Janvier 2025' 
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-3 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2 sm:gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 sm:px-5 py-2 sm:py-2.5 bg-blue-600 dark:bg-blue-500 text-white text-sm sm:text-base font-medium rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            {t('common:close', { defaultValue: 'Fermer' })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LegalNoticeModal;

