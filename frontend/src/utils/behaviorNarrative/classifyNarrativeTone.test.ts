import { classifyNarrativeTone } from './classifyNarrativeTone';

describe('classifyNarrativeTone', () => {
  it('retourne excellent pour de très bonnes métriques sans alerte', () => {
    expect(
      classifyNarrativeTone({
        profitFactor: 2.5,
        sharpeAnnualized: 2.2,
        expectancy: 50,
        winRate: 62,
        maxDrawdownPct: 5,
        recoveryRatio: 2,
        revenge: { alertLevel: 'none', hasSufficientData: true, pctIncrease: 0, avgAfterLoss: 2, avgAfterWin: 2 },
        sizing: { alertLevel: 'none', hasSufficientData: true, pctLargerOnLosers: 0 },
        trajectoryProgression: true,
        trajectoryVolatile: false,
        monetaryNarrativesEnabled: true,
      }),
    ).toBe('excellent');
  });

  it('retourne challenging pour PF faible et alertes', () => {
    expect(
      classifyNarrativeTone({
        profitFactor: 0.8,
        sharpeAnnualized: 0.2,
        expectancy: -20,
        winRate: 35,
        maxDrawdownPct: 20,
        recoveryRatio: 0.5,
        revenge: { alertLevel: 'warning', hasSufficientData: true, pctIncrease: 20, avgAfterLoss: 5, avgAfterWin: 3 },
        sizing: { alertLevel: 'warning', hasSufficientData: true, pctLargerOnLosers: 15 },
        trajectoryProgression: false,
        trajectoryVolatile: true,
        monetaryNarrativesEnabled: true,
      }),
    ).toBe('challenging');
  });

  it('retourne mixed pour un profil intermédiaire', () => {
    const tone = classifyNarrativeTone({
      profitFactor: 1.3,
      sharpeAnnualized: 0.8,
      expectancy: 5,
      winRate: 48,
      maxDrawdownPct: 10,
      recoveryRatio: 1,
      revenge: { alertLevel: 'none', hasSufficientData: true, pctIncrease: 5, avgAfterLoss: 3, avgAfterWin: 3 },
      sizing: { alertLevel: 'none', hasSufficientData: true, pctLargerOnLosers: 5 },
      trajectoryProgression: false,
      trajectoryVolatile: false,
      monetaryNarrativesEnabled: true,
    });
    expect(['mixed', 'positive']).toContain(tone);
  });
});
