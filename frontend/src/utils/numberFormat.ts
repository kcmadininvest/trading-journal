/**
 * Utilitaires de formatage des nombres basés sur les préférences utilisateur
 */

export type NumberFormatType = 'point' | 'comma';
export type DateFormatType = 'US' | 'EU';

/**
 * Formate un nombre avec les préférences de format utilisateur
 * @param value - Valeur à formater
 * @param digits - Nombre de décimales (défaut: 2)
 * @param numberFormat - Format de nombre ('point' ou 'comma')
 * @returns Nombre formaté
 */
export const formatNumber = (
  value: string | number | null | undefined,
  digits: number = 2,
  numberFormat: NumberFormatType = 'comma'
): string => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) {
    return '-';
  }

  // Déterminer la locale et les options selon le format
  const locale = numberFormat === 'comma' ? 'fr-FR' : 'en-US';
  
  return num.toLocaleString(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

/**
 * Formate un montant avec le symbole de devise
 * @param value - Valeur à formater
 * @param currencySymbol - Symbole de la devise (optionnel)
 * @param numberFormat - Format de nombre ('point' ou 'comma')
 * @param digits - Nombre de décimales (défaut: 2)
 * @returns Montant formaté
 */
export const formatCurrency = (
  value: string | number | null | undefined,
  currencySymbol: string = '',
  numberFormat: NumberFormatType = 'comma',
  digits: number = 2
): string => {
  const formatted = formatNumber(value, digits, numberFormat);
  if (formatted === '-') {
    return '-';
  }
  
  return currencySymbol ? `${currencySymbol} ${formatted}` : formatted;
};

/**
 * Formate un nombre avec un signe +/- pour les PnL
 * @param value - Valeur à formater
 * @param currencySymbol - Symbole de la devise (optionnel)
 * @param numberFormat - Format de nombre ('point' ou 'comma')
 * @param digits - Nombre de décimales (défaut: 2)
 * @returns Nombre formaté avec signe
 */
export const formatCurrencyWithSign = (
  value: string | number | null | undefined,
  currencySymbol: string = '',
  numberFormat: NumberFormatType = 'comma',
  digits: number = 2
): string => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) {
    return '-';
  }
  
  const sign = num > 0 ? '+' : (num < 0 ? '' : ''); // Pas de signe pour 0, + pour positif
  const formatted = formatCurrency(Math.abs(num), currencySymbol, numberFormat, digits);
  
  if (formatted === '-') {
    return '-';
  }
  
  // Si la valeur est 0, pas de signe
  if (num === 0) {
    return formatted;
  }
  
  return `${sign}${formatted}`;
};

