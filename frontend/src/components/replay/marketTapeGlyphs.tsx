import React from 'react';
import { ChartHelpTooltip } from '../charts/ChartHelpTooltip';
import { MarketTapeTheme } from './replayStyles';

const ICON = 22;

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
    <circle cx={11} cy={11} r={8} fill={theme.entryLong} stroke="#fff" strokeWidth={1.5} />
    <text x={11} y={14.5} textAnchor="middle" fontSize={8} fill="#fff" fontWeight="700">
      ▲
    </text>
  </svg>
);

export const TapeGlyphEntryShort: React.FC<GlyphProps> = ({ theme, size = ICON }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden>
    <circle cx={11} cy={11} r={8} fill={theme.entryShort} stroke="#fff" strokeWidth={1.5} />
    <text x={11} y={14.5} textAnchor="middle" fontSize={8} fill="#fff" fontWeight="700">
      ▼
    </text>
  </svg>
);

export const TapeGlyphExitWin: React.FC<GlyphProps> = ({ theme, size = ICON }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden>
    <circle cx={11} cy={11} r={6} fill={theme.exitWin} stroke="#fff" strokeWidth={1.25} />
    <text x={11} y={14} textAnchor="middle" fontSize={7} fill="#fff" fontWeight="700">
      ✕
    </text>
  </svg>
);

export const TapeGlyphExitLoss: React.FC<GlyphProps> = ({ theme, size = ICON }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden>
    <circle cx={11} cy={11} r={6} fill={theme.exitLoss} stroke="#fff" strokeWidth={1.25} />
    <text x={11} y={14} textAnchor="middle" fontSize={7} fill="#fff" fontWeight="700">
      ✕
    </text>
  </svg>
);

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
