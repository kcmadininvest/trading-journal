import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { MarketPhaseBlock, MarketPhaseEvent, marketPhasesService } from '../../services/marketPhases';
import {
  AnalyticalPeriod,
  blockMatchesSlot,
  createEmptySlotDraft,
  eventInPeriod,
  generateFixedSlots,
  generateHourlyPeriods,
  getReplayCaptureSlots,
  normalizeSlotPeriod,
  pruneCaptureToSlots,
  resolveInheritedContext,
  slotMidpoint,
  sortSlotsByStart,
  updateSlotInList,
} from '../../utils/marketPhaseSlots';
import { nextDistinctEventTime } from '../../utils/marketPhaseEventCapture';
import { marketPhaseEventKey } from '../../utils/marketPhaseEventDisplay';

function sessionSlotsStorageKey(accountId: number, date: string): string {
  return `replay-slots-${accountId}-${date}`;
}

function readLocalSessionSlots(accountId: number, date: string): AnalyticalPeriod[] | null {
  try {
    const raw = sessionStorage.getItem(sessionSlotsStorageKey(accountId, date));
    if (raw === null) return null;
    return JSON.parse(raw) as AnalyticalPeriod[];
  } catch {
    return null;
  }
}

function writeLocalSessionSlots(accountId: number, date: string, periods: AnalyticalPeriod[] | null): void {
  try {
    if (periods === null) {
      sessionStorage.removeItem(sessionSlotsStorageKey(accountId, date));
    } else {
      sessionStorage.setItem(sessionSlotsStorageKey(accountId, date), JSON.stringify(periods));
    }
  } catch {
    // quota / private mode
  }
}

function eventsForSlot(
  slot: AnalyticalPeriod,
  block: MarketPhaseBlock | undefined,
  allEvents: MarketPhaseEvent[],
): MarketPhaseEvent[] {
  if (!block) return [];
  const sortFn = (a: MarketPhaseEvent, b: MarketPhaseEvent) =>
    (a.occurred_at || '').localeCompare(b.occurred_at || '');

  // 1) Events explicitement liés à ce bloc (source de vérité API)
  if (block.id != null) {
    const linked = allEvents.filter((ev) => ev.parent_block === block.id);
    if (linked.length > 0) return linked.sort(sortFn);
  }

  // 2) Events déjà projetés sur le bloc
  if (block.events && block.events.length > 0) {
    return [...block.events].sort(sortFn);
  }

  // 3) Fallback plage horaire (événements locaux sans parent_block)
  return allEvents
    .filter((ev) => {
      if (ev.parent_block != null && block.id != null && ev.parent_block !== block.id) {
        return false;
      }
      return eventInPeriod(ev.occurred_at, slot.start, slot.end);
    })
    .sort(sortFn);
}

export interface MarketPhaseSlotCapturePanelProps {
  tradingAccountId?: number;
  sessionDate?: string;
  instrumentKey?: string;
  tradingSessionId?: number;
  className?: string;
}

