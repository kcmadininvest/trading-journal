import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMarketQuotes } from '../../hooks/useMarketQuotes';
import type { MarketQuoteItem } from '../../services/marketQuotes';

function formatChangePercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return '—';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function QuoteChip({ quote }: { quote: MarketQuoteItem }) {
  const { t } = useTranslation();
  const label =
    t(`dashboard:marketQuotes.instruments.${quote.key}`, { defaultValue: quote.label }) ||
    quote.label;
  const price = quote.last_price_display ?? '—';
  const changePct = quote.change_percent;
  const isUp = changePct !== null && changePct >= 0;
  const changeClass =
    changePct === null
      ? 'text-gray-400'
      : isUp
        ? 'text-emerald-400'
        : 'text-red-400';

  return (
    <span className="inline-flex items-center gap-2 px-4 shrink-0 text-sm whitespace-nowrap">
      <span className="font-semibold text-gray-200">{label}</span>
      <span className="font-mono text-white tabular-nums">{price}</span>
      <span className={`font-mono text-xs tabular-nums ${changeClass}`}>
        {formatChangePercent(changePct)}
      </span>
    </span>
  );
}

export const MarketQuotesTicker: React.FC = () => {
  const { t } = useTranslation();
  const { snapshot, loading } = useMarketQuotes(true);

  const quotes = snapshot?.quotes ?? [];
  const hasPrices = quotes.some((q) => q.last_price_display != null);

  const trackItems = useMemo(() => {
    if (quotes.length === 0) return [];
    return [...quotes, ...quotes];
  }, [quotes]);

  if (loading && !snapshot) {
    return (
      <div
        className="h-10 rounded-lg bg-gray-900/90 dark:bg-gray-950 flex items-center px-4 mb-4"
        aria-busy="true"
        aria-live="polite"
      >
        <span className="text-xs text-gray-400 animate-pulse">
          {t('dashboard:marketQuotes.loading')}
        </span>
      </div>
    );
  }

  const fatalMessages = new Set([
    'market_quotes_unavailable',
    'market_quotes_disconnected',
    'missing_credentials',
    'hub_error',
    'api_error',
    'no_contracts',
  ]);
  const showFatalOverlay =
    !snapshot?.connected ||
    (snapshot?.message != null && fatalMessages.has(snapshot.message));
  const statusMessage = showFatalOverlay
    ? t(`dashboard:marketQuotes.${snapshot?.message || 'unavailable'}`, {
        defaultValue: t('dashboard:marketQuotes.unavailable'),
      })
    : null;

  return (
    <div
      className="relative overflow-hidden h-10 rounded-lg bg-gray-900 dark:bg-gray-950 border border-gray-700/60 mb-4"
      aria-live="polite"
      role="region"
      aria-label={t('dashboard:marketQuotes.title')}
    >
      {statusMessage && !hasPrices && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900/95 px-3">
          <span className="text-xs text-gray-400 truncate">{statusMessage}</span>
        </div>
      )}
      <div className="market-quotes-ticker-track flex items-center h-full">
        {trackItems.map((quote, index) => (
          <QuoteChip key={`${quote.key}-${index}`} quote={quote} />
        ))}
      </div>
      <style>{`
        @keyframes marketQuotesMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .market-quotes-ticker-track {
          width: max-content;
          animation: marketQuotesMarquee 45s linear infinite;
        }
        .market-quotes-ticker-track:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
};

export default MarketQuotesTicker;
