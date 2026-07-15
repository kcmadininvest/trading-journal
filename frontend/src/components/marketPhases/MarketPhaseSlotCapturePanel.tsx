import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomSelect } from '../common/CustomSelect';
import {
  SessionClockInput,
  MARKET_PHASE_PERIOD_FORM_GRID_CLASS,
  MARKET_PHASE_FORM_LABEL_CLASS,
  MARKET_PHASE_FORM_CONTROL_CLASS,
  MARKET_PHASE_FORM_CLOCK_CLASS,
  MARKET_PHASE_FORM_BUTTON_CLASS,
} from '../common/SessionClockInput';
import { nowTimeInTz, useMarketPhaseCapture } from '../../hooks/useMarketPhaseCapture';
import { usePreferences } from '../../hooks/usePreferences';
import { MarketPhaseEventButtons } from './MarketPhaseEventButtons';
import { MarketPhaseBlock, MarketPhaseEvent } from '../../services/marketPhases';
import {
  AnalyticalPeriod,
  blockMatchesSlot,
  createEmptySlotDraft,
  eventInPeriod,
  generateFixedSlots,
  generateHourlyPeriods,
  getReplayCaptureSlots,
  normalizeSlotPeriod,
  slotMidpoint,
  sortSlotsByStart,
} from '../../utils/marketPhaseSlots';

function eventsForSlot(slot: AnalyticalPeriod, allEvents: MarketPhaseEvent[]): MarketPhaseEvent[] {
  return allEvents
    .filter((ev) => eventInPeriod(ev.occurred_at, slot.start, slot.end))
    .sort((a, b) => (a.occurred_at || '').localeCompare(b.occurred_at || ''));
}

export interface MarketPhaseSlotCapturePanelProps {
  tradingAccountId?: number;
  sessionDate?: string;
  instrumentKey?: string;
  tradingSessionId?: number;
  onSelectTimestamp?: (time: string) => void;
  className?: string;
}

function sessionSlotsStorageKey(accountId: number, date: string): string {
  return `replay-slots-${accountId}-${date}`;
}

