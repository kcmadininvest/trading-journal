import React, { useState, useRef, useEffect, useCallback } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  disabled?: boolean;
  className?: string;
  offset?: { x?: number; y?: number };
}

const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 300,
  disabled = false,
  className = '',
  offset = { x: 0, y: 0 },
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
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
    const baseClasses = 'absolute w-2 h-2 bg-white/70 backdrop-blur-sm border border-gray-200 transform rotate-45';
    
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

  // Détecter si className contient "block" ou "w-full" pour utiliser block au lieu de inline-block
  // Utiliser une regex pour matcher les classes complètes et éviter les conflits avec "inline-block"
  const hasBlockClass = /\bblock\b/.test(className) && !/\binline-block\b/.test(className);
  const hasWFullClass = /\bw-full\b/.test(className);
  const displayClass = hasBlockClass || hasWFullClass ? 'block' : 'inline-block';
  
  return (
    <>
      <div
        ref={triggerRef}
        className={`${displayClass} ${className}`}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
      </div>
      
      {isVisible && (
        <div
          ref={tooltipRef}
          className="fixed z-50 px-3 py-2 text-sm font-normal text-gray-900 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg pointer-events-none max-w-xs break-words"
          style={{
            '--tooltip-top': tooltipPosition.top,
            '--tooltip-left': tooltipPosition.left,
            top: 'var(--tooltip-top)',
            left: 'var(--tooltip-left)',
          } as React.CSSProperties}
        >
          {content}
          <div className={getArrowClasses()} />
        </div>
      )}
    </>
  );
};

export default Tooltip;
