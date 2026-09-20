/** Rendu canvas + hit-test pour l’overlay Position (DraftTrade). */

import {
  DRAWING_HANDLE_RADIUS,
  colorWithAlpha,
  type CoordMapper,
  type PixelPoint,
} from './replayDrawings';
import { riskRewardRatio } from './positionToolMetrics';
import type { PositionSide } from './positionToolSizing';

export type PositionOverlayModel = {
  side: PositionSide;
  entryTime: number;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  endTime: number;
  /** Si défini, le bord droit = entryLogical + widthBars (largeur stable au Play). */
  widthBars?: number | null;
  qty: number;
  instrument?: string | null;
};

export type PositionHandleKind = 'entry' | 'stop' | 'target' | 'end';

export type PositionHit =
  | { kind: 'handle'; handle: PositionHandleKind }
  | { kind: 'body' };

export type PositionLabelFormatters = {
  formatPrice: (n: number) => string;
  /** Ratio récompense/risque, ex. 1:2.00 */
  formatRr: (n: number) => string;
  labels: {
    entry: string;
    stop: string;
    target: string;
    rr: string;
  };
};

const PROFIT_FILL = 'rgba(38, 166, 154, 0.22)';
const LOSS_FILL = 'rgba(239, 83, 80, 0.22)';
const PROFIT_STROKE = '#26A69A';
const LOSS_STROKE = '#EF5350';
const ENTRY_STROKE = '#787B86';
/** Trait d’évolution du prix — sombre en mode clair, clair en mode sombre. */
export function positionPricePathStroke(isDark: boolean): string {
  return isDark ? 'rgba(255, 255, 255, 0.78)' : 'rgba(30, 41, 59, 0.82)';
}

export type PositionPriceCandle = {
  time: number;
  close: number;
  high?: number;
  low?: number;
};

export type PositionPricePoint = { time: number; price: number };

/**
 * Polyligne des closes entre entryTime et endTime.
 * - démarre à (entryTime, entryPrice)
 * - s’arrête au premier touch TP/SL (high/low de bougie, sinon close)
 * - ne se prolonge PAS dans le futur au-delà de la dernière bougie disponible
 *   (évite le « saut » horizontal jusqu’au bord droit au moment du Play)
 */
export function buildPositionPricePath(
  model: Pick<
    PositionOverlayModel,
    'entryTime' | 'entryPrice' | 'endTime' | 'stopPrice' | 'targetPrice'
  >,
  candles: PositionPriceCandle[],
): PositionPricePoint[] {
  const t0 = Math.min(model.entryTime, model.endTime);
  const t1 = Math.max(model.entryTime, model.endTime);
  const upper = Math.max(model.stopPrice, model.targetPrice);
  const lower = Math.min(model.stopPrice, model.targetPrice);

  const sorted = candles
    .filter(
      (c) =>
        Number.isFinite(c.time) &&
        Number.isFinite(c.close) &&
        c.time >= t0 &&
        c.time <= t1,
    )
    .slice()
    .sort((a, b) => a.time - b.time);

  const path: PositionPricePoint[] = [
    { time: model.entryTime, price: model.entryPrice },
  ];
  if (model.entryPrice >= upper || model.entryPrice <= lower) {
    return [
      {
        time: model.entryTime,
        price: Math.min(upper, Math.max(lower, model.entryPrice)),
      },
    ];
  }

  let lastTime = model.entryTime;
  let lastPrice = model.entryPrice;

  for (const c of sorted) {
    if (c.time < model.entryTime) continue;

    const hi =
      c.high != null && Number.isFinite(c.high)
        ? Math.max(c.high, c.close)
        : c.close;
    const lo =
      c.low != null && Number.isFinite(c.low)
        ? Math.min(c.low, c.close)
        : c.close;

    // Touch TP / SL sur cette bougie (extrêmes), même si le close reste dedans.
    const hitUpper = hi >= upper;
    const hitLower = lo <= lower;
    if (hitUpper || hitLower) {
      // Borne touchée : on s’arrête ici (priorité au premier touch logique).
      // Si les deux sont touchés sur la même bougie, on prend la plus proche du close précédent.
      let bound = upper;
      if (hitUpper && hitLower) {
        const distUp = Math.abs(upper - lastPrice);
        const distLo = Math.abs(lower - lastPrice);
        bound = distUp <= distLo ? upper : lower;
      } else if (hitLower) {
        bound = lower;
      }
      const prev = { time: lastTime, price: lastPrice };
      const cur = { time: c.time, price: bound };
      // Interpoler si le close précédent n’était pas encore sur la borne.
      const hit =
        segmentHitBound(prev, { time: c.time, price: bound }, bound) ?? cur;
      if (c.time > lastTime || hit.price !== lastPrice) {
        path.push({ time: Math.max(hit.time, lastTime), price: bound });
      }
      return path;
    }

    if (c.time === model.entryTime) {
      // Ancre entryPrice : on n’ajoute pas le close de la bougie d’entrée
      // (évite un segment vertical / un saut au démarrage du Play).
      continue;
    }

    if (c.time <= lastTime) continue;

    const prev = { time: lastTime, price: lastPrice };
    const cur = { time: c.time, price: c.close };
    const crossUpper = segmentHitBound(prev, cur, upper);
    const crossLower = segmentHitBound(prev, cur, lower);
    let cross: PositionPricePoint | null = null;
    if (crossUpper && crossLower) {
      cross = crossUpper.time <= crossLower.time ? crossUpper : crossLower;
    } else {
      cross = crossUpper ?? crossLower;
    }
    if (cross) {
      path.push(cross);
      return path;
    }

    path.push(cur);
    lastTime = c.time;
    lastPrice = c.close;
  }

  // Pas d’extension horizontale vers endTime : le trait grandit avec les bougies.
  return path;
}

