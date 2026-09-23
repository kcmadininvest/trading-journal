import type { AvailableTimeframe, ReplayCandle } from '../services/marketReplay';

export interface ReplayChartConfiguration {
  chartId: string;
  timeframe: AvailableTimeframe;
}

export interface ReplayConfiguration {
  symbol: string;
  startTimestamp: number; // unix seconds
  endTimestamp: number;
  charts: ReplayChartConfiguration[];
}

export interface VisibleCandle {
  time: number; // unix seconds (open of bar)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type LogicalRange = { from: number; to: number };

/**
 * Plage visible à appliquer quand `appended` bougies sont ajoutées : translation
 * de la plage courante (zoom conservé), uniquement si la dernière bougie était
 * visible avant l’ajout. Retourne null s’il ne faut pas bouger la vue.
 */
export function followAppendedBarsRange(
  current: LogicalRange | null,
  previousCount: number,
  nextCount: number,
): LogicalRange | null {
  const appended = nextCount - previousCount;
  if (!current || appended <= 0 || previousCount <= 0) return null;
  const lastVisible = previousCount - 1 <= current.to + 0.5;
  if (!lastVisible) return null;
  return { from: current.from + appended, to: current.to + appended };
}

export function pickReplayBaseTimeframe(
  charts: ReplayChartConfiguration[],
): AvailableTimeframe | null {
  if (!charts.length) return null;
  let best = charts[0].timeframe;
  for (const chart of charts) {
    if (chart.timeframe.durationSeconds < best.durationSeconds) {
      best = chart.timeframe;
    }
  }
  return best;
}

export function parseCandleUnix(candle: ReplayCandle): number {
  return Math.floor(new Date(candle.t).getTime() / 1000);
}

/**
 * Borne ouverte d'une bougie de durée `durationSeconds` contenant `timestamp`.
 * Alignement UTC epoch (générique, sans hypothèse M1).
 */
export function bucketOpenUnix(timestamp: number, durationSeconds: number): number {
  if (durationSeconds <= 0) return timestamp;
  return Math.floor(timestamp / durationSeconds) * durationSeconds;
}

function durationsCompatible(baseSeconds: number, higherSeconds: number): boolean {
  return baseSeconds > 0 && higherSeconds > baseSeconds && higherSeconds % baseSeconds === 0;
}

/**
 * Agrège des bougies de base dans [bucketStart, replayTimestamp] inclus pour
 * construire une bougie supérieure en formation.
 */
export function aggregateFormingCandle(
  baseCandles: ReplayCandle[],
  bucketStart: number,
  replayTimestamp: number,
): VisibleCandle | null {
  let open: number | null = null;
  let high = -Infinity;
  let low = Infinity;
  let close = 0;
  let volume = 0;
  let found = false;

  for (const candle of baseCandles) {
    const t = parseCandleUnix(candle);
    if (t < bucketStart) continue;
    if (t > replayTimestamp) break;
    if (open === null) open = candle.o;
    high = Math.max(high, candle.h);
    low = Math.min(low, candle.l);
    close = candle.c;
    volume += candle.v;
    found = true;
  }

  if (!found || open === null) return null;
  return {
    time: bucketStart,
    open,
    high,
    low,
    close,
    volume,
  };
}

/**
 * Bougies visibles jusqu'à replayTimestamp (aucune donnée future).
 * Si une série de base compatible est fournie, la dernière bougie du TF
 * supérieur peut être en formation.
 */
export function getVisibleCandles(
  series: ReplayCandle[],
  timeframe: AvailableTimeframe,
  replayTimestamp: number,
  baseSeries?: ReplayCandle[],
  baseTimeframe?: AvailableTimeframe | null,
): VisibleCandle[] {
  const duration = timeframe.durationSeconds;
  const closed: VisibleCandle[] = [];

  for (const candle of series) {
    const t = parseCandleUnix(candle);
    // Convention : timestamp = ouverture. Visible seulement si clôturée
    // (open + duration - 1 <= replay) OU si on formera la bougie courante via base.
    const closeUnix = t + duration - 1;
    if (closeUnix <= replayTimestamp) {
      closed.push({
        time: t,
        open: candle.o,
        high: candle.h,
        low: candle.l,
        close: candle.c,
        volume: candle.v,
      });
    } else if (t > replayTimestamp) {
      break;
    }
  }

  const canForm =
    baseSeries &&
    baseTimeframe &&
    durationsCompatible(baseTimeframe.durationSeconds, duration);

  if (canForm) {
    const bucketStart = bucketOpenUnix(replayTimestamp, duration);
    // Ne pas former si la bougie native est déjà clôturée et présente
    const lastClosed = closed.length ? closed[closed.length - 1] : null;
    if (!lastClosed || lastClosed.time < bucketStart) {
      const forming = aggregateFormingCandle(baseSeries, bucketStart, replayTimestamp);
      if (forming) {
        closed.push(forming);
      }
    }
  } else {
    // Sans granularité inférieure : révéler uniquement les bougies natives
    // dont l'ouverture est <= replayTimestamp (apparition à l'open historique).
    // Si déjà filtrées par closeUnix ci-dessus, pour TF == base (ou égal),
    // une bougie en cours n'est pas partiellement reconstruite.
    if (baseTimeframe && baseTimeframe.durationSeconds === duration) {
      // Même granularité : afficher aussi la bougie dont open <= replay
      // même si non clôturée (c'est la bougie "courante" native).
      const last = series.find((c) => {
        const t = parseCandleUnix(c);
        return t === bucketOpenUnix(replayTimestamp, duration) && t <= replayTimestamp;
      });
      if (last) {
        const t = parseCandleUnix(last);
        if (!closed.some((c) => c.time === t)) {
          closed.push({
            time: t,
            open: last.o,
            high: last.h,
            low: last.l,
            close: last.c,
            volume: last.v,
          });
        }
      }
    }
  }

  // Filet de sécurité anti-futur
  return closed.filter((c) => c.time <= replayTimestamp);
}

export class ReplayEngine {
  readonly config: ReplayConfiguration;
  readonly baseTimeframe: AvailableTimeframe;
  private _timestamp: number;
  private _playing = false;
  private _speed = 1;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(ts: number) => void>();

