import { getTradeDisplayPnlValue, type PnlDisplayMode } from './pnlDisplay';

/** Tranches de durée alignées sur le graphique « Répartition des Trades par Durée » du dashboard. */
export const DURATION_BUCKET_ORDER = [
  '5m',
  '5-10m',
  '10-20m',
  '20-30m',
  '30-45m',
  '45-60m',
] as const;

export type DurationBucketKey = (typeof DURATION_BUCKET_ORDER)[number];

/** Libellé affiché sur l’axe des graphiques (abscisse). */
export function formatDurationBucketLabel(key: DurationBucketKey): string {
  if (key === '5m') return '< 5m';
  if (key === '30-45m') return '> 30m';
  return key;
}

export function categorizeDuration(minutes: number): DurationBucketKey {
  if (minutes < 5) return '5m';
  if (minutes < 10) return '5-10m';
  if (minutes < 20) return '10-20m';
  if (minutes < 30) return '20-30m';
  if (minutes < 45) return '30-45m';
  if (minutes < 60) return '45-60m';
  return '30-45m';
}

/** Parse une durée (HH:MM:SS ou ISO PT…) en minutes. */
export function parseTradeDurationToMinutes(durationStr: string | null | undefined): number {
  if (!durationStr) return 0;

  const trimmed = String(durationStr).trim();
  if (!trimmed) return 0;

  if (trimmed.includes(':')) {
    const parts = trimmed.split(':').map((part) => Number(part));
    if (parts.some((part) => Number.isNaN(part))) {
      const asNumber = Number(trimmed);
      return Number.isFinite(asNumber) && asNumber > 0 ? asNumber : 0;
    }
    if (parts.length === 3) {
      const [hours, minutes, seconds] = parts;
      return hours * 60 + minutes + seconds / 60;
    }
    if (parts.length === 2) {
      const [minutes, seconds] = parts;
      return minutes + seconds / 60;
    }
  }

  const match = trimmed.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/i);
  if (match) {
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseFloat(match[3] || '0');
    return hours * 60 + minutes + seconds / 60;
  }

  const asNumber = Number(trimmed);
  return Number.isFinite(asNumber) && asNumber > 0 ? asNumber : 0;
}

export interface TradeDurationSource {
  trade_duration?: string | null;
  entered_at?: string | null;
  exited_at?: string | null;
}

/**
 * Durée pour les graphiques par tranche : uniquement `trade_duration` (comme le dashboard).
 * N'utilise pas entered_at/exited_at pour éviter des écarts avec la base et la répartition.
 */
export function getTradeDurationMinutesForBucket(trade: TradeDurationSource): number | null {
  if (!trade.trade_duration) return null;
  const minutes = parseTradeDurationToMinutes(trade.trade_duration);
  return minutes > 0 ? minutes : null;
}

/** @deprecated Préférer getTradeDurationMinutesForBucket pour les graphiques par tranche. */
export function resolveTradeDurationMinutes(trade: TradeDurationSource): number | null {
  if (trade.entered_at && trade.exited_at) {
    const entered = new Date(trade.entered_at).getTime();
    const exited = new Date(trade.exited_at).getTime();
    if (!Number.isNaN(entered) && !Number.isNaN(exited) && exited > entered) {
      return (exited - entered) / 60000;
    }
  }
  return getTradeDurationMinutesForBucket(trade);
}

export type TradeOutcome = 'win' | 'loss' | 'breakeven';

/** Résultat aligné sur le champ P/L affiché (net ou brut), pas sur is_profitable (toujours net). */
export function classifyTradeOutcomeFromPnl(pnl: number): TradeOutcome {
  if (pnl > 0) return 'win';
  if (pnl < 0) return 'loss';
  return 'breakeven';
}

export interface TradeForDurationAggregate extends TradeDurationSource {
  pnl?: string | null;
  net_pnl?: string | null;
}

export interface DurationBucketPerformanceRow {
  label: string;
  avgPnl: number;
  /** wins / tradeCount × 100 (même logique que les stats API : dénominateur = tous les trades de la tranche). */
  winRate: number;
  tradeCount: number;
  winningCount: number;
  losingCount: number;
  breakevenCount: number;
}

export interface DurationDistributionRow {
  label: string;
  winning: number;
  losing: number;
  total: number;
}

function emptyBucketCounters(): Record<
  DurationBucketKey,
  { pnlSum: number; tradeCount: number; wins: number; losses: number; breakeven: number }
> {
  return Object.fromEntries(
    DURATION_BUCKET_ORDER.map((key) => [
      key,
      { pnlSum: 0, tradeCount: 0, wins: 0, losses: 0, breakeven: 0 },
    ])
  ) as Record<
    DurationBucketKey,
    { pnlSum: number; tradeCount: number; wins: number; losses: number; breakeven: number }
  >;
}

function accumulateTradeInBuckets(
  buckets: ReturnType<typeof emptyBucketCounters>,
  trade: TradeForDurationAggregate,
  pnlDisplayMode: PnlDisplayMode
): void {
  const minutes = getTradeDurationMinutesForBucket(trade);
  if (minutes == null) return;

  const pnl = getTradeDisplayPnlValue(trade, pnlDisplayMode);
  if (pnl === null || !Number.isFinite(pnl)) return;

  const bucketKey = categorizeDuration(minutes);
  const bucket = buckets[bucketKey];
  bucket.pnlSum += pnl;
  bucket.tradeCount += 1;

  const outcome = classifyTradeOutcomeFromPnl(pnl);
  if (outcome === 'win') bucket.wins += 1;
  else if (outcome === 'loss') bucket.losses += 1;
  else bucket.breakeven += 1;
}

/** Agrégation performance (P/L moyen + win rate) par tranche — source unique pour Analytics. */
export function aggregateDurationPerformance(
  trades: TradeForDurationAggregate[],
  pnlDisplayMode: PnlDisplayMode
): DurationBucketPerformanceRow[] {
  const buckets = emptyBucketCounters();
  trades.forEach((trade) => accumulateTradeInBuckets(buckets, trade, pnlDisplayMode));

  return DURATION_BUCKET_ORDER.flatMap((key) => {
    const bucket = buckets[key];
    if (bucket.tradeCount === 0) return [];

    return [
      {
        label: formatDurationBucketLabel(key),
        avgPnl: bucket.pnlSum / bucket.tradeCount,
        winRate: (bucket.wins / bucket.tradeCount) * 100,
        tradeCount: bucket.tradeCount,
        winningCount: bucket.wins,
        losingCount: bucket.losses,
        breakevenCount: bucket.breakeven,
      },
    ];
  });
}

/** Répartition gagnants / perdants par tranche (dashboard) — même périmètre que aggregateDurationPerformance. */
export function aggregateDurationDistribution(
  trades: TradeForDurationAggregate[],
  pnlDisplayMode: PnlDisplayMode
): DurationDistributionRow[] {
  const buckets = emptyBucketCounters();
  trades.forEach((trade) => accumulateTradeInBuckets(buckets, trade, pnlDisplayMode));

  return DURATION_BUCKET_ORDER.flatMap((key) => {
    const bucket = buckets[key];
    const total = bucket.wins + bucket.losses;
    if (total === 0) return [];

    return [
      {
        label: formatDurationBucketLabel(key),
        winning: bucket.wins,
        losing: bucket.losses,
        total,
      },
    ];
  });
}
