/** Dessins Market Replay — modèles, géométrie, hit-test, rendu canvas. */

export type DrawingTool =
  | 'trendLine'
  | 'horizontalLine'
  | 'horizontalRay'
  | 'rectangle'
  | 'path';

export type ChartPoint = { time: number; price: number };

export type DrawingStyle = { color: string; lineWidth: number };

export const DEFAULT_DRAWING_STYLE: DrawingStyle = {
  color: '#2962FF',
  lineWidth: 1.5,
};

export const DRAWING_LINE_WIDTHS = [1, 2, 3, 4] as const;

export const DRAWING_COLOR_PALETTE = [
  '#2962FF',
  '#EF5350',
  '#26A69A',
  '#FF9800',
  '#AB47BC',
  '#FFFFFF',
  '#131722',
] as const;

export const DRAWING_HIT_PX = 8;
export const DRAWING_HANDLE_RADIUS = 5;

type DrawingBase = { id: string; style: DrawingStyle };

export type Drawing =
  | (DrawingBase & { type: 'trendLine'; p1: ChartPoint; p2: ChartPoint })
  | (DrawingBase & { type: 'horizontalLine'; price: number; anchorTime: number })
  | (DrawingBase & { type: 'horizontalRay'; origin: ChartPoint })
  | (DrawingBase & { type: 'rectangle'; p1: ChartPoint; p2: ChartPoint })
  | (DrawingBase & { type: 'path'; points: ChartPoint[] });

export type DrawingDraft = {
  tool: DrawingTool;
  points: ChartPoint[];
  preview: ChartPoint | null;
  style: DrawingStyle;
};

export type PixelPoint = { x: number; y: number };

export type CoordMapper = {
  width: number;
  height: number;
  toX: (time: number) => number | null;
  toY: (price: number) => number | null;
  /** Convertit un pixel en point chart (time snapé aux bougies si fourni). */
  fromXY: (x: number, y: number) => ChartPoint | null;
};

export type DrawingHit =
  | { kind: 'handle'; drawingId: string; handleIndex: number }
  | { kind: 'body'; drawingId: string };

