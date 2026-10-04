import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  disabled?: boolean;
  className?: string;
  offset?: { x?: number; y?: number };
  triggerDisplay?: 'inline-flex' | 'inline-block' | 'block';
  contentClassName?: string;
}

const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 300,
  disabled = false,
  className = '',
  offset = { x: 0, y: 0 },
  triggerDisplay = 'inline-flex',
  contentClassName = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [isPositioned, setIsPositioned] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    if (disabled) return;
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
    setIsPositioned(false);
  };

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - 4;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = triggerRect.bottom + 2;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.left - tooltipRect.width - 4;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.right + 4;
        break;
    }

    // Ajustements pour éviter le débordement
    if (left < 8) left = 8;
    if (left + tooltipRect.width > viewportWidth - 8) {
      left = viewportWidth - tooltipRect.width - 8;
    }
    if (top < 8) top = 8;
    if (top + tooltipRect.height > viewportHeight - 8) {
      top = viewportHeight - tooltipRect.height - 8;
    }

    // Appliquer l'offset (pour bottom, offset négatif rapproche le tooltip)
    setTooltipPosition({ 
      top: top + (offset.y || 0), 
      left: left + (offset.x || 0) 
    });
    setIsPositioned(true);
  }, [position, offset]);

  useEffect(() => {
    if (isVisible) {
      // Utiliser requestAnimationFrame avec un délai pour s'assurer que le tooltip est rendu
      const updatePositionFrame = () => {
        // Double requestAnimationFrame pour s'assurer que le DOM est mis à jour
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            updatePosition();
          });
        });
      };
      
      updatePositionFrame();
      
      const handleResize = () => updatePosition();
      const handleScroll = () => updatePosition();
      
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleScroll, true);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [isVisible, position, updatePosition]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const getArrowClasses = () => {
    const baseClasses = 'absolute w-2 h-2 bg-white dark:bg-gray-800 backdrop-blur-sm border border-gray-200 dark:border-gray-700 transform rotate-45';
    
    switch (position) {
      case 'top':
        return `${baseClasses} bottom-[-4px] left-1/2 -translate-x-1/2 border-t-0 border-l-0`;
      case 'bottom':
        return `${baseClasses} top-[-4px] left-1/2 -translate-x-1/2 border-b-0 border-r-0`;
      case 'left':
        return `${baseClasses} right-[-4px] top-1/2 -translate-y-1/2 border-l-0 border-b-0`;
      case 'right':
        return `${baseClasses} left-[-4px] top-1/2 -translate-y-1/2 border-r-0 border-t-0`;
      default:
        return baseClasses;
    }
  };

  return (
    <>
      <div
        ref={triggerRef}
        className={`${triggerDisplay} align-middle ${className}`}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
      </div>
      
      {isVisible && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={tooltipRef}
            className="fixed z-50 px-3 py-2 font-sans text-sm font-normal text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg pointer-events-none max-w-xs break-words transition-opacity duration-150"
            style={{
              top: `${tooltipPosition.top}px`,
              left: `${tooltipPosition.left}px`,
              opacity: isPositioned ? 1 : 0,
            }}
          >
            {typeof content === 'string' ? (
              <span className={contentClassName}>{content}</span>
            ) : (
              <div className={contentClassName}>{content}</div>
            )}
            <div className={getArrowClasses()} />
          </div>,
          document.body
        )}
    </>
  );
};

export default Tooltip;

type Validatable = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function validationMessage(control: Validatable, t: (key: string) => string): string {
  if (control.validity.valueMissing) return t('requiredField');
  return t('invalidField');
}

function associatedForm(target: EventTarget | null): HTMLFormElement | null {
  if (!(target instanceof Element)) return null;
  const control = target.closest('button, input, select, textarea');
  if (
    control instanceof HTMLButtonElement ||
    control instanceof HTMLInputElement ||
    control instanceof HTMLSelectElement ||
    control instanceof HTMLTextAreaElement
  ) {
    if (control.form) return control.form;
  }
  return target.closest('form');
}

