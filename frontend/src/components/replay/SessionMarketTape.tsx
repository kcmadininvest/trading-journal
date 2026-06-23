import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import Tooltip from '../ui/Tooltip';
import { useTheme } from '../../hooks/useTheme';
import { usePreferences } from '../../hooks/usePreferences';
import { SessionEventItem, SessionMarketData } from '../../services/sessionReplay';
import { getStopLossLineTooltipText, getTapeMarkerTooltipText } from './eventDetail';
import { buildTapeRenderModel, TapeMarker, TapePriceLine, TapeRenderModel } from './marketTapeData';
import { formatCurrencyWithSign, NumberFormatType } from '../../utils/numberFormat';
import {
  TAPE_VIEW_H,
  TAPE_VIEW_W,
  tapeSlotWidth,
  tapeXForBarIndex,
  tapeYForPrice,
} from './marketTapeChartMetrics';
import {
  computeTapeExitMarkerLayout,
  computeTapeMarkerHitCoords,
  resolveTapeTripStrokeColor,
} from './marketTapeMarkerLayout';
import {
  getTapeMarkerAnchorOffset,
  MarketTapeLegend,
  TapeChartEntryMarkerGlyph,
  TapeExitMarkerGraphic,
} from './marketTapeGlyphs';
import { getMarketTapeTheme, getReplayPnlTextClass, MarketTapeTheme, replayCardClass } from './replayStyles';

interface SessionMarketTapeProps {
  marketData: SessionMarketData | null | undefined;
  events: SessionEventItem[];
  currentIndex: number;
  loading?: boolean;
  onRefresh?: () => void;
}

function yForPrice(price: number, model: TapeRenderModel): number {
  return tapeYForPrice(price, model.yMin, model.yMax);
}

function xForBarIndex(index: number, barCount: number): number {
  return tapeXForBarIndex(index, barCount);
}

function barSlotWidth(index: number, model: TapeRenderModel): number {
  const barCount = model.bars.length;
  if (barCount <= 0) return 10;
  const slot = tapeSlotWidth(barCount);
  const isFuture = model.bars[index]?.isFuture ?? false;
  const maxW = isFuture ? 12 : 18;
  return Math.max(isFuture ? 4 : 6, Math.min(maxW, slot * 0.72));
}

const WICK_W = 0.5;
const BODY_RX = 3;

const ModernCandle: React.FC<{
  x: number;
  slotW: number;
  yO: number;
  yC: number;
  yH: number;
  yL: number;
  up: boolean;
  future?: boolean;
  theme: MarketTapeTheme;
}> = ({ x, slotW, yO, yC, yH, yL, up, future = false, theme }) => {
  const bodyTop = Math.min(yO, yC);
  const bodyBottom = Math.max(yO, yC);
  const bodyH = Math.max(2.5, bodyBottom - bodyTop);
  const bodyColor = future ? theme.futureFill : up ? theme.bullFill : theme.bearFill;
  const isBear = !up && !future;

  return (
    <g>
      {yH < bodyTop - 0.5 && (
        <line
          x1={x}
          y1={yH}
          x2={x}
          y2={bodyTop}
          stroke={theme.wickFill}
          strokeWidth={WICK_W}
          strokeLinecap="round"
        />
      )}
      <rect
        x={x - slotW / 2}
        y={bodyTop}
        width={slotW}
        height={bodyH}
        rx={BODY_RX}
        fill={bodyColor}
        stroke={isBear ? theme.wickFill : undefined}
        strokeWidth={isBear ? 1 : 0}
      />
      {bodyBottom < yL - 0.5 && (
        <line
          x1={x}
          y1={bodyBottom}
          x2={x}
          y2={yL}
          stroke={theme.wickFill}
          strokeWidth={WICK_W}
          strokeLinecap="round"
        />
      )}
    </g>
  );
};

function computeMeetSize(containerW: number, containerH: number): { width: number; height: number } {
  if (containerW <= 0 || containerH <= 0) return { width: 0, height: 0 };
  const scale = Math.min(containerW / TAPE_VIEW_W, containerH / TAPE_VIEW_H);
  return { width: TAPE_VIEW_W * scale, height: TAPE_VIEW_H * scale };
}

function markerPositionPercent(x: number, y: number): { left: string; top: string } {
  return {
    left: `${(x / TAPE_VIEW_W) * 100}%`,
    top: `${(y / TAPE_VIEW_H) * 100}%`,
  };
}

function markerEntryDisplayCoords(
  marker: TapeMarker,
  model: TapeRenderModel,
  barCount: number,
): { x: number; y: number } {
  return {
    x: xForBarIndex(marker.barIndex, barCount),
    y: yForPrice(marker.price, model) + getTapeMarkerAnchorOffset(marker),
  };
}

