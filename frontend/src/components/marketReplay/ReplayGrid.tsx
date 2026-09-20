import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ReplayChartPane,
  type ReplayChartPaneHandle,
  type TradeLevelKey,
} from './ReplayChartPane';
import { TimeframeSelect } from './TimeframeSelect';
import { IndicatorSelect } from './IndicatorSelect';
import { DrawingToolSelect, type DrawingScope } from './DrawingToolSelect';
import type { TradeChartLevels } from './ReplayTradePanel';
import type { AvailableTimeframe } from '../../services/marketReplay';
import type { VisibleCandle } from '../../utils/replayEngine';
import {
  buildReplayOverlays,
  emptyPaneIndicators,
  setAvwapAnchor,
  setAvwapStyle,
  toggleAvwap,
  type PaneIndicators,
} from '../../utils/replayIndicators';
import {
  DEFAULT_DRAWING_STYLE,
  type Drawing,
  type DrawingStyle,
  type DrawingTool,
} from '../../utils/replayDrawings';
import { Tooltip } from '../ui';
import { ChartHelpTooltip } from '../charts/ChartHelpTooltip';
import type { PositionOverlayModel } from '../../utils/positionToolPaint';
import type { PositionOverlayChange } from './usePositionOverlay';

export interface ReplayPaneState {
  chartId: string;
  timeframeValue: string | null;
  candles: VisibleCandle[];
}

interface ReplayGridProps {
  panes: ReplayPaneState[];
  availableTimeframes: AvailableTimeframe[];
  onTimeframeChange: (chartId: string, timeframeValue: string) => void;
  levels?: TradeChartLevels;
  preferredLevel?: TradeLevelKey | null;
  adjustLevel?: TradeLevelKey | null;
  onPriceClick?: (price: number, time?: number, chartId?: string) => void;
  onLevelDrag?: (key: TradeLevelKey, price: number) => void;
  onAdjustCommit?: () => void;
  /** Un bouton Entry / SL / TP / Sortie est armé : le clic chart ne pose pas d’AVWAP. */
  placementArmed?: boolean;
  logarithmic?: boolean;
  autoFit?: boolean;
  /** Replay en cours : forcer le suivi des nouvelles bougies même après interaction. */
  playing?: boolean;
  onLogarithmicChange?: (value: boolean) => void;
  onAutoFitChange?: (value: boolean) => void;
  loading?: boolean;
  emptySession?: boolean;
  positionModel?: PositionOverlayModel | null;
  /** Pane hôte de l’overlay Position ; ailleurs l’outil n’est pas rendu. */
  positionChartId?: string | null;
  positionSelected?: boolean;
  onPositionChange?: (patch: PositionOverlayChange) => void;
  onPositionSelect?: (selected: boolean) => void;
  onPositionClear?: () => void;
  armedPositionSide?: 'LONG' | 'SHORT' | null;
  onArmPositionSide?: (side: 'LONG' | 'SHORT' | null) => void;
  /** Accès au premier pane pour plage prix visible au placement. */
  onPrimaryPaneRef?: (handle: ReplayChartPaneHandle | null) => void;
}

const paneToggleClass = (active: boolean) =>
  `inline-flex h-6 items-center rounded px-1.5 text-[11px] font-medium transition-colors ${
    active
      ? 'bg-blue-600 text-white'
      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
  }`;

function cloneDrawings(list: Drawing[]): Drawing[] {
  return structuredClone(list);
}

