import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  createChart,
  LineStyle,
  PriceScaleMode,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type Logical,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useTranslation } from 'react-i18next';
import { followAppendedBarsRange, type VisibleCandle } from '../../utils/replayEngine';
import type { IndicatorOverlay } from '../../utils/replayIndicators';
import { useTheme } from '../../hooks/useTheme';
import { usePreferences } from '../../hooks/usePreferences';
import {
  getFontStackFromFamily,
  normalizeAppFontFamily,
} from '../../utils/chartConfig';
import { buildChartTimeLocalization } from '../../utils/chartTimeFormatters';
import { formatNumber } from '../../utils/numberFormat';
import {
  logicalIndexToX,
  priceToYExtrapolated,
  timeToLogicalIndex,
} from '../../utils/replayDrawings';
import { getMarketTapeTheme } from '../replay/replayStyles';
import type { TradeChartLevels } from './ReplayTradePanel';
import { DrawingStyleBar } from './DrawingStyleBar';
import { useChartDrawings } from './useChartDrawings';
import { readVisiblePriceRange } from './usePositionOverlay';
import {
  usePositionOverlayBox,
  type PositionOverlayChange,
  type PositionOverlayModel,
} from './PositionOverlayBox';
import {
  DEFAULT_DRAWING_STYLE,
  type Drawing,
  type DrawingStyle,
  type DrawingTool,
} from '../../utils/replayDrawings';

export type TradeLevelKey = 'entry' | 'exit' | 'stop' | 'target';

export interface ReplayChartPaneHandle {
  fitToScreen: () => void;
  getVisiblePriceRange: () => number;
}

interface ReplayChartPaneProps {
  candles: VisibleCandle[];
  levels?: TradeChartLevels;
  /** Niveau armé dans le panneau : prioritaire au hit-test si proche. */
  preferredLevel?: TradeLevelKey | null;
  /** Poignée temporaire après premier placement SL / TP / Sortie. */
  adjustLevel?: TradeLevelKey | null;
  onPriceClick?: (price: number, time?: number) => void;
  /** Clic sur une bougie (unix open) — AVWAP, etc. */
  onCandleClick?: (time: number) => void;
  onLevelDrag?: (key: TradeLevelKey, price: number) => void;
  /** Appelé au mouseup après un drag réel en mode poignée. */
  onAdjustCommit?: () => void;
  /** Échelle de prix logarithmique (forcée Normal si prix ≤ 0). */
  logarithmic?: boolean;
  /** Recentrer tout le contenu visible à chaque update des bougies. */
  autoFit?: boolean;
  /** Replay en lecture : suivre les nouvelles bougies même après interaction chart. */
  playing?: boolean;
  overlays?: IndicatorOverlay[];
  drawings?: Drawing[];
  selectedDrawingId?: string | null;
  armedDrawingTool?: DrawingTool | null;
  drawingStyle?: DrawingStyle;
  onDrawingsChange?: (next: Drawing[]) => void;
  onSelectedDrawingIdChange?: (id: string | null) => void;
  onDrawingStyleChange?: (style: DrawingStyle) => void;
  onArmedDrawingToolChange?: (tool: DrawingTool | null) => void;
  /** Overlay Position (DraftTrade). */
  positionModel?: PositionOverlayModel | null;
  positionSelected?: boolean;
  onPositionChange?: (patch: PositionOverlayChange) => void;
  onPositionSelect?: (selected: boolean) => void;
  onPositionClear?: () => void;
  /** Édition style AVWAP (barre flottante près de l’ancre) ; null = pas d’édition. */
  avwapStyleEdit?: { style: DrawingStyle; anchorTime: number } | null;
  onAvwapStyleChange?: (style: DrawingStyle) => void;
  /** Désactive l’AVWAP (croix, comme supprimer un dessin). */
  onAvwapStyleClear?: () => void;
  /** Ferme uniquement la barre (clic à côté sur le graphique). */
  onAvwapStyleDismiss?: () => void;
  /** Affiche le logo TradingView (licence lightweight-charts). */
  showAttributionLogo?: boolean;
  className?: string;
}

const DEFAULT_BAR_SPACING = 8;
const RIGHT_PAD_BARS = 4;
/** Zone de clic/glisser autour d’une price line (px). */
const LINE_HIT_PX = 18;
/** Si plusieurs lignes dans cette marge, départager (SL/TP > Entry). */
const LINE_TIE_PX = 12;

const CANDLE_COLORS = {
  upColor: '#16a34a',
  downColor: '#dc2626',
  borderUpColor: '#16a34a',
  borderDownColor: '#dc2626',
  wickUpColor: '#16a34a',
  wickDownColor: '#dc2626',
} as const;

const LEVEL_KEYS: TradeLevelKey[] = ['entry', 'stop', 'target', 'exit'];

const ADJUSTABLE_LEVELS: TradeLevelKey[] = ['stop', 'target', 'exit'];

function resolveAppFontStack(fontFamily: string | undefined): string {
  return getFontStackFromFamily(normalizeAppFontFamily(fontFamily));
}

