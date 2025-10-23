import React, { useState, useEffect, useCallback } from 'react';
import { PositionStrategy } from '../../services/positionStrategies';

interface PrintModalProps {
  strategy: PositionStrategy;
  onClose: () => void;
}

const PrintModal: React.FC<PrintModalProps> = ({ strategy, onClose }) => {
  // const [printData, setPrintData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadPrintData = useCallback(async () => {
    try {
      setLoading(true);
      // Pour l'instant, on utilise les données de la stratégie directement
      // Dans une vraie implémentation, on appellerait l'API print_view
      // setPrintData({
      //   strategy: strategy,
      //   print_settings: {
      //     page_size: 'A4',
      //     orientation: 'landscape',
      //     margins: '10mm',
      //     font_size: '12px',
      //     line_height: '1.4'
      //   }
      // });
    } catch (error) {
      console.error('Erreur lors du chargement des données d\'impression:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrintData();
  }, [loadPrintData]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Stratégie - ${strategy.title}</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 10mm;
            }
            body {
              font-family: Arial, sans-serif;
              font-size: 12px;
              line-height: 1.4;
              margin: 0;
              padding: 0;
              color: #333;
            }
            .print-container {
              width: 100%;
              max-width: 100%;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              padding-bottom: 15px;
              border-bottom: 2px solid #333;
            }
            .header h1 {
              font-size: 24px;
              margin: 0 0 10px 0;
              color: #1f2937;
            }
            .header .meta {
              font-size: 14px;
              color: #6b7280;
            }
            .section {
              margin-bottom: 25px;
              page-break-inside: avoid;
            }
            .section-title {
              font-size: 16px;
              font-weight: bold;
              color: #1f2937;
              margin-bottom: 10px;
              padding: 8px 12px;
              background-color: #f3f4f6;
              border-left: 4px solid #3b82f6;
            }
            .section-content {
              padding: 0 12px;
            }
            .section-content h3 {
              font-size: 14px;
              font-weight: bold;
              margin: 10px 0 5px 0;
              color: #374151;
            }
            .section-content p {
              margin: 5px 0;
              color: #4b5563;
            }
            .conditions-list {
              margin: 10px 0;
            }
            .condition-item {
              margin: 5px 0;
              padding-left: 15px;
              position: relative;
            }
            .condition-item:before {
              content: "•";
              position: absolute;
              left: 0;
              color: #3b82f6;
              font-weight: bold;
            }
            .grid-2 {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 15px;
            }
            .grid-3 {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 15px;
            }
            .risk-item {
              background-color: #fef3c7;
              padding: 8px;
              border-radius: 4px;
              margin: 5px 0;
            }
            .footer {
              margin-top: 30px;
              padding-top: 15px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              font-size: 10px;
              color: #6b7280;
            }
            @media print {
              body { -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            <div class="header">
              <h1>${strategy.title}</h1>
              <div class="meta">
                Version ${strategy.version} • ${strategy.status === 'active' ? 'Active' : strategy.status === 'draft' ? 'Brouillon' : 'Archivée'} • 
                Créée le ${new Date(strategy.created_at).toLocaleDateString('fr-FR')}
              </div>
            </div>

            ${strategy.description ? `<div class="section">
              <div class="section-title">Description</div>
              <div class="section-content">
                <p>${strategy.description}</p>
              </div>
            </div>` : ''}

            ${strategy.strategy_content.sections && strategy.strategy_content.sections.length > 0 ? 
              strategy.strategy_content.sections.map((section: any) => `
                <div class="section">
                  <div class="section-title">${section.title}</div>
                  <div class="section-content">
                    ${section.rules && section.rules.length > 0 ? `
                      <div class="conditions-list">
                        ${section.rules.map((rule: any) => 
                          `<div class="condition-item">${rule.text}</div>`
                        ).join('')}
                      </div>
                    ` : ''}
                  </div>
                </div>
              `).join('')
            : '<div class="section"><div class="section-content"><p>Aucune section définie</p></div></div>'}

            <div class="footer">
              Stratégie générée le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}
            </div>
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl p-6">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span>Préparation de l'impression...</span>
          </div>
        </div>
      </div>
    );
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Aperçu d'impression</h2>
            <p className="text-gray-600 mt-1">{strategy.title} - Version {strategy.version}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Format: A4 Paysage • Optimisé pour l'impression</span>
            </div>
          </div>

          {/* Aperçu de la stratégie */}
          <div className="border border-gray-200 rounded-lg p-6 bg-white">
            <div className="text-center mb-6 pb-4 border-b border-gray-200">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{strategy.title}</h1>
              <div className="text-sm text-gray-600">
                Version {strategy.version} • {strategy.status === 'active' ? 'Active' : strategy.status === 'draft' ? 'Brouillon' : 'Archivée'} • 
                Créée le {new Date(strategy.created_at).toLocaleDateString('fr-FR')}
              </div>
            </div>

            {strategy.description && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Description</h2>
                <p className="text-gray-700">{strategy.description}</p>
              </div>
            )}

            <div className="space-y-6">
              {strategy.strategy_content?.sections && strategy.strategy_content.sections.length > 0 ? (
                strategy.strategy_content.sections.map((section, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">{section.title}</h3>
                    {section.rules && section.rules.length > 0 && (
                      <ul className="text-sm text-gray-700 space-y-1">
                        {section.rules.map((rule, ruleIndex) => (
                          <li key={ruleIndex} className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>{rule.text}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Aucune section définie dans cette stratégie
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200"
          >
            Annuler
          </button>
          <button
            onClick={handlePrint}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimer
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrintModal;
