import { getNextDSTChange } from './dstCalculator';

describe('dstCalculator', () => {
  it('US spring/fall 2026 YMD', () => {
    const beforeSpring = getNextDSTChange(
      'US',
      'America/New_York',
      new Date('2026-03-01T15:00:00.000Z'),
    );
    expect(beforeSpring?.dateYmd).toBe('2026-03-08');
    expect(beforeSpring?.type).toBe('spring');

    const beforeFall = getNextDSTChange(
      'US',
      'America/New_York',
      new Date('2026-10-15T15:00:00.000Z'),
    );
    expect(beforeFall?.dateYmd).toBe('2026-11-01');
    expect(beforeFall?.type).toBe('fall');
  });

  it('EU fall 2026 YMD', () => {
    const event = getNextDSTChange(
      'EU',
      'Europe/Paris',
      new Date('2026-10-20T10:00:00.000Z'),
    );
    expect(event?.dateYmd).toBe('2026-10-25');
    expect(event?.type).toBe('fall');
  });

  it('does not skip US spring when now is Paris morning on transition day', () => {
    // 2026-03-08 05:00 UTC ≈ 06:00 Paris, encore avant 02:00 ET (07:00 UTC)
    const event = getNextDSTChange(
      'US',
      'America/New_York',
      new Date('2026-03-08T05:00:00.000Z'),
    );
    expect(event?.dateYmd).toBe('2026-03-08');
    expect(event?.type).toBe('spring');
    expect(event?.isToday).toBe(true);
    expect(event?.daysUntil).toBe(0);
  });

  it('keeps EU fall today for NY observer on EU civil day', () => {
    // 2026-10-25 00:30 UTC = encore le 25 à Paris (02:30 CEST), déjà le 24 soir à NY
    // Avec fuseau Europe/Paris, aujourd'hui = 2026-10-25
    const event = getNextDSTChange(
      'EU',
      'Europe/Paris',
      new Date('2026-10-25T00:30:00.000Z'),
    );
    expect(event?.dateYmd).toBe('2026-10-25');
    expect(event?.isToday).toBe(true);
    expect(event?.daysUntil).toBe(0);
  });

  it('J-7 at market midnight and evening → daysUntil === 7', () => {
    const morning = getNextDSTChange(
      'EU',
      'Europe/Paris',
      new Date('2026-10-18T00:30:00+02:00'),
    );
    expect(morning?.dateYmd).toBe('2026-10-25');
    expect(morning?.daysUntil).toBe(7);

    const evening = getNextDSTChange(
      'EU',
      'Europe/Paris',
      new Date('2026-10-18T23:30:00+02:00'),
    );
    expect(evening?.daysUntil).toBe(7);
  });

  it('isTomorrow the day before EU fall', () => {
    const event = getNextDSTChange(
      'EU',
      'Europe/Paris',
      new Date('2026-10-24T12:00:00+02:00'),
    );
    expect(event?.isTomorrow).toBe(true);
    expect(event?.daysUntil).toBe(1);
    expect(event?.type).toBe('fall');
  });
});