  constructor(config: ReplayConfiguration) {
    const base = pickReplayBaseTimeframe(config.charts);
    if (!base) {
      throw new Error('ReplayEngine: au moins un graphique requis');
    }
    this.config = config;
    this.baseTimeframe = base;
    this._timestamp = config.startTimestamp;
  }

  get replayTimestamp(): number {
    return this._timestamp;
  }

  get playing(): boolean {
    return this._playing;
  }

  get speed(): number {
    return this._speed;
  }

  get stepSeconds(): number {
    return this.baseTimeframe.durationSeconds;
  }

  subscribe(listener: (ts: number) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this._timestamp);
  }

  setTimestamp(ts: number): void {
    const clamped = Math.min(
      Math.max(ts, this.config.startTimestamp),
      this.config.endTimestamp,
    );
    // Aligner sur la grille du TF de base
    const step = this.stepSeconds;
    const aligned = bucketOpenUnix(clamped, step);
    this._timestamp = Math.min(
      Math.max(aligned, this.config.startTimestamp),
      this.config.endTimestamp,
    );
    this.emit();
  }

  reset(): void {
    this.pause();
    this._timestamp = this.config.startTimestamp;
    this.emit();
  }

  stepForward(steps = 1): void {
    this.setTimestamp(this._timestamp + this.stepSeconds * steps);
  }

  stepBackward(steps = 1): void {
    this.setTimestamp(this._timestamp - this.stepSeconds * steps);
  }

  goToStart(): void {
    this.setTimestamp(this.config.startTimestamp);
  }

  goToEnd(): void {
    this.setTimestamp(this.config.endTimestamp);
  }

  setSpeed(speed: number): void {
    this._speed = Math.max(1, speed);
    if (this._playing) {
      this.pause();
      this.play();
    }
  }

  play(): void {
    if (this._playing) return;
    this._playing = true;
    const intervalMs = 1000 / this._speed;
    this.timer = setInterval(() => {
      if (this._timestamp >= this.config.endTimestamp) {
        this.pause();
        return;
      }
      this.stepForward(1);
    }, intervalMs);
  }

  pause(): void {
    this._playing = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  dispose(): void {
    this.pause();
    this.listeners.clear();
  }

  /** Recalcule le TF de base si la config des charts change. */
  withCharts(charts: ReplayChartConfiguration[]): ReplayEngine {
    const next = new ReplayEngine({ ...this.config, charts });
    next._timestamp = this._timestamp;
    next._speed = this._speed;
    return next;
  }
}