function markerHitCoords(
  marker: TapeMarker,
  model: TapeRenderModel,
  barCount: number,
  theme: MarketTapeTheme,
  isDark: boolean,
): { x: number; y: number } {
  return computeTapeMarkerHitCoords(
    marker,
    model,
    barCount,
    theme,
    getTapeMarkerAnchorOffset(marker),
    isDark,
  );
}

function hitPxClassForKind(kind: TapeMarker['kind']): string {
  switch (kind) {
    case 'entry':
      return 'h-7 w-5';
    case 'exit':
      return 'h-4 w-4';
    default:
      return 'h-4 w-4';
  }
}

const TapeMarkerTooltipContent: React.FC<{
  marker: TapeMarker;
  events: SessionEventItem[];
  t: TFunction;
  numberFormat: NumberFormatType;
}> = ({ marker, events, t, numberFormat }) => {
  const fullText = getTapeMarkerTooltipText(marker, t, numberFormat, events);
  if (marker.kind !== 'exit' || marker.pnl == null || !Number.isFinite(marker.pnl)) {
    return <>{fullText}</>;
  }

  const pnlLabel = t('eventDetail.pnl', {
    defaultValue: 'PnL {{amount}}',
    amount: formatCurrencyWithSign(marker.pnl, '', numberFormat, 2),
  });
  const idx = fullText.indexOf(pnlLabel);
  if (idx === -1) {
    return <>{fullText}</>;
  }

  return (
    <>
      {fullText.slice(0, idx)}
      <span className={`font-semibold ${getReplayPnlTextClass(marker.pnl)}`}>{pnlLabel}</span>
      {fullText.slice(idx + pnlLabel.length)}
    </>
  );
};

function lineSegmentBounds(
  line: TapePriceLine,
  model: TapeRenderModel,
  barCount: number,
): { x1: number; x2: number; y: number } {
  const xStart = xForBarIndex(line.barStart, barCount);
  const xEnd = xForBarIndex(line.barEnd, barCount);
  const halfStart = barSlotWidth(line.barStart, model) / 2;
  const halfEnd = barSlotWidth(line.barEnd, model) / 2;
  return {
    x1: xStart - halfStart,
    x2: xEnd + halfEnd,
    y: yForPrice(line.price, model),
  };
}

const TapeStopLossHitLayer: React.FC<{
  model: TapeRenderModel;
  barCount: number;
  t: TFunction;
  numberFormat: NumberFormatType;
}> = ({ model, barCount, t, numberFormat }) => (
  <>
    {model.priceLines.map((line, i) => {
      const { x1, x2, y } = lineSegmentBounds(line, model, barCount);
      const tooltip = getStopLossLineTooltipText(
        line.price,
        line.kind,
        t,
        numberFormat,
        line.side,
        line.tripIndex,
      );
      const leftPct = (x1 / TAPE_VIEW_W) * 100;
      const widthPct = ((x2 - x1) / TAPE_VIEW_W) * 100;
      const topPct = (y / TAPE_VIEW_H) * 100;

      return (
        <div
          key={`sl-hit-${line.kind}-${line.barStart}-${line.barEnd}-${i}`}
          className="absolute pointer-events-auto"
          style={{
            left: `${leftPct}%`,
            width: `${Math.max(widthPct, 2)}%`,
            top: `${topPct}%`,
            height: '12px',
            transform: 'translateY(-50%)',
          }}
        >
          <Tooltip
            content={tooltip}
            position="top"
            delay={200}
            contentClassName="whitespace-pre-line block max-w-[240px]"
            triggerDisplay="block"
          >
            <div className="h-full w-full cursor-help" aria-label={tooltip} />
          </Tooltip>
        </div>
      );
    })}
  </>
);

