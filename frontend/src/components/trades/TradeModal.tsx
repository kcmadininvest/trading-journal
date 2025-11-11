import React, { useEffect, useState } from 'react';
import { TradeDetail, tradesService } from '../../services/trades';
import { usePreferences } from '../../hooks/usePreferences';
import { formatDateTimeShort } from '../../utils/dateFormat';
import { useTranslation as useI18nTranslation } from 'react-i18next';

interface TradeModalProps {
  tradeId: number | null;
  onClose: (changed?: boolean) => void;
}

export const TradeModal: React.FC<TradeModalProps> = ({ tradeId, onClose }) => {
  const { preferences } = usePreferences();
  const { t } = useI18nTranslation();
  const [trade, setTrade] = useState<TradeDetail | null>(null);
  const [notes, setNotes] = useState('');
  const [strategy, setStrategy] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const draftKey = tradeId ? `trade-draft-${tradeId}` : '';

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!tradeId) return;
      const currentDraftKey = `trade-draft-${tradeId}`;
      setIsLoading(true);
      try {
        const data = await tradesService.retrieve(tradeId);
        if (!mounted) return;
        setTrade(data);
        setNotes(data.notes || '');
        setStrategy(data.strategy || '');
        // restore draft if any
        const draft = localStorage.getItem(currentDraftKey);
        if (draft) {
          const parsed = JSON.parse(draft);
          if (parsed.notes !== undefined) setNotes(parsed.notes);
          if (parsed.strategy !== undefined) setStrategy(parsed.strategy);
        }
      } finally {
        setIsLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [tradeId]);

  useEffect(() => {
    if (!draftKey) return;
    const payload = JSON.stringify({ notes, strategy });
    localStorage.setItem(draftKey, payload);
  }, [notes, strategy, draftKey]);

  const save = async () => {
    if (!trade) return;
    setIsSaving(true);
    try {
      await tradesService.update(trade.id, { notes, strategy });
      if (draftKey) localStorage.removeItem(draftKey);
      onClose(true);
    } catch {
      // no-op minimal
    } finally {
      setIsSaving(false);
    }
  };

  if (!tradeId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-2 sm:p-4">
      <div className="bg-white dark:bg-gray-800 w-full max-w-xl rounded-xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="px-3 sm:px-6 py-3 sm:py-5 border-b border-gray-200 dark:border-gray-700 flex items-start sm:items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-t-xl flex-shrink-0 gap-3">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 truncate flex-1 min-w-0">{t('trades:modal.editTitle')}</h2>
          <button 
            onClick={() => onClose(false)} 
            className="w-8 h-8 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
          {isLoading || !trade ? (
            <div className="text-sm sm:text-base text-gray-500 dark:text-gray-400 text-center py-4">{t('trades:loading')}</div>
          ) : (
            <>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-words">
                {trade.contract_name} • {formatDateTimeShort(trade.entered_at, preferences.date_format, preferences.timezone)} • {trade.trade_type}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('trades:modal.strategy')}</label>
                <input
                  type="text"
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('trades:modal.notes')}</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                />
              </div>
            </>
          )}
        </div>
        <div className="px-3 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3 flex-shrink-0 bg-gray-50 dark:bg-gray-900/50 rounded-b-xl">
          <button 
            onClick={() => onClose(false)} 
            className="px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 w-full sm:w-auto"
          >
            {t('trades:modal.cancel')}
          </button>
          <button 
            onClick={save} 
            disabled={isSaving} 
            className="px-3 sm:px-4 py-2 text-sm sm:text-base rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 w-full sm:w-auto"
          >
            {t('trades:modal.save')}
          </button>
        </div>
      </div>
    </div>
  );
};


