import { SessionEventItem, SessionMarketBar, SessionMarketContract, SessionMarketData } from '../../services/sessionReplay';

export type TapeMarkerKind = 'entry' | 'exit';

export type TapePriceLineKind = 'planned_stop_loss' | 'broker_stop';

export interface TapePriceLine {
  price: number;
  barStart: number;
  barEnd: number;
  kind: TapePriceLineKind;
  sourceEventId?: number;
}

export interface TapeMarker {
  kind: TapeMarkerKind;
  barIndex: number;
  price: number;
  occurredAt: string;
  side?: string;
  pnl?: number;
  /** Événement source (ordres) pour tooltip détaillé. */
  sourceEvent?: SessionEventItem;
  markerKey?: string;
  /** Décalage vertical viewBox (px, négatif = vers le haut) si plusieurs marqueurs sur la même bougie. */
  offsetY?: number;
  /** Décalage horizontal viewBox (px, négatif = plus à gauche, positif = côté droit de la bougie). */
  offsetX?: number;
}

export interface TapeRenderBar {
  index: number;
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  isFuture: boolean;
}

export interface TapeRenderModel {
  contractId: string;
  label: string;
  bars: TapeRenderBar[];
  markers: TapeMarker[];
  priceLines: TapePriceLine[];
  cursorBarIndex: number;
  yMin: number;
  yMax: number;
  cursorTime: string | null;
  openPositionBand: { entryPrice: number; topPrice: number; bottomPrice: number; barStart: number; barEnd: number } | null;
}

function parseTimeMs(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
}

export function eventContractKeys(evt: SessionEventItem): { contractId: string | null; label: string | null } {
  const payload = evt.payload || {};
  const fill = payload.fill as Record<string, unknown> | undefined;
  const order = payload.order as Record<string, unknown> | undefined;
  if (fill?.contractId) {
    return { contractId: String(fill.contractId), label: String(payload.contract_name || '') || null };
  }
  if (order?.contractId) {
    return { contractId: String(order.contractId), label: String(payload.contract_name || '') || null };
  }
  const label = payload.contract_name != null ? String(payload.contract_name) : null;
  return { contractId: null, label };
}

export function eventMatchesContract(
  evt: SessionEventItem,
  contractId: string,
  label: string,
): boolean {
  const keys = eventContractKeys(evt);
  if (keys.contractId && keys.contractId === contractId) return true;
  if (keys.label && keys.label === label) return true;
  if (!keys.contractId && keys.label === label) return true;
  return false;
}

function barIndexAtOrBefore(bars: SessionMarketBar[], occurredAt: string): number {
  const target = parseTimeMs(occurredAt);
  let idx = 0;
  for (let i = 0; i < bars.length; i++) {
    if (parseTimeMs(bars[i].t) <= target) {
      idx = i;
    } else {
      break;
    }
  }
  return idx;
}