export function createDrawingId(): string {
  return `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function cloneStyle(style: DrawingStyle): DrawingStyle {
  return { color: style.color, lineWidth: style.lineWidth };
}

export function colorWithAlpha(hex: string, alpha: number): string {
  const raw = hex.replace('#', '');
  if (raw.length !== 6 && raw.length !== 3) return hex;
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  if (![r, g, b].every((n) => Number.isFinite(n))) return hex;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function snapTimeToCandles(
  times: number[],
  time: number,
): number {
  if (times.length === 0) return time;
  let best = times[0];
  let bestDist = Math.abs(best - time);
  for (let i = 1; i < times.length; i += 1) {
    const d = Math.abs(times[i] - time);
    if (d < bestDist) {
      best = times[i];
      bestDist = d;
    }
  }
  return best;
}

/**
 * Index logique (éventuellement fractionnaire) pour un timestamp unix.
 * Extrapolé hors des bornes (avant la 1ʳᵉ / après la dernière bougie) pour que
 * les dessins et l’outil Position gardent une largeur stable quand le replay
 * n’a pas encore livré les barres futures.
 */
export function timeToLogicalIndex(times: number[], time: number): number | null {
  if (times.length === 0) return null;
  if (times.length === 1) return 0;
  const last = times.length - 1;
  if (time < times[0]) {
    const step = times[1] - times[0];
    if (!(step > 0)) return 0;
    return (time - times[0]) / step;
  }
  if (time > times[last]) {
    const step = times[last] - times[last - 1];
    if (!(step > 0)) return last;
    return last + (time - times[last]) / step;
  }
  if (time === times[0]) return 0;
  if (time === times[last]) return last;
  let lo = 0;
  let hi = last;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= time) lo = mid;
    else hi = mid;
  }
  const t0 = times[lo];
  const t1 = times[hi];
  if (t1 === t0) return lo;
  return lo + (time - t0) / (t1 - t0);
}

/**
 * Inverse de timeToLogicalIndex : timestamp depuis un index logique
 * (extrapolé avant/après les bougies — utile pour élargir un dessin dans le futur).
 */
export function logicalIndexToTime(times: number[], logical: number): number | null {
  if (times.length === 0 || !Number.isFinite(logical)) return null;
  if (times.length === 1) return times[0];
  const last = times.length - 1;
  if (logical <= 0) {
    const step = times[1] - times[0];
    if (!(step > 0)) return times[0];
    return times[0] + logical * step;
  }
  if (logical >= last) {
    const step = times[last] - times[last - 1];
    if (!(step > 0)) return times[last];
    return times[last] + (logical - last) * step;
  }
  const i0 = Math.floor(logical);
  const i1 = i0 + 1;
  const frac = logical - i0;
  return times[i0] + frac * (times[i1] - times[i0]);
}

/**
 * Convertit un index logique en X pixel, avec extrapolation hors plage visible
 * (logicalToCoordinate renvoie null hors écran — critique pour les paths multi-points).
 */
export function logicalIndexToX(
  logical: number,
  lookup: (logical: number) => number | null,
  visible: { from: number; to: number } | null,
): number | null {
  const direct = lookup(logical);
  if (direct != null) return direct;
  if (!visible) return null;
  const span = visible.to - visible.from;
  if (!Number.isFinite(span) || Math.abs(span) < 1e-9) return null;

  const xFrom = lookup(visible.from);
  const xTo = lookup(visible.to);
  if (xFrom != null && xTo != null) {
    return xFrom + ((logical - visible.from) / span) * (xTo - xFrom);
  }

  // Ancrage sur deux points intérieurs si les bornes échouent
  const mid = (visible.from + visible.to) / 2;
  const a = mid - Math.min(0.5, Math.abs(span) / 4);
  const b = mid + Math.min(0.5, Math.abs(span) / 4);
  const xA = lookup(a);
  const xB = lookup(b);
  if (xA == null || xB == null || Math.abs(b - a) < 1e-9) return null;
  return xA + ((logical - a) / (b - a)) * (xB - xA);
}

/** Y pixel pour un prix, avec extrapolation hors échelle visible. */
export function priceToYExtrapolated(
  price: number,
  height: number,
  priceToCoordinate: (price: number) => number | null,
  coordinateToPrice: (y: number) => number | null,
): number | null {
  const exact = priceToCoordinate(price);
  if (exact != null) return exact;
  if (height <= 0) return null;
  const top = coordinateToPrice(0);
  const bottom = coordinateToPrice(height);
  if (
    top == null ||
    bottom == null ||
    !Number.isFinite(top) ||
    !Number.isFinite(bottom) ||
    top === bottom
  ) {
    return null;
  }
  return ((top - price) / (top - bottom)) * height;
}

export function pointsNeeded(tool: DrawingTool): number | null {
  if (tool === 'path') return null;
  if (tool === 'horizontalLine' || tool === 'horizontalRay') return 1;
  return 2;
}

export function canFinishDraft(draft: DrawingDraft): boolean {
  if (draft.tool === 'path') return draft.points.length >= 2;
  const need = pointsNeeded(draft.tool);
  return need != null && draft.points.length >= need;
}

export function finalizeDraft(draft: DrawingDraft): Drawing | null {
  const style = cloneStyle(draft.style);
  const id = createDrawingId();
  const pts = draft.points;
  if (draft.tool === 'trendLine' && pts.length >= 2) {
    return { id, type: 'trendLine', style, p1: pts[0], p2: pts[1] };
  }
  if (draft.tool === 'horizontalLine' && pts.length >= 1) {
    return {
      id,
      type: 'horizontalLine',
      style,
      price: pts[0].price,
      anchorTime: pts[0].time,
    };
  }
  if (draft.tool === 'horizontalRay' && pts.length >= 1) {
    return { id, type: 'horizontalRay', style, origin: pts[0] };
  }
  if (draft.tool === 'rectangle' && pts.length >= 2) {
    return { id, type: 'rectangle', style, p1: pts[0], p2: pts[1] };
  }
  if (draft.tool === 'path' && pts.length >= 2) {
    return { id, type: 'path', style, points: pts.map((p) => ({ ...p })) };
  }
  return null;
}

function dist(a: PixelPoint, b: PixelPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distToSegment(p: PixelPoint, a: PixelPoint, b: PixelPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

export function drawingHandlePoints(
  drawing: Drawing,
  mapper: CoordMapper,
): Array<PixelPoint | null> {
  if (drawing.type === 'trendLine') {
    return [
      pointToPixel(drawing.p1, mapper),
      pointToPixel(drawing.p2, mapper),
    ];
  }
  if (drawing.type === 'horizontalLine') {
    return [
      pointToPixel({ time: drawing.anchorTime, price: drawing.price }, mapper),
    ];
  }
  if (drawing.type === 'horizontalRay') {
    return [pointToPixel(drawing.origin, mapper)];
  }
  if (drawing.type === 'rectangle') {
    const x1 = mapper.toX(drawing.p1.time);
    const y1 = mapper.toY(drawing.p1.price);
    const x2 = mapper.toX(drawing.p2.time);
    const y2 = mapper.toY(drawing.p2.price);
    if (x1 == null || y1 == null || x2 == null || y2 == null) {
      return [null, null, null, null];
    }
    return [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
    ];
  }
  return drawing.points.map((p) => pointToPixel(p, mapper));
}

export function pointToPixel(point: ChartPoint, mapper: CoordMapper): PixelPoint | null {
  const x = mapper.toX(point.time);
  const y = mapper.toY(point.price);
  if (x == null || y == null) return null;
  return { x, y };
}

/**
 * Avec Shift : aligne la trendline sur l’angle le plus proche (0 / 45 / 90°…),
 * en pixels pour un rendu visuel correct quelle que soit l’échelle.
 */
export function snapTrendPointWithShift(
  anchor: ChartPoint,
  cursor: ChartPoint,
  mapper: CoordMapper,
): ChartPoint {
  const a = pointToPixel(anchor, mapper);
  const c = pointToPixel(cursor, mapper);
  if (!a || !c) return cursor;
  const dx = c.x - a.x;
  const dy = c.y - a.y;
  if (dx === 0 && dy === 0) return cursor;

  const len = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const step = Math.PI / 4;
  const snappedAngle = Math.round(angle / step) * step;
  const sx = a.x + Math.cos(snappedAngle) * len;
  const sy = a.y + Math.sin(snappedAngle) * len;

  // Horizontal / vertical exacts (évite la dérive float du round-trip prix)
  const norm = ((snappedAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const eps = 1e-6;
  const isHorizontal =
    Math.abs(norm) < eps ||
    Math.abs(norm - Math.PI) < eps ||
    Math.abs(norm - Math.PI * 2) < eps;
  const isVertical =
    Math.abs(norm - Math.PI / 2) < eps || Math.abs(norm - (3 * Math.PI) / 2) < eps;

  if (isHorizontal) {
    const snapped = mapper.fromXY(sx, a.y);
    if (!snapped) return { time: cursor.time, price: anchor.price };
    return { time: snapped.time, price: anchor.price };
  }
  if (isVertical) {
    const snapped = mapper.fromXY(a.x, sy);
    if (!snapped) return { time: anchor.time, price: cursor.price };
    return { time: anchor.time, price: snapped.price };
  }

  return mapper.fromXY(sx, sy) ?? cursor;
}

export function drawingBBox(
  drawing: Drawing,
  mapper: CoordMapper,
): { left: number; top: number; right: number; bottom: number } | null {
  const handles = drawingHandlePoints(drawing, mapper).filter(
    (p): p is PixelPoint => p != null,
  );
  if (drawing.type === 'horizontalLine') {
    const y = mapper.toY(drawing.price);
    if (y == null) return null;
    return { left: 0, top: y, right: mapper.width, bottom: y };
  }
  if (drawing.type === 'horizontalRay') {
    const origin = pointToPixel(drawing.origin, mapper);
    if (!origin) return null;
    return {
      left: origin.x,
      top: origin.y,
      right: mapper.width,
      bottom: origin.y,
    };
  }
  if (handles.length === 0) return null;
  let left = handles[0].x;
  let right = handles[0].x;
  let top = handles[0].y;
  let bottom = handles[0].y;
  for (const h of handles) {
    left = Math.min(left, h.x);
    right = Math.max(right, h.x);
    top = Math.min(top, h.y);
    bottom = Math.max(bottom, h.y);
  }
  return { left, top, right, bottom };
}

function hitBody(drawing: Drawing, p: PixelPoint, mapper: CoordMapper): boolean {
  const threshold = DRAWING_HIT_PX + drawing.style.lineWidth;

  if (drawing.type === 'trendLine') {
    const a = pointToPixel(drawing.p1, mapper);
    const b = pointToPixel(drawing.p2, mapper);
    if (!a || !b) return false;
    return distToSegment(p, a, b) <= threshold;
  }

  if (drawing.type === 'horizontalLine') {
    const y = mapper.toY(drawing.price);
    if (y == null) return false;
    return Math.abs(p.y - y) <= threshold;
  }

  if (drawing.type === 'horizontalRay') {
    const origin = pointToPixel(drawing.origin, mapper);
    if (!origin) return false;
    if (p.x < origin.x - threshold) return false;
    return Math.abs(p.y - origin.y) <= threshold;
  }

  if (drawing.type === 'rectangle') {
    const x1 = mapper.toX(drawing.p1.time);
    const y1 = mapper.toY(drawing.p1.price);
    const x2 = mapper.toX(drawing.p2.time);
    const y2 = mapper.toY(drawing.p2.price);
    if (x1 == null || y1 == null || x2 == null || y2 == null) return false;
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    const top = Math.min(y1, y2);
    const bottom = Math.max(y1, y2);
    const inside =
      p.x >= left - threshold &&
      p.x <= right + threshold &&
      p.y >= top - threshold &&
      p.y <= bottom + threshold;
    if (!inside) return false;
    const nearEdge =
      Math.abs(p.x - left) <= threshold ||
      Math.abs(p.x - right) <= threshold ||
      Math.abs(p.y - top) <= threshold ||
      Math.abs(p.y - bottom) <= threshold;
    const deepInside =
      p.x > left + threshold &&
      p.x < right - threshold &&
      p.y > top + threshold &&
      p.y < bottom - threshold;
    return nearEdge || deepInside;
  }

  const pixels = drawing.points
    .map((pt) => pointToPixel(pt, mapper))
    .filter((pt): pt is PixelPoint => pt != null);
  for (let i = 0; i < pixels.length - 1; i += 1) {
    if (distToSegment(p, pixels[i], pixels[i + 1]) <= threshold) return true;
  }
  return false;
}

/** Hit-test : handles d’abord (dessin sélectionné), puis corps (du plus récent au plus ancien). */
export function hitTestDrawings(
  drawings: Drawing[],
  selectedId: string | null,
  p: PixelPoint,
  mapper: CoordMapper,
): DrawingHit | null {
  if (selectedId) {
    const selected = drawings.find((d) => d.id === selectedId);
    if (selected) {
      const handles = drawingHandlePoints(selected, mapper);
      for (let i = 0; i < handles.length; i += 1) {
        const h = handles[i];
        if (!h) continue;
        if (dist(p, h) <= DRAWING_HANDLE_RADIUS + 4) {
          return { kind: 'handle', drawingId: selected.id, handleIndex: i };
        }
      }
    }
  }

  for (let i = drawings.length - 1; i >= 0; i -= 1) {
    const d = drawings[i];
    if (hitBody(d, p, mapper)) {
      return { kind: 'body', drawingId: d.id };
    }
  }
  return null;
}

export function updateDrawingHandle(
  drawing: Drawing,
  handleIndex: number,
  point: ChartPoint,
): Drawing {
  if (drawing.type === 'trendLine') {
    if (handleIndex === 0) return { ...drawing, p1: point };
    return { ...drawing, p2: point };
  }
  if (drawing.type === 'horizontalLine') {
    return { ...drawing, price: point.price };
  }
  if (drawing.type === 'horizontalRay') {
    return { ...drawing, origin: point };
  }
  if (drawing.type === 'rectangle') {
    const xTimes = [drawing.p1.time, drawing.p2.time];
    const yPrices = [drawing.p1.price, drawing.p2.price];
    const minT = Math.min(xTimes[0], xTimes[1]);
    const maxT = Math.max(xTimes[0], xTimes[1]);
    const minP = Math.min(yPrices[0], yPrices[1]);
    const maxP = Math.max(yPrices[0], yPrices[1]);
    let left = minT;
    let right = maxT;
    let top = maxP;
    let bottom = minP;
    // corners: 0=TL(minT,maxP), 1=TR(maxT,maxP), 2=BR(maxT,minP), 3=BL(minT,minP)
    if (handleIndex === 0) {
      left = point.time;
      top = point.price;
    } else if (handleIndex === 1) {
      right = point.time;
      top = point.price;
    } else if (handleIndex === 2) {
      right = point.time;
      bottom = point.price;
    } else {
      left = point.time;
      bottom = point.price;
    }
    return {
      ...drawing,
      p1: { time: left, price: top },
      p2: { time: right, price: bottom },
    };
  }
  if (handleIndex < 0 || handleIndex >= drawing.points.length) return drawing;
  const points = drawing.points.map((pt, i) => (i === handleIndex ? point : pt));
  return { ...drawing, points };
}

export function translateDrawing(
  drawing: Drawing,
  deltaTime: number,
  deltaPrice: number,
): Drawing {
  const shift = (p: ChartPoint): ChartPoint => ({
    time: p.time + deltaTime,
    price: p.price + deltaPrice,
  });
  if (drawing.type === 'trendLine') {
    return { ...drawing, p1: shift(drawing.p1), p2: shift(drawing.p2) };
  }
  if (drawing.type === 'horizontalLine') {
    return {
      ...drawing,
      price: drawing.price + deltaPrice,
      anchorTime: drawing.anchorTime + deltaTime,
    };
  }
  if (drawing.type === 'horizontalRay') {
    return { ...drawing, origin: shift(drawing.origin) };
  }
  if (drawing.type === 'rectangle') {
    return { ...drawing, p1: shift(drawing.p1), p2: shift(drawing.p2) };
  }
  return { ...drawing, points: drawing.points.map(shift) };
}

export function updateDrawingStyle(drawing: Drawing, style: DrawingStyle): Drawing {
  return { ...drawing, style: cloneStyle(style) };
}

function strokeStyle(ctx: CanvasRenderingContext2D, style: DrawingStyle, selected: boolean) {
  ctx.strokeStyle = style.color;
  ctx.lineWidth = selected ? style.lineWidth + 0.75 : style.lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

function drawHandles(
  ctx: CanvasRenderingContext2D,
  handles: Array<PixelPoint | null>,
  color: string,
) {
  for (const h of handles) {
    if (!h) continue;
    ctx.beginPath();
    ctx.arc(h.x, h.y, DRAWING_HANDLE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function paintTrend(
  ctx: CanvasRenderingContext2D,
  a: PixelPoint,
  b: PixelPoint,
  style: DrawingStyle,
  selected: boolean,
) {
  strokeStyle(ctx, style, selected);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

export function paintDrawing(
  ctx: CanvasRenderingContext2D,
  drawing: Drawing,
  mapper: CoordMapper,
  selected: boolean,
) {
  if (drawing.type === 'trendLine') {
    const a = pointToPixel(drawing.p1, mapper);
    const b = pointToPixel(drawing.p2, mapper);
    if (!a || !b) return;
    paintTrend(ctx, a, b, drawing.style, selected);
  } else if (drawing.type === 'horizontalLine') {
    const y = mapper.toY(drawing.price);
    if (y == null) return;
    strokeStyle(ctx, drawing.style, selected);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(mapper.width, y);
    ctx.stroke();
  } else if (drawing.type === 'horizontalRay') {
    const origin = pointToPixel(drawing.origin, mapper);
    if (!origin) return;
    strokeStyle(ctx, drawing.style, selected);
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(mapper.width, origin.y);
    ctx.stroke();
  } else if (drawing.type === 'rectangle') {
    const x1 = mapper.toX(drawing.p1.time);
    const y1 = mapper.toY(drawing.p1.price);
    const x2 = mapper.toX(drawing.p2.time);
    const y2 = mapper.toY(drawing.p2.price);
    if (x1 == null || y1 == null || x2 == null || y2 == null) return;
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    ctx.fillStyle = colorWithAlpha(drawing.style.color, 0.15);
    ctx.fillRect(left, top, w, h);
    strokeStyle(ctx, drawing.style, selected);
    ctx.strokeRect(left, top, w, h);
  } else {
    // Path : ignorer les sommets non projetables SANS couper la polyligne
    // (reconnecter les voisins valides — évite les gribouillis multi-TF).
    strokeStyle(ctx, drawing.style, selected);
    ctx.beginPath();
    let started = false;
    for (const pt of drawing.points) {
      const pix = pointToPixel(pt, mapper);
      if (!pix) continue;
      if (!started) {
        ctx.moveTo(pix.x, pix.y);
        started = true;
      } else {
        ctx.lineTo(pix.x, pix.y);
      }
    }
    if (started) ctx.stroke();
  }

  if (selected) {
    drawHandles(ctx, drawingHandlePoints(drawing, mapper), drawing.style.color);
  }
}

export function paintDraft(
  ctx: CanvasRenderingContext2D,
  draft: DrawingDraft,
  mapper: CoordMapper,
) {
  const pts = [...draft.points];
  if (draft.preview) pts.push(draft.preview);
  if (pts.length === 0) return;

  const temp: Drawing | null =
    draft.tool === 'trendLine' && pts.length >= 2
      ? {
          id: 'draft',
          type: 'trendLine',
          style: draft.style,
          p1: pts[0],
          p2: pts[1],
        }
      : draft.tool === 'horizontalLine' && pts.length >= 1
        ? {
            id: 'draft',
            type: 'horizontalLine',
            style: draft.style,
            price: pts[0].price,
            anchorTime: pts[0].time,
          }
        : draft.tool === 'horizontalRay' && pts.length >= 1
          ? {
              id: 'draft',
              type: 'horizontalRay',
              style: draft.style,
              origin: pts[0],
            }
          : draft.tool === 'rectangle' && pts.length >= 2
            ? {
                id: 'draft',
                type: 'rectangle',
                style: draft.style,
                p1: pts[0],
                p2: pts[1],
              }
            : draft.tool === 'path' && pts.length >= 1
              ? {
                  id: 'draft',
                  type: 'path',
                  style: draft.style,
                  points: pts,
                }
              : null;

  if (temp) {
    paintDrawing(ctx, temp, mapper, false);
  } else if (pts.length === 1) {
    const p = pointToPixel(pts[0], mapper);
    if (!p) return;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = draft.style.color;
    ctx.fill();
  }
}

export function paintAllDrawings(
  ctx: CanvasRenderingContext2D,
  drawings: Drawing[],
  selectedId: string | null,
  draft: DrawingDraft | null,
  mapper: CoordMapper,
) {
  ctx.clearRect(0, 0, mapper.width, mapper.height);
  for (const d of drawings) {
    paintDrawing(ctx, d, mapper, d.id === selectedId);
  }
  if (draft) paintDraft(ctx, draft, mapper);
}

export const LINE_TOOLS: DrawingTool[] = [
  'trendLine',
  'horizontalLine',
  'horizontalRay',
];

export const SHAPE_TOOLS: DrawingTool[] = ['rectangle'];
