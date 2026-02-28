import React from 'react';
import { useTranslation } from 'react-i18next';
import { AnalyticsDashboard } from '../components/analytics';

const TradeAnalyticsPage: React.FC = () => {
  const { t } = useTranslation();
  
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {t('analytics:dashboard.title', { defaultValue: 'Analyse Statistique des Trades' })}
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          {t('analytics:dashboard.subtitle', { defaultValue: 'Découvrez vos meilleurs setups, identifiez les patterns perdants et détectez les biais comportementaux' })}
        </p>
      </div>
      
      <AnalyticsDashboard />
    </div>
  );
};

export default TradeAnalyticsPage;
