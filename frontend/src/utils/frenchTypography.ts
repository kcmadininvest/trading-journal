/**
 * Ponctuation « libellé : valeur » pour l’UI.
 * En français : espace insécable (U+00A0) avant le deux-points (recommandations typographiques).
 */

/** Espace insécable + deux-points pour le français ; simple « : » sinon. */
export function colonBeforeValueForUi(...locales: (string | undefined)[]): string {
  const wantsFr = locales.some((locale) => String(locale || '').toLowerCase().startsWith('fr'));
  if (wantsFr) {
    return '\u00a0:';
  }
  return ':';
}
