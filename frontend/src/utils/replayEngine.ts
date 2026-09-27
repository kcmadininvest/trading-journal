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

export function durationsCompatible(baseSeconds: number, higherSeconds: number): boolean {
  return baseSeconds > 0 && higherSeconds > baseSeconds && higherSeconds % baseSeconds === 0;
}

/** Meta 1m de repli si absente de availableTimeframes. */
export const ONE_MINUTE_TIMEFRAME: AvailableTimeframe = {
  value: '1m',
  label: '1m',
  durationSeconds: 60,
};

/**
 * Agrège des bougies de base dans le bucket [bucketStart, bucketStart + higherDuration)
 * dont l'ouverture est <= revealedUntil (données révélées jusqu'à cette seconde).
 * `baseDurationSeconds` sert à n'inclure une barre de base que lorsqu'elle est
 * entièrement couverte : open + baseDuration - 1 <= revealedUntil.
 */
export function aggregateFormingCandle(
  baseCandles: ReplayCandle[],
  bucketStart: number,
  revealedUntil: number,
  baseDurationSeconds = 1,
  higherDurationSeconds?: number,
): VisibleCandle | null {
  const bucketEnd =
    higherDurationSeconds != null && higherDurationSeconds > 0
      ? bucketStart + higherDurationSeconds
      : Number.POSITIVE_INFINITY;
  let open: number | null = null;
  let high = -Infinity;
  let low = Infinity;
  let close = 0;
  let volume = 0;
  let found = false;

  for (const candle of baseCandles) {
    const t = parseCandleUnix(candle);
    if (t < bucketStart) continue;
    if (t >= bucketEnd) break;
    // Barre entièrement révélée (équivalent à t <= revealedUntil quand
    // revealedUntil = fin de pas alignée et t sur la grille de base).
    if (t + baseDurationSeconds - 1 > revealedUntil) break;
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

function tryAggregateForming(
  baseSeries: ReplayCandle[] | undefined,
  baseTimeframe: AvailableTimeframe | null | undefined,
  higherDuration: number,
  bucketStart: number,
  revealedUntil: number,
  /** Si fourni, remplace baseTimeframe.durationSeconds pour le test de couverture. */
  baseDurationOverride?: number,
): VisibleCandle | null {
  if (!baseSeries?.length || !baseTimeframe) return null;
  if (!durationsCompatible(baseTimeframe.durationSeconds, higherDuration)) return null;
  const baseDur =
    baseDurationOverride != null && baseDurationOverride > 0
      ? baseDurationOverride
      : baseTimeframe.durationSeconds;
  return aggregateFormingCandle(
    baseSeries,
    bucketStart,
    revealedUntil,
    baseDur,
    higherDuration,
  );
}

/**
 * Bougies visibles jusqu'à la fin du pas courant (revealedUntil).
 * Si une série de base compatible est fournie, la dernière bougie du TF
 * supérieur peut être en formation. `stepSeconds` = durée du pas moteur
 * (plus fin des panes) ; défaut 1 pour préserver les appels legacy.
 * `fallbackBase*` : repli si la série primaire est vide ou ne couvre pas le bucket.
 */
export function getVisibleCandles(
  series: ReplayCandle[],
  timeframe: AvailableTimeframe,
  replayTimestamp: number,
  baseSeries?: ReplayCandle[],
  baseTimeframe?: AvailableTimeframe | null,
  stepSeconds?: number,
  fallbackBaseSeries?: ReplayCandle[],
  fallbackBaseTimeframe?: AvailableTimeframe | null,
): VisibleCandle[] {
  const duration = timeframe.durationSeconds;
  // Sans stepSeconds explicite : revealedUntil = replayTimestamp (comportement legacy).
  const stepProvided = stepSeconds != null && stepSeconds > 0;
  const step = stepProvided ? stepSeconds! : 1;
  const revealedUntil = replayTimestamp + step - 1;
  const closed: VisibleCandle[] = [];
  let latestNative: ReplayCandle | null = null;

  for (const candle of series) {
    const t = parseCandleUnix(candle);
    if (t > revealedUntil) break;
    latestNative = candle;
    // Convention : timestamp = ouverture. Visible seulement si clôturée
    // (open + duration - 1 <= revealedUntil) OU si on formera la bougie courante via base.
    const closeUnix = t + duration - 1;
    if (closeUnix <= revealedUntil) {
      closed.push({
        time: t,
        open: candle.o,
        high: candle.h,
        low: candle.l,
        close: candle.c,
        volume: candle.v,
      });
    }
  }

  const nativeOpen = latestNative ? parseCandleUnix(latestNative) : null;
  const bucketStart =
    nativeOpen !== null && nativeOpen + duration > revealedUntil
      ? nativeOpen
      : bucketOpenUnix(revealedUntil, duration);
  const lastClosed = closed.length ? closed[closed.length - 1] : null;
  const needsForming = !lastClosed || lastClosed.time < bucketStart;

  if (needsForming) {
    // Legacy (pas de step) : inclusion open <= revealedUntil via baseDuration=1.
    // Avec step moteur : n'inclure une barre de base que si entièrement révélée.
    const primaryBaseDur = stepProvided ? baseTimeframe?.durationSeconds : 1;
    const fallbackBaseDur = stepProvided ? fallbackBaseTimeframe?.durationSeconds : 1;
    const forming =
      tryAggregateForming(
        baseSeries,
        baseTimeframe,
        duration,
        bucketStart,
        revealedUntil,
        primaryBaseDur,
      ) ??
      tryAggregateForming(
        fallbackBaseSeries,
        fallbackBaseTimeframe,
        duration,
        bucketStart,
        revealedUntil,
        fallbackBaseDur,
      );
    if (forming) {
      closed.push(forming);
    } else {
      // Sans formation : même granularité que la base (ou fallback) → bougie native courante.
      const sameTf =
        (baseTimeframe && baseTimeframe.durationSeconds === duration) ||
        (fallbackBaseTimeframe && fallbackBaseTimeframe.durationSeconds === duration);
      if (sameTf) {
        const last =
          latestNative && parseCandleUnix(latestNative) + duration > revealedUntil
            ? latestNative
            : null;
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
  }

  // Filet de sécurité anti-futur (aucune open au-delà des données révélées)
  return closed.filter((c) => c.time <= revealedUntil);
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
    const anchor = this.config.startTimestamp;
    const aligned = anchor + Math.floor((clamped - anchor) / step) * step;
    this._timestamp = clamped === this.config.endTimestamp ? clamped : aligned;
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
