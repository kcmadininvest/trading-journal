import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SessionEventItem } from '../../services/sessionReplay';
import { formatCurrencyWithSign } from '../../utils/numberFormat';
import { usePreferences } from '../../hooks/usePreferences';
import { getReplayPnlTextClass } from './replayStyles';

interface SessionStatePanelProps {
  events: SessionEventItem[];
  currentIndex: number;
}

function cumulativePnlAtIndex(events: SessionEventItem[], currentIndex: number): number {
  const slice = events.slice(0, currentIndex + 1);
  for (let i = slice.length - 1; i >= 0; i--) {
    const evt = slice[i];
    if (evt.event_type !== 'pnl_tick') continue;
    const raw = evt.payload?.cumulative_pnl;
    if (raw != null) {
      const value = Number(raw);
      return Number.isFinite(value) ? value : 0;
    }
  }
  return 0;
}

function openPositionsAtIndex(events: SessionEventItem[], currentIndex: number) {
  const positions: Record<string, { side: string; size: string; contract: string }> = {};
  const slice = events.slice(0, currentIndex + 1);

  for (const evt of slice) {
    if (evt.event_type === 'position_open') {
      const c = String(evt.payload?.contract_name || 'unknown');
      positions[c] = {
        contract: c,
        side: String(evt.payload?.trade_type || ''),
        size: String(evt.payload?.size || ''),
      };
    }
    if (evt.event_type === 'position_close') {
      delete positions[String(evt.payload?.contract_name || 'unknown')];
    }
  }

  return Object.values(positions);
}

export const SessionStatePanel: React.FC<SessionStatePanelProps> = ({ events, currentIndex }) => {
  const { t } = useTranslation('replay');
  const { preferences } = usePreferences();

  const state = useMemo(
    () => ({
      cumulativePnl: cumulativePnlAtIndex(events, currentIndex),
      positions: openPositionsAtIndex(events, currentIndex),
    }),
    [events, currentIndex],
  );

  return (
    <div className="space-y-4 h-full">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('stateAtTime')}</h3>
      <div className="bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 p-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('cumulativePnl')}</p>
        <p className={`text-2xl font-bold ${getReplayPnlTextClass(state.cumulativePnl)}`}>
          {formatCurrencyWithSign(
            state.cumulativePnl,
            '',
            preferences.number_format,
            2,
          )}
        </p>
      </div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('openPositions')}</p>
        {state.positions.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('flat')}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {state.positions.map((p) => (
              <li
                key={p.contract}
                className="text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 rounded px-2 py-1 border border-gray-100 dark:border-gray-700"
              >
                {p.contract} — {p.side} ×{p.size}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
