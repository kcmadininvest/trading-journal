import type { Chart } from 'chart.js';

/** Seuil pour traiter un montant comme nul (affichage unicolore). */
export const WF_GRADIENT_EPS = 1e-9;

export interface WaterfallBarGradientInput {
  start: number;
  end: number;
  pnlTrading: number;
  dailyNetTransactions: number;
}

/** Couleurs alignées sur le waterfall du dashboard (flux vs PnL). */
export interface WaterfallGradientPalette {
  fluxPosFill: string;
  fluxNegFill: string;
  pnlPosFill: string;
  pnlNegFill: string;
  fluxPosBorder: string;
  fluxNegBorder: string;
  pnlPosBorder: string;
  pnlNegBorder: string;
}

export const defaultWaterfallGradientPalette = (): WaterfallGradientPalette => ({
  fluxPosFill: 'rgba(167, 139, 250, 0.9)',
  fluxNegFill: 'rgba(251, 191, 36, 0.9)',
  pnlPosFill: 'rgba(59, 130, 246, 0.8)',
  pnlNegFill: 'rgba(236, 72, 153, 0.8)',
  fluxPosBorder: '#A78BFA',
  fluxNegBorder: '#FBBF24',
  pnlPosBorder: '#3b82f6',
  pnlNegBorder: '#ec4899',
});

function solidFill(bar: WaterfallBarGradientInput, pal: WaterfallGradientPalette): string {
  const net = bar.dailyNetTransactions;
  const pnl = bar.pnlTrading;
  if (Math.abs(net) < WF_GRADIENT_EPS) {
    return pnl >= 0 ? pal.pnlPosFill : pal.pnlNegFill;
  }
  if (Math.abs(pnl) < WF_GRADIENT_EPS) {
    return net > 0 ? pal.fluxPosFill : pal.fluxNegFill;
  }
  // Secours (pas d’élément chart) : dominante par amplitude
  return Math.abs(net) >= Math.abs(pnl)
    ? net > 0
      ? pal.fluxPosFill
      : pal.fluxNegFill
    : pnl >= 0
      ? pal.pnlPosFill
      : pal.pnlNegFill;
}

function solidBorder(bar: WaterfallBarGradientInput, pal: WaterfallGradientPalette): string {
  const net = bar.dailyNetTransactions;
  const pnl = bar.pnlTrading;
  if (Math.abs(net) < WF_GRADIENT_EPS) {
    return pnl >= 0 ? pal.pnlPosBorder : pal.pnlNegBorder;
  }
  if (Math.abs(pnl) < WF_GRADIENT_EPS) {
    return net > 0 ? pal.fluxPosBorder : pal.fluxNegBorder;
  }
  return Math.abs(net) >= Math.abs(pnl)
    ? net > 0
      ? pal.fluxPosBorder
      : pal.fluxNegBorder
    : pnl >= 0
      ? pal.pnlPosBorder
      : pal.pnlNegBorder;
}

/**
 * Remplissage waterfall : dégradé flux net puis PnL le long du segment **causal**
 * (cumul début → cumul fin), avec part visuelle |net| / (|net|+|pnl|).
 * Évite l’inversion quand start > end (perte + retrait) due à un gradient basé sur min/max seuls.
 */
