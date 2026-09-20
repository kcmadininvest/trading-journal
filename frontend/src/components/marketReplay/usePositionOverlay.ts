import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import type { IChartApi, ISeriesApi, Logical } from 'lightweight-charts';
import type { VisibleCandle } from '../../utils/replayEngine';
import {
  logicalIndexToTime,
  logicalIndexToX,
  priceToYExtrapolated,
  snapTimeToCandles,
  timeToLogicalIndex,
  type ChartPoint,
  type CoordMapper,
} from '../../utils/replayDrawings';
import {
  hitTestPosition,
  paintPositionOverlay,
  positionBBox,
  positionIsComplete,
  type PositionHandleKind,
  type PositionLabelFormatters,
  type PositionOverlayModel,
} from '../../utils/positionToolPaint';

type DragMode =
  | { type: 'handle'; handle: PositionHandleKind }
  | {
      type: 'body';
      startPoint: ChartPoint;
      snapshot: PositionOverlayModel;
    };

export type PositionOverlayChange = {
  entryTime?: number;
  entryPrice?: number;
  stopPrice?: number;
  targetPrice?: number;
  endTime?: number;
  widthBars?: number;
};

export interface UsePositionOverlayParams {
  chartRef: MutableRefObject<IChartApi | null>;
  seriesRef: MutableRefObject<ISeriesApi<'Candlestick'> | null>;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  candles: VisibleCandle[];
  model: PositionOverlayModel | null;
  selected: boolean;
  formatters: PositionLabelFormatters;
  isDark?: boolean;
  onChange: (patch: PositionOverlayChange) => void;
  onSelect: (selected: boolean) => void;
  onClear: () => void;
  /** Vrai si le pointeur est sur une price line (entry / SL / TP / exit). */
  isPointerOnTradeLevel?: (y: number) => boolean;
  setChartInteractionLocked: (locked: boolean) => void;
  /** Demande un repaint du canvas parent (dessins + position). */
  requestPaint: () => void;
  enabled?: boolean;
}

