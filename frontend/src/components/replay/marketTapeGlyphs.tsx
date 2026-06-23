import React from 'react';
import { ChartHelpTooltip } from '../charts/ChartHelpTooltip';
import { TAPE_EXIT_DOT_R, TAPE_EXIT_TICK_R } from './marketTapeChartMetrics';
import type { TapeExitMarkerLayout } from './marketTapeMarkerLayout';
import type { TapeMarker } from './marketTapeData';
import { getLegendTripColor, getTripColor, getTripLegendSampleColors } from './marketTapeTripColors';
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
  isDark?: boolean;
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
    <rect
      x={7.5}
      y={6}
      width={7}
      height={9}
      rx={2}
      fill={theme.bearFill}
      stroke={theme.wickFill}
      strokeWidth={1}
    />
    <line x1={11} y1={15} x2={11} y2={19} stroke={theme.wickFill} strokeWidth={0.5} strokeLinecap="round" />
  </svg>
);

export const TapeGlyphEntryLong: React.FC<GlyphProps> = ({ theme, isDark = true, size = ICON }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden>
    <TapeArrowUp
      fill={getLegendTripColor('long', isDark) ?? theme.entryLong}
      d={LEGEND_ARROW_UP}
    />
  </svg>
);

export const TapeGlyphEntryShort: React.FC<GlyphProps> = ({ theme, isDark = true, size = ICON }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden>
    <TapeArrowDown
      fill={getLegendTripColor('short', isDark) ?? theme.entryShort}
      d={LEGEND_ARROW_DOWN}
    />
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

export const TapeGlyphExit: React.FC<GlyphProps> = ({ theme, isDark = true, size = ICON }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden>
    <TapeExitLegendGraphic fill={getLegendTripColor('long', isDark) ?? theme.exitWin} />
  </svg>
);

/** Sortie sur le bandeau : tick au prix sur la bougie + trait + pastille décalée. */
export const TapeExitMarkerGraphic: React.FC<{ layout: TapeExitMarkerLayout }> = ({ layout }) => (
  <g>
    <line
      x1={layout.barX}
      y1={layout.tickY}
      x2={layout.dotX}
      y2={layout.dotY}
      stroke={layout.fill}
      strokeWidth={1.25}
      strokeLinecap="round"
      opacity={0.9}
    />
    <circle cx={layout.barX} cy={layout.tickY} r={TAPE_EXIT_TICK_R} fill={layout.fill} />
    <circle cx={layout.dotX} cy={layout.dotY} r={TAPE_EXIT_DOT_R} fill={layout.fill} />
  </g>
);

/** Marqueur entrée sur le bandeau (flèche, décalage vertical géré par le parent). */
export const TapeChartEntryMarkerGlyph: React.FC<{
  marker: Pick<TapeMarker, 'side' | 'tripIndex'>;
  theme: MarketTapeTheme;
  isDark: boolean;
}> = ({ marker, theme, isDark }) => {
  const isLong = (marker.side || '').toLowerCase() === 'long';
  const tripColor = getTripColor(marker.tripIndex, marker.side, isDark);
  const fill = tripColor ?? (isLong ? theme.entryLong : theme.entryShort);
  return isLong ? (
    <TapeArrowUp fill={fill} d={CHART_ARROW_UP} />
  ) : (
    <TapeArrowDown fill={fill} d={CHART_ARROW_DOWN} />
  );
};

const TapeMultiColorStopLine: React.FC<{
  colors: string[];
  dasharray: string;
  strokeWidth: number;
}> = ({ colors, dasharray, strokeWidth }) => {
  const segmentW = 16 / colors.length;
  return (
    <>
      {colors.map((color, i) => (
        <line
          key={`${color}-${i}`}
          x1={3 + i * segmentW}
          y1={11}
          x2={3 + (i + 1) * segmentW}
          y2={11}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={dasharray}
          strokeLinecap="round"
        />
      ))}
    </>
  );
};

export const TapeGlyphStopLossPlanned: React.FC<GlyphProps & { isDark?: boolean }> = ({
  isDark = true,
  size = ICON,
}) => (
  <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden>
    <TapeMultiColorStopLine
      colors={getTripLegendSampleColors(isDark)}
      dasharray="5 2"
      strokeWidth={2.5}
    />
  </svg>
);

export const TapeGlyphStopLossBroker: React.FC<GlyphProps & { isDark?: boolean }> = ({
  isDark = true,
  size = ICON,
}) => (
  <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden>
    <TapeMultiColorStopLine
      colors={getTripLegendSampleColors(isDark)}
      dasharray="4 2"
      strokeWidth={2.25}
    />
  </svg>
);

interface LegendItemProps {
  Glyph: React.FC<GlyphProps>;
  theme: MarketTapeTheme;
  isDark: boolean;
  label: string;
  trailing?: React.ReactNode;
}

export const MarketTapeLegendItem: React.FC<LegendItemProps> = ({
  Glyph,
  theme,
  isDark,
  label,
  trailing,
}) => (
  <span
    className="inline-flex items-center gap-1 shrink-0"
    role="listitem"
    title={label}
    aria-label={label}
  >
    <span className="flex-shrink-0 leading-none md:hidden">
      <Glyph theme={theme} isDark={isDark} size={16} />
    </span>
    <span className="hidden md:inline-flex flex-shrink-0 leading-none">
      <Glyph theme={theme} isDark={isDark} size={22} />
    </span>
    <span className="hidden md:inline text-[11px] text-gray-600 dark:text-gray-300 whitespace-nowrap">{label}</span>
    {trailing}
  </span>
);

interface MarketTapeLegendProps {
  theme: MarketTapeTheme;
  isDark: boolean;
  labels: {
    entryLong: string;
    entryShort: string;
    exit: string;
    stopLossBroker: string;
    help: string;
  };
}

export const MarketTapeLegend: React.FC<MarketTapeLegendProps> = ({ theme, isDark, labels }) => (
  <div
    className="shrink-0 flex flex-nowrap md:flex-wrap justify-start md:justify-center gap-x-2 md:gap-x-3 gap-y-0 md:gap-y-2 overflow-x-auto md:overflow-visible border-t border-gray-100 bg-gray-50 px-1 py-1 md:py-2 -mx-1 md:mx-0 dark:border-gray-700/80 dark:bg-gray-900/40"
    role="list"
    aria-label="Légende du bandeau marché"
  >
    <MarketTapeLegendItem
      Glyph={TapeGlyphEntryLong}
      theme={theme}
      isDark={isDark}
      label={labels.entryLong}
    />
    <MarketTapeLegendItem
      Glyph={TapeGlyphEntryShort}
      theme={theme}
      isDark={isDark}
      label={labels.entryShort}
    />
    <MarketTapeLegendItem
      Glyph={TapeGlyphExit}
      theme={theme}
      isDark={isDark}
      label={labels.exit}
    />
    <MarketTapeLegendItem
      Glyph={TapeGlyphStopLossBroker}
      theme={theme}
      isDark={isDark}
      label={labels.stopLossBroker}
      trailing={<ChartHelpTooltip content={labels.help} position="top" delay={200} />}
    />
  </div>
);
