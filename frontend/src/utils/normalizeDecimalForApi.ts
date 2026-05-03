import type { NumberFormatType } from './numberFormat';

/**
 * Convertit une saisie utilisateur selon `number_format` (préférences compte)
 * en chaîne compatible API Django / Decimal (séparateur `.`).
 *
 * - **comma** (aligné `formatNumber` / locale `fr-FR`) : décimales `,`, milliers souvent espaces (déjà retirés).
 * - **point** (aligné locale `en-US`) : décimales `.`, milliers `,` ; tolère une virgule seule comme décimale (saisie habituelle FR).
 */
export function normalizeDecimalForApi(raw: string, numberFormat: NumberFormatType = 'comma'): string {
  const s = raw
    .trim()
    .replace(/\u00a0/g, '')
    .replace(/\s/g, '');
  if (!s) return '';

  if (numberFormat === 'comma') {
    if (s.includes(',') && !s.includes('.')) {
      return s.replace(',', '.');
    }
    if (s.includes(',') && s.includes('.')) {
      return s.lastIndexOf(',') > s.lastIndexOf('.')
        ? s.replace(/\./g, '').replace(',', '.')
        : s.replace(/,/g, '');
    }
    return s;
  }

  // numberFormat === 'point' (en-US)
  if (s.includes('.') && !s.includes(',')) {
    return s;
  }
  if (s.includes(',') && !s.includes('.')) {
    return s.replace(',', '.');
  }
  if (s.lastIndexOf('.') > s.lastIndexOf(',')) {
    return s.replace(/,/g, '');
  }
  return s.replace(/\./g, '').replace(',', '.');
}

export function parseUserDecimal(raw: string, numberFormat: NumberFormatType = 'comma'): number {
  const n = parseFloat(normalizeDecimalForApi(raw, numberFormat));
  return Number.isFinite(n) ? n : 0;
}