export function usePositionOverlay({
  chartRef,
  seriesRef,
  containerRef,
  candles,
  model,
  selected,
  formatters,
  isDark = true,
  onChange,
  onSelect,
  onClear,
  isPointerOnTradeLevel,
  setChartInteractionLocked,
  requestPaint,
  enabled = true,
}: UsePositionOverlayParams) {
  const modelRef = useRef(model);
  modelRef.current = model;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const formattersRef = useRef(formatters);
  formattersRef.current = formatters;
  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onClearRef = useRef(onClear);
  onClearRef.current = onClear;
  const isPointerOnTradeLevelRef = useRef(isPointerOnTradeLevel);
  isPointerOnTradeLevelRef.current = isPointerOnTradeLevel;
  const setLockedRef = useRef(setChartInteractionLocked);
  setLockedRef.current = setChartInteractionLocked;
  const requestPaintRef = useRef(requestPaint);
  requestPaintRef.current = requestPaint;

  const dragRef = useRef<DragMode | null>(null);
  const didDragRef = useRef(false);
  const hoverEdgeRef = useRef(false);
  const candleTimesRef = useRef<number[]>([]);
  candleTimesRef.current = candles.map((c) => c.time);
  const priceCandlesRef = useRef<{ time: number; close: number; high?: number; low?: number }[]>(
    [],
  );
  priceCandlesRef.current = candles.map((c) => ({
    time: c.time,
    close: c.close,
    high: c.high,
    low: c.low,
  }));

  /** endTime dérivé de widthBars pour une largeur stable quand le Play ajoute des bougies. */
  const resolveModel = useCallback((m: PositionOverlayModel): PositionOverlayModel => {
    const widthBars = m.widthBars;
    if (widthBars == null || !(widthBars > 0)) return m;
    const times = candleTimesRef.current;
    if (times.length === 0) return m;
    const entryL = timeToLogicalIndex(times, m.entryTime);
    if (entryL == null) return m;
    const end = logicalIndexToTime(times, entryL + widthBars);
    if (end == null) return m;
    return { ...m, endTime: Math.max(end, m.entryTime) };
  }, []);

  const buildMapper = useCallback((): CoordMapper | null => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    const el = containerRef.current;
    if (!chart || !series || !el) return null;
    const width = el.clientWidth;
    const height = el.clientHeight;
    const timeScale = chart.timeScale();
    const logicalLookup = (logical: number) =>
      timeScale.logicalToCoordinate(logical as Logical);
    return {
      width,
      height,
      toX: (time) => {
        const times = candleTimesRef.current;
        const logical = timeToLogicalIndex(times, time);
        if (logical == null) return null;
        const vis = timeScale.getVisibleLogicalRange();
        return logicalIndexToX(
          logical,
          logicalLookup,
          vis ? { from: vis.from, to: vis.to } : null,
        );
      },
      toY: (price) =>
        priceToYExtrapolated(
          price,
          height,
          (p) => series.priceToCoordinate(p),
          (y) => series.coordinateToPrice(y),
        ),
      fromXY: (x, y) => {
        const rawTime = timeScale.coordinateToTime(x);
        const price = series.coordinateToPrice(y);
        if (price == null || !Number.isFinite(price)) return null;
        let time: number | null = null;
        if (typeof rawTime === 'number') time = rawTime;
        if (time == null) {
          const logical = timeScale.coordinateToLogical(x);
          if (logical == null || !Number.isFinite(logical)) return null;
          const times = candleTimesRef.current;
          if (times.length === 0) return null;
          const idx = Math.max(0, Math.min(times.length - 1, Math.round(logical)));
          time = times[idx];
        } else {
          time = snapTimeToCandles(candleTimesRef.current, time);
        }
        return { time, price };
      },
    };
  }, [chartRef, seriesRef, containerRef]);

  /** À passer en onAfterPaint des dessins. */
  const paintOnto = useCallback(
    (ctx: CanvasRenderingContext2D, mapper: CoordMapper) => {
      const m = modelRef.current;
      if (!positionIsComplete(m)) return;
      paintPositionOverlay(
        ctx,
        resolveModel(m),
        mapper,
        selectedRef.current,
        formattersRef.current,
        priceCandlesRef.current,
        isDarkRef.current,
      );
    },
    [resolveModel],
  );

  useEffect(() => {
    requestPaintRef.current();
  }, [model, selected, candles, formatters, isDark]);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === 'Escape' && selectedRef.current) {
        event.preventDefault();
        onSelectRef.current(false);
        return;
      }
      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        selectedRef.current &&
        modelRef.current
      ) {
        event.preventDefault();
        onClearRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);

  const localPoint = (event: PointerEvent): { x: number; y: number } | null => {
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const applyHandleDrag = (handle: PositionHandleKind, point: ChartPoint) => {
    const m = modelRef.current;
    if (!m) return;
    if (handle === 'end') {
      const times = candleTimesRef.current;
      const entryL = timeToLogicalIndex(times, m.entryTime) ?? 0;
      const endL = timeToLogicalIndex(times, point.time) ?? entryL;
      const widthBars = Math.max(1, endL - entryL);
      const endTime = Math.max(point.time, m.entryTime);
      onChangeRef.current({ endTime, widthBars });
      return;
    }
    if (handle === 'entry') {
      onChangeRef.current({ entryPrice: point.price, entryTime: point.time });
      return;
    }
    if (handle === 'stop') {
      onChangeRef.current({ stopPrice: point.price });
      return;
    }
    onChangeRef.current({ targetPrice: point.price });
  };

  /** Time depuis X pixel, extrapolé au-delà de la dernière bougie (élargissement futur). */
  const timeFromXExtrapolated = (x: number): number | null => {
    const chart = chartRef.current;
    const times = candleTimesRef.current;
    if (!chart || times.length === 0) return null;
    const logical = chart.timeScale().coordinateToLogical(x);
    if (logical == null || !Number.isFinite(logical)) return null;
    return logicalIndexToTime(times, logical);
  };

  /** Curseurs au survol : ↔ sur le bord droit, ↕ sur entry/SL/TP, move sur le corps. */
  const updateHoverCursor = (event: PointerEvent): boolean => {
    const el = containerRef.current;
    if (!el || !enabled) return false;
    const m = modelRef.current;
    const p = localPoint(event);
    const mapper = buildMapper();
    if (!p || !mapper || !positionIsComplete(m)) {
      if (hoverEdgeRef.current) {
        el.style.cursor = '';
        hoverEdgeRef.current = false;
      }
      return false;
    }
    const hit = hitTestPosition(resolveModel(m), p, mapper, selectedRef.current);
    if (!hit) {
      if (hoverEdgeRef.current) {
        el.style.cursor = '';
        hoverEdgeRef.current = false;
      }
      return false;
    }
    // Au-dessus d’une price line sur le corps : laisser le curseur niveau,
    // mais uniquement dans la boîte (hit body) — pas hors de l’outil.
    if (hit.kind === 'body' && isPointerOnTradeLevelRef.current?.(p.y)) {
      el.style.cursor = 'ns-resize';
      hoverEdgeRef.current = true;
      return true;
    }
    if (hit.kind === 'handle' && hit.handle === 'end') {
      el.style.cursor = 'ew-resize';
    } else if (hit.kind === 'handle') {
      el.style.cursor = 'ns-resize';
    } else {
      el.style.cursor = 'move';
    }
    hoverEdgeRef.current = true;
    return true;
  };

  const tryHandlePointerDown = (event: PointerEvent): boolean => {
    if (!enabled || event.button !== 0) return false;
    const m = modelRef.current;
    if (!positionIsComplete(m)) return false;
    const p = localPoint(event);
    const mapper = buildMapper();
    if (!p || !mapper) return false;
    const hit = hitTestPosition(resolveModel(m), p, mapper, selectedRef.current);
    if (!hit) {
      if (selectedRef.current) onSelectRef.current(false);
      return false;
    }
    if (!selectedRef.current) onSelectRef.current(true);
    // Au-dessus d’une price line, laisser le drag de niveau existant opérer
    // (entry / SL / TP) plutôt que de translater la boîte.
    if (hit.kind === 'body' && isPointerOnTradeLevelRef.current?.(p.y)) {
      return false;
    }
    event.preventDefault();
    event.stopPropagation();
    didDragRef.current = false;
    if (hit.kind === 'handle') {
      dragRef.current = { type: 'handle', handle: hit.handle };
    } else {
      const start = mapper.fromXY(p.x, p.y);
      if (!start) return true;
      dragRef.current = { type: 'body', startPoint: start, snapshot: { ...resolveModel(m) } };
    }
    setLockedRef.current(true);
    try {
      containerRef.current?.setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    return true;
  };

  const tryHandlePointerMove = (event: PointerEvent): boolean => {
    if (!dragRef.current) {
      // true = on a pris le curseur (ex. ↔ largeur) : le pane ne doit pas
      // le remplacer par ns-resize des niveaux entry/SL/TP.
      return updateHoverCursor(event);
    }
    const p = localPoint(event);
    const mapper = buildMapper();
    if (!p || !mapper) return true;
    event.preventDefault();
    event.stopPropagation();
    const drag = dragRef.current;
    // Bord droit : ne pas snaper aux bougies — on doit pouvoir élargir dans le futur.
    if (drag.type === 'handle' && drag.handle === 'end') {
      const time = timeFromXExtrapolated(p.x);
      if (time == null) return true;
      didDragRef.current = true;
      applyHandleDrag('end', { time, price: modelRef.current?.entryPrice ?? 0 });
      const el = containerRef.current;
      if (el) el.style.cursor = 'ew-resize';
      return true;
    }
    const point = mapper.fromXY(p.x, p.y);
    if (!point) return true;
    didDragRef.current = true;
    if (drag.type === 'handle') {
      applyHandleDrag(drag.handle, point);
      const el = containerRef.current;
      if (el) {
        el.style.cursor = 'ns-resize';
      }
    } else {
      const dPrice = point.price - drag.startPoint.price;
      const dTime = point.time - drag.startPoint.time;
      const snap = drag.snapshot;
      const entryTime = snap.entryTime + dTime;
      onChangeRef.current({
        entryPrice: snap.entryPrice + dPrice,
        stopPrice: snap.stopPrice + dPrice,
        targetPrice: snap.targetPrice + dPrice,
        entryTime,
        endTime: snap.endTime + dTime,
        widthBars: snap.widthBars ?? undefined,
      });
      const el = containerRef.current;
      if (el) el.style.cursor = 'move';
    }
    return true;
  };

  const tryHandlePointerUp = (event: PointerEvent): boolean => {
    if (!dragRef.current) return false;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = null;
    setLockedRef.current(false);
    try {
      containerRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    const consumed = didDragRef.current;
    didDragRef.current = false;
    return consumed;
  };

  const consumeClickIfPosition = (): boolean => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return true;
    }
    return false;
  };

  /** true si (x,y) est dans la boîte Position (pour restreindre le drag des niveaux). */
  const isInsidePositionBox = (x: number, y: number): boolean => {
    if (!enabled) return false;
    const m = modelRef.current;
    if (!positionIsComplete(m)) return false;
    const mapper = buildMapper();
    if (!mapper) return false;
    const bbox = positionBBox(resolveModel(m), mapper);
    if (!bbox) return false;
    const pad = 4;
    return (
      x >= bbox.left - pad &&
      x <= bbox.right + pad &&
      y >= bbox.top - pad &&
      y <= bbox.bottom + pad
    );
  };

  return {
    paintOnto,
    tryHandlePointerDown,
    tryHandlePointerMove,
    tryHandlePointerUp,
    consumeClickIfPosition,
    isInsidePositionBox,
  };
}

/** Lit la plage de prix visible via conversion pixel→prix (fallback min/max bougies). */
export function readVisiblePriceRange(
  series: ISeriesApi<'Candlestick'> | null,
  height: number,
  candles: VisibleCandle[],
): number {
  if (series && height > 0) {
    try {
      const top = series.coordinateToPrice(0);
      const bottom = series.coordinateToPrice(height);
      if (
        top != null &&
        bottom != null &&
        Number.isFinite(top) &&
        Number.isFinite(bottom)
      ) {
        const range = Math.abs(top - bottom);
        if (range > 0) return range;
      }
    } catch {
      // ignore
    }
  }
  if (candles.length === 0) return 0;
  let min = candles[0].low;
  let max = candles[0].high;
  for (const c of candles) {
    if (c.low < min) min = c.low;
    if (c.high > max) max = c.high;
  }
  return Math.max(0, max - min);
}
