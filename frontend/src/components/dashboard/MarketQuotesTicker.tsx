import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
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
      ? 'text-blue-200/70'
      : isUp
        ? 'text-emerald-300'
        : 'text-red-300';

  return (
    <span className="inline-flex items-center gap-1.5 px-3 shrink-0 text-xs whitespace-nowrap">
      <span className="font-semibold text-blue-50/95">{label}</span>
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

  const quotes = useMemo(
    () => snapshot?.quotes ?? [],
    [snapshot?.quotes],
  );
  const hasPrices = quotes.some((q) => q.last_price_display != null);

  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [loopMarquee, setLoopMarquee] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure || quotes.length === 0) {
      setLoopMarquee(false);
      return;
    }

    const update = () => {
      setLoopMarquee(measure.scrollWidth > container.clientWidth + 1);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [quotes]);

  const trackItems = useMemo(() => {
    if (quotes.length === 0) return [];
    return loopMarquee ? [...quotes, ...quotes] : quotes;
  }, [quotes, loopMarquee]);

  const tickerTrackClass = 'relative overflow-hidden h-7 w-full';

  if (loading && !snapshot) {
    return (
      <div className={`${tickerTrackClass} flex items-center`} aria-busy="true" aria-live="polite">
        <span className="text-[11px] text-blue-200/80 animate-pulse">
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
      ref={containerRef}
      className={tickerTrackClass}
      aria-live="polite"
      role="region"
      aria-label={t('dashboard:marketQuotes.title')}
    >
      {loopMarquee && (
        <>
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-8 bg-gradient-to-r from-blue-700 dark:from-blue-950 to-transparent"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-8 bg-gradient-to-l from-blue-700 dark:from-blue-950 to-transparent"
            aria-hidden
          />
        </>
      )}
      {statusMessage && !hasPrices && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-blue-900/85 backdrop-blur-sm px-3">
          <span className="text-[11px] text-blue-100/90 truncate">{statusMessage}</span>
        </div>
      )}
      {quotes.length > 0 && (
        <div
          ref={measureRef}
          className="absolute left-0 top-0 flex items-center h-full invisible pointer-events-none"
          aria-hidden
        >
          {quotes.map((quote) => (
            <QuoteChip key={`measure-${quote.key}`} quote={quote} />
          ))}
        </div>
      )}
      <div
        className={
          loopMarquee
            ? 'market-quotes-ticker-track relative z-0 flex items-center h-full'
            : 'relative z-0 flex items-center justify-center h-full w-full'
        }
      >
        {trackItems.map((quote, index) => (
          <QuoteChip
            key={loopMarquee ? `${quote.key}-${index}` : quote.key}
            quote={quote}
          />
        ))}
      </div>
      {loopMarquee && (
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
      )}
    </div>
  );
};

export default MarketQuotesTicker;
