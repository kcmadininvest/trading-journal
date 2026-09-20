/** Métriques R:R / P&L / sizing pour l’outil Position. */

import type { PositionSide } from './positionToolSizing';

export type ContractSpecs = {
  pointValue: number;
  tickSize: number;
  name?: string;
};

/** Sous-ensemble aligné sur backend contract_specs (indices courants). */
const FUTURES_SPECS: Record<string, ContractSpecs> = {
  ES: { pointValue: 50, tickSize: 0.25, name: 'E-mini S&P 500' },
  NQ: { pointValue: 20, tickSize: 0.25, name: 'E-mini Nasdaq-100' },
  YM: { pointValue: 5, tickSize: 1, name: 'E-mini Dow Jones' },
  RTY: { pointValue: 50, tickSize: 0.1, name: 'E-mini Russell 2000' },
  MES: { pointValue: 5, tickSize: 0.25, name: 'Micro E-mini S&P 500' },
  MNQ: { pointValue: 2, tickSize: 0.25, name: 'Micro E-mini Nasdaq-100' },
  MYM: { pointValue: 0.5, tickSize: 1, name: 'Micro E-mini Dow Jones' },
  M2K: { pointValue: 5, tickSize: 0.1, name: 'Micro E-mini Russell 2000' },
  GC: { pointValue: 100, tickSize: 0.1, name: 'Gold' },
  MCL: { pointValue: 100, tickSize: 0.01, name: 'Micro WTI Crude Oil' },
  CL: { pointValue: 1000, tickSize: 0.01, name: 'Crude Oil' },
};

/** Extrait le symbole de base (NQ, MNQ, …) depuis un libellé instrument. */
export function getBaseSymbol(instrument: string | null | undefined): string | null {
  if (!instrument) return null;
  const upper = instrument.trim().toUpperCase();
  if (!upper) return null;
  // CON.F.US.ENQ.H25 → ENQ / NQ aliases handled below
  const conMatch = upper.match(/CON\.F\.[A-Z]+\.([A-Z0-9]+)/);
  if (conMatch) {
    const code = conMatch[1];
    if (code === 'ENQ' || code.startsWith('ENQ')) return 'NQ';
    if (code === 'EP' || code.startsWith('EP')) return 'ES';
    if (FUTURES_SPECS[code]) return code;
  }
  // Tri des clés les plus longues d’abord (MNQ avant NQ)
  const keys = Object.keys(FUTURES_SPECS).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (upper === key || upper.startsWith(key)) return key;
  }
  return null;
}

export function resolveContractSpecs(
  instrument: string | null | undefined,
): ContractSpecs | null {
  const base = getBaseSymbol(instrument);
  if (!base) return null;
  return FUTURES_SPECS[base] ?? null;
}

export function tickValue(specs: ContractSpecs): number {
  return specs.tickSize * specs.pointValue;
}

export type PositionLevels = {
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  side: PositionSide;
};

export type PositionMetrics = {
  stopDistance: number;
  targetDistance: number;
  stopPct: number;
  targetPct: number;
  riskReward: number | null;
  stopPnl: number | null;
  targetPnl: number | null;
  /** P&L en points (Δprice × qty) si pas de point_value. */
  stopPnlPoints: number;
  targetPnlPoints: number;
};

export function stopDistancePoints(levels: PositionLevels): number {
  return Math.abs(levels.entryPrice - levels.stopPrice);
}

export function targetDistancePoints(levels: PositionLevels): number {
  return Math.abs(levels.targetPrice - levels.entryPrice);
}

export function riskRewardRatio(levels: PositionLevels): number | null {
  const risk = stopDistancePoints(levels);
  if (risk <= 0) return null;
  return targetDistancePoints(levels) / risk;
}

/**
 * PnL $ = Δprice × point_value × qty (même logique ImportedTrade).
 */
export function priceMovePnl(
  entryPrice: number,
  exitPrice: number,
  qty: number,
  pointValue: number | null,
  side: PositionSide,
): number | null {
  const signed =
    side === 'long' ? exitPrice - entryPrice : entryPrice - exitPrice;
  if (pointValue == null || !Number.isFinite(pointValue)) return null;
  return signed * pointValue * qty;
}

