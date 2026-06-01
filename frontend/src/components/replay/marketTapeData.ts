import { SessionEventItem, SessionMarketBar, SessionMarketContract, SessionMarketData } from '../../services/sessionReplay';

export type TapeMarkerKind = 'entry' | 'exit';

export type TapePriceLineKind = 'planned_stop_loss' | 'broker_stop';

export interface TapePriceLine {
  price: number;
  barStart: number;
  barEnd: number;
  kind: TapePriceLineKind;
  sourceEventId?: number;
  tripIndex?: number;
  side?: string;
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
  /** Prix d’ancrage pour empiler les pastilles de sortie sur une même bougie (ordre chronologique). */
  stackAnchorPrice?: number;
  /** Rang chronologique parmi les sorties de la même bougie (0 = la plus ancienne). */
  stackSlot?: number;
  /** Index du trade (position_open) pour la teinte unique. */
  tripIndex?: number;
  /** Sortie exécutée au prix du stop broker (ligne SL masquée). */
  exitViaStopLoss?: boolean;
  /** Taille réelle de la position à l'entrée (lots du fill d'entrée). */
  positionSize?: number;
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

interface ContractRoundTrip {
  tripIndex: number;
  tradeSide: string;
  openBar: number;
  openEventId: number;
  openIndex: number;
  closeBar: number | null;
  closeIndex: number | null;
  closeEventIds: number[];
  plannedSl: number | null;
  brokerSl: number | null;
}

function tradeSideFromPayload(payload: Record<string, unknown>): string {
  return String(payload.trade_type || '');
}

/** Comparaison de prix marché (tolérance sous le tick mini courant). */
export function tapePricesEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}

interface TripCloseDetail {
  eventId: number;
  eventIndex: number;
  price: number;
}

function closeDetailsForTrip(
  events: SessionEventItem[],
  trip: ContractRoundTrip,
  maxIndex: number,
): TripCloseDetail[] {
  const idSet = new Set(trip.closeEventIds);
  const details: TripCloseDetail[] = [];
  for (let i = 0; i <= maxIndex && i < events.length; i++) {
    const evt = events[i];
    if (!idSet.has(evt.id)) continue;
    const price = priceFromPayload(evt.payload || {}, ['exit_price']);
    if (price == null) continue;
    details.push({ eventId: evt.id, eventIndex: i, price });
  }
  return details;
}

function brokerStopTriggeredByClose(
  brokerSl: number,
  closes: TripCloseDetail[],
): boolean {
  return closes.some((c) => tapePricesEqual(c.price, brokerSl));
}

/** Indices des position_close liées à un position_open (jusqu'à la prochaine ouverture). */
function closeIndicesForOpen(
  events: SessionEventItem[],
  openIndex: number,
  contractId: string,
  label: string,
): number[] {
  const indices: number[] = [];
  for (let i = openIndex + 1; i < events.length; i++) {
    const evt = events[i];
    if (!eventMatchesContract(evt, contractId, label)) continue;
    if (evt.event_type === 'position_open') break;
    if (evt.event_type === 'position_close') indices.push(i);
  }
  return indices;
}

function isEntryFillEvent(evt: SessionEventItem): boolean {
  const payload = evt.payload || {};
  const pnl = payload.pnl;
  if (pnl != null && pnl !== '') return false;
  const fill = payload.fill as Record<string, unknown> | undefined;
  const fillPnl = fill?.profitAndLoss;
  return fillPnl == null || fillPnl === '';
}