const TapeMarkerHitLayer: React.FC<{
  model: TapeRenderModel;
  barCount: number;
  theme: MarketTapeTheme;
  isDark: boolean;
  events: SessionEventItem[];
  t: TFunction;
  numberFormat: NumberFormatType;
}> = ({ model, barCount, theme, isDark, events, t, numberFormat }) => {
  const interactiveMarkers = model.markers.filter((m) => m.sourceEvent);

  return (
    <>
      {interactiveMarkers.map((marker) => {
        const { x, y } = markerHitCoords(marker, model, barCount, theme, isDark);
        const tooltip = getTapeMarkerTooltipText(marker, t, numberFormat, events);
        const pos = markerPositionPercent(x, y);

        return (
          <div
            key={marker.markerKey || `${marker.kind}-${marker.occurredAt}-${marker.price}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
            style={pos}
          >
            <Tooltip
              content={
                <TapeMarkerTooltipContent
                  marker={marker}
                  events={events}
                  t={t}
                  numberFormat={numberFormat}
                />
              }
              position="top"
              delay={200}
              contentClassName="whitespace-pre-line block max-w-[240px]"
              triggerDisplay="block"
            >
              <div
                className={`${hitPxClassForKind(marker.kind)} cursor-help rounded-full`}
                aria-label={tooltip}
              />
            </Tooltip>
          </div>
        );
      })}
    </>
  );
};

const TapeChart: React.FC<{
  model: TapeRenderModel;
  events: SessionEventItem[];
  theme: MarketTapeTheme;
  isDark: boolean;
  t: TFunction;
  numberFormat: NumberFormatType;
}> = ({ model, events, theme, isDark, t, numberFormat }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [meetSize, setMeetSize] = useState({ width: 0, height: 0 });
  const barCount = model.bars.length;

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      setMeetSize(computeMeetSize(el.clientWidth, el.clientHeight));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full items-center justify-center"
      style={{
        background: `linear-gradient(to bottom, ${theme.chartBgTop}, ${theme.chartBgBottom})`,
      }}
    >
      <div
        className="relative shrink-0"
        style={{
          width: meetSize.width > 0 ? meetSize.width : '100%',
          height: meetSize.height > 0 ? meetSize.height : '100%',
        }}
      >
        <TapeSvg model={model} theme={theme} isDark={isDark} />
        <div className="pointer-events-none absolute inset-0 z-10">
          <TapeStopLossHitLayer model={model} barCount={barCount} t={t} numberFormat={numberFormat} />
          <TapeMarkerHitLayer
            model={model}
            barCount={barCount}
            theme={theme}
            isDark={isDark}
            events={events}
            t={t}
            numberFormat={numberFormat}
          />
        </div>
      </div>
    </div>
  );
};

const TapeSvg: React.FC<{ model: TapeRenderModel; theme: MarketTapeTheme; isDark: boolean }> = ({
  model,
  theme,
  isDark,
}) => {
  const barCount = model.bars.length;
  const bandStartSlot = model.openPositionBand
    ? barSlotWidth(model.openPositionBand.barStart, model)
    : 0;

  return (
    <svg
      viewBox={`0 0 ${TAPE_VIEW_W} ${TAPE_VIEW_H}`}
      className="absolute inset-0 h-full w-full block"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-hidden
    >
      <defs>
        <linearGradient id="tapeChartBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.chartBgTop} />
          <stop offset="100%" stopColor={theme.chartBgBottom} />
        </linearGradient>
      </defs>

      <rect x={0} y={0} width={TAPE_VIEW_W} height={TAPE_VIEW_H} fill="url(#tapeChartBg)" />

      {model.openPositionBand && (
        <rect
          x={xForBarIndex(model.openPositionBand.barStart, barCount) - bandStartSlot * 0.5}
          y={yForPrice(model.openPositionBand.topPrice, model)}
          width={
            Math.max(
              bandStartSlot,
              xForBarIndex(model.openPositionBand.barEnd, barCount) -
                xForBarIndex(model.openPositionBand.barStart, barCount) +
                bandStartSlot,
            )
          }
          height={Math.max(
            3,
            yForPrice(model.openPositionBand.bottomPrice, model) -
              yForPrice(model.openPositionBand.topPrice, model),
          )}
          fill={theme.positionBand}
          stroke={theme.border}
          strokeWidth={0.5}
          strokeOpacity={0.35}
          rx={3}
        />
      )}

      {model.bars.map((bar) => {
        const x = xForBarIndex(bar.index, barCount);
        const slotW = barSlotWidth(bar.index, model);
        const yO = yForPrice(bar.o, model);
        const yC = yForPrice(bar.c, model);
        const yH = yForPrice(bar.h, model);
        const yL = yForPrice(bar.l, model);
        const up = bar.c >= bar.o;

        return (
          <ModernCandle
            key={bar.index}
            x={x}
            slotW={slotW}
            yO={yO}
            yC={yC}
            yH={yH}
            yL={yL}
            up={up}
            future={bar.isFuture}
            theme={theme}
          />
        );
      })}

      {model.priceLines.map((line, i) => {
        const { x1, x2, y } = lineSegmentBounds(line, model, barCount);
        const stroke = resolveTapeTripStrokeColor(
          line.tripIndex,
          line.side,
          isDark,
          theme,
          theme.stopLossBrokerLine,
        );
        return (
          <line
            key={`sl-line-${line.kind}-${line.barStart}-${line.barEnd}-${i}`}
            x1={x1}
            y1={y}
            x2={x2}
            y2={y}
            stroke={stroke}
            strokeWidth={2}
            strokeDasharray="4 3"
            strokeLinecap="round"
            strokeOpacity={1}
          />
        );
      })}

      {model.markers
        .filter((m) => m.kind === 'exit')
        .slice()
        .sort((a, b) => {
          const ta = Date.parse(a.occurredAt);
          const tb = Date.parse(b.occurredAt);
          if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
          return 0;
        })
        .map((m, i) => {
          const layout = computeTapeExitMarkerLayout(m, model, barCount, theme, isDark);
          if (!layout) return null;
          return (
            <TapeExitMarkerGraphic
              key={m.markerKey || `exit-${m.occurredAt}-${i}`}
              layout={layout}
            />
          );
        })}

      {model.markers
        .filter((m) => m.kind === 'entry')
        .map((m, i) => {
          const { x, y } = markerEntryDisplayCoords(m, model, barCount);
          return (
            <g
              key={m.markerKey || `entry-${m.occurredAt}-${i}`}
              transform={`translate(${x}, ${y})`}
            >
              <TapeChartEntryMarkerGlyph marker={m} theme={theme} isDark={isDark} />
            </g>
          );
        })}

    </svg>
  );
};

export const SessionMarketTape: React.FC<SessionMarketTapeProps> = ({
  marketData,
  events,
  currentIndex,
  loading = false,
  onRefresh,
}) => {
  const { t } = useTranslation('replay');
  const { preferences } = usePreferences();
  const { theme: colorMode } = useTheme();
  const isDark = colorMode === 'dark';
  const tapeTheme = useMemo(() => getMarketTapeTheme(isDark), [isDark]);

  const contracts = marketData?.contracts ?? [];
  const [activeTab, setActiveTab] = useState(0);

  const safeTab = contracts.length ? Math.min(activeTab, contracts.length - 1) : 0;
  const activeContract = contracts[safeTab];

  const model = useMemo(() => {
    if (!activeContract) return null;
    return buildTapeRenderModel(activeContract, events, currentIndex);
  }, [activeContract, events, currentIndex]);

  if (loading) {
    return (
      <div
        className={`flex h-[220px] sm:h-[240px] items-center justify-center rounded-lg border border-dashed border-gray-300 dark:border-gray-600 lg:h-auto lg:min-h-[240px] lg:flex-1 ${replayCardClass}`}
      >
        <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">{t('marketTapeLoading')}</p>
      </div>
    );
  }

  const status = marketData?.status;
  if (!contracts.length) {
    if (status === 'no_contracts') return null;
    return (
      <div
        className={`flex h-[220px] sm:h-[240px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 lg:h-auto lg:min-h-[240px] lg:flex-1 ${replayCardClass}`}
      >
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">{t('marketTapeUnavailable')}</p>
        {onRefresh && (
          <button type="button" onClick={onRefresh} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
            {t('marketTapeRefresh')}
          </button>
        )}
      </div>
    );
  }

  if (!model) {
    return (
      <div className="flex h-[220px] sm:h-[240px] items-center justify-center lg:h-auto lg:min-h-[240px] lg:flex-1">
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('marketTapeNoBars')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 lg:min-h-0 lg:flex-1">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
          {t('marketTapeTitle')}
        </p>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {t('marketTapeRefresh')}
          </button>
        )}
      </div>

      {contracts.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {contracts.map((c, idx) => (
            <button
              key={c.contract_id}
              type="button"
              onClick={() => setActiveTab(idx)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                idx === safeTab
                  ? 'bg-blue-600 dark:bg-blue-500 text-white border-blue-600 dark:border-blue-500'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      <div
        className={`flex flex-col overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 lg:min-h-0 lg:flex-1 ${replayCardClass}`}
      >
        <div className="h-[220px] shrink-0 sm:h-[240px] lg:h-auto lg:flex-1 lg:min-h-[240px]">
          <TapeChart
            model={model}
            events={events}
            theme={tapeTheme}
            isDark={isDark}
            t={t}
            numberFormat={preferences.number_format}
          />
        </div>
        <MarketTapeLegend
          theme={tapeTheme}
          isDark={isDark}
          labels={{
            entryLong: t('marketTapeLegendEntryLong'),
            entryShort: t('marketTapeLegendEntryShort'),
            exit: t('marketTapeLegendExit'),
            stopLossBroker: t('marketTapeLegendStopLossBroker'),
            help: t('marketTapeLegendTripColorHelp'),
          }}
        />
      </div>
    </div>
  );
};
