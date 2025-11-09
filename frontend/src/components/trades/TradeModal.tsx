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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white w-full max-w-xl rounded-lg shadow">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">{t('trades:modal.editTitle')}</h2>
          <button onClick={() => onClose(false)} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        <div className="p-4 space-y-4">
          {isLoading || !trade ? (
            <div className="text-gray-500">{t('trades:loading')}</div>
          ) : (
            <>
              <div className="text-sm text-gray-600">
                {trade.contract_name} • {formatDateTimeShort(trade.entered_at, preferences.date_format, preferences.timezone)} • {trade.trade_type}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('trades:modal.strategy')}</label>
                <input
                  type="text"
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  className="w-full border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('trades:modal.notes')}</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={6}
                  className="w-full border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}
        </div>
        <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
          <button onClick={() => onClose(false)} className="px-3 py-2 rounded bg-gray-100">{t('trades:modal.cancel')}</button>
          <button onClick={save} disabled={isSaving} className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50">{t('trades:modal.save')}</button>
        </div>
      </div>
    </div>
  );
};


