import { resolveRiskSectionTitle } from './resolveRiskSectionTitle';

describe('resolveRiskSectionTitle', () => {
  it('retourne celebrate pour un drawdown modéré et une bonne récupération', () => {
    expect(resolveRiskSectionTitle(8, 1.8)).toBe('behaviorNarrative.risk.title.celebrate');
    expect(resolveRiskSectionTitle(15, 1)).toBe('behaviorNarrative.risk.title.celebrate');
  });

  it('retourne positive pour un drawdown modéré sans signal de récupération', () => {
    expect(resolveRiskSectionTitle(10, null)).toBe('behaviorNarrative.risk.title.positive');
    expect(resolveRiskSectionTitle(12, 0.9)).toBe('behaviorNarrative.risk.title.positive');
  });

  it('retourne mixed pour un drawdown modéré avec récupération faible', () => {
    expect(resolveRiskSectionTitle(10, 0.5)).toBe('behaviorNarrative.risk.title.mixed');
  });

  it('retourne excellent (résilience) pour un drawdown élevé avec forte récupération', () => {
    expect(resolveRiskSectionTitle(22, 2)).toBe('behaviorNarrative.risk.title.excellent');
    expect(resolveRiskSectionTitle(30, 1.5)).toBe('behaviorNarrative.risk.title.excellent');
  });

  it('retourne mixed pour un drawdown élevé sans forte récupération', () => {
    expect(resolveRiskSectionTitle(20, 1.2)).toBe('behaviorNarrative.risk.title.mixed');
    expect(resolveRiskSectionTitle(16, null)).toBe('behaviorNarrative.risk.title.mixed');
  });

  it('retourne challenging pour un drawdown très élevé, quelle que soit la récupération', () => {
    expect(resolveRiskSectionTitle(42, 2.5)).toBe('behaviorNarrative.risk.title.challenging');
    expect(resolveRiskSectionTitle(31, 0.5)).toBe('behaviorNarrative.risk.title.challenging');
  });

  it('retourne positive si le drawdown est absent', () => {
    expect(resolveRiskSectionTitle(null, 1.5)).toBe('behaviorNarrative.risk.title.positive');
  });
});
