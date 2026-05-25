import React from 'react';
import { ChartHelpTooltip } from '../charts/ChartHelpTooltip';
import { TAPE_EXIT_DOT_R, TAPE_EXIT_TICK_R } from './marketTapeChartMetrics';
import type { TapeExitMarkerLayout } from './marketTapeMarkerLayout';
import type { TapeMarker } from './marketTapeData';
import { MarketTapeTheme } from './replayStyles';

const ICON = 22;

/** Décalage vertical viewBox : entrées décalées sous/sur le prix ; sorties centrées sur le prix (+ empilement). */
export function getTapeMarkerAnchorOffset(
  marker: Pick<TapeMarker, 'kind' | 'side' | 'pnl' | 'offsetY'>,
): number {
  const stack = marker.offsetY ?? 0;
  if (marker.kind === 'entry') {
    const isLong = (marker.side || '').toLowerCase() === 'long';
    return (isLong ? 14 : -14) + stack;
  }
  if (marker.kind === 'exit') {
    return stack;
  }
  return stack;
}

const ARROW_STROKE = 'rgba(0,0,0,0.2)';

/** Flèche entrée long (arrowUp) — repère : pointe en haut vers le prix. */
const TapeArrowUp: React.FC<{ fill: string; d: string }> = ({ fill, d }) => (
  <path d={d} fill={fill} stroke={ARROW_STROKE} strokeWidth={0.65} strokeLinejoin="round" />
);

/** Flèche entrée short (arrowDown). */
const TapeArrowDown: React.FC<{ fill: string; d: string }> = ({ fill, d }) => (
  <path d={d} fill={fill} stroke={ARROW_STROKE} strokeWidth={0.65} strokeLinejoin="round" />
);

const LEGEND_ARROW_UP = 'M11 5 L15.5 15.5 H6.5 Z';
const LEGEND_ARROW_DOWN = 'M11 17 L15.5 6.5 H6.5 Z';
const CHART_ARROW_UP = 'M0 -5.5 L4.25 4.5 H-4.25 Z';
const CHART_ARROW_DOWN = 'M0 5.5 L4.25 -4.5 H-4.25 Z';

interface GlyphProps {
  theme: MarketTapeTheme;
  size?: number;
}

/** Bougie haussière — même forme que sur le graphique. */
export const TapeGlyphBullCandle: React.FC<GlyphProps> = ({ theme, size = ICON }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden>
    <line x1={11} y1={3} x2={11} y2={7} stroke={theme.wickFill} strokeWidth={0.5} strokeLinecap="round" />
    <rect x={7.5} y={7} width={7} height={9} rx={2} fill={theme.bullFill} />
    <line x1={11} y1={16} x2={11} y2={19} stroke={theme.wickFill} strokeWidth={0.5} strokeLinecap="round" />
  </svg>
);

/** Bougie baissière — même forme que sur le graphique. */
export const TapeGlyphBearCandle: React.FC<GlyphProps> = ({ theme, size = ICON }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden>
    <line x1={11} y1={3} x2={11} y2={6} stroke={theme.wickFill} strokeWidth={0.5} strokeLinecap="round" />
    <rect x={7.5} y={6} width={7} height={9} rx={2} fill={theme.bearFill} />
    <line x1={11} y1={15} x2={11} y2={19} stroke={theme.wickFill} strokeWidth={0.5} strokeLinecap="round" />
  </svg>
);

export const TapeGlyphEntryLong: React.FC<GlyphProps> = ({ theme, size = ICON }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden>
    <TapeArrowUp fill={theme.entryLong} d={LEGEND_ARROW_UP} />
  </svg>
);

export const TapeGlyphEntryShort: React.FC<GlyphProps> = ({ theme, size = ICON }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden>
    <TapeArrowDown fill={theme.entryShort} d={LEGEND_ARROW_DOWN} />
  </svg>
);

const LEGEND_EXIT_BAR_X = 14;
const LEGEND_EXIT_DOT_X = 6;
const LEGEND_EXIT_Y = 11;

const TapeExitLegendGraphic: React.FC<{ fill: string }> = ({ fill }) => (
  <>
    <circle cx={LEGEND_EXIT_BAR_X} cy={LEGEND_EXIT_Y} r={2} fill={fill} />
    <line
      x1={LEGEND_EXIT_BAR_X}
      y1={LEGEND_EXIT_Y}
      x2={LEGEND_EXIT_DOT_X}
      y2={LEGEND_EXIT_Y}
      stroke={fill}
      strokeWidth={1.25}
      strokeLinecap="round"
      opacity={0.9}
    />
    <circle cx={LEGEND_EXIT_DOT_X} cy={LEGEND_EXIT_Y} r={4} fill={fill} />
  </>
);

export const TapeGlyphExitWin: React.FC<GlyphProps> = ({ theme, size = ICON }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden>
    <TapeExitLegendGraphic fill={theme.exitWin} />
  </svg>
);

export const TapeGlyphExitLoss: React.FC<GlyphProps> = ({ theme, size = ICON }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden>
    <TapeExitLegendGraphic fill={theme.exitLoss} />
  </svg>
);

