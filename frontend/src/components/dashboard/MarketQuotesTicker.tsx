import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMarketQuotes } from '../../hooks/useMarketQuotes';
import type { MarketQuoteItem } from '../../services/marketQuotes';
import { getPriceFlashDirection, type PriceFlashDirection } from '../../utils/marketQuoteFlash';

const TICKER_HEIGHT_CLASS = 'h-7 w-full min-w-0';

const FATAL_MESSAGES = new Set([
  'market_quotes_unavailable',
  'market_quotes_disconnected',
  'missing_credentials',
  'hub_error',
  'api_error',
  'no_contracts',
]);

function formatChangePercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return '—';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function TickerStatus({
  message,
  pulse = false,
  ariaLabel,
}: {
  message: string;
  pulse?: boolean;
  ariaLabel: string;
}) {
  return (
    <div
      className={`${TICKER_HEIGHT_CLASS} flex items-center justify-center px-4`}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      <span
        className={`max-w-full text-center text-xs leading-tight text-blue-50/95 ${
          pulse ? 'animate-pulse' : ''
        }`}
      >
        {message}
      </span>
    </div>
  );
}

function QuoteChip({ quote }: { quote: MarketQuoteItem }) {
  const { t } = useTranslation();
  const prevPriceRef = useRef<number | null | undefined>(undefined);
  const [flash, setFlash] = useState<PriceFlashDirection>(null);

  useEffect(() => {
    const direction = getPriceFlashDirection(prevPriceRef.current, quote.last_price);
    prevPriceRef.current = quote.last_price;
    if (direction === null) {
      return;
    }
    setFlash(direction);
    const timer = window.setTimeout(() => setFlash(null), 500);
    return () => window.clearTimeout(timer);
  }, [quote.last_price]);

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
  const priceFlashClass =
    flash === 'up'
      ? 'market-quote-flash-up rounded px-0.5'
      : flash === 'down'
        ? 'market-quote-flash-down rounded px-0.5'
        : '';

  return (
    <span className="inline-flex items-center gap-1.5 px-3 shrink-0 text-xs whitespace-nowrap">
      <span className="font-semibold text-blue-50/95">{label}</span>
      <span className={`font-mono text-white tabular-nums ${priceFlashClass}`}>{price}</span>
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

  const tickerTitle = t('dashboard:marketQuotes.title');

  const statusMessage = useMemo(() => {
    if (hasPrices) {
      return null;
    }

    const message = snapshot?.message;

    if (loading && !snapshot) {
      return t('dashboard:marketQuotes.loading');
    }
    if (message === 'connecting') {
      return t('dashboard:marketQuotes.connecting');
    }
    if (message != null && FATAL_MESSAGES.has(message)) {
      return t(`dashboard:marketQuotes.${message}`, {
        defaultValue: t('dashboard:marketQuotes.unavailable'),
      });
    }
    if (snapshot?.connected) {
      return t('dashboard:marketQuotes.awaitingQuotes');
    }
    return t('dashboard:marketQuotes.unavailable');
  }, [hasPrices, loading, snapshot, t]);

  const statusPulse =
    (loading && !snapshot) || snapshot?.message === 'connecting';

  useLayoutEffect(() => {
    if (!hasPrices) {
      setLoopMarquee(false);
      return;
    }

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
  }, [hasPrices, quotes]);

  const trackItems = useMemo(() => {
    if (!hasPrices || quotes.length === 0) return [];
    return loopMarquee ? [...quotes, ...quotes] : quotes;
  }, [hasPrices, quotes, loopMarquee]);

  if (statusMessage) {
    return (
      <TickerStatus
        message={statusMessage}
        pulse={statusPulse}
        ariaLabel={tickerTitle}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${TICKER_HEIGHT_CLASS}`}
      aria-live="polite"
      role="region"
      aria-label={tickerTitle}
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
      <div
        ref={measureRef}
        className="absolute left-0 top-0 flex h-full items-center invisible pointer-events-none"
        aria-hidden
      >
        {quotes.map((quote) => (
          <QuoteChip key={`measure-${quote.key}`} quote={quote} />
        ))}
      </div>
      <div
        className={
          loopMarquee
            ? 'market-quotes-ticker-track relative z-0 flex h-full items-center'
            : 'relative z-0 flex h-full w-full items-center justify-center'
        }
      >
        {trackItems.map((quote, index) => (
          <QuoteChip
            key={loopMarquee ? `${quote.key}-${index}` : quote.key}
            quote={quote}
          />
        ))}
      </div>
      <style>{`
        @keyframes marketQuoteFlashUp {
          0% { background-color: rgba(52, 211, 153, 0.45); }
          100% { background-color: transparent; }
        }
        @keyframes marketQuoteFlashDown {
          0% { background-color: rgba(248, 113, 113, 0.45); }
          100% { background-color: transparent; }
        }
        .market-quote-flash-up {
          animation: marketQuoteFlashUp 0.5s ease-out;
        }
        .market-quote-flash-down {
          animation: marketQuoteFlashDown 0.5s ease-out;
        }
        ${
          loopMarquee
            ? `
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
        }`
            : ''
        }
      `}</style>
    </div>
  );
};

export default MarketQuotesTicker;
