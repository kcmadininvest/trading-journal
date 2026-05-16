import React, { useMemo, useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { CustomMultiSelect } from '../common/CustomMultiSelect';
import { DateInput } from '../common/DateInput';
import { PositionStrategyPillBar } from '../common/PositionStrategyPillBar';
import { usePositionStrategiesForFilter } from '../../hooks/usePositionStrategiesForFilter';
import { Tooltip } from '../ui';

const FILTER_TOGGLE_ROOT_CLASS =
  'flex h-10 w-full min-w-0 items-stretch gap-0.5 rounded-md border border-gray-300 bg-white p-1 shadow-sm dark:border-gray-600 dark:bg-gray-700';

const FILTER_TOGGLE_ITEM_CLASS =
  'min-w-0 flex-1 inline-flex items-center justify-center rounded-md px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium leading-tight transition-all duration-200 ' +
  'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 ' +
  'data-[state=on]:bg-blue-600 data-[state=on]:font-semibold data-[state=on]:text-white data-[state=on]:shadow-sm ' +
  'data-[state=on]:hover:bg-blue-600 dark:data-[state=on]:bg-blue-500 dark:data-[state=on]:hover:bg-blue-500 ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-700';

const FILTER_LABEL_CLASS = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2';

function FilterField({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 w-full flex flex-col ${className}`.trim()}>
      <span className={FILTER_LABEL_CLASS}>{label}</span>
      {children}
    </div>
  );
}

/** Texte tronqué : tooltip au survol / focus uniquement si ellipses actives. */
function FilterToggleTruncatingLabel({ label }: { label: string }) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  const measure = useCallback(() => {
    const el = textRef.current;
    if (!el) return;
    setIsTruncated(el.scrollWidth > el.clientWidth + 0.5);
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, label]);

  useEffect(() => {
    const el = textRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <Tooltip
      content={label}
      position="top"
      disabled={!isTruncated}
      triggerDisplay="block"
      className="flex h-full min-w-0 w-full max-w-full items-center justify-center"
    >
      <span ref={textRef} className="block min-w-0 max-w-full truncate text-center">
        {label}
      </span>
    </Tooltip>
  );
}

interface TradesFiltersProps {
  values: {
    contract: string[];
    type: '' | 'Long' | 'Short';
    start_date: string;
    end_date: string;
    profitable: '' | 'true' | 'false';
    has_strategy: '' | 'true' | 'false';
    position_strategy: string;
  };
  instruments?: string[];
  onChange: (next: Partial<TradesFiltersProps['values']>) => void;
  onReset: () => void;
}

export const TradesFilters: React.FC<TradesFiltersProps> = ({ values, instruments = [], onChange, onReset }) => {
  const { t } = useI18nTranslation();
  const { strategies, loading: loadingStrategies } = usePositionStrategiesForFilter();

  const contractOptions = useMemo(
    () => instruments.map((it) => ({ value: it, label: it })),
    [instruments]
  );

  const typeToggleItems = useMemo(
    () =>
      [
        { radixValue: 'short' as const, tradeType: 'Short' as const, label: t('trades:short') },
        { radixValue: 'all' as const, tradeType: '' as const, label: t('trades:filters.typeNeutral') },
        { radixValue: 'long' as const, tradeType: 'Long' as const, label: t('trades:long') },
      ],
    [t]
  );

  const typeToggleValue =
    values.type === 'Short' ? 'short' : values.type === 'Long' ? 'long' : 'all';

  const pnlToggleItems = useMemo(
    () =>
      [
        { radixValue: 'losers' as const, profitable: 'false' as const, label: t('trades:filters.losers') },
        { radixValue: 'all' as const, profitable: '' as const, label: t('trades:filters.pnlNeutral') },
        { radixValue: 'winners' as const, profitable: 'true' as const, label: t('trades:filters.winners') },
      ],
    [t]
  );

  const pnlToggleValue =
    values.profitable === 'false' ? 'losers' : values.profitable === 'true' ? 'winners' : 'all';

  const strategyToggleItems = useMemo(
    () =>
      [
        { radixValue: 'without' as const, hasStrategy: 'false' as const, label: t('trades:filters.withoutStrategy') },
        { radixValue: 'all' as const, hasStrategy: '' as const, label: t('trades:filters.strategyNeutral') },
        { radixValue: 'with' as const, hasStrategy: 'true' as const, label: t('trades:filters.withStrategy') },
      ],
    [t]
  );

  const strategyToggleValue =
    values.has_strategy === 'false' ? 'without' : values.has_strategy === 'true' ? 'with' : 'all';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 md:p-5 mb-4 sm:mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-8 gap-3 items-end">
        <FilterField label={t('trades:filters.instrument')}>
          <CustomMultiSelect
            value={values.contract}
            onChange={(contract) => onChange({ contract })}
            options={contractOptions}
            placeholder={t('trades:filters.instrument')}
            clearLabel={t('trades:filters.allInstruments')}
            selectedCountLabel={(count) => t('trades:filters.instrumentsCount', { count })}
            searchable={contractOptions.length > 8}
          />
        </FilterField>
        <FilterField label={t('trades:filters.type')}>
          <ToggleGroup.Root
            type="single"
            value={typeToggleValue}
            onValueChange={(v) => {
              const key = v || 'all';
              const row = typeToggleItems.find((i) => i.radixValue === key);
              if (row) onChange({ type: row.tradeType });
            }}
            aria-label={t('trades:filters.type')}
            className={FILTER_TOGGLE_ROOT_CLASS}
          >
            {typeToggleItems.map((item) => (
              <ToggleGroup.Item
                key={item.radixValue}
                value={item.radixValue}
                aria-label={item.label}
                className={FILTER_TOGGLE_ITEM_CLASS}
              >
                <FilterToggleTruncatingLabel label={item.label} />
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
        </FilterField>
        <FilterField label={t('trades:startDate')}>
          <DateInput
            value={values.start_date}
            onChange={(value) => onChange({ start_date: value })}
            className="w-full h-10 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </FilterField>
        <FilterField label={t('trades:endDate')}>
          <DateInput
            value={values.end_date}
            onChange={(value) => onChange({ end_date: value })}
            className="w-full h-10 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </FilterField>
        <FilterField label={t('trades:filters.pnl')}>
          <ToggleGroup.Root
            type="single"
            value={pnlToggleValue}
            onValueChange={(v) => {
              const key = v || 'all';
              const row = pnlToggleItems.find((i) => i.radixValue === key);
              if (row) onChange({ profitable: row.profitable });
            }}
            aria-label={t('trades:filters.pnl')}
            className={FILTER_TOGGLE_ROOT_CLASS}
          >
            {pnlToggleItems.map((item) => (
              <ToggleGroup.Item
                key={item.radixValue}
                value={item.radixValue}
                aria-label={item.label}
                className={FILTER_TOGGLE_ITEM_CLASS}
              >
                <FilterToggleTruncatingLabel label={item.label} />
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
        </FilterField>
        <FilterField label={t('trades:filters.strategy')}>
          <ToggleGroup.Root
            type="single"
            value={strategyToggleValue}
            onValueChange={(v) => {
              const key = v || 'all';
              const row = strategyToggleItems.find((i) => i.radixValue === key);
              if (row) onChange({ has_strategy: row.hasStrategy });
            }}
            aria-label={t('trades:filters.strategy')}
            className={FILTER_TOGGLE_ROOT_CLASS}
          >
            {strategyToggleItems.map((item) => (
              <ToggleGroup.Item
                key={item.radixValue}
                value={item.radixValue}
                aria-label={item.label}
                className={FILTER_TOGGLE_ITEM_CLASS}
              >
                <FilterToggleTruncatingLabel label={item.label} />
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
        </FilterField>
        <FilterField label={t('trades:filters.positionStrategy')}>
          <PositionStrategyPillBar
            value={values.position_strategy ? Number(values.position_strategy) : null}
            onChange={(id) => onChange({ position_strategy: id != null ? String(id) : '' })}
            strategies={strategies}
            disabled={loadingStrategies}
          />
        </FilterField>
        <div className="w-full flex flex-col justify-end">
          <button
            type="button"
            onClick={onReset}
            aria-label={t('trades:reset')}
            className="w-full h-10 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
          >
            {t('trades:reset')}
          </button>
        </div>
      </div>
    </div>
  );
};