/** Sortie sur le bandeau : tick au prix sur la bougie + trait + pastille décalée. */
export const TapeExitMarkerGraphic: React.FC<{ layout: TapeExitMarkerLayout }> = ({ layout }) => (
  <g>
    <line
      x1={layout.barX}
      y1={layout.priceY}
      x2={layout.dotX}
      y2={layout.priceY}
      stroke={layout.fill}
      strokeWidth={1.25}
      strokeLinecap="round"
      opacity={0.9}
    />
    <circle cx={layout.barX} cy={layout.priceY} r={TAPE_EXIT_TICK_R} fill={layout.fill} />
    <circle cx={layout.dotX} cy={layout.dotY} r={TAPE_EXIT_DOT_R} fill={layout.fill} />
  </g>
);

/** Marqueur entrée sur le bandeau (flèche, décalage vertical géré par le parent). */
export const TapeChartEntryMarkerGlyph: React.FC<{
  marker: Pick<TapeMarker, 'side'>;
  theme: MarketTapeTheme;
}> = ({ marker, theme }) => {
  const isLong = (marker.side || '').toLowerCase() === 'long';
  const fill = isLong ? theme.entryLong : theme.entryShort;
  return isLong ? (
    <TapeArrowUp fill={fill} d={CHART_ARROW_UP} />
  ) : (
    <TapeArrowDown fill={fill} d={CHART_ARROW_DOWN} />
  );
};

export const TapeGlyphStopLossPlanned: React.FC<GlyphProps> = ({ theme, size = ICON }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden>
    <line
      x1={3}
      y1={11}
      x2={19}
      y2={11}
      stroke={theme.stopLossPlannedLine}
      strokeWidth={2.5}
      strokeDasharray="5 2"
      strokeLinecap="round"
    />
  </svg>
);

export const TapeGlyphStopLossBroker: React.FC<GlyphProps> = ({ theme, size = ICON }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden>
    <line
      x1={3}
      y1={11}
      x2={19}
      y2={11}
      stroke={theme.stopLossBrokerLine}
      strokeWidth={2.25}
      strokeDasharray="4 2"
      strokeLinecap="round"
    />
  </svg>
);

interface LegendItemProps {
  Glyph: React.FC<GlyphProps>;
  theme: MarketTapeTheme;
  label: string;
  tooltip?: string;
}

export const MarketTapeLegendItem: React.FC<LegendItemProps> = ({ Glyph, theme, label, tooltip }) => (
  <span
    className="inline-flex items-center gap-1 shrink-0"
    role="listitem"
    title={label}
    aria-label={label}
  >
    <span className="flex-shrink-0 leading-none md:hidden">
      <Glyph theme={theme} size={16} />
    </span>
    <span className="hidden md:inline-flex flex-shrink-0 leading-none">
      <Glyph theme={theme} size={22} />
    </span>
    <span className="hidden md:inline text-[11px] text-gray-600 dark:text-gray-300 whitespace-nowrap">{label}</span>
    {tooltip ? <ChartHelpTooltip content={tooltip} position="top" delay={200} /> : null}
  </span>
);

interface MarketTapeLegendProps {
  theme: MarketTapeTheme;
  labels: {
    bull: string;
    bear: string;
    entryLong: string;
    entryShort: string;
    exitWin: string;
    exitLoss: string;
    stopLossPlanned: string;
    stopLossBroker: string;
  };
}

export const MarketTapeLegend: React.FC<MarketTapeLegendProps> = ({ theme, labels }) => (
  <div
    className="shrink-0 flex flex-nowrap md:flex-wrap justify-start md:justify-center gap-x-2 md:gap-x-3 gap-y-0 md:gap-y-2 overflow-x-auto md:overflow-visible border-t border-gray-100 bg-gray-50 px-1 py-1 md:py-2 -mx-1 md:mx-0 dark:border-gray-700/80 dark:bg-gray-900/40"
    role="list"
    aria-label="Légende du bandeau marché"
  >
    <MarketTapeLegendItem Glyph={TapeGlyphBullCandle} theme={theme} label={labels.bull} />
    <MarketTapeLegendItem Glyph={TapeGlyphBearCandle} theme={theme} label={labels.bear} />
    <MarketTapeLegendItem Glyph={TapeGlyphEntryLong} theme={theme} label={labels.entryLong} />
    <MarketTapeLegendItem Glyph={TapeGlyphEntryShort} theme={theme} label={labels.entryShort} />
    <MarketTapeLegendItem Glyph={TapeGlyphExitWin} theme={theme} label={labels.exitWin} />
    <MarketTapeLegendItem Glyph={TapeGlyphExitLoss} theme={theme} label={labels.exitLoss} />
    <MarketTapeLegendItem Glyph={TapeGlyphStopLossPlanned} theme={theme} label={labels.stopLossPlanned} />
    <MarketTapeLegendItem Glyph={TapeGlyphStopLossBroker} theme={theme} label={labels.stopLossBroker} />
  </div>
);
