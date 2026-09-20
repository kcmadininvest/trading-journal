/**
 * Boîte Long/Short Position (DraftTrade) — couche dédiée.
 *
 * Pas de nœud DOM : le rendu est peint sur le canvas du pane via `paintOnto`.
 * Ce module concentre formatters, hit-test niveaux, paint et interactions
 * pour ne plus mélanger cette logique dans ReplayChartPane.
 */
import { useCallback, useMemo, useRef, type MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import type { VisibleCandle } from '../../utils/replayEngine';
import { usePreferences } from '../../hooks/usePreferences';
import { formatNumber } from '../../utils/numberFormat';
import type { PositionOverlayModel } from '../../utils/positionToolPaint';
import type { TradeChartLevels } from './ReplayTradePanel';
import {
  usePositionOverlay,
  type PositionOverlayChange,
} from './usePositionOverlay';

export type { PositionOverlayChange, PositionOverlayModel };

type TradeLevelKey = 'entry' | 'exit' | 'stop' | 'target';

export interface PositionOverlayBoxParams {
  chartRef: MutableRefObject<IChartApi | null>;
  seriesRef: MutableRefObject<ISeriesApi<'Candlestick'> | null>;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  candles: VisibleCandle[];
  model: PositionOverlayModel | null;
  selected: boolean;
  isDark: boolean;
  levels?: TradeChartLevels;
  preferredLevel?: TradeLevelKey | null;
  findNearestLevel: (
    series: ISeriesApi<'Candlestick'>,
    levels: TradeChartLevels | undefined,
    y: number,
    preferred?: TradeLevelKey | null,
    exclusive?: TradeLevelKey | null,
  ) => TradeLevelKey | null;
  onChange: (patch: PositionOverlayChange) => void;
  onSelect: (selected: boolean) => void;
  onClear: () => void;
  setChartInteractionLocked: (locked: boolean) => void;
  requestPaint: () => void;
  enabled: boolean;
}

/** Hook façade : toute la boîte Position en un seul point d’entrée. */
export function usePositionOverlayBox({
  chartRef,
  seriesRef,
  containerRef,
  candles,
  model,
  selected,
  isDark,
  levels,
  preferredLevel,
  findNearestLevel,
  onChange,
  onSelect,
  onClear,
  setChartInteractionLocked,
  requestPaint,
  enabled,
}: PositionOverlayBoxParams) {
  const { t } = useTranslation('marketReplay');
  const { preferences } = usePreferences();
  const levelsRef = useRef(levels);
  levelsRef.current = levels;
  const preferredLevelRef = useRef(preferredLevel ?? null);
  preferredLevelRef.current = preferredLevel ?? null;

  const formatters = useMemo(() => {
    const nf = preferences.number_format;
    return {
      formatPrice: (n: number) => formatNumber(n, 2, nf),
      formatRr: (n: number) => `1:${formatNumber(n, 2, nf)}`,
      labels: {
        entry: t('positionLabelEntry'),
        stop: t('positionLabelStop'),
        target: t('positionLabelTarget'),
        rr: t('positionLabelRR'),
      },
    };
  }, [preferences.number_format, t]);

  /** Le corps ne capture pas au-dessus d’un niveau (entry/SL/TP via price lines). */
  const isPointerOnTradeLevel = useCallback(
    (y: number) => {
      const series = seriesRef.current;
      if (!series) return false;
      return (
        findNearestLevel(
          series,
          levelsRef.current,
          y,
          preferredLevelRef.current,
          null,
        ) != null
      );
    },
    [findNearestLevel, seriesRef],
  );

  return usePositionOverlay({
    chartRef,
    seriesRef,
    containerRef,
    candles,
    model,
    selected,
    formatters,
    isDark,
    onChange,
    onSelect,
    onClear,
    isPointerOnTradeLevel,
    setChartInteractionLocked,
    requestPaint,
    enabled,
  });
}
