import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import Tooltip from '../ui/Tooltip';
import type { PositionStrategy } from '../../services/positionStrategies';
import { getPillTriggerClasses } from '../dashboard/filterBarStyles';

export interface PositionStrategyPillBarProps {
  value: number | null;
  onChange: (strategyId: number | null) => void;
  strategies: PositionStrategy[];
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'band';
}

export const PositionStrategyPillBar: React.FC<PositionStrategyPillBarProps> = ({
  value,
  onChange,
  strategies,
  disabled = false,
  className = '',
  variant = 'default',
}) => {
  const { t } = useTranslation(['strategies']);
  const pillClasses = getPillTriggerClasses(variant);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });

  const allLabel = t('strategies:allStrategies');

  const displayLabel = useMemo(() => {
    if (value === null) return allLabel;
    const s = strategies.find((x) => x.id === value);
    return s?.title ?? t('strategies:positionStrategy');
  }, [value, strategies, allLabel, t]);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    let w = rect.width;
    const temp = document.createElement('span');
    temp.style.cssText =
      'visibility:hidden;position:absolute;white-space:nowrap;font-size:' +
      window.getComputedStyle(buttonRef.current).fontSize +
      ';font-family:' +
      window.getComputedStyle(buttonRef.current).fontFamily;
    document.body.appendChild(temp);
    temp.textContent = allLabel;
    w = Math.max(w, temp.offsetWidth + 48);
    strategies.forEach((s) => {
      temp.textContent = s.title;
      w = Math.max(w, temp.offsetWidth + 48);
    });
    document.body.removeChild(temp);
    w = Math.min(Math.max(w, 200), 360);
    const margin = 8;
    const vw = window.innerWidth;
    const maxW = Math.min(w, vw - margin * 2);
    let left = rect.left;
    left = Math.max(margin, Math.min(left, vw - maxW - margin));
    const top = rect.bottom + 4;
    setMenuPos({
      top,
      left,
      width: maxW,
    });
  }, [allLabel, strategies]);

  useEffect(() => {
    if (!open) return;
    const timerId = window.setTimeout(() => updatePosition(), 0);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.clearTimeout(timerId);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = e.target as Node;
      if (
        rootRef.current?.contains(el) ||
        menuRef.current?.contains(el)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const pick = (id: number | null) => {
    onChange(id);
    setOpen(false);
  };

  const menu =
    open &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        ref={menuRef}
        role="listbox"
        aria-label={t('strategies:positionStrategy')}
        className="fixed z-[9999] max-h-72 overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-gray-800"
        style={{
          top: menuPos.top,
          left: menuPos.left,
          width: menuPos.width,
          minWidth: menuPos.width,
        }}
      >
        <button
          type="button"
          role="option"
          aria-selected={value === null}
          onClick={() => pick(null)}
          className={`flex w-full items-center px-3 py-2 text-left text-sm transition-colors ${
            value === null
              ? 'bg-blue-50/90 font-medium text-blue-900 dark:bg-blue-950/45 dark:text-blue-100'
              : 'text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          {allLabel}
        </button>
        {strategies.map((s) => (
          <button
            key={s.id}
            type="button"
            role="option"
            aria-selected={value === s.id}
            onClick={() => pick(s.id)}
            className={`flex w-full items-center px-3 py-2 text-left text-sm transition-colors ${
              value === s.id
                ? 'bg-blue-50/90 font-medium text-blue-900 dark:bg-blue-950/45 dark:text-blue-100'
                : 'text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <span className="min-w-0 truncate" title={s.title}>
              {s.title}
            </span>
          </button>
        ))}
      </div>,
      document.body
    );

  return (
    <div ref={rootRef} className={`relative min-w-0 w-full max-w-full ${className}`.trim()}>
      <Tooltip content={displayLabel} position="top" delay={300} className="w-full min-w-0">
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => !disabled && setOpen((o) => !o)}
          className={`${pillClasses.trigger} ${pillClasses.style}`}
        >
          <span className="min-w-0 flex-1 truncate text-left">{displayLabel}</span>
          <svg
            className={`${pillClasses.chevron} ${open ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </Tooltip>
      {menu}
    </div>
  );
};

export interface PositionStrategyFilterFieldProps {
  value: number | null;
  onChange: (strategyId: number | null) => void;
  strategies: PositionStrategy[];
  loading?: boolean;
  /** Conteneur (largeur / flex), ex. w-full lg:min-w-0 lg:flex-1 lg:max-w-sm */
  className?: string;
  /** Libellé au-dessus ; défaut : strategies:positionStrategy */
  label?: string;
}

/** Libellé + pill « Toutes les stratégies » aligné dashboard */
export const PositionStrategyFilterField: React.FC<PositionStrategyFilterFieldProps> = ({
  value,
  onChange,
  strategies,
  loading = false,
  className = '',
  label,
}) => {
  const { t } = useTranslation('strategies');
  return (
    <div className={`w-full min-w-0 ${className}`.trim()}>
      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label ?? t('positionStrategy')}
      </label>
      <PositionStrategyPillBar
        value={value}
        onChange={onChange}
        strategies={strategies}
        disabled={loading}
      />
    </div>
  );
};
