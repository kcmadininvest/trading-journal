export const formatCurrency = (value: number, currencySymbol: string = ''): string => {
  const formatted = value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currencySymbol ? `${currencySymbol} ${formatted}` : formatted;
};