/** Intersection d’un segment avec une horizontale price=bound (t dans (0,1]). */
function segmentHitBound(
  a: PositionPricePoint,
  b: PositionPricePoint,
  bound: number,
): PositionPricePoint | null {
  const da = a.price - bound;
  const db = b.price - bound;
  if (da === 0) return null; // déjà sur la borne au départ du segment
  if (db === 0) return { time: b.time, price: bound };
  if (da * db > 0) return null; // même côté
  const t = da / (da - db);
  if (!(t > 0 && t <= 1)) return null;
  return {
    time: a.time + t * (b.time - a.time),
    price: bound,
  };
}

/**
 * Coupe la polyligne au premier contact avec upper ou lower
 * (plus tôt en temps si les deux sont croisés sur le même segment).
 */
export function truncatePathAtBounds(
  path: PositionPricePoint[],
  upper: number,
  lower: number,
): PositionPricePoint[] {
  if (path.length === 0) return path;
  const out: PositionPricePoint[] = [path[0]];
  // Si le point d’entrée est déjà hors bornes, rien à tracer au-delà.
  if (path[0].price > upper || path[0].price < lower) {
    return [
      {
        time: path[0].time,
        price: Math.min(upper, Math.max(lower, path[0].price)),
      },
    ];
  }
  for (let i = 1; i < path.length; i += 1) {
    const prev = out[out.length - 1];
    const cur = path[i];
    const hitUpper = segmentHitBound(prev, cur, upper);
    const hitLower = segmentHitBound(prev, cur, lower);
    let hit: PositionPricePoint | null = null;
    if (hitUpper && hitLower) {
      hit = hitUpper.time <= hitLower.time ? hitUpper : hitLower;
    } else {
      hit = hitUpper ?? hitLower;
    }
    if (hit) {
      out.push(hit);
      return out;
    }
    out.push(cur);
    if (cur.price >= upper || cur.price <= lower) return out;
  }
  return out;
}

function drawPricePath(
  ctx: CanvasRenderingContext2D,
  points: PositionPricePoint[],
  mapper: CoordMapper,
  clip: { left: number; top: number; right: number; bottom: number },
  strokeColor: string,
) {
  if (points.length < 2) return;
  const pixels: PixelPoint[] = [];
  let lastX = Number.NEGATIVE_INFINITY;
  for (const pt of points) {
    const x = mapper.toX(pt.time);
    const y = mapper.toY(pt.price);
    if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) {
      continue;
    }
    // Ignore tout recul en X (évite le triangle de retour vers l’entrée).
    if (x < lastX - 0.5) continue;
    pixels.push({ x, y });
    lastX = x;
  }
  if (pixels.length < 2) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(
    clip.left,
    clip.top,
    Math.max(1, clip.right - clip.left),
    Math.max(1, clip.bottom - clip.top),
  );
  ctx.clip();
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pixels[0].x, pixels[0].y);
  for (let i = 1; i < pixels.length; i += 1) {
    ctx.lineTo(pixels[i].x, pixels[i].y);
  }
  // Ne jamais closePath : sinon le trait revient au point d’entrée.
  ctx.stroke();
  ctx.restore();
}

