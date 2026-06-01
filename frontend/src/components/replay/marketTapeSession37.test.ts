import fixture from './__fixtures__/session37_replay.json';
import { buildStopLossLines, buildTapeRenderModel, getContractRoundTrips } from './marketTapeData';
import { computeTapeExitMarkerLayout } from './marketTapeMarkerLayout';
import { getTripColor } from './marketTapeTripColors';
import { getMarketTapeTheme } from './replayStyles';
import type { SessionEventItem, SessionMarketContract } from '../../services/sessionReplay';

type FixtureEvent = {
  id: number;
  event_type: string;
  occurred_at: string;
  payload: Record<string, unknown>;
  sequence: number;
};

function asSessionEvents(raw: FixtureEvent[]): SessionEventItem[] {
  return raw.map((event) => ({
    id: event.id,
    event_type: event.event_type,
    source: 'derived',
    external_id: '',
    sequence: event.sequence,
    occurred_at: event.occurred_at,
    payload: event.payload,
    trade_id: null,
  }));
}

describe('session 37 ENQ exit markers', () => {
  const events = asSessionEvents(fixture.events as FixtureEvent[]);
  const contract = fixture.contract as SessionMarketContract;
  const currentIndex = fixture.lastIndex as number;

  it('maps 755 and 990 closes to different 5m bars', () => {
    const model = buildTapeRenderModel(contract, events, currentIndex);
    expect(model).not.toBeNull();
    const exits = model!.markers.filter((m) => m.kind === 'exit' && m.pnl != null && m.pnl >= 700);
    const byPnl = new Map(exits.map((m) => [m.pnl!, m]));
    const m755 = byPnl.get(755);
    const m990 = byPnl.get(990);
    expect(m755).toBeDefined();
    expect(m990).toBeDefined();
    expect(m755!.barIndex).not.toBe(m990!.barIndex);
    expect(m755!.occurredAt).toBe('2026-06-01T16:53:14.802469Z');
    expect(m990!.occurredAt).toBe('2026-06-01T16:55:43.662834Z');
  });

  it('places the later +990 exit higher on screen than the earlier +755 exit', () => {
    const model = buildTapeRenderModel(contract, events, currentIndex)!;
    const theme = getMarketTapeTheme(true);
    const barCount = model.bars.length;
    const m755 = model.markers.find((m) => m.pnl === 755)!;
    const m990 = model.markers.find((m) => m.pnl === 990)!;
    const l755 = computeTapeExitMarkerLayout(m755, model, barCount, theme, true)!;
    const l990 = computeTapeExitMarkerLayout(m990, model, barCount, theme, true)!;
    expect(m755.offsetY).toBeUndefined();
    expect(l990.tickY).toBeLessThan(l755.tickY);
    expect(m990.price).toBeGreaterThan(m755.price);
  });

  it('shares trip color between entry and both partial closes for the 2-lot Long @ 30532.5', () => {
    const model = buildTapeRenderModel(contract, events, currentIndex)!;
    const entry = model.markers.find((m) => m.kind === 'entry' && m.price === 30532.5);
    const m755 = model.markers.find((m) => m.pnl === 755)!;
    const m990 = model.markers.find((m) => m.pnl === 990)!;
    expect(entry?.tripIndex).toBeDefined();
    expect(m755.tripIndex).toBe(entry!.tripIndex);
    expect(m990.tripIndex).toBe(entry!.tripIndex);
    const entryColor = getTripColor(entry!.tripIndex, entry!.side, true);
    expect(getTripColor(m755.tripIndex, m755.side, true)).toBe(entryColor);
    expect(getTripColor(m990.tripIndex, m990.side, true)).toBe(entryColor);
  });

  it('trade #4 entry tooltip uses 2-lot fill size not partial round-trip size', () => {
    const model = buildTapeRenderModel(contract, events, currentIndex)!;
    const entry = model.markers.find((m) => m.kind === 'entry' && m.price === 30532.5);
    expect(entry).toBeDefined();
    expect(entry!.positionSize).toBe(2);
  });

  it('trade #3: broker stop frozen before exit and line ends at close bar', () => {
    const bars = contract.bars!;
    const contractId = contract.contract_id;
    const label = contract.label;
    const closeEventId = 2239;
    const closeIndex = events.findIndex((e) => e.id === closeEventId);
    expect(closeIndex).toBeGreaterThanOrEqual(0);

    const trips = getContractRoundTrips(events, contractId, label, bars, currentIndex);
    const trade3 = trips.find((t) => t.tripIndex === 2);
    expect(trade3).toBeDefined();
    expect(trade3!.brokerSl).toBe(30503.5);

    const lines = buildStopLossLines(
      events,
      currentIndex,
      contractId,
      label,
      bars,
      bars.length - 1,
    );
    const sl = lines.find((l) => l.tripIndex === 2);
    expect(sl).toBeDefined();
    expect(sl!.price).toBe(30503.5);

    const closeBar = trade3!.closeBar;
    expect(sl!.barEnd).toBe(closeBar);
    expect(sl!.barEnd).toBeLessThan(bars.length - 1);
  });
});
