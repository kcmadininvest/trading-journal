import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomSelect } from '../common/CustomSelect';
import { formatSessionClockLabel } from '../../utils/dateFormat';
import {
  formatMarketPhaseEventActionPreview,
  formatMarketPhaseEventSummary,
  getMarketPhaseEventActionByKey,
  marketPhaseEventActionKey,
  marketPhaseEventKey,
  MARKET_PHASE_EVENT_ACTIONS,
  type MarketPhaseEventAction,
} from '../../utils/marketPhaseEventDisplay';
import type { MarketPhaseEvent } from '../../services/marketPhases';

export interface MarketPhaseEventButtonsProps {
  onRecord: (action: MarketPhaseEventAction, occurredAt?: string) => void;
  occurredAt: string;
  mode: 'live' | 'replay';
  lastRecordedEvent?: MarketPhaseEvent | null;
  className?: string;
}

export const MarketPhaseEventButtons: React.FC<MarketPhaseEventButtonsProps> = ({
  onRecord,
  occurredAt,
  mode,
  lastRecordedEvent,
  className = '',
}) => {
  const { t } = useTranslation('marketPhases');
  const [selectedActionKey, setSelectedActionKey] = useState('');

  const eventOptions = useMemo(
    () => [
      { value: '', label: t('events.selectEvent', { defaultValue: 'Choisir un événement' }) },
      ...MARKET_PHASE_EVENT_ACTIONS.map((action) => ({
        value: marketPhaseEventActionKey(action),
        label: formatMarketPhaseEventActionPreview(t, action),
      })),
    ],
    [t],
  );

  const feedback = useMemo(() => {
    if (!lastRecordedEvent) return null;
    return t('events.savedFeedback', {
      time: formatSessionClockLabel(lastRecordedEvent.occurred_at),
      summary: formatMarketPhaseEventSummary(t, lastRecordedEvent),
    });
  }, [lastRecordedEvent, t]);

  const handleEventSelect = (value: string | number | null) => {
    const key = String(value ?? '');
    if (!key) {
      setSelectedActionKey('');
      return;
    }
    const action = getMarketPhaseEventActionByKey(key);
    if (!action) return;
    onRecord(action, mode === 'replay' ? occurredAt : undefined);
    setSelectedActionKey('');
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <CustomSelect
        value={selectedActionKey}
        onChange={handleEventSelect}
        options={eventOptions}
        variant="compact"
        className="!max-w-none w-full min-w-[11rem]"
      />
      {feedback && (
        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400" role="status">
          {feedback}
        </p>
      )}
    </div>
  );
};

export interface MarketPhaseRecordedEventsProps {
  events: MarketPhaseEvent[];
  selectedEventKey?: string | null;
  onSelectEvent?: (event: MarketPhaseEvent) => void;
  onRemoveEvent?: (event: MarketPhaseEvent) => void;
  onSelectTimestamp?: (time: string) => void;
  variant?: 'panel' | 'inline';
  className?: string;
}

export const MarketPhaseRecordedEvents: React.FC<MarketPhaseRecordedEventsProps> = ({
  events,
  selectedEventKey = null,
  onSelectEvent,
  onRemoveEvent,
  onSelectTimestamp,
  variant = 'panel',
  className = '',
}) => {
  const { t } = useTranslation('marketPhases');
  if (events.length === 0) return null;

  const list = (
    <ul className="space-y-1">
      {events.map((ev) => {
        const key = marketPhaseEventKey(ev);
        const selected = selectedEventKey === key;
        return (
          <li
            key={key}
            className={
              selected
                ? 'rounded-md border border-violet-300 bg-violet-100/80 px-2 py-1 dark:border-violet-700 dark:bg-violet-950/40'
                : 'rounded-md px-2 py-1'
            }
          >
            <div className="flex items-start gap-1">
              <button
                type="button"
                className={`min-w-0 flex-1 text-left text-xs hover:underline ${
                  selected
                    ? 'font-medium text-violet-900 dark:text-violet-100'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
                onClick={() => {
                  onSelectEvent?.(ev);
                  onSelectTimestamp?.(ev.occurred_at);
                }}
              >
                <span className="font-medium tabular-nums">{formatSessionClockLabel(ev.occurred_at)}</span>
                {' — '}
                {formatMarketPhaseEventSummary(t, ev)}
              </button>
              {selected && onRemoveEvent && (
                <button
                  type="button"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-sm font-semibold leading-none text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-900/30 dark:hover:text-rose-300"
                  title={t('events.removeEvent')}
                  aria-label={t('events.removeEvent')}
                  onClick={() => onRemoveEvent(ev)}
                >
                  ×
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );

  if (variant === 'inline') {
    return <div className={className}>{list}</div>;
  }

  return (
    <div
      className={`rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900/40 ${className}`}
    >
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t('replay.recordedEvents')}
      </p>
      <p className="mb-2 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
        {t('events.selectHint')}
      </p>
      {list}
    </div>
  );
};
