import { TFunction } from 'i18next';
import { SessionEventItem } from '../../services/sessionReplay';
import { TapePriceLineKind } from './marketTapeData';
import { formatCurrencyWithSign, formatNumber, NumberFormatType } from '../../utils/numberFormat';

const ORDER_TYPE_KEYS: Record<string, string> = {
  unknown: 'orderTypes.unknown',
  limit: 'orderTypes.limit',
  market: 'orderTypes.market',
  stop_limit: 'orderTypes.stop_limit',
  stop: 'orderTypes.stop',
  trailing_stop: 'orderTypes.trailing_stop',
  join_bid: 'orderTypes.join_bid',
  join_ask: 'orderTypes.join_ask',
};

const ORDER_STATUS_KEYS: Record<string, string> = {
  none: 'orderStatus.none',
  open: 'orderStatus.open',
  filled: 'orderStatus.filled',
  cancelled: 'orderStatus.cancelled',
  expired: 'orderStatus.expired',
  rejected: 'orderStatus.rejected',
  pending: 'orderStatus.pending',
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function contractFromPayload(payload: Record<string, unknown>): string {
  if (payload.contract_name) return String(payload.contract_name);
  const order = asRecord(payload.order);
  if (order?.contractId) return shortenContract(String(order.contractId));
  const fill = asRecord(payload.fill);
  if (fill?.contractId) return shortenContract(String(fill.contractId));
  return '';
}

function shortenContract(contractId: string): string {
  const parts = contractId.split('.');
  if (parts.length >= 4 && parts[0] === 'CON') return parts[parts.length - 2];
  if (parts.length === 2 && parts[0] === 'CON') return parts[1];
  return contractId;
}

function sideLabel(
  t: TFunction,
  payload: Record<string, unknown>,
  order?: Record<string, unknown> | null,
  fill?: Record<string, unknown> | null,
): string | null {
  const tradeType = payload.trade_type;
  if (tradeType != null && String(tradeType)) {
    const key = String(tradeType).toLowerCase() === 'short' ? 'sides.short' : 'sides.long';
    return t(key, { defaultValue: String(tradeType) });
  }
  const sideRaw = payload.side_code ?? order?.side ?? fill?.side;
  if (sideRaw === 0 || sideRaw === '0') return t('sides.buy', { defaultValue: 'Achat' });
  if (sideRaw === 1 || sideRaw === '1') return t('sides.sell', { defaultValue: 'Vente' });
  return null;
}

function sizePart(size: unknown, t: TFunction, numberFormat: NumberFormatType): string | null {
  if (size == null || size === '') return null;
  const n = Number(size);
  if (!Number.isFinite(n)) return null;
  const formatted = formatNumber(n, n % 1 === 0 ? 0 : 2, numberFormat);
  return t('eventDetail.sizeContracts', {
    defaultValue: '{{size}} contrat(s)',
    size: formatted,
  });
}

function pricePart(
  price: unknown,
  prefix: string,
  numberFormat: NumberFormatType,
): string | null {
  if (price == null || price === '') return null;
  const n = Number(price);
  if (!Number.isFinite(n)) return null;
  return `${prefix} ${formatNumber(n, 2, numberFormat)}`;
}

function orderTypePart(t: TFunction, payload: Record<string, unknown>, order?: Record<string, unknown> | null): string | null {
  const raw = payload.order_type ?? order?.type ?? order?.orderType;
  if (raw == null) return null;
  const key =
    typeof raw === 'string'
      ? ORDER_TYPE_KEYS[raw]
      : ORDER_TYPE_KEYS[
          ['unknown', 'limit', 'market', 'stop_limit', 'stop', 'trailing_stop', 'join_bid', 'join_ask'][
            Number(raw)
          ] || 'unknown'
        ];
  if (!key) return null;
  return t(key, { defaultValue: String(raw) });
}

function orderStatusPart(t: TFunction, payload: Record<string, unknown>, order?: Record<string, unknown> | null): string | null {
  const raw = payload.order_status ?? order?.status;
  if (raw == null) return null;
  const key =
    typeof raw === 'string'
      ? ORDER_STATUS_KEYS[raw]
      : ORDER_STATUS_KEYS[
          ['none', 'open', 'filled', 'cancelled', 'expired', 'rejected', 'pending'][Number(raw)] || 'none'
        ];
  if (!key) return null;
  return t(key, { defaultValue: String(raw) });
}

function mergeOrderPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const order = asRecord(payload.order);
  if (!order) return payload;
  return {
    ...payload,
    contract_name: payload.contract_name ?? shortenContract(String(order.contractId || '')),
    size: payload.size ?? order.size,
    side_code: payload.side_code ?? order.side,
    order_type: payload.order_type,
    order_status: payload.order_status,
    limit_price: payload.limit_price ?? order.limitPrice,
    stop_price: payload.stop_price ?? order.stopPrice,
    filled_price: payload.filled_price ?? order.filledPrice ?? order.price,
    fill_volume: payload.fill_volume ?? order.fillVolume,
  };
}

function mergeFillPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const fill = asRecord(payload.fill);
  if (!fill) return payload;
  return {
    ...payload,
    contract_name: payload.contract_name ?? shortenContract(String(fill.contractId || '')),
    trade_type: payload.trade_type,
    size: payload.size ?? fill.size,
    side_code: payload.side_code ?? fill.side,
    price: payload.price ?? fill.price,
    pnl: payload.pnl ?? fill.profitAndLoss,
  };
}

