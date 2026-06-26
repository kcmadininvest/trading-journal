import {
  TAX_PAYMENT_TYPES,
  isBuiltinTaxPaymentTypeCode,
  type BuiltinTaxPaymentLabels,
  type TaxPaymentCustomType,
  type TaxPaymentTypeCode,
} from '../../services/tradingActivity';

export type TradingActivityT = (key: string, options?: Record<string, string | number>) => string;

export { isBuiltinTaxPaymentTypeCode };

export function taxPaymentTypeLabel(
  t: TradingActivityT,
  code: string,
  customTypes?: TaxPaymentCustomType[],
  builtinLabels?: BuiltinTaxPaymentLabels,
): string {
  const custom = customTypes?.find((row) => row.code === code);
  if (custom) return custom.name;
  if (isBuiltinTaxPaymentTypeCode(code) && builtinLabels?.[code]) {
    return builtinLabels[code];
  }
  if (isBuiltinTaxPaymentTypeCode(code)) {
    return t(`paymentType.${code}`);
  }
  return code;
}

export function buildTaxPaymentTypeSelectOptions(
  t: TradingActivityT,
  customTypes: TaxPaymentCustomType[],
  builtinLabels?: BuiltinTaxPaymentLabels,
): Array<{ value: TaxPaymentTypeCode; label: string }> {
  const builtins = TAX_PAYMENT_TYPES.map((code) => ({
    value: code,
    label: taxPaymentTypeLabel(t, code, customTypes, builtinLabels),
  }));
  const customs = customTypes.map((row) => ({
    value: row.code,
    label: row.name,
  }));
  return [...builtins, ...customs];
}