/** Taille du fill d'entrée associé à un position_open (même horodatage). */
export function entryFillSizeForOpen(
  events: SessionEventItem[],
  openEvt: SessionEventItem,
  contractId: string,
  label: string,
): number | undefined {
  for (const evt of events) {
    if (evt.event_type !== 'fill') continue;
    if (evt.occurred_at !== openEvt.occurred_at) continue;
    if (!eventMatchesContract(evt, contractId, label)) continue;
    if (!isEntryFillEvent(evt)) continue;
    const payload = evt.payload || {};
    const fill = payload.fill as Record<string, unknown> | undefined;
    const raw = payload.size ?? fill?.size;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

function isAfterTripLastClose(
  events: SessionEventItem[],
  openIndex: number,
  eventIndex: number,
  contractId: string,
  label: string,
): boolean {
  const closeIndices = closeIndicesForOpen(events, openIndex, contractId, label);
  if (closeIndices.length === 0) return false;
  const lastCloseIndex = closeIndices[closeIndices.length - 1];
  return eventIndex > lastCloseIndex;
}

function collectContractRoundTrips(
  events: SessionEventItem[],
  contractId: string,
  label: string,
  bars: SessionMarketBar[],
  maxEventIndex: number = events.length - 1,
): ContractRoundTrip[] {
  const trips: ContractRoundTrip[] = [];
  let current: ContractRoundTrip | null = null;
  let tripCounter = 0;
  const lastIndex = Math.min(maxEventIndex, events.length - 1);

  for (let i = 0; i <= lastIndex; i++) {
    const evt = events[i];
    if (!eventMatchesContract(evt, contractId, label)) continue;

    if (evt.event_type === 'position_open') {
      if (current) {
        trips.push(current);
      }
      const payload = evt.payload || {};
      current = {
        tripIndex: tripCounter++,
        tradeSide: tradeSideFromPayload(payload),
        openBar: barIndexAtOrBefore(bars, evt.occurred_at),
        openEventId: evt.id,
        openIndex: i,
        closeBar: null,
        closeIndex: null,
        closeEventIds: [],
        plannedSl: plannedStopLossFromEvent(evt),
        brokerSl: null,
      };
      continue;
    }

    if (!current) continue;

    const afterLastClose = isAfterTripLastClose(
      events,
      current.openIndex,
      i,
      contractId,
      label,
    );

    if (!afterLastClose && current.plannedSl == null) {
      const planned = plannedStopLossFromEvent(evt);
      if (planned != null) {
        current.plannedSl = planned;
      }
    }

    const brokerStop = brokerStopPriceFromEvent(evt);
    if (brokerStop != null && !afterLastClose) {
      current.brokerSl = brokerStop;
    }

    if (evt.event_type === 'position_close') {
      current.closeBar = barIndexAtOrBefore(bars, evt.occurred_at);
      current.closeIndex = i;
      current.closeEventIds.push(evt.id);
    }
  }

  if (current) {
    trips.push(current);
  }

  return trips;
}

function buildTripLookup(
  trips: ContractRoundTrip[],
): Map<number, { tripIndex: number; side: string; brokerSl: number | null }> {
  const lookup = new Map<number, { tripIndex: number; side: string; brokerSl: number | null }>();
  for (const trip of trips) {
    const meta = { tripIndex: trip.tripIndex, side: trip.tradeSide, brokerSl: trip.brokerSl };
    lookup.set(trip.openEventId, meta);
    for (const closeId of trip.closeEventIds) {
      lookup.set(closeId, meta);
    }
  }
  return lookup;
}

export function buildStopLossLines(
  events: SessionEventItem[],
  currentIndex: number,
  contractId: string,
  label: string,
  bars: SessionMarketBar[],
  cursorBarIndex: number,
): TapePriceLine[] {
  const trips = collectContractRoundTrips(events, contractId, label, bars, currentIndex);
  const lines: TapePriceLine[] = [];

  for (const trip of trips) {
    if (trip.openIndex > currentIndex) continue;

    const allCloseIndices = closeIndicesForOpen(events, trip.openIndex, contractId, label);
    const visibleCloseIndices = allCloseIndices.filter((idx) => idx <= currentIndex);
    const fullyClosed =
      allCloseIndices.length > 0
      && visibleCloseIndices.length === allCloseIndices.length;
    const barEnd = fullyClosed && trip.closeBar != null ? trip.closeBar : cursorBarIndex;
    const lineMeta = { tripIndex: trip.tripIndex, side: trip.tradeSide };
    const closes = closeDetailsForTrip(events, trip, currentIndex);
    const hideBrokerLine =
      trip.brokerSl != null && brokerStopTriggeredByClose(trip.brokerSl, closes);

    if (trip.brokerSl != null && !hideBrokerLine) {
      lines.push({
        price: trip.brokerSl,
        barStart: trip.openBar,
        barEnd,
        kind: 'broker_stop',
        sourceEventId: trip.openEventId,
        ...lineMeta,
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
  const trips = collectContractRoundTrips(events, contractId, label, bars, currentIndex);
  const tripLookup = buildTripLookup(trips);

  for (const evt of slice) {
    if (!eventMatchesContract(evt, contractId, label)) continue;
    const payload = evt.payload || {};
    const occurredAt = evt.occurred_at;
    const barIndex = barIndexAtOrBefore(bars, occurredAt);
    const tripMeta = tripLookup.get(evt.id);

    if (evt.event_type === 'position_open') {
      const price = priceFromPayload(payload, ['entry_price']);
      if (price != null) {
        markers.push({
          kind: 'entry',
          barIndex,
          price,
          occurredAt,
          side: String(payload.trade_type || ''),
          tripIndex: tripMeta?.tripIndex,
          positionSize: entryFillSizeForOpen(events, evt, contractId, label),
          sourceEvent: evt,
          markerKey: `${evt.event_type}-${evt.id}`,
        });
      }
    } else if (evt.event_type === 'position_close') {
      const price = priceFromPayload(payload, ['exit_price']);
      const pnlRaw = payload.pnl;
      const pnl = pnlRaw != null ? Number(pnlRaw) : undefined;
      if (price != null) {
        const brokerSl = tripMeta?.brokerSl;
        const exitViaStopLoss =
          brokerSl != null && tapePricesEqual(price, brokerSl);
        markers.push({
          kind: 'exit',
          barIndex,
          price,
          occurredAt,
          side: tripMeta?.side,
          tripIndex: tripMeta?.tripIndex,
          pnl: Number.isFinite(pnl) ? pnl : undefined,
          exitViaStopLoss: exitViaStopLoss || undefined,
          sourceEvent: evt,
          markerKey: `${evt.event_type}-${evt.id}`,
        });
      }
    }
  }

  return markers;
}

/** Exporté pour les tests — round-trips d'un contrat avec index de teinte. */
export function getContractRoundTrips(
  events: SessionEventItem[],
  contractId: string,
  label: string,
  bars: SessionMarketBar[],
  maxEventIndex?: number,
): ContractRoundTrip[] {
  return collectContractRoundTrips(
    events,
    contractId,
    label,
    bars,
    maxEventIndex ?? events.length - 1,
  );
}

const MARKER_VERTICAL_STACK_STEP_PX = 22;
const MARKER_EXIT_STACK_EXTRA_LEFT_PX = 22;
const MARKER_EXIT_STACK_RIGHT_PX = 20;

export { MARKER_VERTICAL_STACK_STEP_PX };

function applyExitStackOffsetX(exitSlot: number): number | undefined {
  if (exitSlot === 1) return -MARKER_EXIT_STACK_EXTRA_LEFT_PX;
  if (exitSlot === 2) return MARKER_EXIT_STACK_RIGHT_PX;
  if (exitSlot >= 3) return -MARKER_EXIT_STACK_EXTRA_LEFT_PX - (exitSlot - 2) * 14;
  return undefined;
}

/**
 * Sur une même bougie, empile les marqueurs du même type (entrées entre elles, sorties entre elles).
 * Une entrée et une sortie sur la même bougie ne sont pas décalées l'une par rapport à l'autre.
 */
export function applyMarkerVerticalStackOffsets(markers: TapeMarker[]): TapeMarker[] {
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

    for (const kind of ['entry', 'exit'] as TapeMarkerKind[]) {
      const kindIndices = indices
        .filter((idx) => markers[idx].kind === kind)
        .sort((a, b) => {
          const ta = parseTimeMs(markers[a].occurredAt);
          const tb = parseTimeMs(markers[b].occurredAt);
          if (ta !== tb) return ta - tb;
          return a - b;
        });

      if (kindIndices.length <= 1) continue;

      if (kind === 'exit') {
        kindIndices.forEach((markerIdx, exitSlot) => {
          const marker = markers[markerIdx];
          const anchorPrice = markers[kindIndices[0]].price;
          const patch: Partial<TapeMarker> = {
            stackSlot: exitSlot,
          };
          if (
            exitSlot > 0
            && tapePricesEqual(anchorPrice, marker.price)
          ) {
            patch.stackAnchorPrice = anchorPrice;
          }
          const offsetX = applyExitStackOffsetX(exitSlot);
          if (offsetX != null) patch.offsetX = offsetX;
          result[markerIdx] = { ...result[markerIdx], ...patch };
        });
        continue;
      }

      kindIndices.forEach((markerIdx, slot) => {
        if (slot === 0) return;
        result[markerIdx] = {
          ...result[markerIdx],
          offsetY: -slot * MARKER_VERTICAL_STACK_STEP_PX,
        };
      });
    }
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
  let openIndex: number | null = null;

  for (let i = 0; i < slice.length; i++) {
    const evt = slice[i];
    if (!eventMatchesContract(evt, contractId, label)) continue;
    if (evt.event_type === 'position_open') {
      const p = priceFromPayload(evt.payload || {}, ['entry_price']);
      if (p != null) {
        entryPrice = p;
        entryBar = barIndexAtOrBefore(bars, evt.occurred_at);
        openIndex = i;
      }
    }
    if (evt.event_type === 'position_close' && openIndex != null) {
      const closes = closeIndicesForOpen(events, openIndex, contractId, label);
      const lastCloseIndex = closes[closes.length - 1];
      if (i === lastCloseIndex) {
        entryPrice = null;
        openIndex = null;
      }
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
