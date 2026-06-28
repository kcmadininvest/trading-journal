import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePreferences } from '../../hooks/usePreferences';
import { tradeStrategiesService, TradeStrategy } from '../../services/tradeStrategies';
import { formatCurrencyWithSign, formatNumber as formatNumberUtil } from '../../utils/numberFormat';
import { formatDate, formatTime } from '../../utils/dateFormat';
import {
  mergeDrillDownQuery,
  type StrategyDrillDownRequest,
  type StrategyPeriodContext,
} from '../../utils/strategyDrillDown';
import { parsePnlDisplayMode, getTradeDisplayPnlValue } from '../../utils/pnlDisplay';

interface StrategyDrillDownModalProps {
  open: boolean;
  request: StrategyDrillDownRequest | null;
  period: StrategyPeriodContext;
  onClose: () => void;
  onOpenCompliance?: (date: string) => void;
}

export const StrategyDrillDownModal: React.FC<StrategyDrillDownModalProps> = ({
  open,
  request,
  period,
  onClose,
  onOpenCompliance,
}) => {
  const { t } = useTranslation();
  const { preferences } = usePreferences();
  const pnlMode = parsePnlDisplayMode(preferences.pnl_display);
  const [items, setItems] = useState<TradeStrategy[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!request) return;
    setIsLoading(true);
    setError(null);
    try {
      const params = mergeDrillDownQuery(period, request.filters);
      const response = await tradeStrategiesService.listFiltered(params);
      const sorted = [...response.results].sort((a, b) => {
        const dayA = a.trade_info.trade_day ?? a.trade_info.entered_at;
        const dayB = b.trade_info.trade_day ?? b.trade_info.entered_at;
        return new Date(dayA).getTime() - new Date(dayB).getTime();
      });
      setItems(sorted);
      setTotal(response.count);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t('strategies:drillDown.errorLoading');
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [period, request, t]);

  useEffect(() => {
    if (open && request) {
      void load();
    } else {
      setItems([]);
      setTotal(0);
      setError(null);
    }
  }, [open, request, load]);

  if (!open || !request) return null;

  const formatPnl = (strategy: TradeStrategy) => {
    const raw = getTradeDisplayPnlValue(
      { pnl: strategy.trade_info.net_pnl, net_pnl: strategy.trade_info.net_pnl },
      pnlMode
    );
    if (raw == null) return '—';
    return formatCurrencyWithSign(raw, '', preferences.number_format, 2);
  };

  const respectLabel = (respected: boolean | null) => {
    if (respected === true) return t('strategies:respected');
    if (respected === false) return t('strategies:notRespected');
    return t('strategies:drillDown.notEvaluated');
  };

  const respectClass = (respected: boolean | null) => {
    if (respected === true) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
    if (respected === false) return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300';
    return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white dark:bg-gray-800 w-full max-w-3xl rounded-xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{request.title}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('strategies:drillDown.count', {
                formatted: formatNumberUtil(total, 0, preferences.number_format),
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center"
            aria-label={t('common:close')}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : error ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-center text-gray-500 dark:text-gray-400 py-8">
              {t('strategies:drillDown.empty')}
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((strategy) => {
                const tradeDay = strategy.trade_info.trade_day;
                const enteredAt = strategy.trade_info.entered_at;
                const dateLabel = tradeDay
                  ? formatDate(`${tradeDay}T12:00:00`, preferences.date_format, false, preferences.timezone)
                  : formatDate(enteredAt, preferences.date_format, false, preferences.timezone);
                const timeLabel = formatTime(enteredAt, preferences.timezone, preferences.language);

                return (
                  <li
                    key={strategy.id}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2.5 sm:px-4 sm:py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                          #{strategy.trade_info.topstep_id}{' '}
                          <span className="text-gray-500 dark:text-gray-400 font-normal">
                            {strategy.trade_info.contract_name} · {strategy.trade_info.trade_type}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {dateLabel} · {timeLabel}
                        </div>
                        {strategy.emotions_display && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {strategy.emotions_display}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                          {formatPnl(strategy)}
                        </span>
                        <span
                          className={`text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded-full ${respectClass(strategy.strategy_respected)}`}
                        >
                          {respectLabel(strategy.strategy_respected)}
                        </span>
                      </div>
                    </div>
                    {tradeDay && onOpenCompliance && (
                      <button
                        type="button"
                        onClick={() => onOpenCompliance(tradeDay)}
                        className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {t('strategies:drillDown.openCompliance')}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
