import { describe, expect, it } from 'vitest';
import { resolveCalendarContentMode } from './resolveCalendarContentMode';

describe('resolveCalendarContentMode', () => {
  it('garde la vue daily montée pendant un reload (anti-scintillement modale)', () => {
    expect(
      resolveCalendarContentMode({
        viewType: 'daily',
        hasDailyData: true,
        hasMonthlyData: false,
        isLoading: true,
      }),
    ).toBe('daily');
  });

  it('garde la vue monthly montée pendant un reload', () => {
    expect(
      resolveCalendarContentMode({
        viewType: 'monthly',
        hasDailyData: false,
        hasMonthlyData: true,
        isLoading: true,
      }),
    ).toBe('monthly');
  });

  it('affiche le spinner seulement au premier chargement daily (pas encore de data)', () => {
    expect(
      resolveCalendarContentMode({
        viewType: 'daily',
        hasDailyData: false,
        hasMonthlyData: false,
        isLoading: true,
      }),
    ).toBe('loading');
  });

  it('affiche daily quand les données sont prêtes et pas de loading', () => {
    expect(
      resolveCalendarContentMode({
        viewType: 'daily',
        hasDailyData: true,
        hasMonthlyData: true,
        isLoading: false,
      }),
    ).toBe('daily');
  });

  it('affiche monthly quand la vue monthly a ses données', () => {
    expect(
      resolveCalendarContentMode({
        viewType: 'monthly',
        hasDailyData: true,
        hasMonthlyData: true,
        isLoading: false,
      }),
    ).toBe('monthly');
  });

  it('retourne empty si aucune data et pas de loading', () => {
    expect(
      resolveCalendarContentMode({
        viewType: 'daily',
        hasDailyData: false,
        hasMonthlyData: false,
        isLoading: false,
      }),
    ).toBe('empty');
  });

  it('ne préfère pas loading à daily (régression de l’ancien ordre isLoading ? spinner : DailyView)', () => {
    const mode = resolveCalendarContentMode({
      viewType: 'daily',
      hasDailyData: true,
      hasMonthlyData: false,
      isLoading: true,
    });
    expect(mode).not.toBe('loading');
    expect(mode).toBe('daily');
  });
});
