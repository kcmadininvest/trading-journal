import React, { useState } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import ExportModal from './ExportModal';

interface ExportButtonProps {
  tradingAccountId: number;
  tradingAccountName: string;
  className?: string;
}

const ExportButton: React.FC<ExportButtonProps> = ({
  tradingAccountId,
  tradingAccountName,
  className = '',
}) => {
  const { t } = useI18nTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm ${className}`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span className="font-medium">{t('common:export', { defaultValue: 'Exporter' })}</span>
      </button>

      <ExportModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        tradingAccountId={tradingAccountId}
        tradingAccountName={tradingAccountName}
      />
    </>
  );
};

export default ExportButton;
