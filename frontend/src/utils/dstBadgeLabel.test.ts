import type { TFunction } from 'i18next';
import type { DSTEvent } from './dstCalculator';
import {
  formatDstBadgeLabel,
  formatDstBadgeTitle,
  getDstTransitionTime,
} from './dstBadgeLabel';

const FR: Record<string, string> = {
  'common:dstChange.springShort': 'Été',
  'common:dstChange.fallShort': 'Hiver',
  'common:dstChange.todayBadge': "aujourd'hui",
  'common:dstChange.tomorrowBadge': 'demain',
  'common:dstChange.daysShort': 'j',
  'common:dstChange.tooltip': 'Changement d\'heure {{market}} : {{date}} à {{time}}',
  'common:dstChange.clocksForward': "Les horloges avancent d'1 heure",
  'common:dstChange.clocksBackward': "Les horloges reculent d'1 heure",
};

const EN: Record<string, string> = {
  'common:dstChange.springShort': 'Summer',
  'common:dstChange.fallShort': 'Winter',
  'common:dstChange.todayBadge': 'today',
  'common:dstChange.tomorrowBadge': 'tomorrow',
  'common:dstChange.daysShort': 'd',
  'common:dstChange.tooltip': '{{market}} time change: {{date}} at {{time}}',
  'common:dstChange.clocksForward': 'Clocks move forward 1 hour',
  'common:dstChange.clocksBackward': 'Clocks move back 1 hour',
};

function makeT(map: Record<string, string>): TFunction {
  return ((key: string, opts?: Record<string, unknown>) => {
    let value = map[key] ?? (typeof opts?.defaultValue === 'string' ? opts.defaultValue : key);
    if (opts) {
      for (const [k, v] of Object.entries(opts)) {
        if (k === 'defaultValue') continue;
        value = value.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
      }
    }
    return value;
  }) as TFunction;
}

function baseEvent(overrides: Partial<DSTEvent> = {}): DSTEvent {
  return {
    instant: new Date('2026-10-25T01:00:00.000Z'),
    dateYmd: '2026-10-25',
    type: 'fall',
    daysUntil: 1,
    isToday: false,
    isTomorrow: true,
    region: 'EU',
    ...overrides,
  };
}

describe('dstBadgeLabel', () => {
  it('fall tomorrow FR → Hiver demain (pas Heure)', () => {
    const label = formatDstBadgeLabel(baseEvent(), makeT(FR), 'comma');
    expect(label).toBe('Hiver demain');
    expect(label).not.toContain('Heure');
  });

  it('fall tomorrow EN → Winter tomorrow', () => {
    const label = formatDstBadgeLabel(baseEvent(), makeT(EN), 'comma');
    expect(label).toBe('Winter tomorrow');
    expect(label).not.toMatch(/Daylight|Standard/);
  });

  it('fall today FR', () => {
    const label = formatDstBadgeLabel(
      baseEvent({ isToday: true, isTomorrow: false, daysUntil: 0 }),
      makeT(FR),
      'comma',
    );
    expect(label).toBe("Hiver aujourd'hui");
  });

  it('fall in N days uses daysShort', () => {
    const label = formatDstBadgeLabel(
      baseEvent({ isToday: false, isTomorrow: false, daysUntil: 3 }),
      makeT(FR),
      'comma',
    );
    expect(label).toBe('Hiver +3j');
  });

  it('spring short label', () => {
    const label = formatDstBadgeLabel(
      baseEvent({ type: 'spring', isTomorrow: true, daysUntil: 1 }),
      makeT(EN),
      'comma',
    );
    expect(label).toBe('Summer tomorrow');
  });

  it('empty relative avoids double space (CJK-style)', () => {
    const t = makeT({
      ...FR,
      'common:dstChange.fallShort': '冬時間明日',
      'common:dstChange.tomorrowBadge': '',
    });
    expect(formatDstBadgeLabel(baseEvent(), t, 'comma')).toBe('冬時間明日');
  });

  it('title uses regulatory EU fall time 03:00 and clocksBackward', () => {
    const title = formatDstBadgeTitle(baseEvent(), makeT(FR), 'Euronext', 'EU');
    expect(title).toContain('25/10/2026');
    expect(title).toContain('03:00');
    expect(title).toContain("Les horloges reculent d'1 heure");
    expect(title).toContain('Euronext');
  });

  it('title spring US uses 02:00 and clocksForward', () => {
    const title = formatDstBadgeTitle(
      baseEvent({
        type: 'spring',
        region: 'US',
        dateYmd: '2026-03-08',
        instant: new Date('2026-03-08T07:00:00.000Z'),
      }),
      makeT(EN),
      'NYSE',
      'US',
    );
    expect(title).toContain('03/08/2026');
    expect(title).toContain('02:00');
    expect(title).toContain('Clocks move forward 1 hour');
  });

  it('getDstTransitionTime', () => {
    expect(getDstTransitionTime('EU', 'fall')).toBe('03:00');
    expect(getDstTransitionTime('EU', 'spring')).toBe('02:00');
    expect(getDstTransitionTime('US', 'fall')).toBe('02:00');
  });
});
