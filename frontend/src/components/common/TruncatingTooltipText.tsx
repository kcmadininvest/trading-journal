import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '../ui';

export interface TruncatingTooltipTextProps {
  text: string;
  className?: string;
  wrapperClassName?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  triggerDisplay?: 'inline-flex' | 'inline-block' | 'block';
}

/** Texte tronqué : tooltip au survol / focus uniquement si ellipses actives. */
export const TruncatingTooltipText: React.FC<TruncatingTooltipTextProps> = ({
  text,
  className = 'block min-w-0 max-w-full truncate',
  wrapperClassName = 'min-w-0 max-w-full',
  position = 'top',
  triggerDisplay = 'block',
}) => {
  const { i18n } = useTranslation();
  const textRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  const measure = useCallback(() => {
    const el = textRef.current;
    if (!el) return;
    setIsTruncated(el.scrollWidth > el.clientWidth + 0.5);
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, text, i18n.language]);

  useEffect(() => {
    const el = textRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <Tooltip
      content={text}
      position={position}
      disabled={!isTruncated}
      triggerDisplay={triggerDisplay}
      className={wrapperClassName}
    >
      <span ref={textRef} className={className}>
        {text}
      </span>
    </Tooltip>
  );
};
