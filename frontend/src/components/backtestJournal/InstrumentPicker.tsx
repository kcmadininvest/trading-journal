import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import historicalDataService, { type MarketInstrument } from '../../services/historicalData';
import { marketReplayService } from '../../services/marketReplay';

const FIELD_CLASS =
  'mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100';

const catalogCache: { all: MarketInstrument[] | null; withBars: MarketInstrument[] | null } = {
  all: null,
  withBars: null,
};
const inflightByMode: {
  all: Promise<MarketInstrument[]> | null;
  withBars: Promise<MarketInstrument[]> | null;
} = { all: null, withBars: null };

function loadInstruments(withBarsOnly: boolean): Promise<MarketInstrument[]> {
  const mode = withBarsOnly ? 'withBars' : 'all';
  const cached = catalogCache[mode];
  if (cached) return Promise.resolve(cached);
  if (!inflightByMode[mode]) {
    const loader = withBarsOnly
      ? marketReplayService.listInstrumentsWithBars()
      : historicalDataService.listInstruments();
    inflightByMode[mode] = loader
      .then((list) => {
        catalogCache[mode] = list;
        return list;
      })
      .catch((err) => {
        inflightByMode[mode] = null;
        throw err;
      });
  }
  return inflightByMode[mode]!;
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

interface InstrumentPickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  /** Limite le catalogue aux instruments ayant déjà des bougies stockées. */
  withBarsOnly?: boolean;
}

export function InstrumentPicker({
  value,
  onChange,
  disabled,
  id,
  withBarsOnly = false,
}: InstrumentPickerProps) {
  const { t } = useTranslation('backtestJournal');
  const cacheKey = withBarsOnly ? 'withBars' : 'all';
  const [instruments, setInstruments] = useState<MarketInstrument[]>(catalogCache[cacheKey] || []);
  const [apiFailed, setApiFailed] = useState(false);
  const [loaded, setLoaded] = useState(Boolean(catalogCache[cacheKey]));
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadInstruments(withBarsOnly)
      .then((list) => {
        if (!cancelled) {
          setInstruments(list);
          setApiFailed(false);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInstruments([]);
          setApiFailed(true);
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [withBarsOnly]);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const query = value.trim();
  const filtered = useMemo(() => {
    if (!query) return instruments;
    const needle = normalize(query);
    return instruments.filter((item) => {
      const hay = `${item.instrument} ${item.name} ${item.broker_symbol}`;
      return normalize(hay).includes(needle);
    });
  }, [instruments, query]);

  const exactMatch = instruments.some(
    (item) => item.instrument.toUpperCase() === query.toUpperCase()
  );
  const listUnavailable = loaded && (apiFailed || instruments.length === 0);
  const showCustom = query.length > 0 && !exactMatch && !withBarsOnly;

  const pick = (code: string) => {
    onChange(code);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        className={FIELD_CLASS}
        value={value}
        disabled={disabled}
        autoComplete="off"
        maxLength={32}
        placeholder={
          listUnavailable ? t('instrumentTypePlaceholder') : t('instrumentSearchPlaceholder')
        }
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            if (filtered[0] && !showCustom) {
              pick(filtered[0].instrument);
            } else {
              setOpen(false);
            }
          }
          if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {open && !disabled && (instruments.length > 0 || showCustom) && (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {showCustom && (
            <li>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-700"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(query.toUpperCase())}
              >
                {t('instrumentUseCustom', { code: query.toUpperCase() })}
              </button>
            </li>
          )}
          {filtered.map((item) => (
            <li key={item.instrument}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(item.instrument)}
              >
                <span className="font-medium text-gray-900 dark:text-gray-100">{item.instrument}</span>
                {item.name && (
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">{item.name}</span>
                )}
              </button>
            </li>
          ))}
          {filtered.length === 0 && !showCustom && (
            <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{t('instrumentNoMatch')}</li>
          )}
        </ul>
      )}
      {listUnavailable && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('instrumentApiUnavailable')}</p>
      )}
    </div>
  );
}
