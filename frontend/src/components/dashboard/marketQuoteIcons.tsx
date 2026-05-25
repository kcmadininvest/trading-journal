import React from 'react';
import { Bitcoin, DollarSign, Euro, Landmark, TrendingUp, type LucideIcon } from 'lucide-react';

type IconProps = { className?: string; size?: number };

/** Icônes Lucide (MIT) + SVG minimalistes pour le bandeau cours. */
const INSTRUMENT_LUCIDE: Record<string, LucideIcon> = {
  nasdaq: TrendingUp,
  sp500: Landmark,
  bitcoin: Bitcoin,
};

/** Trois lingots empilés — lecture immédiate « or » à petite taille. */
function GoldIcon({ className, size = 16 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="5" y="5" width="14" height="4" rx="1" />
      <rect x="5" y="10" width="14" height="4" rx="1" opacity="0.88" />
      <rect x="5" y="15" width="14" height="4" rx="1" opacity="0.76" />
    </svg>
  );
}

/** Paire EUR/USD : icônes Lucide côte à côte (lisibles à 16px). */
function EurUsdIcon({ className }: IconProps) {
  return (
    <span
      className={`inline-flex items-center justify-center gap-0.5 ${className ?? ''}`}
      aria-hidden
    >
      <Euro className="h-3.5 w-3.5 shrink-0 text-blue-300" strokeWidth={2.5} />
      <DollarSign className="h-3.5 w-3.5 shrink-0 text-emerald-300" strokeWidth={2.5} />
    </span>
  );
}

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

export function MarketQuoteInstrumentIcon({
  instrumentKey,
  className = 'h-4 w-4',
}: {
  instrumentKey: string;
  className?: string;
}) {
  if (instrumentKey === 'eurusd') {
    return <EurUsdIcon className={className} />;
  }
  if (instrumentKey === 'gold') {
    return <GoldIcon className={className} size={16} />;
  }
  const Lucide = INSTRUMENT_LUCIDE[instrumentKey];
  if (Lucide) {
    return <Lucide className={className} strokeWidth={2} aria-hidden />;
  }
  return <TrendingUp className={className} strokeWidth={2} aria-hidden />;
}
