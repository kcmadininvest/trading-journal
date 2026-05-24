import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast/headless';
import { useTranslation } from 'react-i18next';
import { PageShell } from '../components/layout';
import { ConfirmModal } from '../components/ui';
import { DateInput } from '../components/common/DateInput';
import { AccountSelector } from '../components/accounts/AccountSelector';
import { TopStepSyncControls } from '../components/accounts/TopStepSyncControls';
import { PlaybackControls } from '../components/replay/PlaybackControls';
import { SessionPnlChart } from '../components/replay/SessionPnlChart';
import { SessionTimeline } from '../components/replay/SessionTimeline';
import {
  getVisibleEventIndices,
  TIMELINE_FILTER_KEYS,
  type TimelineFilterKey,
} from '../components/replay/timelineFilters';
import { needsMarketDataRefresh } from '../components/replay/marketTapeData';
import { SessionStatePanel } from '../components/replay/SessionStatePanel';
import { InsightsPanel } from '../components/replay/InsightsPanel';
import { JournalDraftPanel } from '../components/replay/JournalDraftPanel';
import {
  canNavigateSessionDate,
  formatSessionDuration,
  getAdjacentSessionDate,
  getTodayDateInTimezone,
} from '../components/replay/replayDateNav';
import {
  getReplayPnlTextClass,
  replayCardClass,
  replayDateInputClass,
  replaySecondaryButtonClass,
} from '../components/replay/replayStyles';
import { useTradingAccount } from '../contexts/TradingAccountContext';
import { useReplayKeyboard } from '../hooks/useReplayKeyboard';
import { usePreferences } from '../hooks/usePreferences';
import { useAccountNumberVisibility } from '../hooks/useAccountNumberVisibility';
import { useTopStepSyncEligibility } from '../hooks/useTopStepSyncEligibility';
import {
  JournalConflictError,
  ReplayApiError,
  sessionReplayService,
  SessionEventItem,
  SessionInsightItem,
  TradingSessionReplay,
} from '../services/sessionReplay';
import { formatDateTimeShort, type DateFormatType } from '../utils/dateFormat';
import { formatCurrencyWithSign } from '../utils/numberFormat';

const LOAD_DEBOUNCE_MS = 300;

function parseHashParams(): { account?: number; date?: string; autoBuild?: boolean } {
  const raw = window.location.hash.replace('#', '');
  const qIndex = raw.indexOf('?');
  if (qIndex < 0) return {};
  const params = new URLSearchParams(raw.slice(qIndex + 1));
  const account = params.get('account');
  const date = params.get('date');
  return {
    account: account ? Number(account) : undefined,
    date: date || undefined,
    autoBuild: params.get('auto') === '1',
  };
}

function clearAutoBuildFromHash(): void {
  const raw = window.location.hash.replace('#', '').trim();
  const qIndex = raw.indexOf('?');
  if (qIndex < 0) return;
  const page = raw.slice(0, qIndex);
  const params = new URLSearchParams(raw.slice(qIndex + 1));
  if (!params.has('auto')) return;
  params.delete('auto');
  const query = params.toString();
  window.location.hash = query ? `${page}?${query}` : page;
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  return error instanceof Error && error.name === 'AbortError';
}

function toastReplayError(error: unknown, fallback: string): void {
  if (isAbortError(error)) return;
  if (error instanceof ReplayApiError && error.status === 403) {
    toast.error(error.message);
    return;
  }
  toast.error(error instanceof Error ? error.message : fallback);
}