export function positionIsComplete(
  model: Partial<PositionOverlayModel> | null | undefined,
): model is PositionOverlayModel {
  if (!model) return false;
  return (
    model.entryTime != null &&
    Number.isFinite(model.entryTime) &&
    model.entryPrice != null &&
    Number.isFinite(model.entryPrice) &&
    model.stopPrice != null &&
    Number.isFinite(model.stopPrice) &&
    model.targetPrice != null &&
    Number.isFinite(model.targetPrice) &&
    model.endTime != null &&
    Number.isFinite(model.endTime)
  );
}

function dist(a: PixelPoint, b: PixelPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function positionHandlePoints(
  model: PositionOverlayModel,
  mapper: CoordMapper,
): Record<PositionHandleKind, PixelPoint | null> {
  const xEntry = mapper.toX(model.entryTime);
  const xEnd = mapper.toX(model.endTime);
  const yEntry = mapper.toY(model.entryPrice);
  const yStop = mapper.toY(model.stopPrice);
  const yTarget = mapper.toY(model.targetPrice);
  const midX =
    xEntry != null && xEnd != null ? (xEntry + xEnd) / 2 : xEntry ?? xEnd;
  return {
    entry: xEntry != null && yEntry != null ? { x: xEntry, y: yEntry } : null,
    stop: midX != null && yStop != null ? { x: midX, y: yStop } : null,
    target: midX != null && yTarget != null ? { x: midX, y: yTarget } : null,
    end:
      xEnd != null && yEntry != null
        ? { x: xEnd, y: yEntry }
        : null,
  };
}

export function positionBBox(
  model: PositionOverlayModel,
  mapper: CoordMapper,
): { left: number; top: number; right: number; bottom: number } | null {
  const x1 = mapper.toX(model.entryTime);
  const x2 = mapper.toX(model.endTime);
  const yEntry = mapper.toY(model.entryPrice);
  const yStop = mapper.toY(model.stopPrice);
  const yTarget = mapper.toY(model.targetPrice);
  if (
    x1 == null ||
    x2 == null ||
    yEntry == null ||
    yStop == null ||
    yTarget == null
  ) {
    return null;
  }
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  const top = Math.min(yEntry, yStop, yTarget);
  const bottom = Math.max(yEntry, yStop, yTarget);
  return { left, top, right, bottom };
}

/** Largeur de préhension du bord droit (redimensionnement horizontal). */
export const POSITION_EDGE_HIT_PX = 6;

export function hitTestPosition(
  model: PositionOverlayModel,
  p: PixelPoint,
  mapper: CoordMapper,
  selected: boolean,
): PositionHit | null {
  const bbox = positionBBox(model, mapper);
  if (!bbox) return null;

  if (selected) {
    const handles = positionHandlePoints(model, mapper);
    const order: PositionHandleKind[] = ['entry', 'stop', 'target', 'end'];
    for (const kind of order) {
      const h = handles[kind];
      if (h && dist(p, h) <= DRAWING_HANDLE_RADIUS + 4) {
        return { kind: 'handle', handle: kind };
      }
    }
  }

  const pad = 4;
  const withinRows = p.y >= bbox.top - pad && p.y <= bbox.bottom + pad;
  // Tout le bord droit est saisissable, pas seulement la pastille.
  if (withinRows && Math.abs(p.x - bbox.right) <= POSITION_EDGE_HIT_PX) {
    return { kind: 'handle', handle: 'end' };
  }
  if (withinRows && p.x >= bbox.left - pad && p.x <= bbox.right + pad) {
    return { kind: 'body' };
  }
  return null;
}

function drawZone(
  ctx: CanvasRenderingContext2D,
  left: number,
  right: number,
  yA: number,
  yB: number,
  fill: string,
  stroke: string,
) {
  const top = Math.min(yA, yB);
  const h = Math.abs(yB - yA);
  const w = Math.max(1, right - left);
  ctx.fillStyle = fill;
  ctx.fillRect(left, top, w, h);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.strokeRect(left, top, w, h);
}

function drawHLine(
  ctx: CanvasRenderingContext2D,
  left: number,
  right: number,
  y: number,
  color: string,
  width = 1.5,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(right, y);
  ctx.stroke();
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  bg: string,
  align: 'left' | 'right' = 'left',
) {
  ctx.font = '11px sans-serif';
  const padX = 4;
  const metrics = ctx.measureText(text);
  const w = metrics.width + padX * 2;
  const h = 14;
  const left = align === 'left' ? x : x - w;
  const top = y - h / 2;
  ctx.fillStyle = bg;
  ctx.fillRect(left, top, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, left + padX, y);
}

function drawHandles(
  ctx: CanvasRenderingContext2D,
  handles: Record<PositionHandleKind, PixelPoint | null>,
) {
  for (const h of Object.values(handles)) {
    if (!h) continue;
    ctx.beginPath();
    ctx.arc(h.x, h.y, DRAWING_HANDLE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = ENTRY_STROKE;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

export function paintPositionOverlay(
  ctx: CanvasRenderingContext2D,
  model: PositionOverlayModel,
  mapper: CoordMapper,
  selected: boolean,
  formatters?: PositionLabelFormatters,
  candles?: PositionPriceCandle[],
  isDark = true,
) {
  const x1 = mapper.toX(model.entryTime);
  const x2 = mapper.toX(model.endTime);
  const yEntry = mapper.toY(model.entryPrice);
  const yStop = mapper.toY(model.stopPrice);
  const yTarget = mapper.toY(model.targetPrice);
  if (
    x1 == null ||
    x2 == null ||
    yEntry == null ||
    yStop == null ||
    yTarget == null
  ) {
    return;
  }
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  const top = Math.min(yEntry, yStop, yTarget);
  const bottom = Math.max(yEntry, yStop, yTarget);

  drawZone(ctx, left, right, yEntry, yTarget, PROFIT_FILL, PROFIT_STROKE);
  drawZone(ctx, left, right, yEntry, yStop, LOSS_FILL, LOSS_STROKE);
  drawHLine(ctx, left, right, yEntry, ENTRY_STROKE, selected ? 2.25 : 1.5);
  drawHLine(ctx, left, right, yTarget, PROFIT_STROKE, selected ? 2 : 1.25);
  drawHLine(ctx, left, right, yStop, LOSS_STROKE, selected ? 2 : 1.25);

  // Bord vertical droit
  ctx.strokeStyle = colorWithAlpha(ENTRY_STROKE, 0.7);
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(right, top);
  ctx.lineTo(right, bottom);
  ctx.stroke();
  ctx.setLineDash([]);

  if (candles && candles.length > 0) {
    drawPricePath(
      ctx,
      buildPositionPricePath(model, candles),
      mapper,
      { left, top, right, bottom },
      positionPricePathStroke(isDark),
    );
  }

  if (formatters) {
    // R:R = (TP − entrée) / (entrée − SL) : dépend donc des deux niveaux.
    const rr = riskRewardRatio({
      entryPrice: model.entryPrice,
      stopPrice: model.stopPrice,
      targetPrice: model.targetPrice,
      side: model.side,
    });
    const entryText = `${formatters.labels.entry} ${formatters.formatPrice(model.entryPrice)}`;
    const stopText = `${formatters.labels.stop} ${formatters.formatPrice(model.stopPrice)}`;
    const rrText =
      rr != null ? `  ${formatters.labels.rr} ${formatters.formatRr(rr)}` : '';
    const targetText = `${formatters.labels.target} ${formatters.formatPrice(model.targetPrice)}${rrText}`;

    // Étiquettes à gauche, posées sur la boîte (bord d’entrée).
    drawLabel(ctx, entryText, left + 6, yEntry, ENTRY_STROKE);
    drawLabel(ctx, stopText, left + 6, yStop, LOSS_STROKE);
    drawLabel(ctx, targetText, left + 6, yTarget, PROFIT_STROKE);
  }

  if (selected) {
    drawHandles(ctx, positionHandlePoints(model, mapper));
  }
}
