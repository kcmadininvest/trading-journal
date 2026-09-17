import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { IChartApi, ISeriesApi, Logical } from 'lightweight-charts';
import type { VisibleCandle } from '../../utils/replayEngine';
import {
  canFinishDraft,
  cloneStyle,
  DEFAULT_DRAWING_STYLE,
  drawingBBox,
  finalizeDraft,
  hitTestDrawings,
  logicalIndexToX,
  paintAllDrawings,
  pointsNeeded,
  priceToYExtrapolated,
  snapTimeToCandles,
  snapTrendPointWithShift,
  timeToLogicalIndex,
  translateDrawing,
  updateDrawingHandle,
  updateDrawingStyle,
  type ChartPoint,
  type CoordMapper,
  type Drawing,
  type DrawingDraft,
  type DrawingStyle,
  type DrawingTool,
} from '../../utils/replayDrawings';

type DragMode =
  | { type: 'handle'; drawingId: string; handleIndex: number }
  | {
      type: 'body';
      drawingId: string;
      startPoint: ChartPoint;
      snapshot: Drawing;
    };

export interface UseChartDrawingsParams {
  chartRef: MutableRefObject<IChartApi | null>;
  seriesRef: MutableRefObject<ISeriesApi<'Candlestick'> | null>;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  candles: VisibleCandle[];
  drawings: Drawing[];
  selectedDrawingId: string | null;
  armedTool: DrawingTool | null;
  drawingStyle: DrawingStyle;
  onDrawingsChange: (next: Drawing[]) => void;
  onSelectedDrawingIdChange: (id: string | null) => void;
  onDrawingStyleChange: (style: DrawingStyle) => void;
  onArmToolChange: (tool: DrawingTool | null) => void;
  /** Désactive le scroll/zoom du chart pendant un drag dessin. */
  setChartInteractionLocked: (locked: boolean) => void;
  enabled?: boolean;
}

