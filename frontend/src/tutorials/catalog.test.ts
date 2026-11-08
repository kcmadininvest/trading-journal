import { describe, expect, it } from 'vitest';
import {
  P0_SLUG,
  TUTORIAL_BY_SLUG,
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
  });

  it('marks secondary tutorials as ready once captures exist', () => {
    expect(TUTORIAL_BY_SLUG['import-trades']?.stub).toBeFalsy();
    expect(TUTORIAL_BY_SLUG.calendar?.stub).toBeFalsy();
    expect(TUTORIAL_BY_SLUG.calendar?.steps).toHaveLength(2);
    expect(TUTORIAL_BY_SLUG['api-connections']?.stub).toBeFalsy();
    expect(TUTORIAL_BY_SLUG['api-connections']?.section).toBe('go-further');
    expect(TUTORIAL_BY_SLUG['api-connections']?.steps).toHaveLength(4);
    expect(TUTORIAL_BY_SLUG['journal-questions']?.stub).toBeFalsy();
    expect(TUTORIAL_BY_SLUG['journal-questions']?.section).toBe('go-further');
    expect(TUTORIAL_BY_SLUG['journal-questions']?.steps).toHaveLength(4);
    expect(TUTORIAL_BY_SLUG['transactions-profitability']?.stub).toBeFalsy();
    expect(TUTORIAL_BY_SLUG['transactions-profitability']?.section).toBe('go-further');
    expect(TUTORIAL_BY_SLUG['transactions-profitability']?.steps).toHaveLength(4);
    expect(TUTORIAL_BY_SLUG['backtest-market-replay']?.stub).toBeFalsy();
    expect(TUTORIAL_BY_SLUG['backtest-market-replay']?.section).toBe('go-further');
    expect(TUTORIAL_BY_SLUG['backtest-market-replay']?.steps).toHaveLength(4);
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