function resolveAvwapStyleBarAnchor(
  chart: IChartApi,
  series: ISeriesApi<'Candlestick'>,
  candles: VisibleCandle[],
  overlays: IndicatorOverlay[],
  anchorTime: number,
  containerWidth: number,
  containerHeight: number,
): { left: number; top: number } {
  const avwap = overlays.find((o) => o.id === 'avwap');
  const firstPoint = avwap?.data[0];
  const pointTime = firstPoint?.time ?? anchorTime;
  const pointPrice =
    firstPoint?.value ??
    candles.find((c) => c.time === anchorTime)?.close ??
    candles.find((c) => c.time >= anchorTime)?.close ??
    null;

  let x: number | null = chart.timeScale().timeToCoordinate(pointTime as UTCTimestamp);
  if (x == null) {
    const times = candles.map((c) => c.time);
    const logical = timeToLogicalIndex(times, pointTime);
    if (logical != null) {
      const timeScale = chart.timeScale();
      x = logicalIndexToX(
        logical,
        (l) => timeScale.logicalToCoordinate(l as Logical),
        timeScale.getVisibleLogicalRange(),
      );
    }
  }

  let y: number | null = null;
  if (pointPrice != null) {
    y = priceToYExtrapolated(
      pointPrice,
      containerHeight,
      (p) => series.priceToCoordinate(p),
      (py) => series.coordinateToPrice(py),
    );
  }

  if (x == null || y == null) {
    return { left: 8, top: 8 };
  }

  return {
    left: Math.min(containerWidth - 220, Math.max(4, x + 10)),
    top: Math.min(containerHeight - 44, Math.max(4, y - 40)),
  };
}

function scaleBorderColor(isDark: boolean): string {
  return isDark ? 'rgba(75, 85, 99, 0.8)' : 'rgba(209, 213, 219, 0.9)';
}

function themeOptions(isDark: boolean, fontStack: string, attributionLogo = true) {
  const textColor = isDark ? '#9ca3af' : '#6b7280';
  const gridColor = isDark ? 'rgba(75, 85, 99, 0.35)' : 'rgba(209, 213, 219, 0.55)';
  const crossColor = isDark ? 'rgba(156, 163, 175, 0.4)' : 'rgba(107, 114, 128, 0.35)';
  const labelBg = isDark ? '#374151' : '#e5e7eb';
  const borderColor = scaleBorderColor(isDark);
  return {
    layout: {
      background: { color: 'transparent' as const },
      textColor,
      fontFamily: fontStack,
      attributionLogo,
    },
    grid: {
      vertLines: { visible: false },
      horzLines: { color: gridColor },
    },
    crosshair: {
      mode: 1 as const,
      vertLine: { color: crossColor, labelBackgroundColor: labelBg },
      horzLine: { color: crossColor, labelBackgroundColor: labelBg },
    },
    rightPriceScale: { borderVisible: true, borderColor },
    timeScale: { borderVisible: true, borderColor },
  };
}

function applyDefaultVisibleRange(chart: IChartApi, candleCount: number, widthPx: number) {
  if (candleCount <= 0) return;
  chart.timeScale().applyOptions({ barSpacing: DEFAULT_BAR_SPACING });
  const visibleBars = Math.max(20, Math.floor(Math.max(widthPx, 320) / DEFAULT_BAR_SPACING) - RIGHT_PAD_BARS);
  if (candleCount <= visibleBars) {
    chart.timeScale().fitContent();
    return;
  }
  const to = Math.max(candleCount - 1, 0) + RIGHT_PAD_BARS;
  const from = Math.max(0, to - visibleBars + 1);
  chart.timeScale().setVisibleLogicalRange({ from, to });
}

function candlesHaveNonPositivePrice(candles: VisibleCandle[]): boolean {
  return candles.some(
    (c) => c.open <= 0 || c.high <= 0 || c.low <= 0 || c.close <= 0,
  );
}

function applyPriceScaleMode(chart: IChartApi, logarithmic: boolean, candles: VisibleCandle[]) {
  const useLog = logarithmic && !candlesHaveNonPositivePrice(candles);
  chart.priceScale('right').applyOptions({
    mode: useLog ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
  });
}

function priceOf(levels: TradeChartLevels | undefined, key: TradeLevelKey): number | null {
  if (!levels) return null;
  if (key === 'entry') return levels.entryPrice;
  if (key === 'exit') return levels.exitPrice;
  if (key === 'stop') return levels.stopPrice;
  return levels.targetPrice;
}

/** Entry perd les égalités : sinon elle « vole » SL/TP placés juste à côté. */
function overlapRank(key: TradeLevelKey, preferred?: TradeLevelKey | null): number {
  if (preferred && key === preferred) return 0;
  if (key === 'entry') return 2;
  return 1;
}

function findNearestLevel(
  series: ISeriesApi<'Candlestick'>,
  levels: TradeChartLevels | undefined,
  y: number,
  preferred?: TradeLevelKey | null,
  exclusive?: TradeLevelKey | null,
): TradeLevelKey | null {
  if (!levels) return null;

  const keys = exclusive ? [exclusive] : LEVEL_KEYS;
  const hits: Array<{ key: TradeLevelKey; dist: number }> = [];
  for (const key of keys) {
    const price = priceOf(levels, key);
    if (price == null || !Number.isFinite(price)) continue;
    const cy = series.priceToCoordinate(price);
    if (cy == null) continue;
    const dist = Math.abs(cy - y);
    const hitPx = exclusive ? LINE_HIT_PX + 10 : LINE_HIT_PX;
    if (dist <= hitPx) hits.push({ key, dist });
  }
  if (hits.length === 0) return null;

  hits.sort((a, b) => {
    if (Math.abs(a.dist - b.dist) > LINE_TIE_PX) return a.dist - b.dist;
    const rankDiff = overlapRank(a.key, preferred) - overlapRank(b.key, preferred);
    if (rankDiff !== 0) return rankDiff;
    return a.dist - b.dist;
  });
  return hits[0].key;
}