export const ReplayGrid: React.FC<ReplayGridProps> = ({
  panes,
  availableTimeframes,
  onTimeframeChange,
  levels,
  preferredLevel = null,
  adjustLevel = null,
  onPriceClick,
  onLevelDrag,
  onAdjustCommit,
  placementArmed = false,
  logarithmic = false,
  autoFit = false,
  playing = false,
  onLogarithmicChange,
  onAutoFitChange,
  loading = false,
  emptySession = false,
  positionModel = null,
  positionChartId = null,
  positionSelected = false,
  onPositionChange,
  onPositionSelect,
  onPositionClear,
  armedPositionSide = null,
  onArmPositionSide,
  onPrimaryPaneRef,
}) => {
  const { t } = useTranslation('marketReplay');
  const paneRefs = useRef<Record<string, ReplayChartPaneHandle | null>>({});
  const [indicatorsByPane, setIndicatorsByPane] = useState<Record<string, PaneIndicators>>({});
  const [drawingScope, setDrawingScope] = useState<DrawingScope>('pane');
  const [drawingsByPane, setDrawingsByPane] = useState<Record<string, Drawing[]>>({});
  const [sharedDrawings, setSharedDrawings] = useState<Drawing[]>([]);
  const [selectedDrawingByPane, setSelectedDrawingByPane] = useState<
    Record<string, string | null>
  >({});
  const [armedToolByPane, setArmedToolByPane] = useState<
    Record<string, DrawingTool | null>
  >({});
  const [drawingStyle, setDrawingStyle] = useState<DrawingStyle>(DEFAULT_DRAWING_STYLE);
  const [avwapStyleEditingByPane, setAvwapStyleEditingByPane] = useState<
    Record<string, boolean>
  >({});

  const paneIndicators = useCallback(
    (chartId: string): PaneIndicators => indicatorsByPane[chartId] ?? emptyPaneIndicators(),
    [indicatorsByPane],
  );

  const setPaneIndicators = useCallback((chartId: string, next: PaneIndicators) => {
    setIndicatorsByPane((prev) => ({ ...prev, [chartId]: next }));
    if (!next.avwap) {
      setAvwapStyleEditingByPane((prev) => {
        if (!prev[chartId]) return prev;
        return { ...prev, [chartId]: false };
      });
    }
  }, []);

  const clearAvwapStyleEdit = useCallback((chartId: string) => {
    setAvwapStyleEditingByPane((prev) => ({ ...prev, [chartId]: false }));
  }, []);

  const selectAvwapStyle = useCallback((chartId: string) => {
    setAvwapStyleEditingByPane((prev) => ({ ...prev, [chartId]: true }));
  }, []);

  const getDrawings = useCallback(
    (chartId: string): Drawing[] => {
      const list =
        drawingScope === 'all' ? sharedDrawings : (drawingsByPane[chartId] ?? []);
      // Path temporairement retiré de l’UI — ne pas afficher d’anciens paths
      return list.filter((d) => d.type !== 'path');
    },
    [drawingScope, sharedDrawings, drawingsByPane],
  );

  const setDrawings = useCallback(
    (chartId: string, next: Drawing[]) => {
      if (drawingScope === 'all') {
        setSharedDrawings(next);
      } else {
        setDrawingsByPane((prev) => ({ ...prev, [chartId]: next }));
      }
    },
    [drawingScope],
  );

  const clearSelectionAndTools = useCallback(() => {
    setSelectedDrawingByPane({});
    setArmedToolByPane({});
  }, []);

  const changeScope = useCallback(
    (next: DrawingScope, fromChartId: string) => {
      if (next === drawingScope) return;

      if (next === 'all') {
        const source = drawingsByPane[fromChartId] ?? [];
        setSharedDrawings(cloneDrawings(source));
        setDrawingScope('all');
        clearSelectionAndTools();
        return;
      }

      // all → pane : chaque pane reçoit une copie de la liste partagée
      const copy = cloneDrawings(sharedDrawings);
      const nextByPane: Record<string, Drawing[]> = {};
      for (const pane of panes) {
        nextByPane[pane.chartId] = cloneDrawings(copy);
      }
      setDrawingsByPane(nextByPane);
      setSharedDrawings([]);
      setDrawingScope('pane');
      clearSelectionAndTools();
    },
    [drawingScope, drawingsByPane, sharedDrawings, panes, clearSelectionAndTools],
  );

  const overlaysByPane = useMemo(() => {
    const out: Record<string, ReturnType<typeof buildReplayOverlays>> = {};
    for (const pane of panes) {
      out[pane.chartId] = buildReplayOverlays(
        pane.candles,
        indicatorsByPane[pane.chartId] ?? emptyPaneIndicators(),
      );
    }
    return out;
  }, [panes, indicatorsByPane]);

  return (
    <div className="grid min-h-[480px] flex-1 grid-cols-1 gap-3 auto-rows-[minmax(240px,1fr)] lg:min-h-[560px] lg:grid-cols-2 lg:grid-rows-2">
      {panes.map((pane, paneIndex) => {
        const indicators = paneIndicators(pane.chartId);
        const drawings = getDrawings(pane.chartId);
        const armedTool = armedToolByPane[pane.chartId] ?? null;
        const selectedDrawingId = selectedDrawingByPane[pane.chartId] ?? null;
        const drawingArmed = armedTool != null;
        const positionArmed = armedPositionSide != null;
        const waitingAvwap =
          indicators.avwap &&
          indicators.avwapAnchor == null &&
          !placementArmed &&
          !drawingArmed &&
          !positionArmed &&
          !loading &&
          !emptySession;
        return (
          <div
            key={pane.chartId}
            className="flex min-h-[240px] h-full flex-col overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
          >
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/70">
              <div className="flex min-w-0 items-center gap-2">
                <TimeframeSelect
                  value={pane.timeframeValue}
                  options={availableTimeframes}
                  onChange={(v) => onTimeframeChange(pane.chartId, v)}
                  disabled={loading || availableTimeframes.length === 0}
                />
                <IndicatorSelect
                  value={indicators}
                  onChange={(next) => setPaneIndicators(pane.chartId, next)}
                  disabled={loading}
                  onSelectAvwapStyle={() => selectAvwapStyle(pane.chartId)}
                />
                <DrawingToolSelect
                  armedTool={armedTool}
                  drawingCount={drawings.length}
                  scope={drawingScope}
                  onScopeChange={(next) => changeScope(next, pane.chartId)}
                  disabled={loading || emptySession}
                  armedPositionSide={armedPositionSide}
                  onArmPositionSide={onArmPositionSide}
                  onArmTool={(tool) => {
                    setArmedToolByPane((prev) => ({ ...prev, [pane.chartId]: tool }));
                    if (tool) {
                      onArmPositionSide?.(null);
                      setSelectedDrawingByPane((prev) => ({
                        ...prev,
                        [pane.chartId]: null,
                      }));
                    }
                  }}
                  onClearAll={() => {
                    setDrawings(pane.chartId, []);
                    setSelectedDrawingByPane((prev) => ({
                      ...prev,
                      [pane.chartId]: null,
                    }));
                    setArmedToolByPane((prev) => ({ ...prev, [pane.chartId]: null }));
                  }}
                />
                <ChartHelpTooltip content={t('chartInteractionHint')} />
              </div>
              <div className="flex items-center gap-1">
                <Tooltip content={t('fitToScreenHint')} position="top">
                  <button
                    type="button"
                    className={paneToggleClass(false)}
                    onClick={() => paneRefs.current[pane.chartId]?.fitToScreen()}
                    aria-label={t('fitToScreen')}
                  >
                    {t('fitToScreen')}
                  </button>
                </Tooltip>
                <Tooltip content={t('logarithmicHint')} position="top">
                  <button
                    type="button"
                    className={paneToggleClass(logarithmic)}
                    aria-pressed={logarithmic}
                    onClick={() => onLogarithmicChange?.(!logarithmic)}
                    aria-label={t('logarithmic')}
                  >
                    {t('logarithmic')}
                  </button>
                </Tooltip>
                <Tooltip content={t('autoFitHint')} position="top">
                  <button
                    type="button"
                    className={paneToggleClass(autoFit)}
                    aria-pressed={autoFit}
                    onClick={() => onAutoFitChange?.(!autoFit)}
                    aria-label={t('autoFit')}
                  >
                    {t('autoFit')}
                  </button>
                </Tooltip>
              </div>
            </div>
            <div className="relative min-h-[200px] flex-1 p-1">
              <ReplayChartPane
                ref={(instance) => {
                  paneRefs.current[pane.chartId] = instance;
                  if (paneIndex === 0) onPrimaryPaneRef?.(instance);
                }}
                candles={pane.candles}
                overlays={overlaysByPane[pane.chartId] ?? []}
                levels={levels}
                preferredLevel={preferredLevel}
                adjustLevel={adjustLevel}
                onPriceClick={
                  drawingArmed
                    ? undefined
                    : (price, time) => onPriceClick?.(price, time, pane.chartId)
                }
                onCandleClick={
                  !placementArmed &&
                  !drawingArmed &&
                  !positionArmed &&
                  indicators.avwap &&
                  indicators.avwapAnchor == null
                    ? (time) => {
                        if (!pane.candles.some((c) => c.time === time)) return;
                        setPaneIndicators(pane.chartId, setAvwapAnchor(indicators, time));
                        selectAvwapStyle(pane.chartId);
                      }
                    : undefined
                }
                onLevelDrag={onLevelDrag}
                onAdjustCommit={onAdjustCommit}
                logarithmic={logarithmic}
                autoFit={autoFit}
                playing={playing}
                drawings={drawings}
                selectedDrawingId={selectedDrawingId}
                armedDrawingTool={armedTool}
                drawingStyle={drawingStyle}
                onDrawingsChange={(next) => setDrawings(pane.chartId, next)}
                onSelectedDrawingIdChange={(id) => {
                  setSelectedDrawingByPane((prev) => ({ ...prev, [pane.chartId]: id }));
                  if (id) {
                    clearAvwapStyleEdit(pane.chartId);
                    onPositionSelect?.(false);
                  }
                }}
                positionModel={
                  positionChartId != null && positionChartId === pane.chartId
                    ? positionModel
                    : null
                }
                positionSelected={
                  positionChartId != null && positionChartId === pane.chartId
                    ? positionSelected
                    : false
                }
                onPositionChange={onPositionChange}
                onPositionSelect={(selected) => {
                  onPositionSelect?.(selected);
                  if (selected) {
                    setSelectedDrawingByPane((prev) => ({
                      ...prev,
                      [pane.chartId]: null,
                    }));
                  }
                }}
                onPositionClear={onPositionClear}
                onDrawingStyleChange={setDrawingStyle}
                onArmedDrawingToolChange={(tool) => {
                  setArmedToolByPane((prev) => ({ ...prev, [pane.chartId]: tool }));
                  if (tool) clearAvwapStyleEdit(pane.chartId);
                }}
                avwapStyleEdit={(() => {
                  if (
                    !avwapStyleEditingByPane[pane.chartId] ||
                    !indicators.avwap ||
                    indicators.avwapAnchor == null
                  ) {
                    return null;
                  }
                  return {
                    style: indicators.avwapStyle,
                    anchorTime: indicators.avwapAnchor,
                  };
                })()}
                onAvwapStyleChange={(style) => {
                  setIndicatorsByPane((prev) => {
                    const current = prev[pane.chartId] ?? emptyPaneIndicators();
                    return { ...prev, [pane.chartId]: setAvwapStyle(current, style) };
                  });
                }}
                onAvwapStyleClear={() => {
                  setIndicatorsByPane((prev) => {
                    const current = prev[pane.chartId] ?? emptyPaneIndicators();
                    return { ...prev, [pane.chartId]: toggleAvwap(current, false) };
                  });
                  clearAvwapStyleEdit(pane.chartId);
                }}
                onAvwapStyleDismiss={() => {
                  clearAvwapStyleEdit(pane.chartId);
                }}
                showAttributionLogo={paneIndex === 2}
                className="absolute inset-0 h-full w-full"
              />
              {waitingAvwap && !avwapStyleEditingByPane[pane.chartId] ? (
                <div className="pointer-events-none absolute left-2 top-2 z-10 rounded bg-purple-600/90 px-2 py-1 text-[11px] font-medium text-white shadow">
                  {t('avwapAnchorHint')}
                </div>
              ) : null}
              {loading ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-sm text-gray-400 dark:bg-gray-900/70 dark:text-gray-500">
                  {t('loading')}
                </div>
              ) : emptySession ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center px-4 text-center text-sm text-gray-400 dark:text-gray-500">
                  {t('emptyChart')}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};
