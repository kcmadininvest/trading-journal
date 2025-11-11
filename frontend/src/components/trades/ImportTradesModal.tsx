import React, { useState, useRef, useMemo } from 'react';
import { tradesService } from '../../services/trades';
import { AccountSelector } from '../accounts/AccountSelector';
import { usePreferences } from '../../hooks/usePreferences';
import { formatCurrencyWithSign, formatNumber } from '../../utils/numberFormat';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { useTradingAccount } from '../../contexts/TradingAccountContext';

interface ImportTradesModalProps {
  open: boolean;
  onClose: (imported?: boolean) => void;
}

type ModalState = 'initial' | 'preview' | 'importing' | 'success';

export const ImportTradesModal: React.FC<ImportTradesModalProps> = ({ open, onClose }) => {
  const { preferences } = usePreferences();
  const { t } = useI18nTranslation();
  const { selectedAccountId } = useTradingAccount();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [accountId, setAccountId] = useState<number | null | undefined>(undefined);
  const [state, setState] = useState<ModalState>('initial');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<{
    success?: boolean;
    total_rows?: number;
    success_count?: number;
    error_count?: number;
    skipped_count?: number;
    total_pnl?: number;
    total_fees?: number;
    errors?: Array<{ row?: number; error: string }>;
    missing_columns?: string[];
  } | null>(null);
  const [importResult, setImportResult] = useState<{
    message?: string;
    total_rows?: number;
    success_count?: number;
    error_count?: number;
    skipped_count?: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showFormatGuide, setShowFormatGuide] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previousFileRef = useRef<File | null>(null);
  const previousAccountRef = useRef<number | null | undefined>(null);

  const CSV_COLUMNS = useMemo(() => [
    { name: 'Id', description: t('trades:importModal.formatGuide.columns.Id.description'), example: '1443101901', required: true },
    { name: 'ContractName', description: t('trades:importModal.formatGuide.columns.ContractName.description'), example: 'NQZ5', required: true },
    { name: 'EnteredAt', description: t('trades:importModal.formatGuide.columns.EnteredAt.description'), example: '10/08/2025 18:23:28 +02:00', required: true },
    { name: 'ExitedAt', description: t('trades:importModal.formatGuide.columns.ExitedAt.description'), example: '10/08/2025 18:31:03 +02:00', required: true },
    { name: 'EntryPrice', description: t('trades:importModal.formatGuide.columns.EntryPrice.description'), example: '25261.750000000', required: true },
    { name: 'ExitPrice', description: t('trades:importModal.formatGuide.columns.ExitPrice.description'), example: '25245.750000000', required: true },
    { name: 'Fees', description: t('trades:importModal.formatGuide.columns.Fees.description'), example: '8.40000', required: true },
    { name: 'PnL', description: t('trades:importModal.formatGuide.columns.PnL.description'), example: '-960.000000000', required: true },
    { name: 'Size', description: t('trades:importModal.formatGuide.columns.Size.description'), example: '3', required: true },
    { name: 'Type', description: t('trades:importModal.formatGuide.columns.Type.description'), example: 'Long', required: true, allowedValues: t('trades:importModal.formatGuide.columns.Type.allowedValues') },
    { name: 'TradeDay', description: t('trades:importModal.formatGuide.columns.TradeDay.description'), example: '10/08/2025 00:00:00 -05:00', required: true },
    { name: 'TradeDuration', description: t('trades:importModal.formatGuide.columns.TradeDuration.description'), example: '00:07:34.9942140', required: true },
    { name: 'Commissions', description: t('trades:importModal.formatGuide.columns.Commissions.description'), example: '0.00', required: false },
  ], [t]);

  // Réinitialiser tous les états quand la modale s'ouvre
  React.useEffect(() => {
    if (open) {
      // Réinitialiser tous les états pour permettre un nouvel import
      setState('initial');
      setSelectedFile(null);
      setError(null);
      setPreviewResult(null);
      setImportResult(null);
      setIsLoading(false);
      setIsDragging(false);
      setShowFormatGuide(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      // Initialiser le compte avec le compte sélectionné dans le contexte
      // Si un compte est sélectionné, l'utiliser, sinon laisser AccountSelector initialiser le compte par défaut
      if (selectedAccountId !== null && selectedAccountId !== undefined) {
        setAccountId(selectedAccountId);
        previousAccountRef.current = selectedAccountId;
      } else {
        // Ne pas définir accountId pour permettre à AccountSelector d'initialiser le compte par défaut
        // On utilise undefined pour que AccountSelector détecte qu'aucune valeur n'a été fournie
        setAccountId(undefined);
        previousAccountRef.current = null;
      }
      // Réinitialiser les références précédentes pour éviter les faux positifs dans le useEffect suivant
      previousFileRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedAccountId]);

  // Réinitialiser l'aperçu si le fichier ou le compte change
  React.useEffect(() => {
    if (
      (selectedFile !== previousFileRef.current || accountId !== previousAccountRef.current) &&
      (previousFileRef.current !== null || (previousAccountRef.current !== null && previousAccountRef.current !== undefined))
    ) {
      // Le fichier ou le compte a changé, réinitialiser l'aperçu
      setState('initial');
      setPreviewResult(null);
      setError(null);
    }
    previousFileRef.current = selectedFile;
    previousAccountRef.current = accountId;
  }, [selectedFile, accountId]);

  const downloadTemplate = () => {
    const headers = CSV_COLUMNS.map(col => col.name).join(',');
    const exampleRow = [
      '1443101901',
      'NQZ5',
      '10/08/2025 18:23:28 +02:00',
      '10/08/2025 18:31:03 +02:00',
      '25261.750000000',
      '25245.750000000',
      '8.40000',
      '-960.000000000',
      '3',
      'Long',
      '10/08/2025 00:00:00 -05:00',
      '00:07:34.9942140',
      ''
    ].join(',');
    
    const csvContent = `${headers}\n${exampleRow}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'template_trades.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!open) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setError(null);
  };

  const handleAccountChange = (id: number | null) => {
    setAccountId(id);
    setError(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const handlePreview = async () => {
    if (!selectedFile) {
      setError(t('trades:importModal.selectFile'));
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setPreviewResult(null);
    
    try {
      const data = await tradesService.uploadCSV(selectedFile, accountId ?? undefined, true); // dry_run = true
      setPreviewResult(data);
      setState('preview');
      
      // Si erreurs bloquantes (colonnes manquantes), rester en état initial
      if (!data.success || (data.missing_columns && data.missing_columns.length > 0)) {
        setState('initial');
      }
    } catch (e: any) {
      setError(e?.message || t('trades:importModal.errorAnalyzing'));
      setState('initial');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setError(t('trades:importModal.selectFile'));
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setState('importing');
    
    try {
      const data = await tradesService.uploadCSV(selectedFile, accountId ?? undefined, false); // dry_run = false
      setImportResult(data);
      setState('success');
      
      // Fermer automatiquement après 2 secondes
      setTimeout(() => {
        onClose(true);
      }, 2000);
    } catch (e: any) {
      setError(e?.message || t('trades:importModal.errorImporting'));
      setState('preview'); // Revenir à l'état aperçu
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const canPreview = selectedFile !== null && !isLoading && state !== 'importing' && state !== 'success';
  const canImport = state === 'preview' && previewResult?.success && 
                    (!previewResult.missing_columns || previewResult.missing_columns.length === 0) &&
                    !isLoading;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-4"
      onClick={() => state !== 'importing' && onClose(false)}
    >
      <div 
        className="bg-white dark:bg-gray-800 w-full max-w-3xl rounded-xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-t-xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 dark:bg-blue-500 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('trades:importModal.title')}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('trades:importModal.format')}</p>
            </div>
          </div>
          <button 
            onClick={() => state !== 'importing' && onClose(false)} 
            disabled={state === 'importing'}
            className="w-8 h-8 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Bandeau de résultats/erreurs (aperçu ou import) */}
        {(state === 'preview' && previewResult) && (
          <div className={`px-6 py-4 border-b flex-shrink-0 ${
            previewResult.success && (!previewResult.missing_columns || previewResult.missing_columns.length === 0)
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
              : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
          }`}>
            <div className="flex items-start gap-3">
              {previewResult.success && (!previewResult.missing_columns || previewResult.missing_columns.length === 0) ? (
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
              <div className="flex-1">
                <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{t('trades:importModal.preview.title')}</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-2">
                  {previewResult.total_rows !== undefined && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('trades:importModal.preview.totalRows')}</div>
                      <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{previewResult.total_rows}</div>
                    </div>
                  )}
                  {previewResult.success_count !== undefined && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-green-200 dark:border-green-800">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('trades:importModal.preview.importable')}</div>
                      <div className="text-lg font-bold text-green-600 dark:text-green-400">{previewResult.success_count}</div>
                    </div>
                  )}
                  {previewResult.error_count !== undefined && previewResult.error_count > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-rose-200 dark:border-rose-800">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('trades:importModal.preview.errors')}</div>
                      <div className="text-lg font-bold text-rose-600 dark:text-rose-400">{previewResult.error_count}</div>
                    </div>
                  )}
                  {previewResult.skipped_count !== undefined && previewResult.skipped_count > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-amber-200 dark:border-amber-800">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('trades:importModal.preview.duplicates')}</div>
                      <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{previewResult.skipped_count}</div>
                    </div>
                  )}
                  {previewResult.total_pnl !== undefined && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-blue-200 dark:border-blue-800">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('trades:importModal.preview.totalPnl')}</div>
                      <div className={`text-lg font-bold ${(previewResult.total_pnl ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {formatCurrencyWithSign(previewResult.total_pnl, '', preferences.number_format, 2)}
                      </div>
                    </div>
                  )}
                  {previewResult.total_fees !== undefined && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-purple-200 dark:border-purple-800">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('trades:importModal.preview.totalFees')}</div>
                      <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                        {formatNumber(previewResult.total_fees, 2, preferences.number_format)}
                      </div>
                    </div>
                  )}
                </div>
                {previewResult.missing_columns && previewResult.missing_columns.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-amber-300 dark:border-amber-700">
                    <div className="font-medium text-amber-900 dark:text-amber-300 mb-1">{t('trades:importModal.preview.missingColumns')}</div>
                    <div className="flex flex-wrap gap-2">
                      {previewResult.missing_columns.map((col, idx) => (
                        <span key={idx} className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs rounded font-mono">
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bandeau de succès (après import) */}
        {state === 'success' && importResult && (
          <div className="px-6 py-4 border-b bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 flex-shrink-0">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="font-semibold text-green-900 dark:text-green-300 mb-2">{importResult.message || t('trades:importModal.success.message')}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {importResult.total_rows !== undefined && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('trades:importModal.preview.totalRows')}</div>
                      <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{importResult.total_rows}</div>
                    </div>
                  )}
                  {importResult.success_count !== undefined && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-green-200 dark:border-green-800">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('trades:importModal.success.imported')}</div>
                      <div className="text-lg font-bold text-green-600 dark:text-green-400">{importResult.success_count}</div>
                    </div>
                  )}
                  {importResult.error_count !== undefined && importResult.error_count > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-rose-200 dark:border-rose-800">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('trades:importModal.preview.errors')}</div>
                      <div className="text-lg font-bold text-rose-600 dark:text-rose-400">{importResult.error_count}</div>
                    </div>
                  )}
                  {importResult.skipped_count !== undefined && importResult.skipped_count > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-amber-200 dark:border-amber-800">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('trades:importModal.success.skipped')}</div>
                      <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{importResult.skipped_count}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content - Scrollable */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Account Selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t('trades:importModal.tradingAccount')}
            </label>
            <AccountSelector value={accountId} onChange={handleAccountChange} hideLabel />
          </div>

          {/* File Upload Area */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t('trades:importModal.csvFile')}
            </label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-xl p-8 transition-all ${
                isDragging
                  ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : selectedFile
                  ? 'border-green-400 dark:border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                disabled={state === 'importing'}
              />
              <div className="text-center">
                {selectedFile ? (
                  <div className="space-y-3">
                    <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                      <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{formatFileSize(selectedFile.size)}</p>
                    </div>
                    {state !== 'importing' && state !== 'success' && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                      >
                        {t('trades:importModal.changeFile')}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto">
                      <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {t('trades:importModal.dragDrop')}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('trades:importModal.or')}</p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={state === 'importing'}
                        className="mt-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium text-sm disabled:opacity-50"
                      >
                        {t('trades:importModal.browseFiles')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('trades:importModal.fileFormatRequired')}
              </p>
              <button
                onClick={() => setShowFormatGuide(!showFormatGuide)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center gap-1"
              >
                {showFormatGuide ? t('trades:importModal.hideFormatGuide') : t('trades:importModal.showFormatGuide')}
                <svg className={`w-4 h-4 transition-transform ${showFormatGuide ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Format Guide Section */}
          {showFormatGuide && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {t('trades:importModal.formatGuide.title')}
                  </h3>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <p>{t('trades:importModal.formatGuide.separator')} <span className="font-mono font-semibold bg-white dark:bg-gray-800 px-2 py-0.5 rounded border dark:border-gray-700">,</span> {t('trades:importModal.formatGuide.separatorNote')}</p>
                    <p>{t('trades:importModal.formatGuide.encoding')} <span className="font-mono font-semibold bg-white dark:bg-gray-800 px-2 py-0.5 rounded border dark:border-gray-700">UTF-8</span> {t('trades:importModal.formatGuide.encodingNote')}</p>
                  </div>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="px-3 py-1.5 bg-blue-600 dark:bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {t('trades:importModal.formatGuide.downloadTemplate')}
                </button>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800 overflow-hidden">
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600">{t('trades:importModal.formatGuide.column')}</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600">{t('trades:importModal.formatGuide.description')}</th>
                        <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600">{t('trades:importModal.formatGuide.example')}</th>
                        <th className="px-4 py-2 text-center font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600">{t('trades:importModal.formatGuide.required')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {CSV_COLUMNS.map((col, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-2.5 font-mono font-medium text-gray-900 dark:text-gray-100">
                            {col.name}
                          </td>
                          <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                            {col.description}
                            {col.allowedValues && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 block mt-1">{t('trades:importModal.formatGuide.values')} {col.allowedValues}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-800 dark:text-gray-200 break-all">
                              {col.example}
                            </code>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {col.required ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                                {t('trades:importModal.formatGuide.yes')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                                {t('trades:importModal.formatGuide.optional')}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800 p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h2m0 0h2m-2 0v2m0-4V9m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">{t('trades:importModal.formatGuide.fullLineExample')}</p>
                    <div className="bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded overflow-x-auto max-w-full">
                      <code className="text-xs text-gray-800 dark:text-gray-200 whitespace-nowrap block">
                        <div>Id,ContractName,EnteredAt,ExitedAt,EntryPrice,ExitPrice,Fees,PnL,Size,Type,TradeDay,TradeDuration,Commissions</div>
                        <div className="mt-1">1443101901,NQZ5,10/08/2025 18:23:28 +02:00,10/08/2025 18:31:03 +02:00,25261.750000000,25245.750000000,8.40000,-960.000000000,3,Long,10/08/2025 00:00:00 -05:00,00:07:34.9942140,</div>
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="rounded-lg border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="font-medium text-rose-900 dark:text-rose-300">{t('trades:importModal.error')}</p>
                <p className="text-sm text-rose-700 dark:text-rose-400 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Détails des erreurs (si aperçu) */}
          {state === 'preview' && previewResult && Array.isArray(previewResult.errors) && previewResult.errors.length > 0 && (
            <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
              <div className="font-medium text-gray-900 dark:text-gray-100 mb-2">{t('trades:importModal.preview.detailedErrors')}</div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {previewResult.errors.slice(0, 10).map((er, idx) => (
                  <div key={idx} className="text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 rounded p-2 border border-gray-200 dark:border-gray-700">
                    {er.row && <span className="font-mono font-medium">{t('trades:importModal.preview.line')} {er.row}: </span>}
                    {er.error}
                  </div>
                ))}
                {previewResult.errors.length > 10 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                    {t('trades:importModal.preview.andMoreErrors', { count: previewResult.errors.length - 10 })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 rounded-b-xl flex items-center justify-between flex-wrap gap-3 flex-shrink-0">
          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
              setSelectedFile(null);
              setError(null);
              setPreviewResult(null);
              setImportResult(null);
              setState('initial');
              onClose(false);
            }}
            disabled={state === 'importing'}
            className="px-4 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 font-medium transition-colors disabled:opacity-50"
          >
            {t('trades:importModal.cancel')}
          </button>
          <div className="flex items-center gap-3">
            {state === 'initial' && (
              <button
                onClick={handlePreview}
                disabled={!canPreview || isLoading}
                className="px-6 py-2 rounded-lg bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('trades:importModal.analyzing')}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {t('trades:importModal.previewButton')}
                  </>
                )}
              </button>
            )}
            {state === 'preview' && (
              <button
                onClick={handleImport}
                disabled={!canImport || isLoading}
                className="px-6 py-2 rounded-lg bg-green-600 dark:bg-green-500 text-white hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('trades:importModal.importing')}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" />
                    </svg>
                    {t('trades:importModal.importButton')}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
