import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast/headless';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { PageShell } from '../components/layout';
import { DateInput } from '../components/common/DateInput';
import { InstrumentPicker } from '../components/backtestJournal/InstrumentPicker';
import { ReplayControls } from '../components/marketReplay/ReplayControls';
import { ReplayGrid } from '../components/marketReplay/ReplayGrid';
import type { TradeLevelKey } from '../components/marketReplay/ReplayChartPane';
import type { ReplayChartPaneHandle } from '../components/marketReplay/ReplayChartPane';
import {
  ReplayTradePanel,
  type DraftTrade,
  type TradePlacementMode,
} from '../components/marketReplay/ReplayTradePanel';
import { useMarketReplay } from '../hooks/useMarketReplay';
import { usePreferences } from '../hooks/usePreferences';
import {
  backtestJournalService,
  type BacktestCampaign,
  type ResultStatus,
} from '../services/backtestJournal';
import userService from '../services/userService';
import { ConfirmModal } from '../components/ui';
import { getTodayDateInTimezone, canNavigateSessionDate, getAdjacentSessionDate } from '../components/replay/replayDateNav';
import { replayPrimaryButtonClass, replaySecondaryButtonClass, replayDateInputClass } from '../components/replay/replayStyles';
import { formatNumber } from '../utils/numberFormat';
import {
  buildPlacedPosition,
  emptyPositionUi,
  positionOverlayFromDraft,
  type PositionUiState,
} from '../utils/positionToolState';
import type { PositionOverlayChange } from '../components/marketReplay/usePositionOverlay';
import { visiblePriceRangeFromBars } from '../utils/positionToolSizing';

type InitParams = { campaign?: number; date?: string; instrument?: string };

function parseSearchParams(params: URLSearchParams): InitParams {
  const campaign = params.get('campaign');
  return {
    campaign: campaign ? Number(campaign) : undefined,
    date: params.get('date') || undefined,
    instrument: params.get('instrument') || undefined,
  };
}

function parseHashParams(): InitParams {
  const raw = window.location.hash.replace('#', '');
  const qIndex = raw.indexOf('?');
  if (qIndex < 0) return {};
  return parseSearchParams(new URLSearchParams(raw.slice(qIndex + 1)));
}

/** Query string (popup) prioritaire, puis paramètres du hash (#market-replay?…). */
function parseInitParams(): InitParams {
  const fromSearch = parseSearchParams(new URLSearchParams(window.location.search));
  const fromHash = parseHashParams();
  return {
    campaign: fromSearch.campaign ?? fromHash.campaign,
    date: fromSearch.date ?? fromHash.date,
    instrument: fromSearch.instrument ?? fromHash.instrument,
  };
}

const emptyDraft = (): DraftTrade => ({
  direction: 'LONG',
  entryTimestamp: null,
  entryPrice: null,
  exitTimestamp: null,
  exitPrice: null,
  stopPrice: null,
  targetPrice: null,
});

/** Arrondi API DecimalField (max_digits=20, decimal_places=8). */
function priceForJournal(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value.toFixed(8).replace(/\.?0+$/, '');
}

/** Statut journal compatible avec le calcul R côté API. */
function deriveJournalResult(draft: DraftTrade): {
  result_status: ResultStatus;
  result_r_source: 'calculated' | 'manual';
  result_r?: string | null;
} {
  if (draft.entryPrice == null || draft.exitPrice == null) {
    return { result_status: 'OPEN', result_r_source: 'calculated' };
  }

  const entry = draft.entryPrice;
  const exit = draft.exitPrice;
  const points = draft.direction === 'LONG' ? exit - entry : entry - exit;

  if (draft.stopPrice != null && draft.stopPrice !== entry) {
    const risk = Math.abs(entry - draft.stopPrice);
    const r = points / risk;
    let result_status: ResultStatus = 'BREAKEVEN';
    if (r > 0.05) result_status = 'WIN';
    else if (r < -0.05) result_status = 'LOSS';
    return { result_status, result_r_source: 'calculated' };
  }

  // Sortie sans stop : pas de R calculable → OPEN (prix de sortie conservés).
  return { result_status: 'OPEN', result_r_source: 'calculated', result_r: null };
}