export const MarketPhaseSlotCapturePanel: React.FC<MarketPhaseSlotCapturePanelProps> = ({
  tradingAccountId,
  sessionDate,
  instrumentKey,
  tradingSessionId,
  onSelectTimestamp,
  className = '',
}) => {
  const { t } = useTranslation(['marketPhases', 'common']);
  const { preferences } = usePreferences();
  const capture = useMarketPhaseCapture({
    tradingAccountId,
    sessionDate,
    instrumentKey,
    source: 'replay',
    tradingSessionId,
  });

  const [sessionSlotOverrides, setSessionSlotOverrides] = useState<AnalyticalPeriod[] | null | undefined>(undefined);
  const [newSlotDraft, setNewSlotDraft] = useState(() =>
    createEmptySlotDraft(nowTimeInTz(preferences.timezone)),
  );
  const [slotFormError, setSlotFormError] = useState<string | null>(null);

  const instrumentOptions = useMemo(
    () => capture.instruments.map((i) => ({ value: i.key, label: i.label })),
    [capture.instruments],
  );

  const phaseOptions = useMemo(
    () => [
      { value: '', label: t('replay.emptySlot') },
      ...capture.phases.map((p) => ({ value: p.code, label: p.label })),
    ],
    [capture.phases, t],
  );

  const contextOptions = useMemo(
    () =>
      Object.entries(t('contextOptions', { returnObjects: true }) as Record<string, string>).map(
        ([value, label]) => ({ value, label }),
      ),
    [t],
  );

  const slots = useMemo(
    () => getReplayCaptureSlots(sessionSlotOverrides),
    [sessionSlotOverrides],
  );

  const quickFillOptions = useMemo(
    () => [
      { value: 'market_30', label: t('replay.quickFill.market30') },
      { value: 'market_60', label: t('replay.quickFill.market60') },
      { value: 'hourly', label: t('replay.quickFill.hourly') },
    ],
    [t],
  );

  useEffect(() => {
    if (!tradingAccountId || !sessionDate) return;
    try {
      const raw = sessionStorage.getItem(sessionSlotsStorageKey(tradingAccountId, sessionDate));
      if (raw === null) {
        setSessionSlotOverrides(null);
        return;
      }
      setSessionSlotOverrides(JSON.parse(raw) as AnalyticalPeriod[]);
    } catch {
      setSessionSlotOverrides(null);
    }
  }, [tradingAccountId, sessionDate]);

  const persistSessionSlots = useCallback(
    (periods: AnalyticalPeriod[] | null) => {
      if (!tradingAccountId || !sessionDate) return;
      if (periods === null) {
        sessionStorage.removeItem(sessionSlotsStorageKey(tradingAccountId, sessionDate));
      } else {
        sessionStorage.setItem(sessionSlotsStorageKey(tradingAccountId, sessionDate), JSON.stringify(periods));
      }
      setSessionSlotOverrides(periods);
    },
    [tradingAccountId, sessionDate],
  );

  const getBlockForSlot = useCallback(
    (slot: AnalyticalPeriod) => capture.blocks.find((b) => blockMatchesSlot(b, slot)),
    [capture.blocks],
  );

  const handleSlotPhaseChange = useCallback(
    (slot: AnalyticalPeriod, phaseCode: string) => {
      const others = capture.blocks.filter((b) => !blockMatchesSlot(b, slot));
      const eventsOutsideSlot = capture.allEvents.filter(
        (ev) => !eventInPeriod(ev.occurred_at, slot.start, slot.end),
      );
      if (!phaseCode) {
        capture.setBlocksAndPersist(others, eventsOutsideSlot);
        return;
      }
      const existing = getBlockForSlot(slot);
      const updated: MarketPhaseBlock = {
        ...existing,
        instrument_key: capture.instrumentKey,
        range_start: slot.start,
        range_end: slot.end,
        phase_code: phaseCode,
        preceding_context: existing?.preceding_context || 'none',
        source: 'replay',
      };
      capture.setBlocksAndPersist([...others, updated], capture.allEvents);
    },
    [capture, getBlockForSlot],
  );

  const handleSlotContextChange = useCallback(
    (slot: AnalyticalPeriod, context: string) => {
      const block = getBlockForSlot(slot);
      if (!block) return;
      const others = capture.blocks.filter((b) => !blockMatchesSlot(b, slot));
      capture.setBlocksAndPersist([...others, { ...block, preceding_context: context }]);
    },
    [capture, getBlockForSlot],
  );

  const handleAddSlot = useCallback(() => {
    const normalized = normalizeSlotPeriod(newSlotDraft);
    if (!normalized) {
      setSlotFormError(t('replay.invalidSlotTimes'));
      return;
    }
    if (slots.some((slot) => slot.key === normalized.key)) {
      setSlotFormError(t('replay.duplicateSlot'));
      return;
    }
    const base = slots;
    persistSessionSlots(sortSlotsByStart([...base, normalized]));
    setNewSlotDraft({
      label: '',
      start: normalized.end,
      end: '',
    });
    setSlotFormError(null);
  }, [newSlotDraft, persistSessionSlots, slots, t]);

  const handleStartChange = useCallback((start: string) => {
    setNewSlotDraft((draft) => ({ ...draft, start }));
  }, []);

  const handleRemoveSlot = useCallback(
    (slot: AnalyticalPeriod) => {
      const next = slots.filter((item) => item.key !== slot.key);
      persistSessionSlots(next);
      const others = capture.blocks.filter((b) => !blockMatchesSlot(b, slot));
      const eventsOutsideSlot = capture.allEvents.filter(
        (ev) => !eventInPeriod(ev.occurred_at, slot.start, slot.end),
      );
      if (others.length !== capture.blocks.length || eventsOutsideSlot.length !== capture.allEvents.length) {
        capture.setBlocksAndPersist(others, eventsOutsideSlot);
      }
    },
    [capture, persistSessionSlots, slots],
  );

  const handleQuickFill = useCallback(
    (mode: string) => {
      let generated: AnalyticalPeriod[] = [];
      if (mode === 'market_30') {
        generated = generateFixedSlots(30, '09:30', '16:00');
      } else if (mode === 'market_60') {
        generated = generateFixedSlots(60, '09:30', '16:00');
      } else if (mode === 'hourly') {
        generated = generateHourlyPeriods();
      }
      persistSessionSlots(sortSlotsByStart(generated));
      setSlotFormError(null);
    },
    [persistSessionSlots],
  );

  const handleClearSessionSlots = useCallback(() => {
    persistSessionSlots([]);
    setNewSlotDraft(createEmptySlotDraft(nowTimeInTz(preferences.timezone)));
  }, [persistSessionSlots, preferences.timezone]);

  if (!tradingAccountId) return null;

  return (
    <div className={`${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('replay.slotsTitle')}</h3>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-500">
            {capture.saveState === 'saving' && t('saving')}
            {capture.saveState === 'saved' && t('saved')}
          </span>
          <button
            type="button"
            className="text-sky-600 hover:underline dark:text-sky-400"
            onClick={() => {
              window.location.hash = 'analytics';
              localStorage.setItem('analytics-active-tab', 'marketPhases');
            }}
          >
            {t('viewStats')}
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="shrink-0 text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('instrument')}
        </label>
        <div className="min-w-[10rem]">
          <CustomSelect
            value={capture.instrumentKey}
            onChange={(value) => capture.setInstrumentKey(String(value ?? 'nasdaq'))}
            options={instrumentOptions}
            variant="compact"
          />
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
        <p className="mb-3 text-xs text-gray-600 dark:text-gray-400">{t('replay.addSlotHint')}</p>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
            {t('replay.quickFill.label')}
          </span>
          {quickFillOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700 transition-colors hover:border-sky-300 hover:text-sky-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-sky-500 dark:hover:text-sky-300"
              onClick={() => handleQuickFill(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className={MARKET_PHASE_PERIOD_FORM_GRID_CLASS}>
          <div className="min-w-0">
            <label className={MARKET_PHASE_FORM_LABEL_CLASS}>
              {t('settings.periodLabel')}
            </label>
            <input
              className={MARKET_PHASE_FORM_CONTROL_CLASS}
              value={newSlotDraft.label}
              onChange={(e) => setNewSlotDraft({ ...newSlotDraft, label: e.target.value })}
              placeholder={t('replay.optionalLabel')}
            />
          </div>
          <div className="min-w-0">
            <label className={MARKET_PHASE_FORM_LABEL_CLASS}>
              {t('settings.periodStart')}
            </label>
            <SessionClockInput
              value={newSlotDraft.start}
              onChange={handleStartChange}
              className={MARKET_PHASE_FORM_CLOCK_CLASS}
            />
          </div>
          <div className="min-w-0">
            <label className={MARKET_PHASE_FORM_LABEL_CLASS}>
              {t('settings.periodEnd')}
            </label>
            <SessionClockInput
              value={newSlotDraft.end}
              onChange={(end) => setNewSlotDraft({ ...newSlotDraft, end })}
              minTime={newSlotDraft.start || undefined}
              className={MARKET_PHASE_FORM_CLOCK_CLASS}
            />
          </div>
          <div className="min-w-0">
            <label className={`${MARKET_PHASE_FORM_LABEL_CLASS} invisible`} aria-hidden="true">
              .
            </label>
            <button type="button" className={MARKET_PHASE_FORM_BUTTON_CLASS} onClick={handleAddSlot}>
              {t('replay.addSlot')}
            </button>
          </div>
        </div>
        {slotFormError && (
          <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{slotFormError}</p>
        )}
        {slots.length > 0 && (
          <button
            type="button"
            className="mt-2 text-xs text-gray-500 hover:underline dark:text-gray-400"
            onClick={handleClearSessionSlots}
          >
            {t('replay.clearSessionSlots')}
          </button>
        )}
      </div>

      <div className="max-h-[28rem] overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
            <tr className="text-left text-gray-500">
              <th className="px-3 py-2">{t('replay.columnPeriod')}</th>
              <th className="px-3 py-2 min-w-[12rem]">{t('selectPhase')}</th>
              <th className="px-3 py-2 min-w-[14rem]">{t('context')}</th>
              <th className="px-3 py-2 min-w-[11rem]">{t('replay.columnEvents')}</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) => {
              const block = getBlockForSlot(slot);
              const slotEvents = eventsForSlot(slot, capture.allEvents);
              return (
                <tr key={slot.key} className={`border-t border-gray-100 dark:border-gray-800 ${block ? 'bg-violet-50/50 dark:bg-violet-950/20' : ''}`}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button type="button" className="font-medium text-gray-800 hover:underline dark:text-gray-200" onClick={() => onSelectTimestamp?.(slot.start)}>
                        {slot.label || `${slot.start} – ${slot.end}`}
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-base font-semibold leading-none text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-900/30 dark:hover:text-rose-300"
                        title={t('replay.removeSlot')}
                        aria-label={t('replay.removeSlot')}
                        onClick={() => handleRemoveSlot(slot)}
                      >
                        ×
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2 min-w-[12rem]">
                    <CustomSelect
                      value={block?.phase_code || ''}
                      onChange={(value) => handleSlotPhaseChange(slot, String(value ?? ''))}
                      options={phaseOptions}
                      variant="compact"
                      className="!max-w-none w-full min-w-[12rem]"
                    />
                  </td>
                  <td className="px-3 py-2 min-w-[14rem]">
                    <CustomSelect
                      value={block?.preceding_context || 'none'}
                      onChange={(value) => handleSlotContextChange(slot, String(value ?? 'none'))}
                      options={contextOptions}
                      variant="compact"
                      className="!max-w-none w-full min-w-[14rem]"
                      disabled={!block}
                    />
                  </td>
                  <td className="px-3 py-2">
                    {!block ? (
                      <p className="text-xs text-gray-400 dark:text-gray-500">{t('replay.selectPhaseFirst')}</p>
                    ) : (
                      <MarketPhaseEventButtons
                        mode="replay"
                        occurredAt={slotMidpoint(slot)}
                        recordedEvent={slotEvents[0] ?? null}
                        onRemoveEvent={capture.handleRemoveEvent}
                        onSelectTimestamp={onSelectTimestamp}
                        onRecord={(action, at) =>
                          capture.handleQuickEvent(
                            action.code,
                            action.direction,
                            action.candlePart,
                            action.outcome,
                            at,
                          )
                        }
                      />
                    )}
                  </td>
                </tr>
              );
            })}
            {slots.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  {t('replay.noSlotsYet')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MarketPhaseSlotCapturePanel;
