import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  addMovingAverage,
  colorForMa,
  countActiveIndicators,
  isValidMaPeriod,
  removeMovingAverage,
  toggleAvwap,
  toggleVwap,
  VWAP_COLOR,
  type MaKind,
  type PaneIndicators,
} from '../../utils/replayIndicators';

/** Périodes les plus utilisées (day / swing) : EMA 8–21, SMA 20/50/100/200. */
const MA_PERIODS = [5, 8, 9, 10, 12, 20, 21, 26, 50, 100, 200] as const;

interface IndicatorSelectProps {
  value: PaneIndicators;
  onChange: (next: PaneIndicators) => void;
  disabled?: boolean;
  /** Ouvre la barre de style AVWAP sur le panneau (comme une trend line). */
  onSelectAvwapStyle?: () => void;
}

export const IndicatorSelect: React.FC<IndicatorSelectProps> = ({
  value,
  onChange,
  disabled = false,
  onSelectAvwapStyle,
}) => {
  const { t } = useTranslation('marketReplay');
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<MaKind>('sma');
  const [customPeriod, setCustomPeriod] = useState('');
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 280,
    maxHeight: 360,
    placement: 'bottom' as 'bottom' | 'top',
  });

  const activeCount = countActiveIndicators(value);

  const toggleDropdown = () => {
    if (disabled) return;
    setOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!open || !buttonRef.current) return;

    const updatePosition = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportMargin = 16;
      const width = 280;
      const left = Math.max(
        viewportMargin,
        Math.min(rect.left, window.innerWidth - width - viewportMargin),
      );
      const spaceBelow = window.innerHeight - rect.bottom - viewportMargin;
      const spaceAbove = rect.top - viewportMargin;
      const minHeight = 280;
      let placement: 'bottom' | 'top' = 'bottom';
      let maxHeight = Math.max(minHeight, spaceBelow);
      let top = rect.bottom + 4;
      if (spaceBelow < minHeight && spaceAbove > spaceBelow) {
        placement = 'top';
        maxHeight = Math.max(minHeight, spaceAbove);
        top = rect.top - 4;
      }
      setDropdownPosition({ top, left, width, maxHeight, placement });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        open &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const onToggleMa = (period: number) => {
    const existing = value.mas.find((ma) => ma.kind === kind && ma.period === period);
    if (existing) {
      onChange(removeMovingAverage(value, existing.id));
      return;
    }
    onChange(addMovingAverage(value, kind, period));
  };

  const onSubmitCustomPeriod = () => {
    const period = Number.parseInt(customPeriod, 10);
    if (!isValidMaPeriod(period)) return;
    onChange(addMovingAverage(value, kind, period));
    setCustomPeriod('');
  };

  const customPeriodParsed = Number.parseInt(customPeriod, 10);
  const customPeriodInvalid =
    customPeriod.trim() !== '' && !isValidMaPeriod(customPeriodParsed);

  const menu = open && (
    <div
      ref={menuRef}
      className="fixed z-[9999] overflow-y-auto rounded-md border border-gray-200 bg-white p-2 text-[11px] shadow-lg dark:border-gray-700 dark:bg-gray-800"
      style={{
        top: `${dropdownPosition.top}px`,
        left: `${dropdownPosition.left}px`,
        width: `${dropdownPosition.width}px`,
        maxHeight: `${dropdownPosition.maxHeight}px`,
        ...(dropdownPosition.placement === 'top' ? { transform: 'translateY(-100%)' } : {}),
      }}
    >
      <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-gray-50 dark:hover:bg-gray-700">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: VWAP_COLOR }}
          aria-hidden
        />
        <input
          type="checkbox"
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
          checked={value.vwap}
          onChange={(e) => onChange(toggleVwap(value, e.target.checked))}
        />
        <span className="text-gray-900 dark:text-gray-100">{t('vwap')}</span>
      </label>
      <div className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-gray-50 dark:hover:bg-gray-700">
        <button
          type="button"
          className={`h-2.5 w-2.5 shrink-0 rounded-full border border-gray-300 dark:border-gray-500 ${
            value.avwap ? 'cursor-pointer ring-offset-1 hover:ring-1 hover:ring-blue-500' : 'cursor-default'
          }`}
          style={{ backgroundColor: value.avwapStyle.color }}
          title={t('avwapStyleHint')}
          aria-label={t('avwapStyle')}
          disabled={disabled || !value.avwap}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!value.avwap || !onSelectAvwapStyle) return;
            onSelectAvwapStyle();
            setOpen(false);
          }}
        />
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
            checked={value.avwap}
            onChange={(e) => {
              const enabled = e.target.checked;
              onChange(toggleAvwap(value, enabled));
              if (enabled) setOpen(false);
            }}
          />
          <span className="text-gray-900 dark:text-gray-100">{t('avwap')}</span>
        </label>
      </div>
      {value.avwap && value.avwapAnchor == null ? (
        <p className="px-1.5 pb-1 text-[10px] leading-snug text-purple-700 dark:text-purple-300">
          {t('avwapAnchorHint')}
        </p>
      ) : null}
      {value.avwap && value.avwapAnchor != null ? (
        <p className="px-1.5 pb-1 text-[10px] leading-snug text-gray-500 dark:text-gray-400">
          {t('avwapStyleHint')}
        </p>
      ) : null}

      <div className="mt-1 border-t border-gray-200 pt-2 dark:border-gray-700">
        <div className="mb-1.5 flex h-8 items-stretch gap-1 px-1">
          <button
            type="button"
            className={`h-full flex-1 rounded px-2 font-medium ${
              kind === 'sma'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
            onClick={() => setKind('sma')}
          >
            {t('sma')}
          </button>
          <button
            type="button"
            className={`h-full flex-1 rounded px-2 font-medium ${
              kind === 'ema'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
            }`}
            onClick={() => setKind('ema')}
          >
            {t('ema')}
          </button>
        </div>
        <p className="px-1 pb-1 text-[10px] text-gray-500 dark:text-gray-400">{t('maPeriod')}</p>
        <div className="grid grid-cols-4 gap-1 px-1 pb-1">
          {MA_PERIODS.map((period) => {
            const added = value.mas.some((ma) => ma.kind === kind && ma.period === period);
            return (
              <button
                key={period}
                type="button"
                onClick={() => onToggleMa(period)}
                aria-pressed={added}
                className={`h-8 rounded tabular-nums font-medium ${
                  added
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {period}
              </button>
            );
          })}
          <div className="relative h-8 rounded bg-gray-100 dark:bg-gray-700">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={customPeriod}
              aria-label={t('maPeriod')}
              placeholder=""
              onChange={(e) => setCustomPeriod(e.target.value.replace(/[^\d]/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSubmitCustomPeriod();
                }
              }}
              className="absolute inset-0 h-full w-full appearance-none border-0 bg-transparent p-0 text-center text-[11px] font-medium tabular-nums text-gray-900 outline-none dark:text-gray-100"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded border border-dashed border-gray-400 dark:border-gray-500"
            />
          </div>
        </div>
        {customPeriodInvalid ? (
          <p className="px-1 pt-1 text-[10px] text-amber-700 dark:text-amber-300">
            {t('invalidPeriod')}
          </p>
        ) : null}
        {value.mas.length === 0 ? (
          <p className="px-1.5 py-1 text-gray-500 dark:text-gray-400">{t('noMovingAverages')}</p>
        ) : (
          <ul className="space-y-0.5">
            {value.mas.map((ma, index) => (
              <li
                key={ma.id}
                className="flex items-center justify-between gap-2 rounded px-1.5 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <span className="flex min-w-0 items-center gap-1.5 text-gray-900 dark:text-gray-100">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: colorForMa(index) }}
                    aria-hidden
                  />
                  {t(ma.kind)} {ma.period}
                </span>
                <button
                  type="button"
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-base leading-none text-gray-500 hover:bg-gray-200 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-gray-100"
                  aria-label={t('removeIndicator')}
                  onClick={() => onChange(removeMovingAverage(value, ma.id))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div ref={dropdownRef} className="relative min-w-0">
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={toggleDropdown}
          aria-expanded={open}
          aria-label={t('indicatorsHint')}
          className="inline-flex h-6 min-w-[6.5rem] items-center justify-between gap-1.5 rounded border border-gray-300 bg-white px-2 text-[11px] shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700"
        >
          <span className="whitespace-nowrap text-gray-900 dark:text-gray-100">
            {activeCount > 0 ? `${t('indicators')} (${activeCount})` : t('indicators')}
          </span>
          <svg
            className={`h-3 w-3 shrink-0 text-gray-400 transition-transform dark:text-gray-500 ${open ? 'rotate-180' : ''}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      {open && typeof document !== 'undefined' && createPortal(menu, document.body)}
    </>
  );
};