const SessionReplayPage: React.FC = () => {
  const { t } = useTranslation('replay');
  const { preferences } = usePreferences();
  const hideAccountNumber = useAccountNumberVisibility();
  const { selectedAccountId, setSelectedAccountId } = useTradingAccount();
  const hashParams = useMemo(() => parseHashParams(), []);

  const [sessionDate, setSessionDate] = useState(
    hashParams.date || new Date().toISOString().slice(0, 10),
  );
  const [session, setSession] = useState<TradingSessionReplay | null>(null);
  const [events, setEvents] = useState<SessionEventItem[]>([]);
  const [insights, setInsights] = useState<SessionInsightItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);
  const [applyingJournal, setApplyingJournal] = useState(false);
  const [activeDates, setActiveDates] = useState<string[]>([]);
  const [timelineFilters, setTimelineFilters] = useState<Set<TimelineFilterKey>>(
    () => new Set(TIMELINE_FILTER_KEYS),
  );
  const [marketDataLoading, setMarketDataLoading] = useState(false);

  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const silentRefreshAbortRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const autoBuildPendingRef = useRef(hashParams.autoBuild ?? false);
  const activeDatesRef = useRef(activeDates);
  activeDatesRef.current = activeDates;

  const accountId = selectedAccountId ?? hashParams.account ?? null;
  const { canSync, loading: eligibilityLoading } = useTopStepSyncEligibility(accountId);
  const canSyncRef = useRef(canSync);
  canSyncRef.current = canSync;
  const eligibilityLoadingRef = useRef(eligibilityLoading);
  eligibilityLoadingRef.current = eligibilityLoading;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;
  const buildingRef = useRef(building);
  buildingRef.current = building;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  const playingRef = useRef(playing);
  playingRef.current = playing;

  const cancelPendingRequests = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  useEffect(() => {
    if (hashParams.account && !selectedAccountId) {
      setSelectedAccountId(hashParams.account);
    }
  }, [hashParams.account, selectedAccountId, setSelectedAccountId]);

  const loadActiveDates = useCallback(async () => {
    if (!accountId) {
      setActiveDates([]);
      return;
    }
    try {
      const dates = await sessionReplayService.getActiveDates(accountId);
      setActiveDates(dates);
    } catch {
      setActiveDates([]);
    }
  }, [accountId]);

  useEffect(() => {
    void loadActiveDates();
  }, [loadActiveDates]);

  const fetchBuiltSession = useCallback(
    async (signal: AbortSignal): Promise<TradingSessionReplay | null> => {
      if (!accountId || !sessionDate) return null;
      const list = await sessionReplayService.list(
        {
          trading_account: accountId,
          date_from: sessionDate,
          date_to: sessionDate,
        },
        { signal },
      );
      return list.find((s) => s.session_date === sessionDate && s.status === 'built') ?? null;
    },
    [accountId, sessionDate],
  );

  const refreshMarketDataForSession = useCallback(
    async (built: TradingSessionReplay, signal: AbortSignal) => {
      setMarketDataLoading(true);
      try {
        const updated = await sessionReplayService.refreshMarketData(built.id, { signal });
        if (!signal.aborted) {
          setSession(updated);
        }
        return updated;
      } catch (error: unknown) {
        if (!isAbortError(error)) {
          toastReplayError(error, t('marketTapeRefreshError'));
        }
        return built;
      } finally {
        if (!signal.aborted) {
          setMarketDataLoading(false);
        }
      }
    },
    [t],
  );

  const hydrateSession = useCallback(
    async (
      built: TradingSessionReplay,
      signal: AbortSignal,
      options?: { preservePlayback?: boolean },
    ) => {
      const anchorExternalId = options?.preservePlayback
        ? eventsRef.current[currentIndexRef.current]?.external_id
        : null;
      const resumePlaying = options?.preservePlayback ? playingRef.current : false;

      const [timeline, insightList] = await Promise.all([
        sessionReplayService.getTimeline(built.id, { signal }),
        sessionReplayService.getInsights(built.id, { signal }),
      ]);
      if (signal.aborted) return;
      setSession(built);
      setEvents(timeline);
      setInsights(insightList);

      if (options?.preservePlayback && timeline.length > 0) {
        let nextIndex = currentIndexRef.current;
        if (anchorExternalId) {
          const matched = timeline.findIndex((e) => e.external_id === anchorExternalId);
          if (matched >= 0) nextIndex = matched;
        }
        nextIndex = Math.max(0, Math.min(nextIndex, timeline.length - 1));
        setCurrentIndex(nextIndex);
        setPlaying(resumePlaying);
      } else {
        setCurrentIndex(0);
        setPlaying(false);
      }

      if (needsMarketDataRefresh(built.market_data)) {
        await refreshMarketDataForSession(built, signal);
      }
    },
    [refreshMarketDataForSession],
  );

  const handleRefreshMarketData = useCallback(() => {
    if (!session) return;
    const controller = new AbortController();
    void refreshMarketDataForSession(session, controller.signal);
  }, [session, refreshMarketDataForSession]);

  const clearSessionState = useCallback(() => {
    setSession(null);
    setEvents([]);
    setInsights([]);
    setCurrentIndex(0);
    setPlaying(false);
  }, []);

  const runBuild = useCallback(
    async (signal: AbortSignal, generation: number): Promise<TradingSessionReplay | null> => {
      if (!accountId || !sessionDate) return null;
      const built = await sessionReplayService.build(accountId, sessionDate, { signal });
      if (generation !== generationRef.current) return null;
      await hydrateSession(built, signal);
      return built;
    },
    [accountId, sessionDate, hydrateSession],
  );

  const handleBuild = useCallback(
    async (options?: { refresh?: boolean }) => {
      if (!accountId) {
        toast.error(t('selectAccount'));
        return;
      }
      if (!canSync) return;

      cancelPendingRequests();
      const controller = new AbortController();
      abortRef.current = controller;
      const generation = ++generationRef.current;

      setBuilding(true);
      setPlaying(false);
      try {
        const built = await runBuild(controller.signal, generation);
        if (generation !== generationRef.current || !built) return;
        if (built.preserved) {
          toast(t(`preserveReason.${built.preserve_reason || 'api_empty'}`, {
            defaultValue: t('preserveExistingData'),
          }), { icon: '⚠️' });
        } else {
          toast.success(options?.refresh ? t('refreshSuccess') : t('buildSuccess'));
        }
        await loadActiveDates();
      } catch (error: unknown) {
        toastReplayError(error, t('buildError'));
      } finally {
        if (generation === generationRef.current) {
          setBuilding(false);
        }
      }
    },
    [accountId, canSync, cancelPendingRequests, loadActiveDates, runBuild, t],
  );

  const tryAutoBuildForSelection = useCallback(
    async (signal: AbortSignal, generation: number): Promise<boolean> => {
      if (!accountId || !sessionDate) return false;
      const shouldAutoBuild =
        (autoBuildPendingRef.current || parseHashParams().autoBuild) &&
        activeDatesRef.current.includes(sessionDate) &&
        canSyncRef.current &&
        !eligibilityLoadingRef.current;
      if (!shouldAutoBuild) return false;

      autoBuildPendingRef.current = false;
      clearAutoBuildFromHash();
      setBuilding(true);
      try {
        await runBuild(signal, generation);
        if (generation !== generationRef.current) return false;
        toast.success(t('buildSuccess'));
        await loadActiveDates();
        return true;
      } catch (error: unknown) {
        toastReplayError(error, t('buildError'));
        return false;
      } finally {
        if (generation === generationRef.current) {
          setBuilding(false);
        }
      }
    },
    [accountId, sessionDate, runBuild, loadActiveDates, t],
  );

  const loadSessionForSelection = useCallback(async () => {
    if (!accountId || !sessionDate) {
      clearSessionState();
      return;
    }

    cancelPendingRequests();
    const controller = new AbortController();
    abortRef.current = controller;
    const generation = ++generationRef.current;
    const { signal } = controller;

    setLoading(true);
    try {
      const built = await fetchBuiltSession(signal);
      if (generation !== generationRef.current) return;

      if (built) {
        autoBuildPendingRef.current = false;
        await hydrateSession(built, signal);
        return;
      }

      clearSessionState();
      if (generation !== generationRef.current) return;
      await tryAutoBuildForSelection(signal, generation);
    } catch (error: unknown) {
      if (generation !== generationRef.current) return;
      clearSessionState();
      toastReplayError(error, t('loadError'));
    } finally {
      if (generation === generationRef.current) {
        setLoading(false);
      }
    }
  }, [
    accountId,
    sessionDate,
    cancelPendingRequests,
    fetchBuiltSession,
    hydrateSession,
    clearSessionState,
    tryAutoBuildForSelection,
    t,
  ]);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      void loadSessionForSelection();
    }, LOAD_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      abortRef.current?.abort();
    };
  }, [accountId, sessionDate, loadSessionForSelection]);

  /** Auto-build différé quand activeDates / éligibilité arrivent après le premier chargement. */
  useEffect(() => {
    if (!accountId || !sessionDate) return;
    if (!(autoBuildPendingRef.current || parseHashParams().autoBuild)) return;
    if (eligibilityLoading || !canSync) return;
    if (!activeDates.includes(sessionDate)) return;
    if (session?.session_date === sessionDate && session.status === 'built') return;

    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled || loadingRef.current || buildingRef.current) return;
      const currentSession = sessionRef.current;
      if (currentSession?.session_date === sessionDate && currentSession.status === 'built') {
        return;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      const generation = ++generationRef.current;
      void tryAutoBuildForSelection(controller.signal, generation);
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    accountId,
    sessionDate,
    activeDates,
    canSync,
    eligibilityLoading,
    session,
    tryAutoBuildForSelection,
  ]);

  const refreshSessionQuiet = useCallback(async () => {
    if (!accountId || !sessionDate || !canSync) return;
    if (sessionRef.current?.session_date !== sessionDate) return;

    silentRefreshAbortRef.current?.abort();
    const controller = new AbortController();
    silentRefreshAbortRef.current = controller;

    try {
      const built = await sessionReplayService.build(accountId, sessionDate, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      await hydrateSession(built, controller.signal, { preservePlayback: true });
    } catch (error: unknown) {
      if (!isAbortError(error)) {
        console.error('[SessionReplayPage] quiet refresh failed', error);
      }
    } finally {
      if (silentRefreshAbortRef.current === controller) {
        silentRefreshAbortRef.current = null;
      }
    }
  }, [accountId, sessionDate, canSync, hydrateSession]);

  const handleAfterSync = useCallback(() => {
    void loadActiveDates();
    if (!accountId || !canSync || !sessionDate) return;
    void handleBuild({ refresh: true });
  }, [loadActiveDates, accountId, canSync, sessionDate, handleBuild]);

  const handlePollingAfterSync = useCallback(() => {
    void loadActiveDates();
    void refreshSessionQuiet();
  }, [loadActiveDates, refreshSessionQuiet]);

  const applyJournalToSession = async (overwrite: boolean) => {
    if (!session) return;
    setApplyingJournal(true);
    try {
      await sessionReplayService.applyJournal(session.id, overwrite);
      toast.success(t('journalApplySuccess'));
      setShowOverwriteModal(false);
      cancelPendingRequests();
      const controller = new AbortController();
      abortRef.current = controller;
      const generation = ++generationRef.current;
      setLoading(true);
      try {
        const built = await fetchBuiltSession(controller.signal);
        if (generation !== generationRef.current) return;
        if (built) {
          await hydrateSession(built, controller.signal);
        }
      } finally {
        if (generation === generationRef.current) setLoading(false);
      }
    } catch (e: unknown) {
      if (e instanceof JournalConflictError) {
        setShowOverwriteModal(true);
      } else {
        const msg = e instanceof Error ? e.message : '';
        toast.error(msg || t('journalApplyError'));
      }
    } finally {
      setApplyingJournal(false);
    }
  };

  const handleApplyJournal = () => {
    void applyJournalToSession(false);
  };

  const jumpToTime = (occurredAt: string) => {
    const target = new Date(occurredAt).getTime();
    const idx = events.findIndex((e) => new Date(e.occurred_at).getTime() >= target);
    setCurrentIndex(idx >= 0 ? idx : events.length - 1);
  };

  const hasBuiltSession = session?.status === 'built';

  const visibleEventIndices = useMemo(
    () => getVisibleEventIndices(events, timelineFilters),
    [events, timelineFilters],
  );

  const playbackPosition = useMemo(() => {
    const pos = visibleEventIndices.indexOf(currentIndex);
    return pos >= 0 ? pos : 0;
  }, [visibleEventIndices, currentIndex]);

  const maxPlaybackIndex = Math.max(visibleEventIndices.length - 1, 0);

  const handlePlaybackSeek = useCallback(
    (visibleIdx: number) => {
      const eventIndex = visibleEventIndices[visibleIdx];
      if (eventIndex !== undefined) setCurrentIndex(eventIndex);
    },
    [visibleEventIndices],
  );

  const toggleTimelineFilter = useCallback((key: TimelineFilterKey) => {
    setTimelineFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  useEffect(() => {
    if (visibleEventIndices.length === 0) return;
    if (!visibleEventIndices.includes(currentIndex)) {
      setCurrentIndex(visibleEventIndices[0]);
    }
  }, [visibleEventIndices, currentIndex]);

  useEffect(() => {
    setTimelineFilters(new Set(TIMELINE_FILTER_KEYS));
  }, [session?.id]);

  const handlePlayPause = useCallback(() => {
    setPlaying((p) => !p);
  }, []);

  const handleReplay = useCallback(() => {
    handlePlaybackSeek(0);
    setPlaying(true);
  }, [handlePlaybackSeek]);

  useReplayKeyboard({
    enabled: hasBuiltSession && visibleEventIndices.length > 0,
    maxIndex: maxPlaybackIndex,
    currentIndex: playbackPosition,
    onPlayPause: handlePlayPause,
    onSeek: handlePlaybackSeek,
  });

  useEffect(() => {
    if (!playing || visibleEventIndices.length === 0) {
      if (playRef.current) clearInterval(playRef.current);
      playRef.current = null;
      return;
    }
    const intervalMs = 1000 / speed;
    playRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        const pos = visibleEventIndices.indexOf(prev);
        const at = pos >= 0 ? pos : 0;
        if (at >= visibleEventIndices.length - 1) {
          setPlaying(false);
          return prev;
        }
        return visibleEventIndices[at + 1];
      });
    }, intervalMs);
    return () => {
      if (playRef.current) clearInterval(playRef.current);
    };
  }, [playing, speed, visibleEventIndices]);

  const todayInTz = useMemo(
    () => getTodayDateInTimezone(preferences.timezone || 'Europe/Paris'),
    [preferences.timezone],
  );

  const canGoPrevDay = canNavigateSessionDate(sessionDate, activeDates, -1);
  const canGoNextDay = canNavigateSessionDate(sessionDate, activeDates, 1);

  const goToPreviousDay = () => {
    if (!canGoPrevDay) return;
    setSessionDate(getAdjacentSessionDate(sessionDate, activeDates, -1));
  };

  const goToNextDay = () => {
    if (!canGoNextDay) return;
    setSessionDate(getAdjacentSessionDate(sessionDate, activeDates, 1));
  };

  const goToToday = () => setSessionDate(todayInTz);

  const journalApplied = Boolean(session?.journal_draft?.applied_at);
  const netPnlNum = session?.net_pnl != null ? Number(session.net_pnl) : null;
  const maxDdNum =
    session?.max_drawdown_intraday != null ? Number(session.max_drawdown_intraday) : null;
  const dateFormat = (preferences.date_format || 'EU') as DateFormatType;
  const timezone = preferences.timezone || 'Europe/Paris';

  const sessionHoursLabel = useMemo(() => {
    const toClock = (iso: string | null | undefined): string => {
      if (!iso) return '';
      const formatted = formatDateTimeShort(iso, dateFormat, timezone);
      const spaceIdx = formatted.lastIndexOf(' ');
      return spaceIdx >= 0 ? formatted.slice(spaceIdx + 1) : formatted;
    };
    if (!session?.started_at && !session?.ended_at) return '—';
    const start = toClock(session.started_at);
    const end = toClock(session.ended_at);
    if (start && end && session.started_at && session.ended_at) {
      const duration = formatSessionDuration(session.started_at, session.ended_at);
      if (duration) {
        return t('sessionHoursRangeWithDuration', { start, end, duration });
      }
      return `${start} → ${end}`;
    }
    return start || end || '—';
  }, [session?.started_at, session?.ended_at, dateFormat, timezone, t]);

  const busy = loading || building;

  return (
    <PageShell>
      <div className={`${replayCardClass} p-3 sm:p-4 mb-4 sm:mb-6`}>
        <div className="flex min-w-0 flex-col lg:flex-row lg:items-end gap-4">
          <div className="w-full min-w-0 lg:w-auto lg:flex-shrink-0">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('account')}
            </label>
            <AccountSelector
              value={accountId}
              onChange={(id) => setSelectedAccountId(id)}
              hideLabel
              hideAccountNumber={hideAccountNumber}
            />
          </div>
          <div className="w-full min-w-0 lg:flex-1 lg:max-w-md">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('sessionDate')}
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={goToPreviousDay}
                disabled={!canGoPrevDay || busy}
                title={t('previousDay')}
                aria-label={t('previousDay')}
                className={`${replaySecondaryButtonClass} !min-w-[2.25rem] !px-2.5 shrink-0 text-lg leading-none`}
              >
                ‹
              </button>
              <DateInput
                value={sessionDate}
                onChange={setSessionDate}
                className={`${replayDateInputClass} flex-1 min-w-0`}
                markedDates={activeDates}
                markedDatesTitle={t('dateWithActivity')}
              />
              <button
                type="button"
                onClick={goToNextDay}
                disabled={!canGoNextDay || busy}
                title={t('nextDay')}
                aria-label={t('nextDay')}
                className={`${replaySecondaryButtonClass} !min-w-[2.25rem] !px-2.5 shrink-0 text-lg leading-none`}
              >
                ›
              </button>
              <button
                type="button"
                onClick={goToToday}
                disabled={sessionDate === todayInTz || busy}
                title={t('today')}
                className={`${replaySecondaryButtonClass} shrink-0 text-xs sm:text-sm`}
              >
                {t('today')}
              </button>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-end gap-2 lg:w-auto lg:flex-shrink-0">
            {accountId && canSync && (
              <TopStepSyncControls
                iconOnly="narrow"
                accountId={accountId}
                enablePolling
                onSynced={handleAfterSync}
                onPollingSynced={handlePollingAfterSync}
              />
            )}
          </div>
        </div>
        {!canSync && !eligibilityLoading && accountId && (
          <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">{t('topstepRequired')}</p>
        )}
      </div>

      {loading && !building ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">{t('loading')}</p>
          </div>
        </div>
      ) : !hasBuiltSession ? (
        <div className={`${replayCardClass} p-8 text-center`}>
          <p className="text-gray-600 dark:text-gray-400">{t('noSession')}</p>
          {building && (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{t('building')}</p>
          )}
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <StatCard label={t('tradeCount')} value={String(session.trade_count)} />
            <StatCard
              label={t('netPnl')}
              value={
                netPnlNum != null
                  ? formatCurrencyWithSign(netPnlNum, '', preferences.number_format, 2)
                  : '—'
              }
              pnlValue={netPnlNum}
            />
            <StatCard
              label={t('maxDrawdown')}
              value={
                maxDdNum != null
                  ? formatCurrencyWithSign(-Math.abs(maxDdNum), '', preferences.number_format, 2)
                  : '—'
              }
              pnlValue={maxDdNum != null ? -Math.abs(maxDdNum) : null}
            />
            <StatCard label={t('eventCount')} value={String(session.event_count)} />
            <StatCard label={t('insightCount')} value={String(session.insight_count)} />
            <StatCard label={t('sessionHours')} value={sessionHoursLabel} />
          </div>

          <div className={`${replayCardClass} overflow-hidden`}>
            <div className="grid lg:grid-cols-5 lg:items-stretch gap-0">
              <div className="lg:col-span-2 p-4 space-y-4 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700">
                <PlaybackControls
                  playing={playing}
                  speed={speed}
                  currentIndex={playbackPosition}
                  maxIndex={maxPlaybackIndex}
                  onPlayPause={handlePlayPause}
                  onReplay={handleReplay}
                  onSpeedChange={setSpeed}
                  onSeek={handlePlaybackSeek}
                />
                <SessionPnlChart
                  events={events}
                  currentIndex={currentIndex}
                  timezone={preferences.timezone}
                  language={preferences.language}
                  numberFormat={preferences.number_format}
                />
                <SessionTimeline
                  events={events}
                  visibleIndices={visibleEventIndices}
                  currentIndex={currentIndex}
                  onSelectIndex={setCurrentIndex}
                  activeFilters={timelineFilters}
                  onToggleFilter={toggleTimelineFilter}
                  playing={playing}
                  timezone={preferences.timezone}
                  language={preferences.language}
                  numberFormat={preferences.number_format}
                />
              </div>
              <div className="lg:col-span-3 flex flex-col p-4 bg-gray-50 dark:bg-gray-900/30 lg:min-h-0 lg:h-full">
                <SessionStatePanel
                  events={events}
                  currentIndex={currentIndex}
                  marketData={session?.market_data}
                  marketDataLoading={marketDataLoading}
                  onRefreshMarketData={session ? handleRefreshMarketData : undefined}
                />
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
            <InsightsPanel insights={insights} onJumpToTime={jumpToTime} />
            <JournalDraftPanel
              content={session.journal_draft?.content || ''}
              applied={journalApplied}
              loading={applyingJournal}
              onApply={handleApplyJournal}
            />
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={showOverwriteModal}
        variant="warning"
        onClose={() => {
          if (!applyingJournal) setShowOverwriteModal(false);
        }}
        onConfirm={() => applyJournalToSession(true)}
        isLoading={applyingJournal}
        title={t('journalOverwriteTitle')}
        message={t('journalOverwriteConfirm')}
        confirmButtonText={t('journalOverwriteReplace')}
        cancelButtonText={t('common:cancel', { defaultValue: 'Annuler' })}
      />
    </PageShell>
  );
};

const StatCard: React.FC<{
  label: string;
  value: string;
  pnlValue?: number | null;
}> = ({ label, value, pnlValue }) => (
  <div className={`${replayCardClass} p-4`}>
    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{label}</p>
    <p
      className={`text-lg sm:text-xl font-bold ${
        pnlValue != null ? getReplayPnlTextClass(pnlValue) : 'text-gray-900 dark:text-white'
      }`}
    >
      {value}
    </p>
  </div>
);

export default SessionReplayPage;