function formatBulkError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const fields = (err as Error & { fields?: { errors?: Array<{ errors?: Record<string, unknown> }> } })
    .fields;
  const first = fields?.errors?.[0]?.errors;
  if (first && typeof first === 'object') {
    const parts = Object.entries(first).flatMap(([key, val]) => {
      const msg = Array.isArray(val) ? val.join(' ') : String(val);
      return msg ? [`${key}: ${msg}`] : [];
    });
    if (parts.length) return parts.join(' · ');
  }
  if (err.message && err.message !== 'backtest_journal_error') return err.message;
  return fallback;
}

export type MarketReplayPageProps = {
  /** Fenêtre détachée (/market-replay-popup) : pas de bouton Détacher. */
  detached?: boolean;
};

const MarketReplayPage: React.FC<MarketReplayPageProps> = ({ detached = false }) => {
  const { t } = useTranslation('marketReplay');
  const { preferences, mergePreferences } = usePreferences();
  const init = parseInitParams();

  const [instrument, setInstrument] = useState(init.instrument || '');
  const [sessionDate, setSessionDate] = useState<string>(
    init.date || getTodayDateInTimezone(preferences.timezone),
  );
  const [campaign, setCampaign] = useState<BacktestCampaign | null>(null);
  const [draft, setDraft] = useState<DraftTrade>(emptyDraft);
  const [placementMode, setPlacementMode] = useState<TradePlacementMode>(null);
  /** Poignée temporaire après premier placement SL / TP / Sortie. */
  const [adjustLevel, setAdjustLevel] = useState<TradeLevelKey | null>(null);
  const [positionUi, setPositionUi] = useState<PositionUiState>(emptyPositionUi);
  const primaryPaneRef = useRef<ReplayChartPaneHandle | null>(null);
  const [saving, setSaving] = useState(false);
  const [logarithmic, setLogarithmic] = useState(!!preferences.market_replay_logarithmic);
  const [autoFit, setAutoFit] = useState(!!preferences.market_replay_autofit);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const adjustDraggedRef = useRef(false);

  useEffect(() => {
    setLogarithmic(!!preferences.market_replay_logarithmic);
    setAutoFit(!!preferences.market_replay_autofit);
  }, [preferences.market_replay_logarithmic, preferences.market_replay_autofit]);

  const persistChartPref = useCallback(
    async (
      patch: { market_replay_logarithmic?: boolean; market_replay_autofit?: boolean },
      rollback: () => void,
    ) => {
      mergePreferences(patch);
      try {
        await userService.updatePreferences(patch);
      } catch (error) {
        console.error('Erreur lors de la mise à jour Market Replay:', error);
        rollback();
        mergePreferences({
          market_replay_logarithmic: logarithmic,
          market_replay_autofit: autoFit,
        });
      }
    },
    [mergePreferences, logarithmic, autoFit],
  );

  const handleLogarithmicChange = useCallback(
    (value: boolean) => {
      const previous = logarithmic;
      setLogarithmic(value);
      void persistChartPref({ market_replay_logarithmic: value }, () => setLogarithmic(previous));
    },
    [logarithmic, persistChartPref],
  );

  const handleAutoFitChange = useCallback(
    (value: boolean) => {
      const previous = autoFit;
      setAutoFit(value);
      void persistChartPref({ market_replay_autofit: value }, () => setAutoFit(previous));
    },
    [autoFit, persistChartPref],
  );

  const replay = useMarketReplay({
    instrument: instrument.trim() || null,
    sessionDate,
    onSuggestSessionDate: useCallback((nextDate: string) => {
      setSessionDate(nextDate);
    }, []),
  });

  const availableSessions = replay.availableSessions;
  const canGoPrevSession = canNavigateSessionDate(sessionDate, availableSessions, -1);
  const canGoNextSession = canNavigateSessionDate(sessionDate, availableSessions, 1);

  useEffect(() => {
    if (!init.campaign) return;
    backtestJournalService
      .getCampaign(init.campaign)
      .then((c) => setCampaign(c))
      .catch(() => toast.error(t('errorCampaign')));
  }, [init.campaign, t]);

  const panes = useMemo(
    () =>
      replay.chartIds.map((id, i) => ({
        chartId: id,
        timeframeValue: replay.paneTfs[i],
        candles: replay.visibleByChart[id] || [],
      })),
    [replay.chartIds, replay.paneTfs, replay.visibleByChart],
  );

  const chartLevels = useMemo(
    () => ({
      direction: draft.direction,
      entryPrice: draft.entryPrice,
      exitPrice: draft.exitPrice,
      stopPrice: draft.stopPrice,
      targetPrice: draft.targetPrice,
    }),
    [draft],
  );

  const primaryCandles = useMemo(
    () => panes[0]?.candles ?? [],
    [panes],
  );

  const positionModel = useMemo(
    () => positionOverlayFromDraft(draft, positionUi, instrument),
    [draft, positionUi, instrument],
  );

  const applyPlacedPosition = useCallback(
    (
      side: 'long' | 'short',
      entryPrice: number,
      entryTime: number,
      chartId: string,
      candles: typeof primaryCandles,
      visibleRangeHint?: number,
    ) => {
      const isPrimary = chartId === panes[0]?.chartId;
      const visibleRange =
        visibleRangeHint ??
        (isPrimary
          ? primaryPaneRef.current?.getVisiblePriceRange()
          : undefined) ??
        visiblePriceRangeFromBars(
          candles.map((c) => ({ high: c.high, low: c.low, close: c.close })),
        );
      const placed = buildPlacedPosition({
        side,
        entryPrice,
        entryTime,
        candles,
        visiblePriceRange: visibleRange,
      });
      setDraft((d) => ({ ...d, ...placed.draftPatch }));
      setPositionUi((ui) => ({
        ...ui,
        ...placed.uiPatch,
        chartId,
        qty: ui.qty || 1,
      }));
      setPlacementMode(null);
      setAdjustLevel(null);
    },
    [panes],
  );

  const markEntry = useCallback(
    (direction: 'LONG' | 'SHORT') => {
      setAdjustLevel(null);
      setPlacementMode(direction === 'LONG' ? 'entry_long' : 'entry_short');
      if (replay.lastPrice == null || replay.replayTimestamp == null) {
        setDraft((d) => ({
          ...d,
          direction,
          exitTimestamp: null,
          exitPrice: null,
        }));
        return;
      }
      const hostId = panes[0]?.chartId;
      if (!hostId) return;
      applyPlacedPosition(
        direction === 'SHORT' ? 'short' : 'long',
        replay.lastPrice,
        replay.replayTimestamp,
        hostId,
        panes[0]?.candles ?? [],
      );
    },
    [
      replay.lastPrice,
      replay.replayTimestamp,
      applyPlacedPosition,
      panes,
    ],
  );

  const markExit = useCallback(() => {
    setPlacementMode('exit');
    if (replay.lastPrice == null) return;
    setDraft((d) => ({
      ...d,
      exitTimestamp: replay.replayTimestamp,
      exitPrice: replay.lastPrice,
    }));
    setAdjustLevel('exit');
  }, [replay.lastPrice, replay.replayTimestamp]);

  const setStop = useCallback(() => {
    setPlacementMode('stop');
    if (replay.lastPrice == null) return;
    setDraft((d) => ({ ...d, stopPrice: replay.lastPrice }));
    setAdjustLevel(positionUi.active ? null : 'stop');
    if (positionUi.active) {
      setPositionUi((ui) => ({ ...ui, selected: true }));
    }
  }, [replay.lastPrice, positionUi.active]);

  const setTarget = useCallback(() => {
    setPlacementMode('target');
    if (replay.lastPrice == null) return;
    setDraft((d) => ({ ...d, targetPrice: replay.lastPrice }));
    setAdjustLevel(positionUi.active ? null : 'target');
    if (positionUi.active) {
      setPositionUi((ui) => ({ ...ui, selected: true }));
    }
  }, [replay.lastPrice, positionUi.active]);

  const placePriceOnChart = useCallback(
    (price: number, time?: number, chartId?: string) => {
      if (!placementMode) {
        if (adjustLevel) setAdjustLevel(null);
        return;
      }
      const entryTime = time ?? replay.replayTimestamp;
      const hostId = chartId ?? panes[0]?.chartId ?? null;
      if (placementMode === 'entry_long' || placementMode === 'entry_short') {
        if (entryTime == null || !hostId) return;
        const candles =
          panes.find((p) => p.chartId === hostId)?.candles ?? primaryCandles;
        applyPlacedPosition(
          placementMode === 'entry_short' ? 'short' : 'long',
          price,
          entryTime,
          hostId,
          candles,
        );
        return;
      }
      if (!replay.replayTimestamp) return;
      if (placementMode === 'exit') {
        setDraft((d) => {
          if (d.entryTimestamp == null) return d;
          return {
            ...d,
            exitTimestamp: time ?? replay.replayTimestamp,
            exitPrice: price,
          };
        });
        setPlacementMode(null);
        setAdjustLevel('exit');
        return;
      }
      if (placementMode === 'stop') {
        setDraft((d) => ({ ...d, stopPrice: price }));
        setPlacementMode(null);
        if (positionUi.active) {
          setPositionUi((ui) => ({ ...ui, selected: true }));
        } else if (
          draft.entryPrice != null &&
          draft.targetPrice != null &&
          draft.entryTimestamp != null
        ) {
          setPositionUi((ui) => ({
            ...ui,
            active: true,
            selected: true,
            chartId: ui.chartId ?? hostId,
            endTime: ui.endTime ?? draft.entryTimestamp,
          }));
        } else {
          setAdjustLevel('stop');
        }
        return;
      }
      if (placementMode === 'target') {
        setDraft((d) => ({ ...d, targetPrice: price }));
        setPlacementMode(null);
        if (positionUi.active) {
          setPositionUi((ui) => ({ ...ui, selected: true }));
        } else if (
          draft.entryPrice != null &&
          draft.stopPrice != null &&
          draft.entryTimestamp != null
        ) {
          setPositionUi((ui) => ({
            ...ui,
            active: true,
            selected: true,
            chartId: ui.chartId ?? hostId,
            endTime: ui.endTime ?? draft.entryTimestamp,
          }));
        } else {
          setAdjustLevel('target');
        }
      }
    },
    [
      placementMode,
      replay.replayTimestamp,
      adjustLevel,
      applyPlacedPosition,
      positionUi.active,
      draft.entryPrice,
      draft.targetPrice,
      draft.stopPrice,
      draft.entryTimestamp,
      panes,
      primaryCandles,
    ],
  );

  const dragLevelOnChart = useCallback(
    (key: TradeLevelKey, price: number) => {
      if (adjustLevel === key) adjustDraggedRef.current = true;
      if (key === 'entry') {
        setDraft((d) => ({
          ...d,
          entryTimestamp: d.entryTimestamp ?? replay.replayTimestamp,
          entryPrice: price,
        }));
        return;
      }
      if (key === 'exit') {
        setDraft((d) => {
          if (d.entryTimestamp == null) return d;
          return {
            ...d,
            exitTimestamp: d.exitTimestamp ?? replay.replayTimestamp,
            exitPrice: price,
          };
        });
        return;
      }
      if (key === 'stop') {
        setDraft((d) => ({ ...d, stopPrice: price }));
        return;
      }
      setDraft((d) => ({ ...d, targetPrice: price }));
    },
    [replay.replayTimestamp, adjustLevel],
  );

  const commitAdjustLevel = useCallback(() => {
    adjustDraggedRef.current = false;
    setAdjustLevel(null);
  }, []);

  const clearTrade = useCallback(() => {
    setDraft(emptyDraft());
    setPlacementMode(null);
    setAdjustLevel(null);
    setPositionUi(emptyPositionUi());
    adjustDraggedRef.current = false;
  }, []);

  const handlePositionChange = useCallback((patch: PositionOverlayChange) => {
    setDraft((d) => ({
      ...d,
      entryTimestamp: patch.entryTime ?? d.entryTimestamp,
      entryPrice: patch.entryPrice ?? d.entryPrice,
      stopPrice: patch.stopPrice ?? d.stopPrice,
      targetPrice: patch.targetPrice ?? d.targetPrice,
    }));
    if (patch.endTime != null || patch.widthBars != null) {
      setPositionUi((ui) => ({
        ...ui,
        endTime: patch.endTime ?? ui.endTime,
        widthBars: patch.widthBars ?? ui.widthBars,
      }));
    }
  }, []);

  const handlePositionSelect = useCallback((selected: boolean) => {
    setPositionUi((ui) => ({ ...ui, selected }));
  }, []);

  const handleArmPositionSide = useCallback((side: 'LONG' | 'SHORT' | null) => {
    if (side == null) {
      setPlacementMode(null);
      return;
    }
    setAdjustLevel(null);
    setPlacementMode(side === 'LONG' ? 'entry_long' : 'entry_short');
  }, []);

  const goToPreviousSession = useCallback(() => {
    if (!canGoPrevSession) return;
    setSessionDate(getAdjacentSessionDate(sessionDate, availableSessions, -1));
    clearTrade();
  }, [canGoPrevSession, sessionDate, availableSessions, clearTrade]);

  const goToNextSession = useCallback(() => {
    if (!canGoNextSession) return;
    setSessionDate(getAdjacentSessionDate(sessionDate, availableSessions, 1));
    clearTrade();
  }, [canGoNextSession, sessionDate, availableSessions, clearTrade]);

  useEffect(() => {
    if (!adjustLevel) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAdjustLevel(null);
        adjustDraggedRef.current = false;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [adjustLevel]);

  const sendToJournal = useCallback(async () => {
    if (!campaign || draft.entryTimestamp == null || draft.entryPrice == null) return;
    setSaving(true);
    try {
      const market_datetime = new Date(draft.entryTimestamp * 1000).toISOString();
      const exit_datetime =
        draft.exitTimestamp != null
          ? new Date(draft.exitTimestamp * 1000).toISOString()
          : null;
      const result = deriveJournalResult(draft);
      await backtestJournalService.saveObservationsBulk(campaign.id, [
        {
          market_datetime,
          exit_datetime,
          direction: draft.direction,
          trade_taken: true,
          setup_valid: true,
          entry_price: priceForJournal(draft.entryPrice),
          exit_price: priceForJournal(draft.exitPrice),
          initial_stop_price: priceForJournal(draft.stopPrice),
          target_price: priceForJournal(draft.targetPrice),
          result_status: result.result_status,
          result_r_source: result.result_r_source,
          ...(result.result_r !== undefined ? { result_r: result.result_r } : {}),
          allow_stop_side_override: true,
          allow_target_side_override: true,
        },
      ]);
      toast.success(t('sentToJournal'));
      setDraft(emptyDraft());
      setPlacementMode(null);
      setAdjustLevel(null);
      setPositionUi(emptyPositionUi());
    } catch (err) {
      toast.error(formatBulkError(err, t('errorSend')));
    } finally {
      setSaving(false);
    }
  }, [campaign, draft, t]);

  const canPlace = Boolean(replay.replayTimestamp);
  const noTimeframes =
    Boolean(instrument.trim()) &&
    !replay.loading &&
    replay.availableTimeframes.length === 0 &&
    !replay.error;
  const hasReplaySession = Boolean(instrument.trim() && replay.range);

  useEffect(() => {
    if (!hasReplaySession) return undefined;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasReplaySession]);

  const goToJournal = useCallback(() => {
    if (!campaign) return;
    const params = new URLSearchParams({
      view: 'grid',
      campaign: String(campaign.id),
      strategy: String(campaign.strategy_id),
    });
    const hash = `backtest-journal?${params.toString()}`;
    if (detached) {
      window.location.assign(`/#${hash}`);
      return;
    }
    window.location.hash = hash;
  }, [campaign, detached]);

  const requestLeaveToJournal = useCallback(() => {
    if (!campaign) return;
    if (hasReplaySession) {
      setShowLeaveConfirm(true);
      return;
    }
    goToJournal();
  }, [campaign, hasReplaySession, goToJournal]);

  const handleDetach = useCallback(() => {
    const params = new URLSearchParams();
    if (instrument.trim()) params.set('instrument', instrument.trim());
    if (sessionDate) params.set('date', sessionDate);
    if (campaign?.id != null) params.set('campaign', String(campaign.id));
    const qs = params.toString();
    const url = qs ? `/market-replay-popup?${qs}` : '/market-replay-popup';

    const width = Math.max(960, Math.round(window.screen.availWidth * 0.9));
    const height = Math.max(700, Math.round(window.screen.availHeight * 0.9));
    const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
    const top = Math.round(window.screenY + (window.outerHeight - height) / 2);

    window.open(
      url,
      'market-replay-popup',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`,
    );
  }, [instrument, sessionDate, campaign?.id]);

  const preferredLevel: TradeLevelKey | null =
    adjustLevel ??
    (placementMode === 'entry_long' || placementMode === 'entry_short'
      ? 'entry'
      : placementMode === 'exit'
        ? 'exit'
        : placementMode === 'stop'
          ? 'stop'
          : placementMode === 'target'
            ? 'target'
            : null);

  return (
    <PageShell variant="fluid" className={detached ? 'flex-1' : undefined}>
      <div className="flex flex-col gap-4 min-h-0 flex-1">
        <div className="mb-0 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-4xl">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t('title')}</h1>
            <p className="mt-2 text-xs text-amber-800 dark:text-amber-200/90 rounded-md border border-amber-200/80 bg-amber-50/90 px-2.5 py-1.5 dark:border-amber-800/60 dark:bg-amber-950/40">
              {t('leaveSessionHint')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!detached ? (
              <button
                type="button"
                onClick={handleDetach}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
                title={t('detachTooltip')}
              >
                <ExternalLink className="w-4 h-4" />
                <span className="text-sm font-medium">{t('detach')}</span>
              </button>
            ) : null}
            {campaign ? (
              <button
                type="button"
                className={`${replayPrimaryButtonClass} min-w-[10.5rem] gap-2 px-5 sm:px-6 shadow-sm`}
                onClick={requestLeaveToJournal}
              >
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                {t('backToJournal')}
              </button>
            ) : null}
          </div>
        </div>
        <div className="shrink-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-wrap items-end gap-3 min-w-0 shrink-0">
              <div className="w-72 min-w-[16rem] max-w-full">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('instrument')}</label>
                <InstrumentPicker
                  value={instrument}
                  onChange={(v) => {
                    setInstrument(v);
                    clearTrade();
                  }}
                />
              </div>
              <div className="min-w-[14rem]">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('sessionDate')}</label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={goToPreviousSession}
                    disabled={
                      !canGoPrevSession ||
                      replay.loading ||
                      !instrument ||
                      availableSessions.length === 0
                    }
                    title={t('previousSession')}
                    aria-label={t('previousSession')}
                    className={`${replaySecondaryButtonClass} !min-w-[2.25rem] !px-2.5 shrink-0 text-lg leading-none`}
                  >
                    ‹
                  </button>
                  <DateInput
                    value={sessionDate}
                    onChange={(v) => {
                      setSessionDate(v);
                      clearTrade();
                    }}
                    className={`${replayDateInputClass} flex-1 min-w-0`}
                    markedDates={availableSessions}
                    markedDatesTitle={t('dateWithData')}
                    allowedDates={availableSessions.length > 0 ? availableSessions : undefined}
                  />
                  <button
                    type="button"
                    onClick={goToNextSession}
                    disabled={
                      !canGoNextSession ||
                      replay.loading ||
                      !instrument ||
                      availableSessions.length === 0
                    }
                    title={t('nextSession')}
                    aria-label={t('nextSession')}
                    className={`${replaySecondaryButtonClass} !min-w-[2.25rem] !px-2.5 shrink-0 text-lg leading-none`}
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 min-w-0">
              <ReplayControls
                compact
                playing={replay.playing}
                speed={replay.speed}
                replayTimestamp={replay.replayTimestamp}
                startTimestamp={replay.range?.start ?? 0}
                endTimestamp={replay.range?.end ?? 0}
                disabled={!replay.range || replay.loading}
                onPlayPause={replay.playPause}
                onStepBack={replay.stepBackward}
                onStepForward={replay.stepForward}
                onGoStart={replay.goStart}
                onGoEnd={replay.goEnd}
                onReset={replay.reset}
                onSpeedChange={replay.changeSpeed}
                onSeek={replay.seek}
              />
              <div
                className="hidden sm:block h-[2.75rem] w-px bg-gray-200 dark:bg-gray-700 shrink-0"
                aria-hidden
              />
              <ReplayTradePanel
                compact
                draft={draft}
                lastPrice={replay.lastPrice}
                campaignId={campaign?.id ?? null}
                campaignName={campaign?.name}
                saving={saving}
                placementMode={placementMode}
                canPlace={canPlace}
                onMarkEntry={markEntry}
                onMarkExit={markExit}
                onSetStop={setStop}
                onSetTarget={setTarget}
                onClear={clearTrade}
                onSendToJournal={sendToJournal}
              />
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-gray-600 dark:text-gray-300 tabular-nums">
            <span className="text-gray-500 dark:text-gray-400 truncate">
              {campaign
                ? t('linkedCampaign', { name: campaign.name || `#${campaign.id}` })
                : t('noCampaign')}
            </span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                <span className="text-gray-400 dark:text-gray-500">{t('direction')} </span>
                <span className="font-medium text-gray-800 dark:text-gray-100">
                  {draft.entryTimestamp == null ? '—' : draft.direction}
                </span>
              </span>
              <span>
                <span className="text-gray-400 dark:text-gray-500">{t('entry')} </span>
                <span className="font-medium text-gray-800 dark:text-gray-100">
                  {draft.entryPrice == null
                    ? '—'
                    : formatNumber(draft.entryPrice, 4, preferences.number_format)}
                </span>
              </span>
              <span>
                <span className="text-gray-400 dark:text-gray-500">{t('stop')} </span>
                <span className="font-medium text-gray-800 dark:text-gray-100">
                  {draft.stopPrice == null
                    ? '—'
                    : formatNumber(draft.stopPrice, 4, preferences.number_format)}
                </span>
              </span>
              <span>
                <span className="text-gray-400 dark:text-gray-500">{t('target')} </span>
                <span className="font-medium text-gray-800 dark:text-gray-100">
                  {draft.targetPrice == null
                    ? '—'
                    : formatNumber(draft.targetPrice, 4, preferences.number_format)}
                </span>
              </span>
              <span>
                <span className="text-gray-400 dark:text-gray-500">{t('exit')} </span>
                <span className="font-medium text-gray-800 dark:text-gray-100">
                  {draft.exitPrice == null
                    ? '—'
                    : formatNumber(draft.exitPrice, 4, preferences.number_format)}
                </span>
              </span>
              <span>
                <span className="text-gray-400 dark:text-gray-500">{t('lastPrice')} </span>
                <span className="font-medium text-gray-800 dark:text-gray-100">
                  {replay.lastPrice == null
                    ? '—'
                    : formatNumber(replay.lastPrice, 4, preferences.number_format)}
                </span>
              </span>
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <input
              type="range"
              min={replay.range?.start ?? 0}
              max={Math.max(replay.range?.end ?? 0, replay.range?.start ?? 0)}
              step={1}
              value={Math.min(
                Math.max(replay.replayTimestamp, replay.range?.start ?? 0),
                replay.range?.end || replay.range?.start || 0,
              )}
              disabled={!replay.range || replay.loading || (replay.range?.end ?? 0) <= (replay.range?.start ?? 0)}
              onChange={(e) => replay.seek(Number(e.target.value))}
              className="w-full h-1.5 accent-blue-600 dark:accent-blue-500 cursor-pointer disabled:opacity-40"
              aria-label={t('timeline')}
            />
          </div>
        </div>

        {replay.error ? (
          <div className="text-sm text-red-600 dark:text-red-400">{replay.error}</div>
        ) : null}
        {noTimeframes ? (
          <div className="text-sm text-amber-700 dark:text-amber-300">
            {t('noHistoricalData')}{' '}
            <button
              type="button"
              className="underline"
              onClick={() => {
                if (detached) {
                  window.location.assign('/#historical-data');
                  return;
                }
                window.location.hash = 'historical-data';
              }}
            >
              {t('goHistoricalData')}
            </button>
          </div>
        ) : null}
        {replay.sessionHasBars === false && replay.latestSessionDate ? (
          <div className="text-sm text-amber-700 dark:text-amber-300">
            {t('noBarsForSession', { date: sessionDate })}{' '}
            <button
              type="button"
              className="underline"
              onClick={() => setSessionDate(replay.latestSessionDate!)}
            >
              {t('useLatestSession', { date: replay.latestSessionDate })}
            </button>
          </div>
        ) : null}

        <ReplayGrid
          panes={panes}
          availableTimeframes={replay.availableTimeframes}
          onTimeframeChange={replay.changePaneTimeframe}
          levels={chartLevels}
          preferredLevel={preferredLevel}
          adjustLevel={adjustLevel}
          onPriceClick={placePriceOnChart}
          onLevelDrag={dragLevelOnChart}
          onAdjustCommit={commitAdjustLevel}
          placementArmed={placementMode != null}
          logarithmic={logarithmic}
          autoFit={autoFit}
          playing={replay.playing}
          onLogarithmicChange={handleLogarithmicChange}
          onAutoFitChange={handleAutoFitChange}
          loading={replay.loading}
          emptySession={replay.sessionHasBars === false}
          positionModel={positionModel}
          positionChartId={positionUi.chartId}
          positionSelected={positionUi.selected}
          onPositionChange={handlePositionChange}
          onPositionSelect={handlePositionSelect}
          onPositionClear={clearTrade}
          armedPositionSide={
            placementMode === 'entry_long'
              ? 'LONG'
              : placementMode === 'entry_short'
                ? 'SHORT'
                : null
          }
          onArmPositionSide={handleArmPositionSide}
          onPrimaryPaneRef={(handle) => {
            primaryPaneRef.current = handle;
          }}
        />
      </div>

      <ConfirmModal
        isOpen={showLeaveConfirm}
        variant="warning"
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={() => {
          setShowLeaveConfirm(false);
          goToJournal();
        }}
        title={t('leaveSessionTitle')}
        message={t('leaveSessionConfirm')}
        confirmButtonText={t('leaveSessionConfirmBtn')}
        cancelButtonText={t('leaveSessionStay')}
      />
    </PageShell>
  );
};

export default MarketReplayPage;
