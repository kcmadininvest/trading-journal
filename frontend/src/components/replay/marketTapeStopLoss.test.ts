import {
  buildMarkersForContract,
  buildStopLossLines,
  getContractRoundTrips,
} from './marketTapeData';
import { getTripColor } from './marketTapeTripColors';
import type { SessionEventItem, SessionMarketBar } from '../../services/sessionReplay';

const bars: SessionMarketBar[] = [
  { t: '2024-01-01T10:00:00Z', o: 100, h: 110, l: 95, c: 105 },
  { t: '2024-01-01T10:05:00Z', o: 105, h: 108, l: 102, c: 103 },
  { t: '2024-01-01T10:10:00Z', o: 103, h: 106, l: 101, c: 104 },
];

function evt(
  id: number,
  event_type: string,
  occurred_at: string,
  payload: Record<string, unknown>,
): SessionEventItem {
  return {
    id,
    event_type,
    source: 'derived',
    external_id: `${event_type}-${id}`,
    sequence: id,
    occurred_at,
    payload,
    trade_id: null,
    planned_stop_loss: payload.planned_stop_loss as string | undefined,
  };
}

describe('trip index on markers and stop lines', () => {
  const contractId = 'CON.NQ';
  const label = 'NQ';

  const events: SessionEventItem[] = [
    evt(1, 'position_open', '2024-01-01T10:01:00Z', {
      contract_name: label,
      trade_type: 'Long',
      entry_price: '100',
      planned_stop_loss: '98',
    }),
    evt(2, 'order_created', '2024-01-01T10:01:30Z', {
      contract_name: label,
      order_type: 'stop',
      stop_price: '97.5',
      order: { orderType: 'stop', stopPrice: 97.5 },
    }),
    evt(3, 'position_close', '2024-01-01T10:02:00Z', {
      contract_name: label,
      trade_type: 'Long',
      exit_price: '102',
      pnl: '50',
    }),
    evt(4, 'position_open', '2024-01-01T10:06:00Z', {
      contract_name: label,
      trade_type: 'Long',
      entry_price: '104',
      planned_stop_loss: '102',
    }),
    evt(5, 'position_close', '2024-01-01T10:08:00Z', {
      contract_name: label,
      trade_type: 'Long',
      exit_price: '106',
      pnl: '80',
    }),
    evt(6, 'position_open', '2024-01-01T10:09:00Z', {
      contract_name: label,
      trade_type: 'Short',
      entry_price: '105',
    }),
  ];

  it('assigns incremental tripIndex per position_open', () => {
    const trips = getContractRoundTrips(events, contractId, label, bars);
    expect(trips.map((t) => t.tripIndex)).toEqual([0, 1, 2]);
    expect(trips[0].tradeSide).toBe('Long');
    expect(trips[2].tradeSide).toBe('Short');
  });

  it('propagates tripIndex to SL lines and markers', () => {
    const lines = buildStopLossLines(events, events.length - 1, contractId, label, bars, 2);
    const trip0Lines = lines.filter((l) => l.tripIndex === 0);
    expect(trip0Lines.length).toBeGreaterThan(0);
    expect(trip0Lines.every((l) => l.side === 'Long')).toBe(true);

    const markers = buildMarkersForContract(events, events.length - 1, contractId, label, bars);
    const entry0 = markers.find((m) => m.kind === 'entry' && m.tripIndex === 0);
    const entry1 = markers.find((m) => m.kind === 'entry' && m.tripIndex === 1);
    expect(entry0).toBeDefined();
    expect(entry1).toBeDefined();
    expect(getTripColor(entry0!.tripIndex, entry0!.side, true)).not.toBe(
      getTripColor(entry1!.tripIndex, entry1!.side, true),
    );
  });

  it('shares tripIndex across partial closes from one position_open', () => {
    const partialEvents: SessionEventItem[] = [
      evt(1, 'position_open', '2024-01-01T10:01:00Z', {
        contract_name: label,
        trade_type: 'Long',
        entry_price: '100',
        size: '2',
      }),
      evt(2, 'position_close', '2024-01-01T10:02:00Z', {
        contract_name: label,
        trade_type: 'Long',
        exit_price: '102',
        size: '1',
        pnl: '50',
      }),
      evt(3, 'position_close', '2024-01-01T10:04:00Z', {
        contract_name: label,
        trade_type: 'Long',
        exit_price: '104',
        size: '1',
        pnl: '80',
      }),
    ];
    const trips = getContractRoundTrips(partialEvents, contractId, label, bars);
    expect(trips).toHaveLength(1);
    expect(trips[0].closeEventIds).toEqual([2, 3]);

    const markers = buildMarkersForContract(partialEvents, 3, contractId, label, bars);
    const entry = markers.find((m) => m.kind === 'entry')!;
    const exit1 = markers.find((m) => m.kind === 'exit' && m.pnl === 50)!;
    const exit2 = markers.find((m) => m.kind === 'exit' && m.pnl === 80)!;
    expect(exit1.tripIndex).toBe(entry.tripIndex);
    expect(exit2.tripIndex).toBe(entry.tripIndex);
    expect(getTripColor(exit2.tripIndex, exit2.side, true)).toBe(
      getTripColor(entry.tripIndex, entry.side, true),
    );
  });

  it('hides broker SL line when exit price equals stop and flags exit tooltip', () => {
    const stopEvents: SessionEventItem[] = [
      evt(1, 'position_open', '2024-01-01T10:01:00Z', {
        contract_name: label,
        trade_type: 'Long',
        entry_price: '100',
      }),
      evt(2, 'order_created', '2024-01-01T10:01:30Z', {
        contract_name: label,
        order_type: 'stop',
        stop_price: '98',
        order: { orderType: 'stop', stopPrice: 98 },
      }),
      evt(3, 'position_close', '2024-01-01T10:02:00Z', {
        contract_name: label,
        trade_type: 'Long',
        exit_price: '98',
        pnl: '-50',
      }),
    ];
    const lines = buildStopLossLines(stopEvents, 3, contractId, label, bars, 2);
    expect(lines.filter((l) => l.kind === 'broker_stop')).toHaveLength(0);

    const markers = buildMarkersForContract(stopEvents, 3, contractId, label, bars);
    const exit = markers.find((m) => m.kind === 'exit')!;
    expect(exit.exitViaStopLoss).toBe(true);
  });
});
