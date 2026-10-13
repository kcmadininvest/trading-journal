import React from 'react';
import { ChartHelpTooltip } from '../charts/ChartHelpTooltip';
import {
  TAPE_BROKER_STOP_DASH,
  TAPE_BROKER_STOP_WIDTH,
  TAPE_EXIT_DOT_R,
  TAPE_EXIT_TICK_R,
  TAPE_PLANNED_STOP_DASH,
  TAPE_PLANNED_STOP_WIDTH,
} from './marketTapeChartMetrics';
import type { TapeExitMarkerLayout } from './marketTapeMarkerLayout';
import type { TapeMarker } from './marketTapeData';
import { getLegendTripColor, getTripColor } from './marketTapeTripColors';
import { MarketTapeTheme } from './replayStyles';

const ICON = 22;

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

/** Croix à la place de la pastille, même centre, quand la sortie est au stop. */
const TapeExitStopCross: React.FC<{ cx: number; cy: number; r: number; stroke: string }> = ({
  cx,
  cy,
  r,
  stroke,
}) => (
  <g stroke={stroke} strokeWidth={1.4} strokeLinecap="round">
    <line x1={cx - r} y1={cy - r} x2={cx + r} y2={cy + r} />
    <line x1={cx - r} y1={cy + r} x2={cx + r} y2={cy - r} />
  </g>
);

export const TapeGlyphExit: React.FC<GlyphProps> = ({ theme, isDark = true, size = ICON }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden>
    <TapeExitLegendGraphic fill={getLegendTripColor('long', isDark) ?? theme.exitWin} />
  </svg>
);

export const TapeGlyphExitStop: React.FC<GlyphProps> = ({ theme, isDark = true, size = ICON }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden>
    <g>
      <circle
        cx={LEGEND_EXIT_BAR_X}
        cy={LEGEND_EXIT_Y}
        r={2}
        fill={getLegendTripColor('long', isDark) ?? theme.exitWin}
      />
      <line
        x1={LEGEND_EXIT_BAR_X}
        y1={LEGEND_EXIT_Y}
        x2={LEGEND_EXIT_DOT_X}
        y2={LEGEND_EXIT_Y}
        stroke={getLegendTripColor('long', isDark) ?? theme.exitWin}
        strokeWidth={1.25}
        strokeLinecap="round"
        opacity={0.9}
      />
      <TapeExitStopCross
        cx={LEGEND_EXIT_DOT_X}
        cy={LEGEND_EXIT_Y}
        r={4}
        stroke={getLegendTripColor('long', isDark) ?? theme.exitWin}
      />
    </g>
  </svg>
);

/** Sortie sur le bandeau : tick au prix sur la bougie + trait + pastille décalée. */
export const TapeExitMarkerGraphic: React.FC<{
  layout: TapeExitMarkerLayout;
  viaStop?: boolean;
}> = ({ layout, viaStop = false }) => (
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
    {viaStop ? (
      <TapeExitStopCross
        cx={layout.dotX}
        cy={layout.dotY}
        r={TAPE_EXIT_DOT_R}
        stroke={layout.fill}
      />
    ) : (
      <circle cx={layout.dotX} cy={layout.dotY} r={TAPE_EXIT_DOT_R} fill={layout.fill} />
    )}
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

/** Un seul trait, même teinte : le motif distingue le stop broker du stop planifié. */
const TapeStopLegendLine: React.FC<{
  isDark: boolean;
  size: number;
  dasharray: string;
  strokeWidth: number;
}> = ({ isDark, size, dasharray, strokeWidth }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden>
    <line
      x1={1.5}
      y1={11}
      x2={20.5}
      y2={11}
      stroke={getLegendTripColor('long', isDark)}
      strokeWidth={strokeWidth}
      strokeDasharray={dasharray}
      strokeLinecap="round"
    />
  </svg>
);

export const TapeGlyphStopLossPlanned: React.FC<GlyphProps & { isDark?: boolean }> = ({
  isDark = true,
  size = ICON,
}) => (
  <TapeStopLegendLine
    isDark={isDark}
    size={size}
    dasharray={TAPE_PLANNED_STOP_DASH}
    strokeWidth={TAPE_PLANNED_STOP_WIDTH}
  />
);

export const TapeGlyphStopLossBroker: React.FC<GlyphProps & { isDark?: boolean }> = ({
  isDark = true,
  size = ICON,
}) => (
  <TapeStopLegendLine
    isDark={isDark}
    size={size}
    dasharray={TAPE_BROKER_STOP_DASH}
    strokeWidth={TAPE_BROKER_STOP_WIDTH}
  />
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
    <span className="text-[11px] text-gray-600 dark:text-gray-300 whitespace-nowrap">{label}</span>
    {trailing}
  </span>
);

interface MarketTapeLegendProps {
  theme: MarketTapeTheme;
  isDark: boolean;
  showPlannedStop?: boolean;
  labels: {
    entryLong: string;
    entryShort: string;
    exit: string;
    exitStop: string;
    stopLossBroker: string;
    stopLossPlanned: string;
    help: string;
  };
}

export const MarketTapeLegend: React.FC<MarketTapeLegendProps> = ({
  theme,
  isDark,
  showPlannedStop = false,
  labels,
}) => (
  <div
    className="shrink-0 flex flex-wrap justify-start md:justify-center gap-x-2 md:gap-x-3 gap-y-1 md:gap-y-2 border-t border-gray-100 bg-gray-50 px-1 py-1 md:py-2 -mx-1 md:mx-0 dark:border-gray-700/80 dark:bg-gray-900/40"
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
      Glyph={TapeGlyphExitStop}
      theme={theme}
      isDark={isDark}
      label={labels.exitStop}
    />
    <MarketTapeLegendItem
      Glyph={TapeGlyphStopLossBroker}
      theme={theme}
      isDark={isDark}
      label={labels.stopLossBroker}
      trailing={<ChartHelpTooltip content={labels.help} position="top" delay={200} />}
    />
    {showPlannedStop && (
      <MarketTapeLegendItem
        Glyph={TapeGlyphStopLossPlanned}
        theme={theme}
        isDark={isDark}
        label={labels.stopLossPlanned}
      />
    )}
  </div>
);
