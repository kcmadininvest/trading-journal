import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import historicalDataService, { type MarketInstrument } from '../../services/historicalData';

const FIELD_CLASS =
  'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100';

let cachedInstruments: MarketInstrument[] | null = null;
let inflight: Promise<MarketInstrument[]> | null = null;

function loadInstruments(): Promise<MarketInstrument[]> {
  if (cachedInstruments) {
    return Promise.resolve(cachedInstruments);
  }
  if (!inflight) {
    inflight = historicalDataService
      .listInstruments()
      .then((list) => {
        cachedInstruments = list;
        return list;
      })
      .catch((err) => {
        inflight = null;
        throw err;
      });
  }
  return inflight;
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
}

export function InstrumentPicker({ value, onChange, disabled, id }: InstrumentPickerProps) {
  const { t } = useTranslation('backtestJournal');
  const [instruments, setInstruments] = useState<MarketInstrument[]>(cachedInstruments || []);
  const [apiFailed, setApiFailed] = useState(false);
  const [loaded, setLoaded] = useState(Boolean(cachedInstruments));
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadInstruments()
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
  }, []);

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
  const showCustom = query.length > 0 && !exactMatch;

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
