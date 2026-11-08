import { describe, expect, it } from 'vitest';
import {
  P0_SLUG,
  TUTORIALS,
  TUTORIAL_BY_SLUG,
  TUTORIAL_SECTION_ORDER,
  getTutorialStatus,
  isP0Incomplete,
  tutorialImageCandidates,
  tutorialImagePath,
} from './catalog';

describe('tutorials catalog', () => {
  it('exposes getting-started as P0 with 4 steps', () => {
    expect(P0_SLUG).toBe('getting-started');
    const p0 = TUTORIAL_BY_SLUG[P0_SLUG];
    expect(p0).toBeDefined();
    expect(p0.steps).toHaveLength(4);
    expect(p0.section).toBe('getting-started');
  });

  it('groups tutorials into thematic sections', () => {
    expect(TUTORIAL_SECTION_ORDER).toEqual([
      'getting-started',
      'workspace',
      'trades-pnl',
      'journal',
      'strategies',
    ]);
    for (const tut of TUTORIALS) {
      expect(TUTORIAL_SECTION_ORDER).toContain(tut.section);
      expect(tut.stub).toBeFalsy();
      expect(tut.steps.length).toBeGreaterThan(0);
    }
  });

  it('exposes high-priority and existing go-further tutorials', () => {
    const expected = [
      'trading-accounts',
      'display-settings',
      'trades',
      'dashboard-filters',
      'daily-journal',
      'import-trades',
      'calendar',
      'api-connections',
      'journal-questions',
      'transactions-profitability',
      'position-strategies',
      'backtest-market-replay',
    ];
    for (const slug of expected) {
      expect(TUTORIAL_BY_SLUG[slug]?.stub).toBeFalsy();
      expect(TUTORIAL_BY_SLUG[slug]?.steps.length).toBeGreaterThan(0);
    }
    expect(TUTORIAL_BY_SLUG['trading-accounts']?.section).toBe('workspace');
    expect(TUTORIAL_BY_SLUG['display-settings']?.section).toBe('workspace');
    expect(TUTORIAL_BY_SLUG['trades']?.section).toBe('trades-pnl');
    expect(TUTORIAL_BY_SLUG['dashboard-filters']?.section).toBe('trades-pnl');
    expect(TUTORIAL_BY_SLUG['daily-journal']?.section).toBe('journal');
    expect(TUTORIAL_BY_SLUG['position-strategies']?.section).toBe('strategies');
    const strategies = TUTORIALS.filter((t) => t.section === 'strategies').map((t) => t.slug);
    expect(strategies.indexOf('position-strategies')).toBeLessThan(
      strategies.indexOf('backtest-market-replay')
    );
  });

  it('tracks progress helpers', () => {
    expect(isP0Incomplete({})).toBe(true);
    expect(isP0Incomplete({ 'getting-started': { status: 'completed' } })).toBe(false);
    expect(getTutorialStatus({}, 'import-trades')).toBe('not_started');
  });

  it('builds image paths', () => {
    expect(tutorialImagePath('fr-FR', 'getting-started', 2)).toBe(
      '/tutorials/fr/getting-started-step-2.png'
    );
  });

  it('orders image candidates by UI locale then EN/FR fallback', () => {
    expect(tutorialImageCandidates('es', 'getting-started', 1)).toEqual([
      '/tutorials/es/getting-started-step-1.png',
      '/tutorials/en/getting-started-step-1.png',
      '/tutorials/fr/getting-started-step-1.png',
    ]);
    expect(tutorialImageCandidates('en', 'getting-started', 1)[0]).toBe(
      '/tutorials/en/getting-started-step-1.png'
    );
  });
});