export const MarketPhaseSlotCapturePanel: React.FC<MarketPhaseSlotCapturePanelProps> = ({
  tradingAccountId,
  sessionDate,
  instrumentKey,
  tradingSessionId,
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

  const [sessionSlotOverrides, setSessionSlotOverrides] = useState<AnalyticalPeriod[] | null | undefined>(() => {
    if (!tradingAccountId || !sessionDate) return undefined;
    return readLocalSessionSlots(tradingAccountId, sessionDate);
  });
  const [newSlotDraft, setNewSlotDraft] = useState(() =>
    createEmptySlotDraft(nowTimeInTz(preferences.timezone)),
  );
  const [slotFormError, setSlotFormError] = useState<string | null>(null);
  const slotsLoadIdRef = useRef(0);

  const instrumentOptions = useMemo(
    () => capture.instruments.map((i) => ({ value: i.key, label: i.label })),
    [capture.instruments],
  );

  const phaseOptions = useMemo(
    () => [
      { value: '', label: t('replay.emptySlot') },
      ...capture.phases.map((p) => ({
        value: p.code,
        label: t(`phases.${p.code}`, { defaultValue: p.label }),
      })),
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
    let cancelled = false;
    const requestId = ++slotsLoadIdRef.current;
    const local = readLocalSessionSlots(tradingAccountId, sessionDate);
    setSessionSlotOverrides(local);

    marketPhasesService
      .getSessionSlots({
        session_date: sessionDate,
        trading_account: tradingAccountId,
      })
      .then(async (data) => {
        if (cancelled || requestId !== slotsLoadIdRef.current) return;
        const remote = Array.isArray(data.slots) ? data.slots : [];
        // Migration ponctuelle : grille locale présente, serveur vide → pousser vers l’API.
        if (remote.length === 0 && local && local.length > 0) {
          try {
            const saved = await marketPhasesService.putSessionSlots({
              session_date: sessionDate,
              trading_account: tradingAccountId,
              slots: local,
            });
            if (cancelled || requestId !== slotsLoadIdRef.current) return;
            const slots = Array.isArray(saved.slots) ? saved.slots : local;
            writeLocalSessionSlots(tradingAccountId, sessionDate, slots);
            setSessionSlotOverrides(slots);
            return;
          } catch {
            // garde le cache local
          }
        }
        if (cancelled || requestId !== slotsLoadIdRef.current) return;
        writeLocalSessionSlots(tradingAccountId, sessionDate, remote);
        setSessionSlotOverrides(remote);
      })
      .catch(() => {
        // hors-ligne / erreur : conserver le cache sessionStorage
      });

    return () => {
      cancelled = true;
    };
  }, [tradingAccountId, sessionDate]);

  const persistSessionSlots = useCallback(
    (periods: AnalyticalPeriod[] | null) => {
      if (!tradingAccountId || !sessionDate) return;
      // Invalide un GET en cours pour ne pas écraser une saisie locale.
      slotsLoadIdRef.current += 1;
      const next = periods ?? [];
      writeLocalSessionSlots(tradingAccountId, sessionDate, periods === null ? null : next);
      setSessionSlotOverrides(periods === null ? [] : next);
      void marketPhasesService
        .putSessionSlots({
          session_date: sessionDate,
          trading_account: tradingAccountId,
          slots: next,
        })
        .catch(() => undefined);
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
      const existing = getBlockForSlot(slot);
      const eventsOutsideSlot = capture.allEvents.filter(
        (ev) => !eventInPeriod(ev.occurred_at, slot.start, slot.end),
      );
      const existingSlotEvents = existing
        ? eventsForSlot(slot, existing, capture.allEvents)
        : [];
      if (!phaseCode) {
        capture.setBlocksAndPersist(others, eventsOutsideSlot);
        return;
      }
      const precedingContext =
        existing?.preceding_context ?? resolveInheritedContext(others, slot.start);
      const updated: MarketPhaseBlock = {
        ...existing,
        instrument_key: capture.instrumentKey,
        range_start: slot.start,
        range_end: slot.end,
        phase_code: phaseCode,
        preceding_context: precedingContext,
        source: 'replay',
        events: existingSlotEvents,
      };
      // Ne pas réinjecter les orphelins / événements d’autres tranches dans ce créneau.
      capture.setBlocksAndPersist([...others, updated], [...eventsOutsideSlot, ...existingSlotEvents]);
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

  const handleSlotTimeChange = useCallback(
    (slot: AnalyticalPeriod, nextTimes: Pick<AnalyticalPeriod, 'start' | 'end'>) => {
      if (nextTimes.start === slot.start && nextTimes.end === slot.end) return;

      const updated = updateSlotInList(slots, slot, nextTimes);
      if (!updated) {
        const normalized = normalizeSlotPeriod({
          label: slot.label,
          start: nextTimes.start,
          end: nextTimes.end,
        });
        setSlotFormError(
          normalized ? t('replay.duplicateSlot') : t('replay.invalidSlotTimes'),
        );
        return;
      }

      setSlotFormError(null);
      persistSessionSlots(updated.slots);

      const existing = capture.blocks.find((b) => blockMatchesSlot(b, slot));
      if (!existing) return;

      const slotEvents = eventsForSlot(slot, existing, capture.allEvents);
      const slotIds = new Set(
        slotEvents.map((ev) => ev.id).filter((id): id is number => id != null),
      );
      const slotKeys = new Set(slotEvents.map((ev) => marketPhaseEventKey(ev)));

      const midpoint = slotMidpoint(updated.nextSlot);
      const usedTimes: string[] = [];
      const remappedSlotEvents = slotEvents.map((ev) => {
        const occurredAt = nextDistinctEventTime(
          midpoint,
          usedTimes,
          updated.nextSlot.end,
        );
        usedTimes.push(occurredAt);
        return { ...ev, occurred_at: occurredAt };
      });

      const eventsOutsideSlot = capture.allEvents.filter((ev) => {
        if (ev.id != null && slotIds.has(ev.id)) return false;
        if (slotKeys.has(marketPhaseEventKey(ev))) return false;
        return true;
      });

      const others = capture.blocks.filter((b) => !blockMatchesSlot(b, slot));
      const migrated: MarketPhaseBlock = {
        ...existing,
        range_start: updated.nextSlot.start,
        range_end: updated.nextSlot.end,
        events: remappedSlotEvents,
      };
      capture.setBlocksAndPersist(
        [...others, migrated],
        [...eventsOutsideSlot, ...remappedSlotEvents],
      );
    },
    [capture, persistSessionSlots, slots, t],
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
      const nextSlots = sortSlotsByStart(generated);
      persistSessionSlots(nextSlots);
      const pruned = pruneCaptureToSlots(nextSlots, capture.blocks, capture.allEvents);
      if (
        pruned.blocks.length !== capture.blocks.length ||
        pruned.events.length !== capture.allEvents.length
      ) {
        capture.setBlocksAndPersist(pruned.blocks, pruned.events);
      }
      setSlotFormError(null);
    },
    [capture, persistSessionSlots],
  );

  const handleClearSessionSlots = useCallback(() => {
    persistSessionSlots([]);
    setNewSlotDraft(createEmptySlotDraft(nowTimeInTz(preferences.timezone)));
    if (capture.blocks.length > 0 || capture.allEvents.length > 0) {
      capture.setBlocksAndPersist([], []);
    }
  }, [capture, persistSessionSlots, preferences.timezone]);

  if (!tradingAccountId) return null;

  return (
    <div className={`font-sans ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('replay.slotsTitle')}</h3>
        <div className="flex flex-wrap items-center gap-2 text-xs">
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

      <div className="relative max-h-[28rem] overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
        {capture.loading && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-gray-900/70"
            aria-busy="true"
            aria-live="polite"
          >
            <div className="flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm text-gray-600 shadow-sm dark:bg-gray-800 dark:text-gray-300">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
              {t('common:loading')}
            </div>
          </div>
        )}
        <table className={`w-full table-fixed text-sm ${capture.loading ? 'pointer-events-none opacity-60' : ''}`}>
          <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
            <tr className="text-left text-gray-500">
              <th className="w-[16.5rem] px-2 py-2 pr-1">{t('replay.columnPeriod')}</th>
              <th className="w-[22%] px-2 py-2 pl-1">{t('selectPhase')}</th>
              <th className="w-[16%] px-2 py-2">{t('context')}</th>
              <th className="w-auto px-2 py-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    {t('events.categoryUp', { defaultValue: 'Hausse' })}
                  </span>
                  <span className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
                    {t('events.categoryDown', { defaultValue: 'Baisse' })}
                  </span>
                  <span className="inline-flex w-[7.5rem] shrink-0 justify-center text-center text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                    {t('events.categoryReentry', { defaultValue: 'Réintégration' })}
                  </span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) => {
              const block = getBlockForSlot(slot);
              const slotEvents = eventsForSlot(slot, block, capture.allEvents);
              return (
                <tr key={slot.key} className={`border-t border-gray-100 dark:border-gray-800 ${block ? 'bg-violet-50/50 dark:bg-violet-950/20' : ''}`}>
                  <td className="w-[16.5rem] px-2 py-2 pr-1 align-middle text-left">
                    <div className="flex min-w-0 items-center justify-start gap-1">
                      <div className="w-[6.25rem] shrink-0">
                        <SessionClockInput
                          value={slot.start}
                          onChange={(start) =>
                            handleSlotTimeChange(slot, { start, end: slot.end })
                          }
                          className={MARKET_PHASE_FORM_CLOCK_CLASS}
                        />
                      </div>
                      <span className="shrink-0 text-gray-400 dark:text-gray-500" aria-hidden="true">
                        –
                      </span>
                      <div className="w-[6.25rem] shrink-0">
                        <SessionClockInput
                          value={slot.end}
                          onChange={(end) =>
                            handleSlotTimeChange(slot, { start: slot.start, end })
                          }
                          minTime={slot.start || undefined}
                          className={MARKET_PHASE_FORM_CLOCK_CLASS}
                        />
                      </div>
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
                  <td className="px-2 py-2 pl-1 align-middle">
                    <CustomSelect
                      value={block?.phase_code || ''}
                      onChange={(value) => handleSlotPhaseChange(slot, String(value ?? ''))}
                      options={phaseOptions}
                      variant="compact"
                      className="!max-w-none w-full"
                    />
                  </td>
                  <td className="px-2 py-2 align-middle">
                    <CustomSelect
                      value={block?.preceding_context || 'none'}
                      onChange={(value) => handleSlotContextChange(slot, String(value ?? 'none'))}
                      options={contextOptions}
                      variant="compact"
                      className="!max-w-none w-full"
                      disabled={!block}
                    />
                  </td>
                  <td className="px-2 py-2 align-middle">
                    {!block ? (
                      <p className="text-xs text-gray-400 dark:text-gray-500">{t('replay.selectPhaseFirst')}</p>
                    ) : (
                      <MarketPhaseEventButtons
                        mode="replay"
                        occurredAt={slotMidpoint(slot)}
                        events={slotEvents}
                        onToggle={(action, at) =>
                          capture.handleToggleExclusiveEvent(
                            action.code,
                            action.direction,
                            action.candlePart,
                            action.outcome,
                            slotEvents,
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
