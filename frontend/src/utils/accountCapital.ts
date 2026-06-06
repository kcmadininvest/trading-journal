/**
 * Parse le capital initial d'un compte (0 est une valeur valide).
 */
export function parseInitialCapital(
  value: string | number | null | undefined,
): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const parsed = parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Parse un montant optionnel (null/undefined → null).
 */
export function parseOptionalAmount(
  value: string | number | null | undefined,
): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

export function hasFiniteMll(
  value: string | number | null | undefined,
): boolean {
  const parsed = parseOptionalAmount(value);
  return parsed !== null && parsed > 0;
}
