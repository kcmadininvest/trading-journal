import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { authService } from '../services/auth';
import MarketReplayPage from './MarketReplayPage';

const MarketReplayPopup: React.FC = () => {
  const { t } = useTranslation('marketReplay');

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      window.close();
      return;
    }

    document.title = `${t('title')} - Trading Journal`;
  }, [t]);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-900">
      <MarketReplayPage detached />
    </div>
  );
};

export default MarketReplayPopup;
