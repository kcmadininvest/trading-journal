import React from 'react';
import { VERSION } from '../../version';
import { useApiStatus } from '../../hooks/useApiStatus';
import { useTranslation } from '../../hooks/useTranslation';

const Footer: React.FC = () => {
  const { status } = useApiStatus();
  const { t } = useTranslation();

  const getStatusConfig = () => {
    switch (status) {
      case 'online':
        return {
          color: 'bg-green-400 dark:bg-green-500',
          text: t('common:apiStatus.online'),
          blink: false,
        };
      case 'offline':
        return {
          color: 'bg-red-400 dark:bg-red-500',
          text: t('common:apiStatus.offline'),
          blink: true,
        };
      case 'checking':
        return {
          color: 'bg-yellow-400 dark:bg-yellow-500',
          text: t('common:apiStatus.checking'),
          blink: true,
        };
      default:
        return {
          color: 'bg-gray-400 dark:bg-gray-500',
          text: t('common:apiStatus.offline'),
          blink: true,
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <footer className="relative bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-center">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            © 2025 Trading Journal. Tous droits réservés.
          </span>
        </div>
      </div>
      
      {/* Statut et Version positionnés à droite de la page */}
      <div className="absolute right-4 sm:right-6 lg:right-8 top-1/2 -translate-y-1/2 flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div 
            className={`w-2 h-2 ${statusConfig.color} rounded-full ${
              statusConfig.blink ? 'animate-pulse' : ''
            }`}
          ></div>
          <span className="text-xs text-gray-400 dark:text-gray-500">{statusConfig.text}</span>
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          Version {VERSION}
        </span>
      </div>
    </footer>
  );
};

export default Footer;