function firstInvalidControl(form: HTMLFormElement): Validatable | null {
  const controls = form.querySelectorAll<Validatable>('input, select, textarea');
  for (const control of controls) {
    if (control.willValidate && !control.validity.valid) return control;
  }
  return null;
}

function disarmNativeValidation(root: ParentNode) {
  if (root instanceof HTMLFormElement) root.noValidate = true;
  root.querySelectorAll('form').forEach((form) => {
    form.noValidate = true;
  });
}

/** Remplace la bulle native du navigateur (« Please fill out this field. ») par l'infobulle du projet. */
export function FormValidationTooltip() {
  const { t } = useTranslation('common');
  const tRef = useRef(t);
  tRef.current = t;
  const targetRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showCount, setShowCount] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isPositioned, setIsPositioned] = useState(false);
  const [below, setBelow] = useState(false);

  const place = useCallback(() => {
    const target = targetRef.current;
    const tip = tooltipRef.current;
    if (!target || !tip) return;
    const triggerRect = target.getBoundingClientRect();
    const tooltipRect = tip.getBoundingClientRect();
    let top = triggerRect.bottom + 8;
    let left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
    let placeBelow = true;
    if (left < 8) left = 8;
    if (left + tooltipRect.width > window.innerWidth - 8) {
      left = window.innerWidth - tooltipRect.width - 8;
    }
    if (top + tooltipRect.height > window.innerHeight - 8) {
      top = triggerRect.top - tooltipRect.height - 8;
      placeBelow = false;
    }
    setBelow(placeBelow);
    setPosition({ top, left });
    setIsPositioned(true);
  }, []);

  const hide = useCallback(() => {
    targetRef.current = null;
    setMessage(null);
    setIsPositioned(false);
  }, []);

  const show = useCallback((control: Validatable) => {
    targetRef.current = control;
    setIsPositioned(false);
    setMessage(validationMessage(control, (key) => tRef.current(key)));
    setShowCount((count) => count + 1);
    control.focus({ preventScroll: false });
  }, []);

  useEffect(() => {
    const arm = (event: Event) => {
      const form = associatedForm(event.target);
      if (form) form.noValidate = true;
      if (targetRef.current && event.target !== targetRef.current) hide();
    };

    const onSubmit = (event: Event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      form.noValidate = true;
      const invalid = firstInvalidControl(form);
      if (!invalid) {
        hide();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      show(invalid);
    };

    const onEdit = (event: Event) => {
      if (event.target === targetRef.current) hide();
    };

    disarmNativeValidation(document);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) disarmNativeValidation(node);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('focusin', arm, true);
    document.addEventListener('pointerdown', arm, true);
    document.addEventListener('submit', onSubmit, true);
    document.addEventListener('input', onEdit, true);
    document.addEventListener('change', onEdit, true);
    return () => {
      observer.disconnect();
      document.removeEventListener('focusin', arm, true);
      document.removeEventListener('pointerdown', arm, true);
      document.removeEventListener('submit', onSubmit, true);
      document.removeEventListener('input', onEdit, true);
      document.removeEventListener('change', onEdit, true);
    };
  }, [hide, show]);

  useEffect(() => {
    if (!message) return;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(place);
    });
    const onScroll = () => place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [message, showCount, place]);

  if (!message || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={tooltipRef}
      role="alert"
      className="fixed z-[60] px-3 py-2 font-sans text-sm font-normal text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg pointer-events-none max-w-xs break-words"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        opacity: isPositioned ? 1 : 0,
      }}
    >
      <span>{message}</span>
      <div
        className={`absolute w-2 h-2 bg-white dark:bg-gray-800 backdrop-blur-sm border border-gray-200 dark:border-gray-700 transform rotate-45 left-1/2 -translate-x-1/2 ${
          below ? 'top-[-4px] border-b-0 border-r-0' : 'bottom-[-4px] border-t-0 border-l-0'
        }`}
      />
    </div>,
    document.body,
  );
}
