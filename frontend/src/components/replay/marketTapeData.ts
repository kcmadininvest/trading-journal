import { SessionEventItem, SessionMarketBar, SessionMarketContract, SessionMarketData } from '../../services/sessionReplay';

export type TapeMarkerKind = 'entry' | 'exit' | 'fill' | 'order';

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
    } else if (evt.event_type === 'fill') {
      const fillPayload = (payload.fill as Record<string, unknown>) || payload;
      const price = priceFromPayload(payload, ['price']) ?? priceFromPayload(fillPayload, ['price']);
      if (price != null) {
        markers.push({
          kind: 'fill',
          barIndex,
          price,
          occurredAt,
          side: String(payload.trade_type || ''),
          sourceEvent: evt,
          markerKey: `${evt.event_type}-${evt.external_id}-${evt.id}`,
        });
      }
    } else if (evt.event_type === 'order_created' || evt.event_type === 'order_updated') {
      const price =
        priceFromPayload(payload, ['limit_price', 'stop_price', 'filled_price']) ??
        priceFromPayload((payload.order as Record<string, unknown>) || {}, ['limitPrice', 'stopPrice']);
      if (price != null) {
        markers.push({
          kind: 'order',
          barIndex,
          price,
          occurredAt,
          sourceEvent: evt,
          markerKey: `${evt.event_type}-${evt.external_id}-${evt.id}`,
        });
      }
    }
  }

  return markers;
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

  return {
    contractId: contract.contract_id,
    label: contract.label,
    bars: renderBars,
    markers,
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
