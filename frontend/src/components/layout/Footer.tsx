import React, { useState } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import LegalNoticeModal from '../legal/LegalNoticeModal';
import { useApiStatus } from '../../hooks/useApiStatus';
import { VERSION } from '../../version';

interface FooterProps {
  onNavigate?: (page: string) => void;
}

const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const { t } = useI18nTranslation();
  const { status } = useApiStatus();
  const [showLegalModal, setShowLegalModal] = useState(false);
  const currentYear = new Date().getFullYear();

  const handleLegalClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setShowLegalModal(true);
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'online':
        return {
          color: 'bg-green-400',
          text: t('common:apiStatus.online'),
          blink: false,
        };
      case 'offline':
        return {
          color: 'bg-red-400',
          text: t('common:apiStatus.offline'),
          blink: true,
        };
      case 'checking':
        return {
          color: 'bg-yellow-400',
          text: t('common:apiStatus.checking'),
          blink: true,
        };
      default:
        return {
          color: 'bg-gray-400',
          text: t('common:apiStatus.offline'),
          blink: true,
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-gray-50 dark:bg-gray-900 w-full border-t border-gray-200 dark:border-gray-700 z-20">
      <div className="w-full px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          {/* Left: API Status & Version - Hidden on mobile */}
          <div className="hidden sm:flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-2" title={statusConfig.text}>
              <div 
                className={`w-2 h-2 ${statusConfig.color} rounded-full ${
                  statusConfig.blink ? 'animate-pulse' : ''
                }`}
              />
              <span className="hidden sm:inline">{statusConfig.text}</span>
            </div>
            <span className="hidden sm:inline">•</span>
            <span>v{VERSION}</span>
          </div>

          {/* Center: Copyright */}
          <span className="text-sm text-gray-500 dark:text-gray-400 text-center">
            © {currentYear} K&C Trading Journal. {t('common:allRightsReserved', { defaultValue: 'Tous droits réservés.' })}
          </span>

          {/* Right: Legal */}
          <a
            href="#legal-notice"
            onClick={handleLegalClick}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline transition-colors"
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