export function computePositionMetrics(
  levels: PositionLevels,
  qty: number,
  specs: ContractSpecs | null,
): PositionMetrics {
  const stopDistance = stopDistancePoints(levels);
  const targetDistance = targetDistancePoints(levels);
  const entry = levels.entryPrice;
  const stopPct = entry !== 0 ? (stopDistance / Math.abs(entry)) * 100 : 0;
  const targetPct = entry !== 0 ? (targetDistance / Math.abs(entry)) * 100 : 0;
  const pv = specs?.pointValue ?? null;
  const stopPnl = priceMovePnl(
    levels.entryPrice,
    levels.stopPrice,
    qty,
    pv,
    levels.side,
  );
  const targetPnl = priceMovePnl(
    levels.entryPrice,
    levels.targetPrice,
    qty,
    pv,
    levels.side,
  );
  return {
    stopDistance,
    targetDistance,
    stopPct,
    targetPct,
    riskReward: riskRewardRatio(levels),
    stopPnl,
    targetPnl,
    stopPnlPoints: stopDistance * qty,
    targetPnlPoints: targetDistance * qty,
  };
}

/**
 * quantité = floor( risqueDollars / (distanceStop × valeurParPoint) )
 * valeurParPoint = point_value (1 point de prix).
 */
export function calculatePositionSizeFromRisk(params: {
  accountBalance: number;
  riskPercentage: number;
  entryPrice: number;
  stopLossPrice: number;
  pointValue: number;
  tickSize?: number;
}): number {
  const {
    accountBalance,
    riskPercentage,
    entryPrice,
    stopLossPrice,
    pointValue,
    tickSize,
  } = params;
  const riskDollars = accountBalance * (riskPercentage / 100);
  const stopDistance = Math.abs(entryPrice - stopLossPrice);
  if (riskDollars <= 0 || stopDistance <= 0 || pointValue <= 0) return 0;

  if (tickSize != null && tickSize > 0) {
    const numTicks = stopDistance / tickSize;
    const riskPerContract = numTicks * tickSize * pointValue;
    if (riskPerContract <= 0) return 0;
    return Math.floor(riskDollars / riskPerContract);
  }

  const riskPerUnit = stopDistance * pointValue;
  return Math.floor(riskDollars / riskPerUnit);
}

export function flipPositionSide(levels: PositionLevels): PositionLevels {
  const mid = levels.entryPrice;
  const slDist = levels.stopPrice - mid;
  const tpDist = levels.targetPrice - mid;
  return {
    entryPrice: mid,
    // Miroir autour de l’entrée + inversion du sens
    stopPrice: mid - slDist,
    targetPrice: mid - tpDist,
    side: levels.side === 'long' ? 'short' : 'long',
  };
}

/** Après déplacement du SL, recalcule le TP pour garder un R:R cible. */
export function adjustTargetForLockedRR(
  entryPrice: number,
  stopPrice: number,
  side: PositionSide,
  rr: number,
): number {
  const stopDist = Math.abs(entryPrice - stopPrice);
  const tpDist = stopDist * rr;
  return side === 'long' ? entryPrice + tpDist : entryPrice - tpDist;
}

/** Après déplacement du TP, recalcule le SL pour garder un R:R cible. */
export function adjustStopForLockedRR(
  entryPrice: number,
  targetPrice: number,
  side: PositionSide,
  rr: number,
): number {
  const tpDist = Math.abs(targetPrice - entryPrice);
  if (rr <= 0) return entryPrice;
  const stopDist = tpDist / rr;
  return side === 'long' ? entryPrice - stopDist : entryPrice + stopDist;
}

export function translateLevels(
  levels: PositionLevels,
  deltaPrice: number,
): PositionLevels {
  return {
    ...levels,
    entryPrice: levels.entryPrice + deltaPrice,
    stopPrice: levels.stopPrice + deltaPrice,
    targetPrice: levels.targetPrice + deltaPrice,
  };
}
