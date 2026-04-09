import React, { useCallback, useState } from 'react';
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

  const handleLegalClick = useCallback(() => {
    setShowLegalModal(true);
  }, []);

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
    <footer className="w-full shrink-0 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
      <div className="w-full px-4 sm:px-6 py-2 sm:py-2.5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3">
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

          {/* Right: mentions légales — pastille cliquable */}
          <button
            type="button"
            onClick={handleLegalClick}
            aria-haspopup="dialog"
            className="group inline-flex items-center gap-1.5 rounded-full border border-gray-200/90 dark:border-gray-600 bg-white/90 dark:bg-gray-800/90 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 shadow-sm backdrop-blur-sm transition-all hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 hover:shadow dark:hover:border-gray-500 dark:hover:bg-gray-700/90 dark:hover:text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/80 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-50 dark:focus-visible:ring-offset-gray-900 active:scale-[0.98]"
          >
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors group-hover:bg-blue-100 group-hover:text-blue-700 dark:bg-gray-700 dark:text-gray-400 dark:group-hover:bg-blue-900/50 dark:group-hover:text-blue-300"
              aria-hidden
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </span>
            {t('legal:link', { defaultValue: 'Mentions légales' })}
          </button>
        </div>
      </div>
      <LegalNoticeModal isOpen={showLegalModal} onClose={() => setShowLegalModal(false)} />
    </footer>
  );
};

export default Footer;