function priceFromPayload(payload: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const raw = payload[key];
    if (raw == null) continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

const BROKER_STOP_ORDER_TYPES = new Set(['stop', 'stop_limit', 'trailing_stop']);

function isBrokerStopOrderType(orderType: unknown): boolean {
  if (orderType == null) return false;
  return BROKER_STOP_ORDER_TYPES.has(String(orderType).toLowerCase());
}

function plannedStopLossFromEvent(evt: SessionEventItem): number | null {
  const raw = evt.planned_stop_loss;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function brokerStopPriceFromEvent(evt: SessionEventItem): number | null {
  if (evt.event_type !== 'order_created' && evt.event_type !== 'order_updated') return null;
  const payload = evt.payload || {};
  const order = (payload.order as Record<string, unknown>) || {};
  const orderType = payload.order_type ?? order.orderType ?? order.type;
  if (!isBrokerStopOrderType(orderType)) return null;
  return (
    priceFromPayload(payload, ['stop_price']) ??
    priceFromPayload(order, ['stopPrice', 'stop_price'])
  );
}

interface RoundTripStopLoss {
  openBar: number;
  openEventId: number;
  openIndex: number;
  closeBar: number | null;
  closeIndex: number | null;
  plannedSl: number | null;
  brokerSl: number | null;
}

function collectRoundTripsStopLoss(
  events: SessionEventItem[],
  contractId: string,
  label: string,
  bars: SessionMarketBar[],
): RoundTripStopLoss[] {
  const trips: RoundTripStopLoss[] = [];
  let current: RoundTripStopLoss | null = null;

  for (let i = 0; i < events.length; i++) {
    const evt = events[i];
    if (!eventMatchesContract(evt, contractId, label)) continue;

    if (evt.event_type === 'position_open') {
      if (current) {
        trips.push(current);
      }
      current = {
        openBar: barIndexAtOrBefore(bars, evt.occurred_at),
        openEventId: evt.id,
        openIndex: i,
        closeBar: null,
        closeIndex: null,
        plannedSl: plannedStopLossFromEvent(evt),
        brokerSl: null,
      };
      continue;
    }

    if (!current) continue;

    if (current.plannedSl == null) {
      const planned = plannedStopLossFromEvent(evt);
      if (planned != null) {
        current.plannedSl = planned;
      }
    }

    const brokerStop = brokerStopPriceFromEvent(evt);
    if (brokerStop != null) {
      current.brokerSl = brokerStop;
    }

    if (evt.event_type === 'position_close') {
      current.closeBar = barIndexAtOrBefore(bars, evt.occurred_at);
      current.closeIndex = i;
      trips.push(current);
      current = null;
    }
  }

  if (current) {
    trips.push(current);
  }

  return trips;
}

export function buildStopLossLines(
  events: SessionEventItem[],
  currentIndex: number,
  contractId: string,
  label: string,
  bars: SessionMarketBar[],
  cursorBarIndex: number,
): TapePriceLine[] {
  const trips = collectRoundTripsStopLoss(events, contractId, label, bars);
  const lines: TapePriceLine[] = [];

  for (const trip of trips) {
    if (trip.openIndex > currentIndex) continue;

    const tradeClosed =
      trip.closeIndex != null && trip.closeBar != null && trip.closeIndex <= currentIndex;
    const barEnd = tradeClosed ? trip.closeBar! : cursorBarIndex;

    if (trip.plannedSl != null) {
      lines.push({
        price: trip.plannedSl,
        barStart: trip.openBar,
        barEnd,
        kind: 'planned_stop_loss',
        sourceEventId: trip.openEventId,
      });
    }
    if (trip.brokerSl != null) {
      lines.push({
        price: trip.brokerSl,
        barStart: trip.openBar,
        barEnd,
        kind: 'broker_stop',
        sourceEventId: trip.openEventId,
      });
    }
  }

  return lines;
}

export function buildMarkersForContract(
  events: SessionEventItem[],
  currentIndex: number,
  contractId: string,
  label: string,
  bars: SessionMarketBar[],
): TapeMarker[] {
  const markers: TapeMarker[] = [];
  const slice = events.slice(0, currentIndex + 1);

  for (const evt of slice) {
    if (!eventMatchesContract(evt, contractId, label)) continue;
    const payload = evt.payload || {};
    const occurredAt = evt.occurred_at;
    const barIndex = barIndexAtOrBefore(bars, occurredAt);

    if (evt.event_type === 'position_open') {
      const price = priceFromPayload(payload, ['entry_price']);
      if (price != null) {
        markers.push({
          kind: 'entry',
          barIndex,
          price,
          occurredAt,
          side: String(payload.trade_type || ''),
          sourceEvent: evt,
          markerKey: `${evt.event_type}-${evt.id}`,
        });
      }
    } else if (evt.event_type === 'position_close') {
      const price = priceFromPayload(payload, ['exit_price']);
      const pnlRaw = payload.pnl;
      const pnl = pnlRaw != null ? Number(pnlRaw) : undefined;
      if (price != null) {
        markers.push({
          kind: 'exit',
          barIndex,
          price,
          occurredAt,
          pnl: Number.isFinite(pnl) ? pnl : undefined,
          sourceEvent: evt,
          markerKey: `${evt.event_type}-${evt.id}`,
        });
      }
    }
  }

  return markers;
}

const MARKER_VERTICAL_STACK_STEP_PX = 22;
const MARKER_EXIT_STACK_EXTRA_LEFT_PX = 22;
const MARKER_EXIT_STACK_RIGHT_PX = 20;

const MARKER_KIND_STACK_ORDER: Record<TapeMarkerKind, number> = {
  entry: 0,
  exit: 1,
};

/**
 * Sur une même bougie, empile les marqueurs vers le haut sans décaler horizontalement
 * (le prix / la bougie restent alignés sur l’axe X).
 */
function applyMarkerVerticalStackOffsets(markers: TapeMarker[]): TapeMarker[] {
  if (markers.length <= 1) return markers;

  const byBar = new Map<number, number[]>();
  markers.forEach((m, i) => {
    const list = byBar.get(m.barIndex) ?? [];
    list.push(i);
    byBar.set(m.barIndex, list);
  });

  const result = [...markers];

  for (const indices of Array.from(byBar.values())) {
    if (indices.length <= 1) continue;

    const sorted = [...indices].sort((a, b) => {
      const ka = MARKER_KIND_STACK_ORDER[markers[a].kind];
      const kb = MARKER_KIND_STACK_ORDER[markers[b].kind];
      if (ka !== kb) return ka - kb;
      return parseTimeMs(markers[a].occurredAt) - parseTimeMs(markers[b].occurredAt);
    });

    sorted.forEach((markerIdx, slot) => {
      if (slot === 0) return;
      const stacked = markers[markerIdx];
      const patch: Partial<TapeMarker> = {
        offsetY: -slot * MARKER_VERTICAL_STACK_STEP_PX,
      };
      if (stacked.kind === 'exit') {
        if (slot === 1) {
          patch.offsetX = -MARKER_EXIT_STACK_EXTRA_LEFT_PX;
        } else if (slot === 2) {
          patch.offsetX = MARKER_EXIT_STACK_RIGHT_PX;
        } else if (slot >= 3) {
          patch.offsetX = -MARKER_EXIT_STACK_EXTRA_LEFT_PX - (slot - 2) * 14;
        }
      }
      result[markerIdx] = { ...result[markerIdx], ...patch };
    });
  }

  return result;
}

function computeOpenPositionBand(
  events: SessionEventItem[],
  currentIndex: number,
  contractId: string,
  label: string,
  bars: SessionMarketBar[],
  cursorBarIndex: number,
): TapeRenderModel['openPositionBand'] {
  const slice = events.slice(0, currentIndex + 1);
  let entryPrice: number | null = null;
  let entryBar = 0;

  for (const evt of slice) {
    if (!eventMatchesContract(evt, contractId, label)) continue;
    if (evt.event_type === 'position_open') {
      const p = priceFromPayload(evt.payload || {}, ['entry_price']);
      if (p != null) {
        entryPrice = p;
        entryBar = barIndexAtOrBefore(bars, evt.occurred_at);
      }
    }
    if (evt.event_type === 'position_close') {
      entryPrice = null;
    }
  }

  if (entryPrice == null || !bars.length) return null;

  const cursorBar = bars[cursorBarIndex];
  const refPrice = cursorBar?.c ?? cursorBar?.o ?? entryPrice;
  const topPrice = Math.max(entryPrice, refPrice);
  const bottomPrice = Math.min(entryPrice, refPrice);

  return {
    entryPrice,
    topPrice,
    bottomPrice,
    barStart: entryBar,
    barEnd: cursorBarIndex,
  };
}

export function buildTapeRenderModel(
  contract: SessionMarketContract,
  events: SessionEventItem[],
  currentIndex: number,
): TapeRenderModel | null {
  const bars = (contract.bars || []).filter(
    (b) => b.t && b.o != null && b.h != null && b.l != null && b.c != null,
  ) as SessionMarketBar[];
  if (!bars.length) return null;

  const cursorTime =
    currentIndex >= 0 && currentIndex < events.length ? events[currentIndex].occurred_at : null;
  const cursorMs = cursorTime ? parseTimeMs(cursorTime) : parseTimeMs(bars[bars.length - 1].t);

  const renderBars: TapeRenderBar[] = bars.map((b, index) => ({
    index,
    t: b.t,
    o: b.o,
    h: b.h,
    l: b.l,
    c: b.c,
    isFuture: parseTimeMs(b.t) > cursorMs,
  }));

  const cursorBarIndex = cursorTime ? barIndexAtOrBefore(bars, cursorTime) : bars.length - 1;

  const markers = buildMarkersForContract(
    events,
    currentIndex,
    contract.contract_id,
    contract.label,
    bars,
  );

  let yMin = Infinity;
  let yMax = -Infinity;
  for (const b of renderBars) {
    if (!b.isFuture || b.index <= cursorBarIndex) {
      yMin = Math.min(yMin, b.l);
      yMax = Math.max(yMax, b.h);
    }
  }
  for (const m of markers) {
    yMin = Math.min(yMin, m.price);
    yMax = Math.max(yMax, m.price);
  }
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
    yMin = renderBars[0].l;
    yMax = renderBars[0].h;
  }
  const pad = (yMax - yMin) * 0.08 || 1;
  yMin -= pad;
  yMax += pad;

  const openPositionBand = computeOpenPositionBand(
    events,
    currentIndex,
    contract.contract_id,
    contract.label,
    bars,
    cursorBarIndex,
  );

  const priceLines = buildStopLossLines(
    events,
    currentIndex,
    contract.contract_id,
    contract.label,
    bars,
    cursorBarIndex,
  );

  for (const line of priceLines) {
    yMin = Math.min(yMin, line.price);
    yMax = Math.max(yMax, line.price);
  }

  const markersStacked = applyMarkerVerticalStackOffsets(markers);

  return {
    contractId: contract.contract_id,
    label: contract.label,
    bars: renderBars,
    markers: markersStacked,
    priceLines,
    cursorBarIndex,
    yMin,
    yMax,
    cursorTime,
    openPositionBand: openPositionBand
      ? {
          entryPrice: openPositionBand.entryPrice,
          topPrice: openPositionBand.topPrice,
          bottomPrice: openPositionBand.bottomPrice,
          barStart: openPositionBand.barStart,
          barEnd: openPositionBand.barEnd,
        }
      : null,
  };
}

export function needsMarketDataRefresh(marketData: SessionMarketData | null | undefined): boolean {
  if (!marketData || typeof marketData !== 'object') return true;
  const status = marketData.status;
  if (status === 'ok' || status === 'partial') return false;
  if (status === 'no_contracts') return false;
  return status === 'unavailable' || !status;
}

export function pickDefaultContractIndex(contracts: SessionMarketContract[]): number {
  if (!contracts.length) return 0;
  return 0;
}
