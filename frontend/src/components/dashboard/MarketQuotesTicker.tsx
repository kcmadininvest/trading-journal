import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMarketQuotes } from '../../hooks/useMarketQuotes';
import { usePreferences } from '../../hooks/usePreferences';
import integrationsService from '../../services/integrationsService';
import type { MarketQuoteItem } from '../../services/marketQuotes';
import { getPriceFlashDirection, type PriceFlashDirection } from '../../utils/marketQuoteFlash';
import {
  formatMarketQuoteChangePercent,
  formatMarketQuotePrice,
} from '../../utils/marketQuotesFormat';
import { MarketQuoteInstrumentIcon } from './marketQuoteIcons';
import { quoteIconContainerClass } from './quoteIconContainerClass';
import { TickerShell } from './tickerShell';

const FATAL_MESSAGES = new Set([
  'market_quotes_unavailable',
  'market_quotes_disconnected',
  'missing_credentials',
  'hub_error',
  'api_error',
  'no_contracts',
]);

const TICKER_ROW_CLASS =
  'mx-auto flex w-max min-w-full items-center justify-center gap-4 sm:gap-6';

function VerticalRule() {
  return <div className="h-6 w-px shrink-0 bg-white/10" aria-hidden />;
}

function LiveStatus({ live }: { live: boolean }) {
  const { t } = useTranslation();

  return (
    <div
      className={`flex shrink-0 items-center gap-2 rounded-full px-2.5 py-1 sm:px-3 ${
        live ? 'bg-emerald-500/10' : 'bg-white/5'
      }`}
    >
      <div
        className={`h-2 w-2 rounded-full ${
          live ? 'animate-pulse bg-emerald-400' : 'bg-white/30'
        }`}
      />
      <span
        className={`text-xs font-semibold sm:text-sm ${
          live ? 'text-emerald-400' : 'text-white/50'
        }`}
      >
        {live ? t('dashboard:marketQuotes.live') : t('dashboard:marketQuotes.offline')}
      </span>
    </div>
  );
}

function QuoteRow({
  quote,
  numberFormat,
  showSeparator,
}: {
  quote: MarketQuoteItem;
  numberFormat: 'point' | 'comma';
  showSeparator: boolean;
}) {
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
  const price = formatMarketQuotePrice(quote.last_price, quote.key, numberFormat);
  const changePct = quote.change_percent;
  const isUp = changePct !== null && changePct >= 0;
  const changeText = formatMarketQuoteChangePercent(changePct, numberFormat);
  const priceFlashClass =
    flash === 'up'
      ? 'market-quote-flash-up rounded px-0.5'
      : flash === 'down'
        ? 'market-quote-flash-down rounded px-0.5'
        : '';

  return (
    <div className="flex shrink-0 items-center gap-3">
      <div className={quoteIconContainerClass(quote.key)}>
        <MarketQuoteInstrumentIcon instrumentKey={quote.key} className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-2 whitespace-nowrap">
        <span className="text-sm font-semibold text-white/90">{label}</span>
        <span className={`text-sm tabular-nums text-white ${priceFlashClass}`}>
          {price}
        </span>
        <span
          className={`text-sm font-semibold tabular-nums ${
            changePct === null
              ? 'text-white/50'
              : isUp
                ? 'text-emerald-400'
                : 'text-red-400'
          }`}
        >
          {changeText}
        </span>
      </div>
      {showSeparator ? <div className="ml-1 hidden h-5 w-px bg-white/10 sm:block" aria-hidden /> : null}
    </div>
  );
}

function StatusContent({
  message,
  pulse,
}: {
  message: string;
  pulse: boolean;
}) {
  return (
    <span
      className={`whitespace-nowrap text-center text-sm text-white/80 ${pulse ? 'animate-pulse' : ''}`}
      role="status"
      aria-live="polite"
    >
      {message}
    </span>
  );
}

export const MarketQuotesTicker: React.FC = () => {
  const { t } = useTranslation();
  const { preferences } = usePreferences();
  const [topStepConfigured, setTopStepConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await integrationsService.listIntegrations();
        if (cancelled) return;
        const topstepx = data.integrations.find((item) => item.provider === 'topstepx');
        setTopStepConfigured(Boolean(topstepx?.configured));
      } catch {
        if (!cancelled) {
          setTopStepConfigured(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const { snapshot, loading, wsConnected } = useMarketQuotes(topStepConfigured === true);
  const numberFormat = preferences.number_format;

  const quotes = useMemo(
    () => (snapshot?.quotes ?? []).filter((q) => q.last_price != null),
    [snapshot?.quotes],
  );
  const hasPrices = quotes.length > 0;

  const tickerTitle = t('dashboard:marketQuotes.title');

  const statusMessage = useMemo(() => {
    if (topStepConfigured === false) {
      return t('dashboard:marketQuotes.missing_credentials');
    }
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
  }, [hasPrices, loading, snapshot, t, topStepConfigured]);

  const statusPulse =
    (loading && !snapshot) || snapshot?.message === 'connecting';

  const isLive = hasPrices && (snapshot?.connected === true || wsConnected);

  const tickerContent = statusMessage ? (
    <div className={TICKER_ROW_CLASS}>
      <LiveStatus live={false} />
      <VerticalRule />
      <StatusContent message={statusMessage} pulse={statusPulse} />
    </div>
  ) : (
    <>
      <div className={TICKER_ROW_CLASS} aria-live="polite">
        <LiveStatus live={isLive} />
        <VerticalRule />
        {quotes.map((quote, index) => (
          <QuoteRow
            key={quote.key}
            quote={quote}
            numberFormat={numberFormat}
            showSeparator={index < quotes.length - 1}
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
      `}</style>
    </>
  );

  return <TickerShell ariaLabel={tickerTitle}>{tickerContent}</TickerShell>;
};

export default MarketQuotesTicker;
