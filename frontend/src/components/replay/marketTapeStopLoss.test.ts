import {
  buildMarkersForContract,
  buildStopLossLines,
  buildTapeRenderModel,
  getContractRoundTrips,
  tapeBarIntervalLabel,
} from './marketTapeData';
import { getTripColor } from './marketTapeTripColors';
import type { SessionEventItem, SessionMarketBar, SessionMarketContract } from '../../services/sessionReplay';

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

  it('keeps broker SL line when exit price equals stop and flags exit tooltip', () => {
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
    expect(lines.filter((l) => l.kind === 'broker_stop')).toHaveLength(1);
    expect(lines[0].price).toBe(98);

    const markers = buildMarkersForContract(stopEvents, 3, contractId, label, bars);
    const exit = markers.find((m) => m.kind === 'exit')!;
    expect(exit.exitViaStopLoss).toBe(true);
  });
});

describe('trade spans on the tape', () => {
  const contractId = 'CON.NQ';
  const label = 'NQ';
  const contract: SessionMarketContract = {
    contract_id: contractId,
    label,
    bars,
  };

  function tape(events: SessionEventItem[], currentIndex = events.length - 1) {
    return buildTapeRenderModel(contract, events, currentIndex)!;
  }

  it('extends an open risk zone to the cursor bar', () => {
    const events: SessionEventItem[] = [
      evt(1, 'position_open', '2024-01-01T10:01:00Z', {
        contract_name: label,
        trade_type: 'Long',
        entry_price: '100',
        planned_stop_loss: '98',
      }),
      evt(2, 'pnl_tick', '2024-01-01T10:10:00Z', { contract_name: label }),
    ];
    const span = tape(events).tradeSpans?.[0];
    expect(span).toBeDefined();
    expect(span!.open).toBe(true);
    expect(span!.endBar).toBe(2);
    expect(span!.stopPrice).toBe(98);
    expect(span!.entryPrice).toBe(100);
  });

  it('ends a closed risk zone on the last exit bar', () => {
    const events: SessionEventItem[] = [
      evt(1, 'position_open', '2024-01-01T10:01:00Z', {
        contract_name: label,
        trade_type: 'Long',
        entry_price: '100',
        planned_stop_loss: '98',
      }),
      evt(2, 'position_close', '2024-01-01T10:02:00Z', {
        contract_name: label,
        exit_price: '102',
        pnl: '20',
      }),
      evt(3, 'position_close', '2024-01-01T10:08:00Z', {
        contract_name: label,
        exit_price: '104',
        pnl: '40',
      }),
    ];
    const span = tape(events).tradeSpans?.[0];
    expect(span!.open).toBe(false);
    expect(span!.endBar).toBe(1);
    expect(span!.endBar).toBeLessThan(bars.length - 1);
  });

  it('uses the planned stop as the zone boundary when there is no broker stop', () => {
    const events: SessionEventItem[] = [
      evt(1, 'position_open', '2024-01-01T10:01:00Z', {
        contract_name: label,
        trade_type: 'Long',
        entry_price: '100',
        planned_stop_loss: '98',
      }),
    ];
    const model = tape(events);
    expect(model.priceLines.map((line) => line.kind)).toEqual(['planned_stop_loss']);
    expect(model.tradeSpans?.[0].stopPrice).toBe(98);
  });

  it('draws broker then a different planned stop, and bounds the zone on the broker', () => {
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
    ];
    const model = tape(events);
    expect(model.priceLines.map((line) => line.kind)).toEqual(['broker_stop', 'planned_stop_loss']);
    expect(model.priceLines[0].price).toBe(97.5);
    expect(model.tradeSpans?.[0].stopPrice).toBe(97.5);
  });

  it('drops a far planned stop and leaves the price scale unchanged', () => {
    const open = evt(1, 'position_open', '2024-01-01T10:01:00Z', {
      contract_name: label,
      trade_type: 'Long',
      entry_price: '100',
    });
    const far = evt(1, 'position_open', '2024-01-01T10:01:00Z', {
      contract_name: label,
      trade_type: 'Long',
      entry_price: '100',
      planned_stop_loss: '1000',
    });
    const plain = tape([open]);
    const distant = tape([far]);
    expect(distant.priceLines.some((line) => line.kind === 'planned_stop_loss')).toBe(false);
    expect(distant.tradeSpans ?? []).toHaveLength(0);
    expect(distant.yMin).toBe(plain.yMin);
    expect(distant.yMax).toBe(plain.yMax);
  });

  it('links each partial exit back to the entry', () => {
    const events: SessionEventItem[] = [
      evt(1, 'position_open', '2024-01-01T10:01:00Z', {
        contract_name: label,
        trade_type: 'Long',
        entry_price: '100',
        planned_stop_loss: '98',
      }),
      evt(2, 'position_close', '2024-01-01T10:02:00Z', {
        contract_name: label,
        exit_price: '102',
        pnl: '50',
      }),
      evt(3, 'position_close', '2024-01-01T10:08:00Z', {
        contract_name: label,
        exit_price: '104',
        pnl: '80',
      }),
    ];
    const span = tape(events).tradeSpans?.[0];
    expect(span!.exits).toEqual([
      { barIndex: 0, price: 102 },
      { barIndex: 1, price: 104 },
    ]);
  });
});

describe('tape bar interval label', () => {
  const bars = [
    { t: '2024-01-01T10:00:00Z' },
    { t: '2024-01-01T10:05:00Z' },
    { t: '2024-01-01T10:10:00Z' },
    { t: '2024-01-01T10:25:00Z' },
  ];

  it('reads 1, 5 and 15 minute intervals from the contract', () => {
    expect(tapeBarIntervalLabel({ unit: 2, unit_number: 1 }, [])).toEqual({ unit: 'minutes', count: 1 });
    expect(tapeBarIntervalLabel({ unit: 2, unit_number: 5 }, [])).toEqual({ unit: 'minutes', count: 5 });
    expect(tapeBarIntervalLabel({ unit: 2, unit_number: 15 }, [])).toEqual({ unit: 'minutes', count: 15 });
  });

  it('falls back to the most common gap when a bar is missing', () => {
    expect(tapeBarIntervalLabel(undefined, bars)).toEqual({ unit: 'minutes', count: 5 });
  });

  it('returns nothing when the duration is unknown', () => {
    expect(tapeBarIntervalLabel(undefined, [{ t: '2024-01-01T10:00:00Z' }])).toBeNull();
  });
});
