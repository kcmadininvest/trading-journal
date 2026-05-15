import React, { useMemo, useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { CustomSelect } from '../common/CustomSelect';
import { DateInput } from '../common/DateInput';
import { PositionStrategyPillBar } from '../common/PositionStrategyPillBar';
import { usePositionStrategiesForFilter } from '../../hooks/usePositionStrategiesForFilter';
import { Tooltip } from '../ui';

/** Texte tronqué : tooltip au survol / focus uniquement si ellipses actives. */
function StrategyToggleTruncatingLabel({ label }: { label: string }) {
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
    contract: string;
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

  const contractOptions = useMemo(() => [
    { value: '', label: t('trades:filters.instrument') },
    ...instruments.map((it) => ({ value: it, label: it }))
  ], [instruments, t]);

  const typeOptions = useMemo(() => [
    { value: '', label: t('trades:filters.type') },
    { value: 'Long', label: t('trades:long') },
    { value: 'Short', label: t('trades:short') }
  ], [t]);

  const profitableOptions = useMemo(() => [
    { value: '', label: t('trades:filters.pnl') },
    { value: 'true', label: t('trades:filters.winners') },
    { value: 'false', label: t('trades:filters.losers') }
  ], [t]);

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

  const strategyToggleItemClass =
    'min-w-0 flex-1 inline-flex items-center justify-center rounded-md px-1.5 py-1.5 text-[11px] font-medium leading-tight ' +
    'transition-[color,background-color,box-shadow] duration-200 ease-out ' +
    'text-gray-500 hover:bg-gray-100/90 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700/50 dark:hover:text-gray-200 ' +
    'data-[state=on]:relative data-[state=on]:z-10 data-[state=on]:bg-blue-600 data-[state=on]:text-white ' +
    'data-[state=on]:shadow-[0_3px_12px_-1px_rgba(37,99,235,0.55),0_2px_6px_-1px_rgba(15,23,42,0.18)] ' +
    'data-[state=on]:hover:bg-blue-600 dark:data-[state=on]:bg-blue-500 dark:data-[state=on]:hover:bg-blue-500 ' +
    'dark:data-[state=on]:shadow-[0_4px_16px_-2px_rgba(59,130,246,0.5),0_2px_8px_rgba(0,0,0,0.35)] ' +
    'focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-700';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 md:p-5 mb-4 sm:mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-8 gap-3 items-end">
        <CustomSelect
          value={values.contract}
          onChange={(value) => onChange({ contract: value as string })}
          options={contractOptions}
        />
        <CustomSelect
          value={values.type}
          onChange={(value) => onChange({ type: value as '' | 'Long' | 'Short' })}
          options={typeOptions}
        />
        <DateInput
          value={values.start_date}
          onChange={(value) => onChange({ start_date: value })}
          className="w-full h-10 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <DateInput
          value={values.end_date}
          onChange={(value) => onChange({ end_date: value })}
          className="w-full h-10 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <CustomSelect
          value={values.profitable}
          onChange={(value) => onChange({ profitable: value as '' | 'true' | 'false' })}
          options={profitableOptions}
        />
        <div className="min-w-0 w-full">
          <ToggleGroup.Root
            type="single"
            value={strategyToggleValue}
            onValueChange={(v) => {
              const key = v || 'all';
              const row = strategyToggleItems.find((i) => i.radixValue === key);
              if (row) onChange({ has_strategy: row.hasStrategy });
            }}
            aria-label={t('trades:filters.strategy')}
            className="flex h-10 w-full min-w-0 items-stretch gap-0.5 overflow-visible rounded-md border border-gray-300 bg-white p-1 shadow-sm dark:border-gray-600 dark:bg-gray-700"
          >
            {strategyToggleItems.map((item) => (
              <ToggleGroup.Item
                key={item.radixValue}
                value={item.radixValue}
                aria-label={item.label}
                className={strategyToggleItemClass}
              >
                <StrategyToggleTruncatingLabel label={item.label} />
              </ToggleGroup.Item>
            ))}
          </ToggleGroup.Root>
        </div>
        <div className="min-w-0 w-full">
          <PositionStrategyPillBar
            value={values.position_strategy ? Number(values.position_strategy) : null}
            onChange={(id) => onChange({ position_strategy: id != null ? String(id) : '' })}
            strategies={strategies}
            disabled={loadingStrategies}
          />
        </div>
        <div className="w-full flex items-end">
          <button
            onClick={onReset}
            className="w-full h-10 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            {t('trades:reset')}
          </button>
        </div>
      </div>
    </div>
  );
};


