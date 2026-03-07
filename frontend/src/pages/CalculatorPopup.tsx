import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import PositionCalculator from '../components/tools/PositionCalculator';
import { authService } from '../services/auth';

const CalculatorPopup: React.FC = () => {
  const { t } = useTranslation();

  useEffect(() => {
    // Vérifier l'authentification
    if (!authService.isAuthenticated()) {
      window.close();
      return;
    }

    // Définir le titre de la fenêtre
    document.title = `${t('calculator:title')} - Trading Journal`;
  }, [t]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PositionCalculator />
    </div>
  );
};

export default CalculatorPopup;
