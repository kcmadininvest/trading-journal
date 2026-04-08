import React from 'react';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import PositionCalculator from '../components/tools/PositionCalculator';
import { PageShell } from '../components/layout';

const CalculatorPage: React.FC = () => {
  const { t } = useTranslation();

  const handleDetach = () => {
    const width = 800;
    const height = 900;
    const left = window.screenX + window.outerWidth - width - 30;
    const top = window.screenY + 50;
    
    window.open(
      '/calculator-popup',
      'calculator-popup',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
  };

  return (
    <PageShell className="max-w-6xl mx-auto">
      <div className="mb-4">
        <button
          onClick={handleDetach}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
          title={t('calculator:detachTooltip')}
        >
          <ExternalLink className="w-4 h-4" />
          <span className="text-sm font-medium">
            {t('calculator:detach')}
          </span>
        </button>
      </div>
      <PositionCalculator />
    </PageShell>
  );
};

export default CalculatorPage;
