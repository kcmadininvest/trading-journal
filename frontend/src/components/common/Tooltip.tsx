import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  content: string | React.ReactNode;
  children: React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

function Tooltip({ content, children, placement = 'top', className = '' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const gutter = 8;

    let top = 0;
    let left = 0;

    switch (placement) {
      case 'bottom':
        top = triggerRect.bottom + gutter;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.left - tooltipRect.width - gutter;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.right + gutter;
        break;
      case 'top':
      default:
        top = triggerRect.top - tooltipRect.height - gutter;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
    }

    // Clamp within viewport
    if (left < gutter) left = gutter;
    if (left + tooltipRect.width > viewportWidth - gutter) left = viewportWidth - gutter - tooltipRect.width;
    if (top < gutter) top = gutter;
    if (top + tooltipRect.height > viewportHeight - gutter) top = viewportHeight - gutter - tooltipRect.height;

    setPosition({ top, left });
  };

  useEffect(() => {
    if (isVisible) {
      updatePosition();
    }
  }, [isVisible, placement]);

  const handleMouseEnter = () => {
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  return (
    <>
      <div
        ref={triggerRef}
        className={`inline-block ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </div>
      
      {isVisible && (
        <div
          ref={tooltipRef}
          className="fixed z-50 px-3 py-2 text-xs text-gray-700 bg-white/95 border border-gray-200 rounded-lg shadow-lg pointer-events-none max-w-xs"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
          }}
        >
          {content}
          <div className={`absolute w-0 h-0 border-4 border-transparent ${
            placement === 'top' ? 'top-full left-1/2 transform -translate-x-1/2 border-t-white/95' :
            placement === 'bottom' ? 'bottom-full left-1/2 transform -translate-x-1/2 border-b-white/95' :
            placement === 'left' ? 'left-full top-1/2 transform -translate-y-1/2 border-l-white/95' :
            'right-full top-1/2 transform -translate-y-1/2 border-r-white/95'
          }`} />
        </div>
      )}
    </>
  );
}

export default Tooltip;