export function useChartDrawings({
  chartRef,
  seriesRef,
  containerRef,
  candles,
  drawings,
  selectedDrawingId,
  armedTool,
  drawingStyle,
  onDrawingsChange,
  onSelectedDrawingIdChange,
  onDrawingStyleChange,
  onArmToolChange,
  setChartInteractionLocked,
  enabled = true,
}: UseChartDrawingsParams) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const draftRef = useRef<DrawingDraft | null>(null);
  const lastRawCursorRef = useRef<ChartPoint | null>(null);
  const [draftVersion, setDraftVersion] = useState(0);
  const dragRef = useRef<DragMode | null>(null);
  const didDrawingDragRef = useRef(false);
  const candleTimesRef = useRef<number[]>([]);
  candleTimesRef.current = candles.map((c) => c.time);

  const drawingsRef = useRef(drawings);
  drawingsRef.current = drawings;
  const selectedRef = useRef(selectedDrawingId);
  selectedRef.current = selectedDrawingId;
  const armedRef = useRef(armedTool);
  armedRef.current = armedTool;
  const styleRef = useRef(drawingStyle);
  styleRef.current = drawingStyle;

  const onDrawingsChangeRef = useRef(onDrawingsChange);
  onDrawingsChangeRef.current = onDrawingsChange;
  const onSelectedChangeRef = useRef(onSelectedDrawingIdChange);
  onSelectedChangeRef.current = onSelectedDrawingIdChange;
  const onStyleChangeRef = useRef(onDrawingStyleChange);
  onStyleChangeRef.current = onDrawingStyleChange;
  const onArmChangeRef = useRef(onArmToolChange);
  onArmChangeRef.current = onArmToolChange;
  const setLockedRef = useRef(setChartInteractionLocked);
  setLockedRef.current = setChartInteractionLocked;

  const [styleAnchor, setStyleAnchor] = useState<{ left: number; top: number } | null>(
    null,
  );

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
        // Toujours via index logique : cohérent entre timeframes (évite mélange
        // timeToCoordinate exact / null qui déforme les paths multi-points).
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
        if (typeof rawTime === 'number') {
          time = rawTime;
        }
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

  const bumpDraft = () => setDraftVersion((v) => v + 1);

  const clearDraft = useCallback(() => {
    draftRef.current = null;
    lastRawCursorRef.current = null;
    bumpDraft();
  }, []);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const mapper = buildMapper();
    if (!canvas || !mapper) {
      setStyleAnchor(null);
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.floor(mapper.width * dpr) || canvas.height !== Math.floor(mapper.height * dpr)) {
      canvas.width = Math.floor(mapper.width * dpr);
      canvas.height = Math.floor(mapper.height * dpr);
      canvas.style.width = `${mapper.width}px`;
      canvas.style.height = `${mapper.height}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintAllDrawings(
      ctx,
      drawingsRef.current,
      selectedRef.current,
      draftRef.current,
      mapper,
    );

    const sel = selectedRef.current
      ? drawingsRef.current.find((d) => d.id === selectedRef.current)
      : null;
    if (sel) {
      const bbox = drawingBBox(sel, mapper);
      if (bbox) {
        setStyleAnchor({
          left: Math.min(mapper.width - 220, Math.max(4, bbox.right - 180)),
          top: Math.min(mapper.height - 40, Math.max(4, bbox.top + 6)),
        });
      } else {
        setStyleAnchor({ left: 8, top: 36 });
      }
    } else {
      setStyleAnchor(null);
    }
  }, [buildMapper]);

  useEffect(() => {
    paint();
  }, [paint, drawings, selectedDrawingId, draftVersion, candles]);

  useEffect(() => {
    clearDraft();
  }, [armedTool, clearDraft]);

  const finishPathIfPossible = useCallback(() => {
    const draft = draftRef.current;
    if (!draft || draft.tool !== 'path') return;
    if (!canFinishDraft(draft)) return;
    const created = finalizeDraft(draft);
    if (!created) return;
    onDrawingsChangeRef.current([...drawingsRef.current, created]);
    onSelectedChangeRef.current(created.id);
    onArmChangeRef.current(null);
    clearDraft();
  }, [clearDraft]);

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

      if (event.key === 'Shift') {
        const draft = draftRef.current;
        const mapper = buildMapper();
        if (
          draft?.tool === 'trendLine' &&
          draft.points.length === 1 &&
          mapper &&
          lastRawCursorRef.current
        ) {
          const raw = lastRawCursorRef.current;
          const preview =
            event.type === 'keydown'
              ? snapTrendPointWithShift(draft.points[0], raw, mapper)
              : raw;
          draftRef.current = { ...draft, preview };
          bumpDraft();
        }
        return;
      }

      if (event.key === 'Escape') {
        if (draftRef.current) {
          event.preventDefault();
          clearDraft();
          onArmChangeRef.current(null);
          return;
        }
        if (armedRef.current) {
          event.preventDefault();
          onArmChangeRef.current(null);
          return;
        }
        if (selectedRef.current) {
          event.preventDefault();
          onSelectedChangeRef.current(null);
        }
        return;
      }

      if (event.key === 'Enter' && draftRef.current?.tool === 'path') {
        event.preventDefault();
        finishPathIfPossible();
        return;
      }

      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        selectedRef.current &&
        !draftRef.current &&
        !armedRef.current
      ) {
        event.preventDefault();
        const id = selectedRef.current;
        onDrawingsChangeRef.current(drawingsRef.current.filter((d) => d.id !== id));
        onSelectedChangeRef.current(null);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  }, [enabled, clearDraft, finishPathIfPossible, buildMapper]);

  const localPoint = (event: PointerEvent | MouseEvent): { x: number; y: number } | null => {
    const el = containerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const tryHandlePointerDown = (event: PointerEvent): boolean => {
    if (!enabled || event.button !== 0) return false;
    const p = localPoint(event);
    const mapper = buildMapper();
    if (!p || !mapper) return false;

    const hit = hitTestDrawings(
      drawingsRef.current,
      selectedRef.current,
      p,
      mapper,
    );

    // Mode outil armé : placement prioritaire (sauf handle de sélection)
    if (armedRef.current) {
      if (hit?.kind === 'handle' && selectedRef.current === hit.drawingId) {
        // allow editing while tool somehow still armed — rare
      } else {
        let point = mapper.fromXY(p.x, p.y);
        if (!point) return true;
        event.preventDefault();
        event.stopPropagation();
        didDrawingDragRef.current = true;

        const tool = armedRef.current;
        let draft = draftRef.current;
        if (!draft || draft.tool !== tool) {
          draft = {
            tool,
            points: [],
            preview: null,
            style: cloneStyle(styleRef.current),
          };
        }

        if (
          tool === 'trendLine' &&
          event.shiftKey &&
          draft.points.length === 1
        ) {
          point = snapTrendPointWithShift(draft.points[0], point, mapper);
        }

        draft.points = [...draft.points, point];
        draft.preview = null;
        draftRef.current = draft;
        bumpDraft();

        const need = pointsNeeded(tool);
        if (need != null && draft.points.length >= need) {
          const created = finalizeDraft(draft);
          if (created) {
            onDrawingsChangeRef.current([...drawingsRef.current, created]);
            onSelectedChangeRef.current(created.id);
            onArmChangeRef.current(null);
            clearDraft();
          }
        }
        return true;
      }
    }

    if (hit?.kind === 'handle') {
      event.preventDefault();
      event.stopPropagation();
      dragRef.current = {
        type: 'handle',
        drawingId: hit.drawingId,
        handleIndex: hit.handleIndex,
      };
      didDrawingDragRef.current = false;
      setLockedRef.current(true);
      onSelectedChangeRef.current(hit.drawingId);
      try {
        containerRef.current?.setPointerCapture(event.pointerId);
      } catch {
        // ignore
      }
      return true;
    }

    if (hit?.kind === 'body') {
      event.preventDefault();
      event.stopPropagation();
      const drawing = drawingsRef.current.find((d) => d.id === hit.drawingId);
      const startPoint = mapper.fromXY(p.x, p.y);
      if (!drawing || !startPoint) return true;
      dragRef.current = {
        type: 'body',
        drawingId: hit.drawingId,
        startPoint,
        snapshot: drawing,
      };
      didDrawingDragRef.current = false;
      setLockedRef.current(true);
      onSelectedChangeRef.current(hit.drawingId);
      try {
        containerRef.current?.setPointerCapture(event.pointerId);
      } catch {
        // ignore
      }
      return true;
    }

    if (!armedRef.current && selectedRef.current) {
      onSelectedChangeRef.current(null);
    }

    return false;
  };

  const tryHandlePointerMove = (event: PointerEvent): boolean => {
    if (!enabled) return false;
    const p = localPoint(event);
    const mapper = buildMapper();
    if (!p || !mapper) return false;

    if (dragRef.current) {
      event.preventDefault();
      event.stopPropagation();
      const rawPoint = mapper.fromXY(p.x, p.y);
      if (!rawPoint) return true;
      didDrawingDragRef.current = true;
      const drag = dragRef.current;
      if (drag.type === 'handle') {
        const current = drawingsRef.current.find((d) => d.id === drag.drawingId);
        let nextPoint = rawPoint;
        if (current?.type === 'trendLine' && event.shiftKey) {
          const anchor = drag.handleIndex === 0 ? current.p2 : current.p1;
          nextPoint = snapTrendPointWithShift(anchor, rawPoint, mapper);
        }
        onDrawingsChangeRef.current(
          drawingsRef.current.map((d) =>
            d.id === drag.drawingId
              ? updateDrawingHandle(d, drag.handleIndex, nextPoint)
              : d,
          ),
        );
      } else {
        const deltaTime = rawPoint.time - drag.startPoint.time;
        const deltaPrice = rawPoint.price - drag.startPoint.price;
        onDrawingsChangeRef.current(
          drawingsRef.current.map((d) =>
            d.id === drag.drawingId
              ? translateDrawing(drag.snapshot, deltaTime, deltaPrice)
              : d,
          ),
        );
      }
      return true;
    }

    if (armedRef.current && draftRef.current) {
      let point = mapper.fromXY(p.x, p.y);
      if (point) {
        const draft = draftRef.current;
        lastRawCursorRef.current = point;
        if (
          draft.tool === 'trendLine' &&
          event.shiftKey &&
          draft.points.length === 1
        ) {
          point = snapTrendPointWithShift(draft.points[0], point, mapper);
        }
        draftRef.current = { ...draft, preview: point };
        bumpDraft();
      }
      const el = containerRef.current;
      if (el) el.style.cursor = 'crosshair';
      return true;
    }

    if (armedRef.current) {
      const el = containerRef.current;
      if (el) el.style.cursor = 'crosshair';
      return true;
    }

    const hit = hitTestDrawings(
      drawingsRef.current,
      selectedRef.current,
      p,
      mapper,
    );
    const el = containerRef.current;
    if (el && !dragRef.current) {
      if (hit?.kind === 'handle') {
        el.style.cursor = 'grab';
        return true;
      }
      if (hit?.kind === 'body') {
        el.style.cursor = 'move';
        return true;
      }
    }
    return false;
  };

  const tryHandlePointerUp = (event: PointerEvent): boolean => {
    if (!enabled) return false;
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
    if (didDrawingDragRef.current) {
      // swallow following click
    }
    return true;
  };

  const tryHandleDoubleClick = (event: MouseEvent): boolean => {
    if (!enabled) return false;
    if (armedRef.current === 'path' && draftRef.current) {
      event.preventDefault();
      event.stopPropagation();
      // Remove accidental extra point from second click of dblclick if present
      const draft = draftRef.current;
      if (draft.points.length > 2) {
        draft.points = draft.points.slice(0, -1);
        draftRef.current = draft;
      }
      finishPathIfPossible();
      return true;
    }
    return false;
  };

  const consumeClickIfDrawing = (): boolean => {
    if (didDrawingDragRef.current) {
      didDrawingDragRef.current = false;
      return true;
    }
    if (armedRef.current || draftRef.current) return true;
    return false;
  };

  const deleteSelected = useCallback(() => {
    const id = selectedRef.current;
    if (!id) return;
    onDrawingsChangeRef.current(drawingsRef.current.filter((d) => d.id !== id));
    onSelectedChangeRef.current(null);
  }, []);

  const applyStyleToSelected = useCallback((style: DrawingStyle) => {
    const id = selectedRef.current;
    if (!id) return;
    onStyleChangeRef.current(style);
    onDrawingsChangeRef.current(
      drawingsRef.current.map((d) =>
        d.id === id ? updateDrawingStyle(d, style) : d,
      ),
    );
  }, []);

  const selectedDrawing =
    selectedDrawingId != null
      ? drawings.find((d) => d.id === selectedDrawingId) ?? null
      : null;

  return {
    canvasRef,
    paint,
    styleAnchor,
    selectedDrawing,
    tryHandlePointerDown,
    tryHandlePointerMove,
    tryHandlePointerUp,
    tryHandleDoubleClick,
    consumeClickIfDrawing,
    deleteSelected,
    applyStyleToSelected,
    isDrawingInteractionActive: Boolean(armedTool || draftRef.current),
    defaultStyle: DEFAULT_DRAWING_STYLE,
  };
}
