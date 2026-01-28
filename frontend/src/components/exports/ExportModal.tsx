import React, { useState, useEffect, useCallback } from 'react';
import exportService, { ExportTemplate, ExportConfiguration } from '../../services/exports';
import { DateInput } from '../common/DateInput';
import { ConfirmModal, DeleteConfirmModal } from '../ui';
import { CustomSelect } from '../common/CustomSelect';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { usePreferences } from '../../hooks/usePreferences';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tradingAccountId: number;
  tradingAccountName: string;
}

const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  tradingAccountId,
  tradingAccountName,
}) => {
  const { t, i18n } = useI18nTranslation();
  const { preferences } = usePreferences();

  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf');
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [useCustom, setUseCustom] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateFeedback, setTemplateFeedback] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
  }>({
    isOpen: false,
    title: '',
    message: null,
  });
  const [showDeleteTemplateModal, setShowDeleteTemplateModal] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<number | null>(null);
  const [isDeletingTemplate, setIsDeletingTemplate] = useState(false);
  
  const [configuration, setConfiguration] = useState<ExportConfiguration>({
    sections: {
      header: true,
      metrics: true,
      trades_list: 'all',
    },
    options: {
      watermark: true,
      page_numbers: true,
    },
  });

  const [dateRange, setDateRange] = useState({
    start: '',
    end: '',
  });

  const fetchTemplates = useCallback(async () => {
    try {
      const templates = await exportService.getTemplates(format);
      setTemplates(templates);
      
      const defaultTemplate = templates.find(
        (t: ExportTemplate) => t.is_default && t.format === format
      );
      if (defaultTemplate) {
        setSelectedTemplate(defaultTemplate.id);
        setConfiguration(defaultTemplate.configuration);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des templates:', error);
    }
  }, [format]);

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen, fetchTemplates]);

  const handleTemplateChange = (templateId: number | null) => {
    if (!templateId) {
      setSelectedTemplate(null);
      setUseCustom(true);
      return;
    }
    setSelectedTemplate(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setConfiguration(template.configuration);
      setUseCustom(false);
    }
  };

  const handleDeleteTemplateClick = () => {
    if (isLoading || isDeletingTemplate || !selectedTemplate) {
      return;
    }
    setTemplateToDelete(selectedTemplate);
    setShowDeleteTemplateModal(true);
  };

  const confirmDeleteTemplate = async () => {
    if (!templateToDelete) return;

    setIsDeletingTemplate(true);
    try {
      await exportService.deleteTemplate(templateToDelete);

      if (selectedTemplate === templateToDelete) {
        setSelectedTemplate(null);
        setUseCustom(true);
      }

      await fetchTemplates();
      setShowDeleteTemplateModal(false);
      setTemplateToDelete(null);
    } catch (error) {
      console.error('Erreur lors de la suppression du template:', error);
      setShowDeleteTemplateModal(false);
      setTemplateToDelete(null);
      setTemplateFeedback({
        isOpen: true,
        title: t('common:error', { defaultValue: 'Erreur' }),
        message: (
          <p className="text-gray-600 dark:text-gray-400">
            {t('statistics:exportModal.modelDeleteError', { defaultValue: 'Erreur lors de la suppression du modèle.' })}
          </p>
        ),
      });
    } finally {
      setIsDeletingTemplate(false);
    }
  };

  const handleSectionToggle = (section: string, value?: any) => {
    setUseCustom(true);
    setConfiguration((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        [section]: value !== undefined ? value : !prev.sections[section as keyof typeof prev.sections],
      },
    }));
  };

  const handleExport = async () => {
    setIsLoading(true);
    try {
      const selectedLang = (i18n.language || '')?.split('-')[0];
      const supportedLangs = ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'ko', 'zh'];
      const resolvedLanguage = supportedLangs.includes(selectedLang) ? selectedLang : preferences?.language || 'fr';

      const payload: any = {
        trading_account_id: tradingAccountId,
        format,
        language: resolvedLanguage,
      };

      if (useCustom || !selectedTemplate) {
        payload.configuration = configuration;
      } else {
        payload.template_id = selectedTemplate;
      }

      if (dateRange.start) {
        payload.start_date = new Date(dateRange.start).toISOString();
      }
      if (dateRange.end) {
        payload.end_date = new Date(dateRange.end).toISOString();
      }

      const blob = await exportService.generateExport(payload);

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const extension = format === 'pdf' ? 'pdf' : 'xlsx';
      const reportFilePrefix = t('statistics:exportModal.reportFilePrefix', { defaultValue: 'rapport' });
      link.setAttribute('download', `${reportFilePrefix}_${tradingAccountName}_${new Date().toISOString().split('T')[0]}.${extension}`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      onClose();
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      setTemplateFeedback({
        isOpen: true,
        title: t('common:error', { defaultValue: 'Erreur' }),
        message: (
          <p className="text-gray-600 dark:text-gray-400">
            {t('statistics:exportModal.exportErrorMessage', {
              defaultValue: "Une erreur est survenue lors de l'export. Veuillez réessayer.",
            })}
          </p>
        ),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportClick = () => {
    if (!isLoading) {
      setShowExportConfirm(true);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      setTemplateFeedback({
        isOpen: true,
        title: t('statistics:exportModal.modelNameRequiredTitle', { defaultValue: 'Nom requis' }),
        message: (
          <p className="text-gray-600 dark:text-gray-400">
            {t('statistics:exportModal.modelNameRequiredMessage', { defaultValue: 'Veuillez entrer un nom pour le modèle.' })}
          </p>
        ),
      });
      return;
    }

    try {
      await exportService.createTemplate({
        name: templateName,
        format,
        configuration,
        is_default: false,
      });

      setTemplateFeedback({
        isOpen: true,
        title: t('common:success', { defaultValue: 'Succès' }),
        message: (
          <p className="text-gray-600 dark:text-gray-400">
            {t('statistics:exportModal.modelSavedSuccess', { defaultValue: 'Modèle sauvegardé avec succès !' })}
          </p>
        ),
      });
      setShowSaveTemplate(false);
      setTemplateName('');
      fetchTemplates();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du template:', error);
      setTemplateFeedback({
        isOpen: true,
        title: t('common:error', { defaultValue: 'Erreur' }),
        message: (
          <p className="text-gray-600 dark:text-gray-400">
            {t('statistics:exportModal.modelSavedError', { defaultValue: 'Erreur lors de la sauvegarde du modèle.' })}
          </p>
        ),
      });
    }
  };

  if (!isOpen) return null;

  const tradesListOptions = [
    { value: 'none', label: t('statistics:exportModal.tradesList.none', { defaultValue: 'Aucun' }) },
    { value: 'top_10_best_worst', label: t('statistics:exportModal.tradesList.top_10_best_worst', { defaultValue: 'Top 10 Meilleurs/Pires' }) },
    { value: 'top_10_best', label: t('statistics:exportModal.tradesList.top_10_best', { defaultValue: 'Top 10 Meilleurs' }) },
    { value: 'top_10_worst', label: t('statistics:exportModal.tradesList.top_10_worst', { defaultValue: 'Top 10 Pires' }) },
    { value: 'all', label: t('statistics:exportModal.tradesList.all', { defaultValue: 'Tous les trades' }) },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-2 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white dark:bg-gray-800 w-full max-w-4xl rounded-xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 sm:px-6 py-3 sm:py-5 border-b border-gray-200 dark:border-gray-700 flex items-start sm:items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-t-xl flex-shrink-0 gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-600 dark:bg-blue-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 truncate">{t('statistics:exportModal.title', { defaultValue: 'Exporter les statistiques' })}</h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">{t('statistics:exportModal.subtitle', { defaultValue: 'Générer un rapport PDF ou Excel' })}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="w-8 h-8 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('statistics:exportModal.tradingAccount', { defaultValue: 'Compte de trading' })}
            </label>
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-md text-gray-900 dark:text-gray-100 font-medium">
              {tradingAccountName}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('statistics:exportModal.exportFormat', { defaultValue: "Format d'export" })}
            </label>
            <div className="flex gap-4">
              <button
                onClick={() => setFormat('pdf')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  format === 'pdf'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-900 dark:text-gray-100'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span className="font-medium">{t('statistics:exportModal.formats.pdf', { defaultValue: 'PDF' })}</span>
              </button>
              <button
                onClick={() => setFormat('excel')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  format === 'excel'
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-900 dark:text-gray-100'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="font-medium">{t('statistics:exportModal.formats.excel', { defaultValue: 'Excel' })}</span>
              </button>
            </div>
          </div>

          {templates.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('statistics:exportModal.presetModel', { defaultValue: 'Modèle pré-configuré' })}
              </label>
              <div className="flex gap-2">
                <CustomSelect
                  value={selectedTemplate}
                  onChange={(value) => handleTemplateChange(value as number | null)}
                  options={[
                    { value: null, label: t('statistics:exportModal.custom', { defaultValue: 'Personnalisé' }) },
                    ...templates.map((template) => ({
                      value: template.id,
                      label: `${template.name}${template.is_default ? ` (${t('common:default', { defaultValue: 'Par défaut' })})` : ''}`,
                    })),
                  ]}
                  disabled={isLoading || isDeletingTemplate}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={handleDeleteTemplateClick}
                  disabled={!selectedTemplate || isLoading || isDeletingTemplate}
                  className="px-3 py-2 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={t('statistics:exportModal.deleteModelAria', { defaultValue: 'Supprimer le modèle sélectionné' })}
                  title={t('common:delete', { defaultValue: 'Supprimer' })}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3m-4 0h14" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('statistics:exportModal.periodOptional', { defaultValue: 'Période (optionnel)' })}
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">{t('statistics:exportModal.startDate', { defaultValue: 'Date de début' })}</label>
                <DateInput
                  value={dateRange.start}
                  onChange={(value) => setDateRange({ ...dateRange, start: value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  max={dateRange.end || undefined}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">{t('statistics:exportModal.endDate', { defaultValue: 'Date de fin' })}</label>
                <DateInput
                  value={dateRange.end}
                  onChange={(value) => setDateRange({ ...dateRange, end: value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  min={dateRange.start || undefined}
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {t('statistics:exportModal.customization', { defaultValue: 'Personnalisation' })}
              </h3>
              {useCustom && (
                <button
                  onClick={() => setShowSaveTemplate(!showSaveTemplate)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  {t('statistics:exportModal.saveAsModel', { defaultValue: 'Sauvegarder comme modèle' })}
                </button>
              )}
            </div>

            {showSaveTemplate && (
              <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('statistics:exportModal.modelNameLabel', { defaultValue: 'Nom du modèle' })}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder={t('statistics:exportModal.modelNamePlaceholder', { defaultValue: 'Mon modèle personnalisé' })}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleSaveTemplate}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {t('common:save', { defaultValue: 'Enregistrer' })}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">{t('statistics:exportModal.tradesListTitle', { defaultValue: 'Liste des trades' })}</h4>
                <CustomSelect
                  value={configuration.sections.trades_list || 'all'}
                  onChange={(value) => handleSectionToggle('trades_list', value as string)}
                  options={tradesListOptions}
                />
              </div>

              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">{t('statistics:exportModal.optionsTitle', { defaultValue: 'Options' })}</h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={configuration.options.watermark}
                      onChange={() =>
                        setConfiguration((prev) => ({
                          ...prev,
                          options: {
                            ...prev.options,
                            watermark: !prev.options.watermark,
                          },
                        }))
                      }
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{t('statistics:exportModal.options.watermark', { defaultValue: 'Inclure un watermark' })}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={configuration.options.page_numbers}
                      onChange={() =>
                        setConfiguration((prev) => ({
                          ...prev,
                          options: {
                            ...prev.options,
                            page_numbers: !prev.options.page_numbers,
                          },
                        }))
                      }
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{t('statistics:exportModal.options.pageNumbers', { defaultValue: 'Numérotation des pages' })}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900/20 border-t border-gray-200 dark:border-gray-700 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-end gap-3 flex-shrink-0 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 sm:px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {t('common:cancel', { defaultValue: 'Annuler' })}
          </button>
          <button
            onClick={handleExportClick}
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{t('statistics:exportModal.generating', { defaultValue: 'Génération...' })}</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>{t('common:export', { defaultValue: 'Exporter' })}</span>
              </>
            )}
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={showExportConfirm}
        onClose={() => setShowExportConfirm(false)}
        onConfirm={async () => {
          await handleExport();
          setShowExportConfirm(false);
        }}
        isLoading={isLoading}
        title={t('statistics:exportModal.confirmExportTitle', { defaultValue: "Confirmer l'export" })}
        message={
          <p className="text-gray-600 dark:text-gray-400">
            {t('statistics:exportModal.confirmExportMessage', {
              defaultValue: 'Voulez-vous générer un rapport {{format}} pour le compte {{account}} ?',
              format: format === 'pdf' ? t('statistics:exportModal.formats.pdf', { defaultValue: 'PDF' }) : t('statistics:exportModal.formats.excel', { defaultValue: 'Excel' }),
              account: tradingAccountName,
            })}
          </p>
        }
        confirmButtonText={t('common:export', { defaultValue: 'Exporter' })}
        cancelButtonText={t('common:cancel', { defaultValue: 'Annuler' })}
      />

      <ConfirmModal
        isOpen={templateFeedback.isOpen}
        onClose={() => setTemplateFeedback((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={() => setTemplateFeedback((prev) => ({ ...prev, isOpen: false }))}
        title={templateFeedback.title}
        message={templateFeedback.message}
        confirmButtonText={t('common:gotIt', { defaultValue: 'OK' })}
        showCancelButton={false}
      />

      <DeleteConfirmModal
        isOpen={showDeleteTemplateModal}
        onClose={() => {
          if (!isDeletingTemplate) {
            setShowDeleteTemplateModal(false);
            setTemplateToDelete(null);
          }
        }}
        onConfirm={confirmDeleteTemplate}
        isLoading={isDeletingTemplate}
        title={t('statistics:exportModal.deleteModelTitle', { defaultValue: 'Supprimer le modèle' })}
        itemName={templates.find((t) => t.id === templateToDelete)?.name}
        confirmButtonText={t('common:delete', { defaultValue: 'Supprimer' })}
        cancelButtonText={t('common:cancel', { defaultValue: 'Annuler' })}
      />
    </div>
  );
};

export default ExportModal;
