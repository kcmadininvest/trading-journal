import React, { useState } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import LegalNoticeModal from '../legal/LegalNoticeModal';

interface FooterProps {
  onNavigate?: (page: string) => void;
}

const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const { t } = useI18nTranslation();
  const [showLegalModal, setShowLegalModal] = useState(false);

  const handleLegalClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setShowLegalModal(true);
  };

  return (
    <footer className="relative bg-transparent w-full">
      <div className="w-full px-4 sm:px-6 py-4">
        <div className="flex items-center relative w-full">
          <span className="text-sm text-gray-500 dark:text-gray-400 absolute left-1/2 transform -translate-x-1/2 whitespace-nowrap">
            © 2025 KC Trading Journal. {t('common:allRightsReserved', { defaultValue: 'Tous droits réservés.' })}
          </span>
          <a
            href="#legal-notice"
            onClick={handleLegalClick}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline transition-colors ml-auto mr-6"
          >
            {t('legal:link', { defaultValue: 'Mentions légales' })}
          </a>
        </div>
      </div>
      <LegalNoticeModal isOpen={showLegalModal} onClose={() => setShowLegalModal(false)} />
    </footer>
  );
};

export default Footer;
