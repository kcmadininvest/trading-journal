import fixture from './__fixtures__/session37_replay.json';
import { buildTapeRenderModel } from './marketTapeData';
import { computeTapeExitMarkerLayout } from './marketTapeMarkerLayout';
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
    const l755 = computeTapeExitMarkerLayout(m755, model, barCount, theme)!;
    const l990 = computeTapeExitMarkerLayout(m990, model, barCount, theme)!;
    expect(m755.offsetY).toBeUndefined();
    expect(l990.tickY).toBeLessThan(l755.tickY);
    expect(m990.price).toBeGreaterThan(m755.price);
  });
});
