export function quoteIconContainerClass(instrumentKey: string): string {
  const base =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full';
  if (instrumentKey === 'gold') {
    return `${base} bg-amber-400/25 text-amber-300 ring-1 ring-amber-400/40`;
  }
  if (instrumentKey === 'eurusd') {
    return `${base} bg-slate-900/50 ring-1 ring-blue-400/40`;
  }
  return `${base} bg-white/10 text-white/85`;
}