function handleTone(key: TradeLevelKey, isDark: boolean): { bg: string; border: string; text: string } {
  const theme = getMarketTapeTheme(isDark);
  if (key === 'stop') {
    return {
      bg: isDark ? 'rgba(234, 88, 12, 0.95)' : 'rgba(234, 88, 12, 0.95)',
      border: theme.stopLossPlannedLine,
      text: '#ffffff',
    };
  }
  if (key === 'target') {
    return {
      bg: isDark ? 'rgba(37, 99, 235, 0.95)' : 'rgba(37, 99, 235, 0.95)',
      border: theme.fillDot,
      text: '#ffffff',
    };
  }
  return {
    bg: isDark ? 'rgba(100, 116, 139, 0.95)' : 'rgba(71, 85, 105, 0.95)',
    border: theme.orderRing,
    text: '#ffffff',
  };
}

const SCROLL_ON = {
  mouseWheel: true,
  pressedMouseMove: true,
  horzTouchDrag: true,
  vertTouchDrag: true,
};
const SCROLL_OFF = {
  mouseWheel: true,
  pressedMouseMove: false,
  horzTouchDrag: false,
  vertTouchDrag: false,
};
const SCALE_ON = {
  mouseWheel: true,
  pinch: true,
  axisPressedMouseMove: { time: true, price: true },
  axisDoubleClickReset: true,
};
const SCALE_OFF = {
  mouseWheel: false,
  pinch: false,
  axisPressedMouseMove: false,
  axisDoubleClickReset: false,
};

