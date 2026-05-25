export interface DensityGridPoint {
  x: number;
  y: number;
}

export interface DensityGridCell {
  /** Centre X (nombre de trades, entier) */
  trades: number;
  yMin: number;
  yMax: number;
  yCenter: number;
  count: number;
  avgPnl: number;
}

export interface DensityGridDomain {
  yMin: number;
  yMax: number;
  minTrades: number;
  maxTrades: number;
}

/**
 * Grille 2D : une colonne par nombre de trades (entier), bandes verticales de PnL.
 * Adapté aux journées agrégées (X discret, Y continu).
 */
export function computeTradePnlDensityGrid(
  points: DensityGridPoint[],
  domain: DensityGridDomain,
  yBinCount = 22,
): DensityGridCell[] {
  if (points.length === 0 || yBinCount <= 0) {
    return [];
  }

  const ySpan = domain.yMax - domain.yMin;
  if (ySpan <= 0) {
    return [];
  }

  const yStep = ySpan / yBinCount;
  const bins = new Map<string, { trades: number; yIndex: number; count: number; sumPnl: number }>();

  for (const point of points) {
    const trades = Math.round(point.x);
    if (trades < domain.minTrades || trades > domain.maxTrades) {
      continue;
    }
    let yIndex = Math.floor((point.y - domain.yMin) / yStep);
    yIndex = Math.max(0, Math.min(yBinCount - 1, yIndex));
    const key = `${trades},${yIndex}`;
    const existing = bins.get(key);
    if (existing) {
      existing.count += 1;
      existing.sumPnl += point.y;
    } else {
      bins.set(key, { trades, yIndex, count: 1, sumPnl: point.y });
    }
  }

  return Array.from(bins.values()).map((bin) => {
    const yMin = domain.yMin + bin.yIndex * yStep;
    const yMax = yMin + yStep;
    return {
      trades: bin.trades,
      yMin,
      yMax,
      yCenter: (yMin + yMax) / 2,
      count: bin.count,
      avgPnl: bin.sumPnl / bin.count,
    };
  });
}

/** Bornes Y arrondies pour un axe lisible. */
export function computeNiceYBounds(values: number[]): { yMin: number; yMax: number } {
  if (values.length === 0) {
    return { yMin: -1000, yMax: 1000 };
  }
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = Math.max(rawMax - rawMin, 1);
  const roughStep = span / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const step = Math.ceil(roughStep / magnitude) * magnitude;
  const yMin = Math.floor(rawMin / step) * step - step * 0.5;
  const yMax = Math.ceil(rawMax / step) * step + step * 0.5;
  return { yMin, yMax };
}

export function computeXTickValues(minTrades: number, maxTrades: number): number[] {
  const start = Math.ceil(minTrades);
  const end = Math.floor(maxTrades);
  if (end < start) {
    return [minTrades, maxTrades];
  }
  const range = end - start;
  const step = range <= 12 ? 1 : Math.ceil(range / 10);
  const ticks: number[] = [];
  for (let v = start; v <= end; v += step) {
    ticks.push(v);
  }
  if (ticks[ticks.length - 1] !== end) {
    ticks.push(end);
  }
  return ticks;
}

export function computeYTickValues(yMin: number, yMax: number, count = 5): number[] {
  const span = yMax - yMin;
  if (span <= 0) {
    return [yMin, yMax];
  }
  const step = span / (count - 1);
  return Array.from({ length: count }, (_, i) => yMin + step * i);
}

/** Fraction de la largeur d'une bande utilisée par la colonne de densité. */
export const TRADE_COLUMN_FILL_RATIO = 0.72;

/** Valeurs entières de l'axe X (une bande par nombre de trades). */
export function buildTradeSlots(minTrades: number, maxTrades: number): number[] {
  const start = Math.ceil(minTrades);
  const end = Math.floor(maxTrades);
  const slots: number[] = [];
  for (let t = start; t <= end; t += 1) {
    slots.push(t);
  }
  return slots;
}

/** Max de jours par cellule, par colonne (normalisation relative). */
export function computeMaxCountByTrades(cells: DensityGridCell[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const cell of cells) {
    const prev = map.get(cell.trades) ?? 0;
    if (cell.count > prev) {
      map.set(cell.trades, cell.count);
    }
  }
  return map;
}

/** Nombre total de jours de trading par nombre de trades (entier). */
export function computeDayTotalsByTrades(points: DensityGridPoint[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const point of points) {
    const trades = Math.round(point.x);
    map.set(trades, (map.get(trades) ?? 0) + 1);
  }
  return map;
}

/** Intensité 0–1 avec plancher pour garder les colonnes peu denses lisibles. */
export function densityIntensity(count: number, maxInColumn: number): number {
  if (count <= 0 || maxInColumn <= 0) {
    return 0;
  }
  if (maxInColumn === 1) {
    return 1;
  }
  const linear = count / maxInColumn;
  return 0.35 + Math.sqrt(linear) * 0.65;
}