export function getWaterfallBarFill(
  context: { chart: Chart; dataIndex: number; datasetIndex: number },
  bar: WaterfallBarGradientInput,
  pal: WaterfallGradientPalette = defaultWaterfallGradientPalette()
): CanvasGradient | string {
  const { chart, dataIndex, datasetIndex } = context;
  const ctx = chart?.ctx;
  const yScale = chart?.scales?.y;
  if (!ctx || !yScale) {
    return solidFill(bar, pal);
  }

  const meta = chart.getDatasetMeta(datasetIndex);
  const el = meta?.data?.[dataIndex] as { x?: number } | undefined;
  if (el == null || typeof el.x !== 'number') {
    return solidFill(bar, pal);
  }

  const { start, end, pnlTrading: pnl, dailyNetTransactions: net } = bar;

  if (Math.abs(end - start) < WF_GRADIENT_EPS) {
    return solidFill(bar, pal);
  }

  if (Math.abs(net) < WF_GRADIENT_EPS) {
    return pnl >= 0 ? pal.pnlPosFill : pal.pnlNegFill;
  }
  if (Math.abs(pnl) < WF_GRADIENT_EPS) {
    return net > 0 ? pal.fluxPosFill : pal.fluxNegFill;
  }

  const fluxFill = net > 0 ? pal.fluxPosFill : pal.fluxNegFill;
  const pnlFill = pnl >= 0 ? pal.pnlPosFill : pal.pnlNegFill;

  const w = Math.abs(net) + Math.abs(pnl);
  const frac = w < WF_GRADIENT_EPS ? 0.5 : Math.abs(net) / w;

  const fracClamped = Math.min(1, Math.max(0, frac));
  if (fracClamped <= WF_GRADIENT_EPS) {
    return pnlFill;
  }
  if (fracClamped >= 1 - WF_GRADIENT_EPS) {
    return fluxFill;
  }

  const pStart = yScale.getPixelForValue(start);
  const pEnd = yScale.getPixelForValue(end);
  const g = ctx.createLinearGradient(el.x, pStart, el.x, pEnd);
  g.addColorStop(0, fluxFill);
  g.addColorStop(fracClamped, fluxFill);
  g.addColorStop(fracClamped, pnlFill);
  g.addColorStop(1, pnlFill);
  return g;
}

export function getWaterfallBarBorder(
  context: { chart: Chart; dataIndex: number; datasetIndex: number },
  bar: WaterfallBarGradientInput,
  pal: WaterfallGradientPalette = defaultWaterfallGradientPalette()
): CanvasGradient | string {
  const { chart, dataIndex, datasetIndex } = context;
  const ctx = chart?.ctx;
  const yScale = chart?.scales?.y;
  if (!ctx || !yScale) {
    return solidBorder(bar, pal);
  }

  const meta = chart.getDatasetMeta(datasetIndex);
  const el = meta?.data?.[dataIndex] as { x?: number } | undefined;
  if (el == null || typeof el.x !== 'number') {
    return solidBorder(bar, pal);
  }

  const { start, end, pnlTrading: pnl, dailyNetTransactions: net } = bar;

  if (Math.abs(end - start) < WF_GRADIENT_EPS) {
    return solidBorder(bar, pal);
  }

  if (Math.abs(net) < WF_GRADIENT_EPS) {
    return pnl >= 0 ? pal.pnlPosBorder : pal.pnlNegBorder;
  }
  if (Math.abs(pnl) < WF_GRADIENT_EPS) {
    return net > 0 ? pal.fluxPosBorder : pal.fluxNegBorder;
  }

  const fluxBorder = net > 0 ? pal.fluxPosBorder : pal.fluxNegBorder;
  const pnlBorder = pnl >= 0 ? pal.pnlPosBorder : pal.pnlNegBorder;

  const w = Math.abs(net) + Math.abs(pnl);
  const frac = w < WF_GRADIENT_EPS ? 0.5 : Math.abs(net) / w;

  const fracClamped = Math.min(1, Math.max(0, frac));
  if (fracClamped <= WF_GRADIENT_EPS) {
    return pnlBorder;
  }
  if (fracClamped >= 1 - WF_GRADIENT_EPS) {
    return fluxBorder;
  }

  const pStart = yScale.getPixelForValue(start);
  const pEnd = yScale.getPixelForValue(end);
  const g = ctx.createLinearGradient(el.x, pStart, el.x, pEnd);
  g.addColorStop(0, fluxBorder);
  g.addColorStop(fracClamped, fluxBorder);
  g.addColorStop(fracClamped, pnlBorder);
  g.addColorStop(1, pnlBorder);
  return g;
}