/**
 * Ligne de détail lisible sous le libellé d'événement (ex. « NQ · Achat · 2 · Limite @ 21050 »).
 */
export function getEventDetailText(
  evt: SessionEventItem,
  t: TFunction,
  numberFormat: NumberFormatType = 'comma',
): string | null {
  const base = asRecord(evt.payload) || {};
  let payload = base;
  const order = asRecord(base.order);
  const fill = asRecord(base.fill);

  switch (evt.event_type) {
    case 'order_created':
    case 'order_updated': {
      payload = mergeOrderPayload(base);
      const parts: string[] = [];
      const contract = contractFromPayload(payload);
      if (contract) parts.push(contract);
      const side = sideLabel(t, payload, order);
      if (side) parts.push(side);
      const size = sizePart(payload.size, t, numberFormat);
      if (size) parts.push(size);
      const oType = orderTypePart(t, payload, order);
      if (oType) parts.push(oType);
      const limit = pricePart(payload.limit_price, '@', numberFormat);
      if (limit) parts.push(limit);
      else {
        const stop = pricePart(payload.stop_price, 'stop', numberFormat);
        if (stop) parts.push(stop);
        else {
          const filled = pricePart(payload.filled_price, '@', numberFormat);
          if (filled) parts.push(filled);
        }
      }
      const fillVol = payload.fill_volume;
      if (fillVol != null && Number(fillVol) > 0) {
        const fv = sizePart(fillVol, t, numberFormat);
        if (fv) {
          parts.push(
            t('eventDetail.partialFill', {
              defaultValue: 'exécuté {{size}}',
              size: formatNumber(Number(fillVol), 0, numberFormat),
            }),
          );
        }
      }
      const status = orderStatusPart(t, payload, order);
      if (status) parts.push(status);
      return parts.length ? parts.join(' · ') : null;
    }
    case 'fill': {
      payload = mergeFillPayload(base);
      const parts: string[] = [];
      const contract = contractFromPayload(payload);
      if (contract) parts.push(contract);
      const side = sideLabel(t, payload, null, fill);
      if (side) parts.push(side);
      const size = sizePart(payload.size, t, numberFormat);
      const atPrice = pricePart(payload.price, '@', numberFormat);
      if (size && atPrice) parts.push(`${size} ${atPrice}`);
      else if (size) parts.push(size);
      else if (atPrice) parts.push(atPrice);
      const pnl = payload.pnl;
      if (pnl != null && pnl !== '') {
        const n = Number(pnl);
        if (Number.isFinite(n)) {
          parts.push(formatCurrencyWithSign(n, '', numberFormat, 2));
        }
      }
      return parts.length ? parts.join(' · ') : null;
    }
    case 'position_open': {
      const parts: string[] = [];
      if (payload.contract_name) parts.push(String(payload.contract_name));
      if (payload.trade_type) parts.push(String(payload.trade_type));
      const size = sizePart(payload.size, t, numberFormat);
      const entry = pricePart(payload.entry_price, '@', numberFormat);
      if (size) parts.push(size);
      if (entry) parts.push(entry);
      return parts.length ? parts.join(' · ') : null;
    }
    case 'position_close': {
      const parts: string[] = [];
      if (payload.contract_name) parts.push(String(payload.contract_name));
      if (payload.trade_type) parts.push(String(payload.trade_type));
      const size = sizePart(payload.size, t, numberFormat);
      const exit = pricePart(payload.exit_price, '@', numberFormat);
      if (size) parts.push(size);
      if (exit) parts.push(exit);
      if (payload.pnl != null) {
        const n = Number(payload.pnl);
        if (Number.isFinite(n)) {
          parts.push(
            t('eventDetail.pnl', {
              defaultValue: 'PnL {{amount}}',
              amount: formatCurrencyWithSign(n, '', numberFormat, 2),
            }),
          );
        }
      }
      return parts.length ? parts.join(' · ') : null;
    }
    case 'pnl_tick': {
      const raw = payload.cumulative_pnl;
      if (raw == null) return null;
      const n = Number(raw);
      if (!Number.isFinite(n)) return null;
      return t('eventDetail.cumulativePnl', {
        defaultValue: 'PnL cumulé {{amount}}',
        amount: formatCurrencyWithSign(n, '', numberFormat, 2),
      });
    }
    default:
      return null;
  }
}

/** Tooltip d'une ligne stop loss sur le bandeau marché. */
export function getStopLossLineTooltipText(
  price: number,
  kind: TapePriceLineKind,
  t: TFunction,
  numberFormat: NumberFormatType = 'comma',
): string {
  const labelKey =
    kind === 'planned_stop_loss'
      ? 'marketTapeStopLossPlannedTooltip'
      : 'marketTapeStopLossBrokerTooltip';
  const priceStr = formatNumber(price, price % 1 === 0 ? 0 : 2, numberFormat);
  return t(labelKey, {
    defaultValue: kind === 'planned_stop_loss' ? 'Stop loss planifié @ {{price}}' : 'Stop broker @ {{price}}',
    price: priceStr,
  });
}

/** Tooltip du marqueur ordre sur le bandeau marché (type, sens, prix…). */
export function getOrderMarkerTooltipText(
  evt: SessionEventItem,
  t: TFunction,
  numberFormat: NumberFormatType = 'comma',
): string {
  const title = t(`eventTypes.${evt.event_type}`, { defaultValue: evt.event_type });
  const detail = getEventDetailText(evt, t, numberFormat);
  return detail ? `${title} — ${detail}` : title;
}