export const ReplayChartPane = forwardRef<ReplayChartPaneHandle, ReplayChartPaneProps>(function ReplayChartPane(
  {
    candles,
    levels,
    preferredLevel = null,
    adjustLevel = null,
    onPriceClick,
    onCandleClick,
    onLevelDrag,
    onAdjustCommit,
    logarithmic = false,
    autoFit = false,
    playing = false,
    overlays = [],
    drawings = [],
    selectedDrawingId = null,
    armedDrawingTool = null,
    drawingStyle = DEFAULT_DRAWING_STYLE,
    onDrawingsChange,
    onSelectedDrawingIdChange,
    onDrawingStyleChange,
    onArmedDrawingToolChange,
    positionModel = null,
    positionSelected = false,
    onPositionChange,
    onPositionSelect,
    onPositionClear,
    avwapStyleEdit = null,
    onAvwapStyleChange,
    onAvwapStyleClear,
    onAvwapStyleDismiss,
    showAttributionLogo = false,
    className = '',
  },
  ref,
) {
  const { t, i18n } = useTranslation('marketReplay');
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const priceLinesRef = useRef<Partial<Record<TradeLevelKey, IPriceLine>>>({});
  /** Étiquettes d’axe des dessins horizontaux, indexées par id de dessin. */
  const drawingPriceLinesRef = useRef<Map<string, IPriceLine>>(new Map());
  const levelsRef = useRef(levels);
  levelsRef.current = levels;
  const preferredLevelRef = useRef(preferredLevel);
  preferredLevelRef.current = preferredLevel;
  const adjustLevelRef = useRef(adjustLevel);
  adjustLevelRef.current = adjustLevel;
  const userAdjustedViewRef = useRef(false);
  const programmaticRangeRef = useRef(false);
  const lastCandleCountRef = useRef(0);
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const onPriceClickRef = useRef(onPriceClick);
  onPriceClickRef.current = onPriceClick;
  const onCandleClickRef = useRef(onCandleClick);
  onCandleClickRef.current = onCandleClick;
  const avwapStyleEditRef = useRef(avwapStyleEdit);
  avwapStyleEditRef.current = avwapStyleEdit;
  const onAvwapStyleDismissRef = useRef(onAvwapStyleDismiss);
  onAvwapStyleDismissRef.current = onAvwapStyleDismiss;
  const overlaySeriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const [chartReady, setChartReady] = useState(false);
  const onLevelDragRef = useRef(onLevelDrag);
  onLevelDragRef.current = onLevelDrag;
  const onAdjustCommitRef = useRef(onAdjustCommit);
  onAdjustCommitRef.current = onAdjustCommit;
  const dragKeyRef = useRef<TradeLevelKey | null>(null);
  const didDragRef = useRef(false);
  const hadLayoutSizeRef = useRef(false);
  const handleDraggingRef = useRef(false);
  const drawingLockRef = useRef(false);
  const { isDark } = useTheme();
  const { preferences } = usePreferences();
  const fontStack = resolveAppFontStack(preferences.font_family);
  const chartTimezone = preferences.timezone?.trim() || 'Europe/Paris';
  const chartLanguage = i18n.language;
  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;
  const chartTimezoneRef = useRef(chartTimezone);
  chartTimezoneRef.current = chartTimezone;
  const chartLanguageRef = useRef(chartLanguage);
  chartLanguageRef.current = chartLanguage;
  const showAttributionLogoRef = useRef(showAttributionLogo);
  showAttributionLogoRef.current = showAttributionLogo;

  const [handleTop, setHandleTop] = useState<number | null>(null);
  const [avwapStyleBarAnchor, setAvwapStyleBarAnchor] = useState<{
    left: number;
    top: number;
  } | null>(null);

  const setChartInteractionLocked = useCallback((locked: boolean) => {
    drawingLockRef.current = locked;
    const chart = chartRef.current;
    const el = containerRef.current;
    if (!chart) return;
    chart.applyOptions({
      handleScroll: locked ? SCROLL_OFF : SCROLL_ON,
      handleScale: locked ? SCALE_OFF : SCALE_ON,
    });
    if (el && !locked && !dragKeyRef.current && !handleDraggingRef.current) {
      el.style.cursor = armedDrawingTool ? 'crosshair' : '';
    }
  }, [armedDrawingTool]);

  const drawingsEnabled = Boolean(onDrawingsChange);
  const positionEnabled = Boolean(onPositionChange);
  const hideEntryStopTargetLines = Boolean(positionModel);
  const hideTradeLinesRef = useRef(hideEntryStopTargetLines);
  hideTradeLinesRef.current = hideEntryStopTargetLines;

  const paintOntoPositionRef = useRef<
    ((ctx: CanvasRenderingContext2D, mapper: import('../../utils/replayDrawings').CoordMapper) => void) | null
  >(null);

  const onAfterPaint = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      mapper: import('../../utils/replayDrawings').CoordMapper,
    ) => {
      paintOntoPositionRef.current?.(ctx, mapper);
    },
    [],
  );

  const {
    canvasRef,
    paint: paintDrawings,
    styleAnchor,
    selectedDrawing,
    tryHandlePointerDown,
    tryHandlePointerMove,
    tryHandlePointerUp,
    tryHandleDoubleClick,
    consumeClickIfDrawing,
    deleteSelected,
    applyStyleToSelected,
  } = useChartDrawings({
    chartRef,
    seriesRef,
    containerRef,
    candles,
    drawings,
    selectedDrawingId,
    armedTool: armedDrawingTool,
    drawingStyle,
    onDrawingsChange: onDrawingsChange ?? (() => undefined),
    onSelectedDrawingIdChange: onSelectedDrawingIdChange ?? (() => undefined),
    onDrawingStyleChange: onDrawingStyleChange ?? (() => undefined),
    onArmToolChange: onArmedDrawingToolChange ?? (() => undefined),
    setChartInteractionLocked,
    enabled: drawingsEnabled,
    onAfterPaint,
  });

  const {
    paintOnto: paintPositionOnto,
    tryHandlePointerDown: tryPositionPointerDown,
    tryHandlePointerMove: tryPositionPointerMove,
    tryHandlePointerUp: tryPositionPointerUp,
    consumeClickIfPosition,
    isInsidePositionBox: isInsidePositionBox,
  } = usePositionOverlayBox({
    chartRef,
    seriesRef,
    containerRef,
    candles,
    model: positionModel ?? null,
    selected: positionSelected,
    isDark,
    levels,
    preferredLevel,
    findNearestLevel,
    onChange: onPositionChange ?? (() => undefined),
    onSelect: onPositionSelect ?? (() => undefined),
    onClear: onPositionClear ?? (() => undefined),
    setChartInteractionLocked,
    requestPaint: paintDrawings,
    enabled: positionEnabled,
  });
  paintOntoPositionRef.current = paintPositionOnto;

  useImperativeHandle(ref, () => ({
    fitToScreen() {
      const chart = chartRef.current;
      if (!chart || lastCandleCountRef.current <= 0) return;
      programmaticRangeRef.current = true;
      chart.timeScale().fitContent();
      userAdjustedViewRef.current = true;
      requestAnimationFrame(() => {
        programmaticRangeRef.current = false;
        updateHandlePosition();
        paintDrawings();
      });
    },
    getVisiblePriceRange() {
      return readVisiblePriceRange(
        seriesRef.current,
        containerRef.current?.clientHeight ?? 0,
        candles,
      );
    },
  }));

  const updateHandlePosition = useCallback(() => {
    const series = seriesRef.current;
    const key = adjustLevelRef.current;
    if (!series || !key || !ADJUSTABLE_LEVELS.includes(key)) {
      setHandleTop(null);
      return;
    }
    // Poignée HTML seulement pour exit si overlay Position actif
    if (hideTradeLinesRef.current && (key === 'stop' || key === 'target')) {
      setHandleTop(null);
      return;
    }
    const price = priceOf(levelsRef.current, key);
    if (price == null || !Number.isFinite(price)) {
      setHandleTop(null);
      return;
    }
    const y = series.priceToCoordinate(price);
    setHandleTop(y == null ? null : y);
  }, []);

  const drawingHandlersRef = useRef({
    tryHandlePointerDown,
    tryHandlePointerMove,
    tryHandlePointerUp,
    tryHandleDoubleClick,
    consumeClickIfDrawing,
    paintDrawings,
    tryPositionPointerDown,
    tryPositionPointerMove,
    tryPositionPointerUp,
    consumeClickIfPosition,
    isInsidePositionBox,
  });
  drawingHandlersRef.current = {
    tryHandlePointerDown,
    tryHandlePointerMove,
    tryHandlePointerUp,
    tryHandleDoubleClick,
    consumeClickIfDrawing,
    paintDrawings,
    tryPositionPointerDown,
    tryPositionPointerMove,
    tryPositionPointerUp,
    consumeClickIfPosition,
    isInsidePositionBox,
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const timeLocalization = buildChartTimeLocalization(
      chartTimezoneRef.current,
      chartLanguageRef.current,
    );
    const chart = createChart(el, {
      ...themeOptions(isDarkRef.current, fontStack, showAttributionLogoRef.current),
      localization: timeLocalization.localization,
      rightPriceScale: {
        borderVisible: true,
        borderColor: scaleBorderColor(isDarkRef.current),
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderVisible: true,
        borderColor: scaleBorderColor(isDarkRef.current),
        timeVisible: true,
        secondsVisible: false,
        rightOffset: RIGHT_PAD_BARS,
        barSpacing: DEFAULT_BAR_SPACING,
        minBarSpacing: 2,
        tickMarkFormatter: timeLocalization.timeScale.tickMarkFormatter,
      },
      handleScroll: SCROLL_ON,
      handleScale: SCALE_ON,
      width: el.clientWidth,
      height: el.clientHeight || 220,
    });
    const series = chart.addCandlestickSeries({ ...CANDLE_COLORS });
    chartRef.current = chart;
    seriesRef.current = series;
    setChartReady(true);

    const onDblClick = (event: MouseEvent) => {
      if (drawingHandlersRef.current.tryHandleDoubleClick(event)) return;
      if (dragKeyRef.current || handleDraggingRef.current || drawingLockRef.current) return;
      const count = lastCandleCountRef.current;
      if (count <= 0) return;
      programmaticRangeRef.current = true;
      applyDefaultVisibleRange(chart, count, el.clientWidth || 400);
      userAdjustedViewRef.current = false;
      requestAnimationFrame(() => {
        programmaticRangeRef.current = false;
        updateHandlePosition();
        drawingHandlersRef.current.paintDrawings();
      });
    };
    el.addEventListener('dblclick', onDblClick);

    const onRangeChange = () => {
      // Toujours repeindre : le canvas overlay (dessins, Position) doit suivre
      // le chart même lors d’un décalage programmatique (nouvelle bougie).
      updateHandlePosition();
      drawingHandlersRef.current.paintDrawings();
      if (programmaticRangeRef.current || dragKeyRef.current) return;
      // Play / lock interaction : ne pas figer le suivi des nouvelles bougies.
      if (playingRef.current || drawingLockRef.current) return;
      userAdjustedViewRef.current = true;
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);

    const setDraggingUi = (dragging: boolean) => {
      chart.applyOptions({
        handleScroll: dragging ? SCROLL_OFF : SCROLL_ON,
        handleScale: dragging ? SCALE_OFF : SCALE_ON,
      });
      el.style.cursor = dragging ? 'ns-resize' : '';
    };

    const exclusiveHit = () =>
      adjustLevelRef.current && ADJUSTABLE_LEVELS.includes(adjustLevelRef.current)
        ? adjustLevelRef.current
        : null;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !seriesRef.current) return;
      if (handleDraggingRef.current) return;
      if (drawingHandlersRef.current.tryPositionPointerDown(event)) return;
      if (drawingHandlersRef.current.tryHandlePointerDown(event)) return;
      const rect = el.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const hit = findNearestLevel(
        seriesRef.current,
        levelsRef.current,
        y,
        preferredLevelRef.current,
        exclusiveHit(),
      );
      if (!hit) return;
      // Overlay Position : entry/SL/TP uniquement dans la boîte (pas hors outil).
      // La sortie reste saisissable sur toute la largeur.
      if (
        hideTradeLinesRef.current &&
        hit !== 'exit' &&
        !drawingHandlersRef.current.isInsidePositionBox(x, y)
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      dragKeyRef.current = hit;
      didDragRef.current = false;
      setDraggingUi(true);
      try {
        el.setPointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!seriesRef.current) return;
      if (handleDraggingRef.current) return;
      if (drawingHandlersRef.current.tryPositionPointerMove(event)) return;
      if (drawingHandlersRef.current.tryHandlePointerMove(event)) return;
      const rect = el.getBoundingClientRect();
      const y = event.clientY - rect.top;

      if (!dragKeyRef.current) {
        if (drawingLockRef.current) return;
        // Overlay Position actif : le curseur est géré par l’outil (dans la boîte).
        // Ne pas réappliquer ns-resize sur toute la largeur du chart (même Y que SL/TP).
        if (hideTradeLinesRef.current) {
          return;
        }
        const hit = findNearestLevel(
          seriesRef.current,
          levelsRef.current,
          y,
          preferredLevelRef.current,
          exclusiveHit(),
        );
        el.style.cursor = hit ? 'ns-resize' : '';
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const price = seriesRef.current.coordinateToPrice(y);
      if (price == null || !Number.isFinite(price)) return;
      didDragRef.current = true;
      const key = dragKeyRef.current;
      const line = priceLinesRef.current[key];
      line?.applyOptions({ price });
      onLevelDragRef.current?.(key, price);
      updateHandlePosition();
    };

    const endDrag = (event: PointerEvent) => {
      if (drawingHandlersRef.current.tryPositionPointerUp(event)) return;
      if (drawingHandlersRef.current.tryHandlePointerUp(event)) return;
      if (!dragKeyRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      const key = dragKeyRef.current;
      const didDrag = didDragRef.current;
      dragKeyRef.current = null;
      setDraggingUi(false);
      try {
        el.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
      if (didDrag && adjustLevelRef.current === key) {
        onAdjustCommitRef.current?.();
      }
    };

    el.addEventListener('pointerdown', onPointerDown, { capture: true });
    el.addEventListener('pointermove', onPointerMove, { capture: true });
    el.addEventListener('pointerup', endDrag, { capture: true });
    el.addEventListener('pointercancel', endDrag, { capture: true });

    chart.subscribeClick((param) => {
      if (drawingHandlersRef.current.consumeClickIfPosition()) return;
      if (drawingHandlersRef.current.consumeClickIfDrawing()) return;
      if (didDragRef.current) {
        didDragRef.current = false;
        return;
      }
      if (handleDraggingRef.current) return;
      const rawTime = param.time;
      // Premier ancrage AVWAP : le clic pose l’ancre et ouvre la barre.
      if (typeof rawTime === 'number' && onCandleClickRef.current) {
        onCandleClickRef.current(rawTime);
        return;
      }
      // Clic à côté : fermer la barre de style AVWAP (comme désélectionner une trend line).
      if (avwapStyleEditRef.current) {
        onAvwapStyleDismissRef.current?.();
      }
      if (!param.point || !seriesRef.current) return;
      const price = seriesRef.current.coordinateToPrice(param.point.y);
      if (price == null || !Number.isFinite(price)) return;
      const clickTime = typeof rawTime === 'number' ? rawTime : undefined;
      onPriceClickRef.current?.(price, clickTime);
    });

    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      chartRef.current.applyOptions({
        width,
        height: height || 220,
      });
      if (
        !hadLayoutSizeRef.current &&
        width > 0 &&
        height > 0 &&
        lastCandleCountRef.current > 0 &&
        !userAdjustedViewRef.current
      ) {
        hadLayoutSizeRef.current = true;
        programmaticRangeRef.current = true;
        applyDefaultVisibleRange(chartRef.current, lastCandleCountRef.current, width);
        requestAnimationFrame(() => {
          programmaticRangeRef.current = false;
          updateHandlePosition();
          drawingHandlersRef.current.paintDrawings();
        });
      } else if (width > 0 && height > 0) {
        hadLayoutSizeRef.current = true;
        updateHandlePosition();
        drawingHandlersRef.current.paintDrawings();
      }
    });
    ro.observe(el);
    const overlayMap = overlaySeriesRef.current;
    const drawingLabels = drawingPriceLinesRef.current;

    return () => {
      el.removeEventListener('dblclick', onDblClick);
      el.removeEventListener('pointerdown', onPointerDown, true);
      el.removeEventListener('pointermove', onPointerMove, true);
      el.removeEventListener('pointerup', endDrag, true);
      el.removeEventListener('pointercancel', endDrag, true);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
      ro.disconnect();
      overlayMap.clear();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      priceLinesRef.current = {};
      drawingLabels.clear();
      hadLayoutSizeRef.current = false;
      setChartReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions(themeOptions(isDark, fontStack, showAttributionLogo));
  }, [isDark, fontStack, showAttributionLogo]);

  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions(buildChartTimeLocalization(chartTimezone, chartLanguage));
  }, [chartTimezone, chartLanguage]);

  useEffect(() => {
    if (!playing || !drawingLockRef.current) return;
    setChartInteractionLocked(false);
  }, [playing, setChartInteractionLocked]);

  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const el = containerRef.current;
    if (!chart || !series || !el || !chartReady || !avwapStyleEdit) {
      setAvwapStyleBarAnchor(null);
      return undefined;
    }

    const updateAnchor = () => {
      setAvwapStyleBarAnchor(
        resolveAvwapStyleBarAnchor(
          chart,
          series,
          candles,
          overlays,
          avwapStyleEdit.anchorTime,
          el.clientWidth || 400,
          el.clientHeight || 220,
        ),
      );
    };

    updateAnchor();
    // Recalcul après layout / données (coords parfois null au premier frame)
    const raf = requestAnimationFrame(updateAnchor);
    chart.timeScale().subscribeVisibleLogicalRangeChange(updateAnchor);
    return () => {
      cancelAnimationFrame(raf);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(updateAnchor);
    };
  }, [avwapStyleEdit, candles, overlays, chartReady]);

  useEffect(() => {
    if (!chartRef.current) return;
    applyPriceScaleMode(chartRef.current, logarithmic, candles);
  }, [logarithmic, candles]);

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    const data: CandlestickData[] = candles.map((c) => ({
      time: c.time as CandlestickData['time'],
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    const prevCount = lastCandleCountRef.current;
    const chart = chartRef.current;
    // Plage lue AVANT setData : LWC peut la déplacer lui-même à l’ajout d’une barre.
    const rangeBefore = chart.timeScale().getVisibleLogicalRange();
    seriesRef.current.setData(data);
    lastCandleCountRef.current = data.length;

    const repaint = () => {
      updateHandlePosition();
      drawingHandlersRef.current.paintDrawings();
    };
    const finishProgrammatic = () => {
      requestAnimationFrame(() => {
        programmaticRangeRef.current = false;
        repaint();
      });
    };

    if (data.length === 0) {
      repaint();
      return;
    }

    if (autoFit) {
      programmaticRangeRef.current = true;
      chart.timeScale().fitContent();
      finishProgrammatic();
      return;
    }

    if (prevCount === 0) {
      const width = containerRef.current?.clientWidth || 400;
      programmaticRangeRef.current = true;
      applyDefaultVisibleRange(chart, data.length, width);
      userAdjustedViewRef.current = false;
      finishProgrammatic();
      return;
    }

    // Nouvelle(s) bougie(s) : translater la vue courante (zoom et position
    // relative conservés) au lieu de réappliquer la plage par défaut, afin que
    // l’outil Position et les dessins restent alignés sur les mêmes bougies.
    const followRange = followAppendedBarsRange(
      rangeBefore ? { from: rangeBefore.from, to: rangeBefore.to } : null,
      prevCount,
      data.length,
    );
    if (followRange) {
      if (drawingLockRef.current) {
        setChartInteractionLocked(false);
      }
      programmaticRangeRef.current = true;
      chart.timeScale().setVisibleLogicalRange(followRange);
      finishProgrammatic();
      return;
    }
    repaint();
  }, [candles, autoFit, updateHandlePosition, setChartInteractionLocked]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !chartReady) return;
    const map = overlaySeriesRef.current;
    const nextIds = new Set(overlays.map((overlay) => overlay.id));
    for (const [id, series] of map) {
      if (!nextIds.has(id)) {
        chart.removeSeries(series);
        map.delete(id);
      }
    }
    for (const overlay of overlays) {
      const lineWidth = Math.min(4, Math.max(1, Math.round(overlay.lineWidth ?? 2))) as 1 | 2 | 3 | 4;
      let series = map.get(overlay.id);
      if (!series) {
        series = chart.addLineSeries({
          color: overlay.color,
          lineWidth,
          lastValueVisible: true,
          priceLineVisible: false,
          title: overlay.title,
        });
        map.set(overlay.id, series);
      } else {
        series.applyOptions({
          color: overlay.color,
          lineWidth,
          title: overlay.title,
        });
      }
      const data: LineData[] = overlay.data.map((point) => ({
        time: point.time as UTCTimestamp,
        value: point.value,
      }));
      series.setData(data);
    }
  }, [chartReady, overlays]);

  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    if (dragKeyRef.current || handleDraggingRef.current) return;

    const theme = getMarketTapeTheme(isDark);
    const specs: Record<
      TradeLevelKey,
      { price: number | null; color: string; title: string; style: LineStyle }
    > = {
      entry: {
        price: levels?.entryPrice ?? null,
        color:
          levels?.direction === 'SHORT' ? theme.entryShort : theme.entryLong,
        title: 'Entry',
        style: LineStyle.Solid,
      },
      stop: {
        price: levels?.stopPrice ?? null,
        color: theme.stopLossPlannedLine,
        title: 'Stop',
        style: LineStyle.Dashed,
      },
      target: {
        price: levels?.targetPrice ?? null,
        color: theme.fillDot,
        title: 'TP',
        style: LineStyle.Dashed,
      },
      exit: {
        price: levels?.exitPrice ?? null,
        color: theme.orderRing,
        title: 'Exit',
        style: LineStyle.Solid,
      },
    };

    for (const key of LEVEL_KEYS) {
      const spec = specs[key];
      const existing = priceLinesRef.current[key];
      // Overlay Position : la boîte dessine déjà les niveaux, on garde la ligne
      // invisible pour conserver l’étiquette de prix sur l’axe.
      const axisLabelOnly =
        hideEntryStopTargetLines &&
        (key === 'entry' || key === 'stop' || key === 'target');
      if (spec.price == null || !Number.isFinite(spec.price)) {
        if (existing) {
          series.removePriceLine(existing);
          delete priceLinesRef.current[key];
        }
        continue;
      }
      const options = {
        price: spec.price,
        color: spec.color,
        lineWidth: 2 as const,
        lineStyle: spec.style,
        lineVisible: !axisLabelOnly,
        axisLabelVisible: true,
        title: axisLabelOnly ? '' : spec.title,
      };
      if (existing) {
        existing.applyOptions(options);
      } else {
        priceLinesRef.current[key] = series.createPriceLine(options);
      }
    }
    updateHandlePosition();
  }, [levels, isDark, hideEntryStopTargetLines, updateHandlePosition]);

  /** Étiquettes de prix sur l’axe pour les dessins horizontaux (ligne invisible). */
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const map = drawingPriceLinesRef.current;
    const wanted = new Map<string, { price: number; color: string }>();
    for (const drawing of drawings) {
      if (drawing.type === 'horizontalLine') {
        wanted.set(drawing.id, { price: drawing.price, color: drawing.style.color });
      } else if (drawing.type === 'horizontalRay') {
        wanted.set(drawing.id, {
          price: drawing.origin.price,
          color: drawing.style.color,
        });
      }
    }
    for (const [id, line] of map) {
      if (!wanted.has(id)) {
        series.removePriceLine(line);
        map.delete(id);
      }
    }
    for (const [id, spec] of wanted) {
      if (!Number.isFinite(spec.price)) continue;
      const options = {
        price: spec.price,
        color: spec.color,
        lineVisible: false,
        axisLabelVisible: true,
        title: '',
      };
      const existing = map.get(id);
      if (existing) {
        existing.applyOptions(options);
      } else {
        map.set(id, series.createPriceLine(options));
      }
    }
  }, [drawings, chartReady]);

  useLayoutEffect(() => {
    updateHandlePosition();
  }, [adjustLevel, levels, updateHandlePosition]);

  const adjustPrice =
    adjustLevel && ADJUSTABLE_LEVELS.includes(adjustLevel)
      ? priceOf(levels, adjustLevel)
      : null;
  const showHandle =
    adjustLevel != null &&
    ADJUSTABLE_LEVELS.includes(adjustLevel) &&
    !(hideEntryStopTargetLines && (adjustLevel === 'stop' || adjustLevel === 'target')) &&
    adjustPrice != null &&
    handleTop != null;

  const handleLabel =
    adjustLevel === 'stop'
      ? t('handleStop')
      : adjustLevel === 'target'
        ? t('handleTarget')
        : t('handleExit');

  const tone = adjustLevel ? handleTone(adjustLevel, isDark) : null;
  const priceLabel =
    adjustPrice == null
      ? ''
      : formatNumber(adjustPrice, 2, preferences.number_format);

  const onHandlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !adjustLevel || !seriesRef.current || !chartRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    handleDraggingRef.current = true;
    didDragRef.current = false;
    dragKeyRef.current = adjustLevel;
    chartRef.current.applyOptions({
      handleScroll: SCROLL_OFF,
      handleScale: SCALE_OFF,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onHandlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!handleDraggingRef.current || !adjustLevel || !seriesRef.current || !containerRef.current) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const rect = containerRef.current.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const price = seriesRef.current.coordinateToPrice(y);
    if (price == null || !Number.isFinite(price)) return;
    didDragRef.current = true;
    priceLinesRef.current[adjustLevel]?.applyOptions({ price });
    onLevelDragRef.current?.(adjustLevel, price);
    setHandleTop(y);
  };

  const onHandlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!handleDraggingRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    handleDraggingRef.current = false;
    dragKeyRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    if (chartRef.current) {
      chartRef.current.applyOptions({
        handleScroll: SCROLL_ON,
        handleScale: SCALE_ON,
      });
    }
    if (didDragRef.current) {
      didDragRef.current = false;
      onAdjustCommitRef.current?.();
    }
    updateHandlePosition();
  };

  return (
    <div
      ref={wrapperRef}
      className={`relative min-h-[200px] ${className || 'h-full w-full'}`}
    >
      <div ref={containerRef} className="absolute inset-0 touch-none" />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-[5]"
        aria-hidden
      />
      {drawingsEnabled && selectedDrawing && styleAnchor ? (
        <DrawingStyleBar
          style={selectedDrawing.style}
          anchor={styleAnchor}
          isDark={isDark}
          onChange={applyStyleToSelected}
          onDelete={deleteSelected}
        />
      ) : null}
      {avwapStyleEdit && avwapStyleBarAnchor && onAvwapStyleChange && onAvwapStyleClear ? (
        <DrawingStyleBar
          style={avwapStyleEdit.style}
          anchor={avwapStyleBarAnchor}
          isDark={isDark}
          onChange={onAvwapStyleChange}
          onDelete={onAvwapStyleClear}
        />
      ) : null}
      {armedDrawingTool ? (
        <div className="pointer-events-none absolute left-2 top-2 z-10 rounded bg-blue-600/90 px-2 py-1 text-[11px] font-medium text-white shadow">
          {armedDrawingTool === 'trendLine'
            ? t('drawingTrendShiftHint')
            : t('drawingArmedHint')}
        </div>
      ) : null}
      {showHandle && tone ? (
        <button
          type="button"
          key={adjustLevel}
          className="absolute z-20 flex min-h-[2rem] cursor-ns-resize items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold shadow-md outline-none ring-2 ring-white/30 dark:ring-black/20"
          style={{
            top: handleTop ?? undefined,
            right: 52,
            backgroundColor: tone.bg,
            borderColor: tone.border,
            color: tone.text,
            transform: 'translateY(-50%)',
            animation: 'replay-handle-pulse 0.45s ease-out 1',
          }}
          aria-label={t('handleDragHint', { label: handleLabel })}
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
        >
          <span className="inline-flex h-3 w-2.5 flex-col justify-center gap-0.5 opacity-90" aria-hidden>
            <span className="h-0.5 w-full rounded bg-white/90" />
            <span className="h-0.5 w-full rounded bg-white/90" />
            <span className="h-0.5 w-full rounded bg-white/90" />
          </span>
          <span>{handleLabel}</span>
          <span className="tabular-nums opacity-95">{priceLabel}</span>
        </button>
      ) : null}
      <style>{`
        @keyframes replay-handle-pulse {
          0% { transform: translateY(-50%) scale(0.92); box-shadow: 0 0 0 0 rgba(255,255,255,0.55); }
          70% { transform: translateY(-50%) scale(1.04); box-shadow: 0 0 0 8px rgba(255,255,255,0); }
          100% { transform: translateY(-50%) scale(1); box-shadow: 0 0 0 0 rgba(255,255,255,0); }
        }
      `}</style>
    </div>
  );
});
